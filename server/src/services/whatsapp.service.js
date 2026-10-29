import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import config from '../config/index.js';
import logger from './logger.service.js';
import { isValidPhone, toWhatsAppJid, maskPhone } from '../utils/phone.js';

export const WhatsAppStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  AUTH_REQUIRED: 'auth_required',
  READY: 'ready'
};

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.status = WhatsAppStatus.DISCONNECTED;
    this.qrCodeDataUrl = null;
    this.qrRaw = null;
    this.lastError = null;
    this.authenticatedUser = null;
    this.isInitializing = false;
    this.isMock = config.whatsappMock;
    this.mockTimer = null;
  }

  /**
   * Initializes the WhatsApp client singleton.
   */
  async initialize() {
    if (this.isInitializing || this.status === WhatsAppStatus.READY) {
      return;
    }

    this.isInitializing = true;
    this.status = WhatsAppStatus.CONNECTING;
    this.lastError = null;
    this.emit('status_change', { status: this.status });
    logger.info('whatsapp', 'Initializing WhatsApp service...', { mock: this.isMock });

    if (this.isMock) {
      this._initializeMock();
      return;
    }

    try {
      // Ensure private session directory exists
      if (!fs.existsSync(config.whatsappSessionPath)) {
        fs.mkdirSync(config.whatsappSessionPath, { recursive: true });
      }

      // Clean stale chromium locks if a previous process died abruptly
      this._cleanStaleLocks();

      const puppeteerOptions = {
        headless: config.puppeteerHeadless ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--mute-audio',
          '--disable-notifications',
          '--renderer-process-limit=1',
          '--disable-features=Translate,BlinkGenPropertyTrees,AudioServiceOutOfProcess',
          '--js-flags=--max-old-space-size=192'
        ]
      };

      const resolvedExecutable = this._resolveChromiumPath();
      if (resolvedExecutable) {
        puppeteerOptions.executablePath = resolvedExecutable;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.whatsappSessionPath
        }),
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html'
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        puppeteer: puppeteerOptions
      });

      this._registerEvents();
      await this.client.initialize();
    } catch (err) {
      this.status = WhatsAppStatus.DISCONNECTED;
      this.lastError = err.message;
      this.isInitializing = false;
      logger.error('whatsapp', `Failed to initialize WhatsApp client: ${err.message}`);

      // Auto-heal corrupted sessions (e.g. from container restart during sync)
      const isCorruptedSession = err.message && (
        err.message.includes('Socket') ||
        err.message.includes('Evaluation failed') ||
        err.message.includes('Session closed') ||
        err.message.includes('Navigating frame was detached') ||
        err.message.includes('Execution context was destroyed')
      );

      if (isCorruptedSession) {
        logger.warn('whatsapp', 'Corrupted session detected. Automatically cleaning session directory and resetting...');
        try {
          if (fs.existsSync(config.whatsappSessionPath)) {
            fs.rmSync(config.whatsappSessionPath, { recursive: true, force: true });
          }
        } catch (cleanErr) {
          logger.warn('whatsapp', `Failed to clean corrupted session: ${cleanErr.message}`);
        }
        // Automatically attempt a clean initialization in 3 seconds
        setTimeout(() => {
          this.initialize().catch(() => {});
        }, 3000);
      }

      this.emit('status_change', { status: this.status, error: this.lastError });
    }
  }

  _registerEvents() {
    this.client.on('qr', async (qr) => {
      this.status = WhatsAppStatus.AUTH_REQUIRED;
      this.qrRaw = qr;
      this.isInitializing = false;
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        logger.info('whatsapp', 'QR code generated. Authentication required.');
        this.emit('qr', { qrDataUrl: this.qrCodeDataUrl });
        this.emit('status_change', { status: this.status });
      } catch (err) {
        logger.error('whatsapp', 'Failed to generate QR data URL:', err.message);
      }
    });

    this.client.on('ready', () => {
      this.status = WhatsAppStatus.READY;
      this.qrCodeDataUrl = null;
      this.qrRaw = null;
      this.isInitializing = false;
      this.lastError = null;
      const info = this.client.info || {};
      this.authenticatedUser = {
        pushname: info.pushname || 'User',
        wid: info.wid ? info.wid.user : null,
        phone: info.wid ? `+${info.wid.user}` : null
      };
      logger.info('whatsapp', `WhatsApp client is ready. Logged in as ${this.authenticatedUser.pushname}`);
      this.emit('ready', this.authenticatedUser);
      this.emit('status_change', { status: this.status, user: this.authenticatedUser });
    });

    this.client.on('loading_screen', (percent, message) => {
      logger.info('whatsapp', `WhatsApp synchronizing: ${percent}% - ${message}`);
    });

    this.client.on('authenticated', () => {
      logger.info('whatsapp', 'WhatsApp authentication handshake successful. Synchronizing messages...');
      this.status = WhatsAppStatus.CONNECTING;
      this.qrCodeDataUrl = null;
      this.qrRaw = null;
      this.emit('status_change', { status: this.status });
    });

    this.client.on('auth_failure', (msg) => {
      this.status = WhatsAppStatus.DISCONNECTED;
      this.lastError = `Authentication failed: ${msg}`;
      this.isInitializing = false;
      logger.error('whatsapp', this.lastError);
      this.emit('status_change', { status: this.status, error: this.lastError });
    });

    this.client.on('disconnected', (reason) => {
      this.status = WhatsAppStatus.DISCONNECTED;
      this.qrCodeDataUrl = null;
      this.authenticatedUser = null;
      this.isInitializing = false;
      this.lastError = `Disconnected: ${reason}`;
      logger.warn('whatsapp', `WhatsApp client disconnected. Reason: ${reason}`);
      this.emit('status_change', { status: this.status, error: this.lastError });
    });
  }

  _initializeMock() {
    this.isInitializing = false;
    // Generate sample QR code for mock mode
    QRCode.toDataURL('mock-whatsapp-session-pairing-code-antigravity', { width: 320, margin: 2 })
      .then(url => {
        this.qrCodeDataUrl = url;
        this.status = WhatsAppStatus.READY; // In mock mode, mark ready or auth_required
        this.authenticatedUser = {
          pushname: 'Mock Dev Account',
          wid: '919876543210',
          phone: '+919876543210'
        };
        logger.info('whatsapp', '[Mock Mode] WhatsApp simulated connection ready.');
        this.emit('ready', this.authenticatedUser);
        this.emit('status_change', { status: this.status, user: this.authenticatedUser });
      })
      .catch(err => {
        this.status = WhatsAppStatus.READY;
      });
  }

  /**
   * Set Mock mode explicitly (useful for testing).
   */
  setMockMode(enabled) {
    this.isMock = Boolean(enabled);
  }

  /**
   * Returns current WhatsApp connection status payload.
   */
  getStatus() {
    return {
      status: this.status,
      isMock: this.isMock,
      qrCodeDataUrl: this.status === WhatsAppStatus.AUTH_REQUIRED ? this.qrCodeDataUrl : null,
      authenticatedUser: this.authenticatedUser,
      lastError: this.lastError
    };
  }

  /**
   * Validates if a recipient phone number is valid and exists on WhatsApp.
   * @param {string} phoneNumber 
   * @returns {Promise<{ valid: boolean, jid?: string, error?: string }>}
   */
  async validateRecipient(phoneNumber) {
    if (!isValidPhone(phoneNumber)) {
      return {
        valid: false,
        error: 'Invalid phone number format. Must start with + country code followed by 8-15 digits (e.g. +919876543210).'
      };
    }

    if (this.isMock) {
      return {
        valid: true,
        jid: toWhatsAppJid(phoneNumber)
      };
    }

    if (this.status !== WhatsAppStatus.READY || !this.client) {
      return {
        valid: false,
        error: 'WhatsApp client is not ready. Please connect your account first.'
      };
    }

    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '');
      const numberId = await this.client.getNumberId(cleanDigits);
      if (!numberId) {
        return {
          valid: false,
          error: `Phone number ${maskPhone(phoneNumber)} is not registered on WhatsApp.`
        };
      }
      return {
        valid: true,
        jid: numberId._serialized
      };
    } catch (err) {
      // In case getNumberId has a transient network failure, fallback to formatted JID
      logger.warn('whatsapp', `Could not query getNumberId for ${maskPhone(phoneNumber)}: ${err.message}`);
      return {
        valid: true,
        jid: toWhatsAppJid(phoneNumber)
      };
    }
  }

  /**
   * Sends a text message to a recipient.
   * @param {string} phoneNumber - E.164 phone number
   * @param {string} message - Message text
   * @returns {Promise<{ success: boolean, messageId?: string, uncertain?: boolean, error?: string }>}
   */
  async sendMessage(phoneNumber, message) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return { success: false, error: 'Message cannot be empty.' };
    }

    if (this.status !== WhatsAppStatus.READY && !this.isMock) {
      return {
        success: false,
        error: `Cannot send message: WhatsApp client is ${this.status}.`
      };
    }

    const validation = await this.validateRecipient(phoneNumber);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const jid = validation.jid || toWhatsAppJid(phoneNumber);
    const masked = maskPhone(phoneNumber);

    if (this.isMock) {
      logger.info('whatsapp', `[Mock Mode] Simulated sending message to ${masked}`);
      const mockMsgId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return {
        success: true,
        messageId: mockMsgId
      };
    }

    try {
      logger.info('whatsapp', `Attempting to send message to ${masked}...`);
      
      // Promise race with timeout to detect uncertain network freezes
      const sendPromise = this.client.sendMessage(jid, message);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SEND_TIMEOUT_UNCERTAIN')), 25000)
      );

      const sentMsg = await Promise.race([sendPromise, timeoutPromise]);
      const messageId = sentMsg && sentMsg.id ? sentMsg.id._serialized || sentMsg.id.id : `msg_${Date.now()}`;

      logger.info('whatsapp', `Message sent successfully to ${masked}. Message ID: ${messageId}`);
      return {
        success: true,
        messageId
      };
    } catch (err) {
      if (err.message === 'SEND_TIMEOUT_UNCERTAIN') {
        logger.error('whatsapp', `Send timed out for ${masked}. Delivery status is UNCERTAIN.`);
        return {
          success: false,
          uncertain: true,
          error: 'Delivery status is uncertain. The message was dispatched to WhatsApp Web, but no acknowledgment was received before timeout. Resending automatically is unsafe.'
        };
      }

      logger.error('whatsapp', `Failed to send message to ${masked}: ${err.message}`);
      return {
        success: false,
        uncertain: false,
        error: err.message || 'Unknown WhatsApp send error'
      };
    }
  }

  /**
   * Safely logs out and removes the linked session.
   */
  async logout() {
    logger.info('whatsapp', 'Logging out from WhatsApp session...');
    this.status = WhatsAppStatus.DISCONNECTED;
    this.authenticatedUser = null;
    this.qrCodeDataUrl = null;
    this.qrRaw = null;

    if (this.isMock) {
      this.emit('status_change', { status: this.status });
      return { success: true };
    }

    try {
      if (this.client) {
        try {
          await this.client.logout();
        } catch (e) {
          logger.warn('whatsapp', `Client logout error: ${e.message}`);
        }
        try {
          await this.client.destroy();
        } catch (e) {
          logger.warn('whatsapp', `Client destroy error: ${e.message}`);
        }
        this.client = null;
      }

      // Safely delete session directory
      if (fs.existsSync(config.whatsappSessionPath)) {
        fs.rmSync(config.whatsappSessionPath, { recursive: true, force: true });
        logger.info('whatsapp', 'Deleted local WhatsApp session folder.');
      }

      this.emit('status_change', { status: this.status });
      return { success: true };
    } catch (err) {
      logger.error('whatsapp', `Error during logout: ${err.message}`);
      throw err;
    }
  }

  /**
   * Cleans stale Chromium lock files if the previous process crashed.
   */
  _cleanStaleLocks() {
    try {
      const sessionDir = path.join(config.whatsappSessionPath, 'session');
      if (fs.existsSync(sessionDir)) {
        const lockNames = ['lockfile', 'SingletonLock', 'SingletonCookie', 'SingletonSocket'];
        for (const name of lockNames) {
          const lockPath = path.join(sessionDir, name);
          if (fs.existsSync(lockPath)) {
            try {
              fs.rmSync(lockPath, { force: true });
              logger.info('whatsapp', `Removed stale Chromium lockfile: ${name}`);
            } catch (err) {
              logger.warn('whatsapp', `Could not remove stale lockfile ${name}: ${err.message}`);
            }
          }
        }
      }
    } catch (e) {
      // Ignore directory read errors
    }
  }

  /**
   * Resolves Chromium executable path, checking environment variable or system binaries.
   */
  _resolveChromiumPath() {
    if (config.puppeteerExecutablePath) {
      return config.puppeteerExecutablePath;
    }
    if (process.platform === 'linux') {
      const candidates = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome'
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
    }
    return undefined;
  }

  /**
   * Reconnects WhatsApp client safely by clearing stale state and restarting.
   */
  async reconnect() {
    logger.info('whatsapp', 'Reconnecting WhatsApp client...');
    await this.destroy();
    this.status = WhatsAppStatus.DISCONNECTED;
    this.isInitializing = false;
    this.qrCodeDataUrl = null;
    this.qrRaw = null;
    this.lastError = null;
    return this.initialize();
  }

  /**
   * Safely terminates client on app shutdown.
   */
  async destroy() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        // ignore on shutdown
      }
      this.client = null;
    }
    this._cleanStaleLocks();
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;
