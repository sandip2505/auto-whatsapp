import whatsappService, { WhatsAppStatus } from '../services/whatsapp.service.js';
import logger from '../services/logger.service.js';

export async function getStatus(req, res, next) {
  try {
    const statusData = whatsappService.getStatus();
    res.json({
      success: true,
      data: statusData
    });
  } catch (err) {
    next(err);
  }
}

export async function getQr(req, res, next) {
  try {
    const statusData = whatsappService.getStatus();
    if (statusData.status !== WhatsAppStatus.AUTH_REQUIRED || !statusData.qrCodeDataUrl) {
      return res.status(200).json({
        success: true,
        data: {
          qrCodeDataUrl: null,
          message: 'Authentication QR code is not currently required or available.'
        }
      });
    }

    res.json({
      success: true,
      data: {
        qrCodeDataUrl: statusData.qrCodeDataUrl
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    logger.info('api', 'User requested WhatsApp logout.');
    await whatsappService.logout();
    res.json({
      success: true,
      message: 'Logged out successfully and local session data cleaned.'
    });
  } catch (err) {
    next(err);
  }
}

export async function reconnect(req, res, next) {
  try {
    logger.info('api', 'User requested WhatsApp reconnection.');
    await whatsappService.initialize();
    res.json({
      success: true,
      message: 'WhatsApp reconnection initiated.'
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getStatus,
  getQr,
  logout,
  reconnect
};
