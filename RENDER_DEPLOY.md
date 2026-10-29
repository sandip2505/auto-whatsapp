# 🚀 Render Deployment & Live Setup Guide

This guide explains how to deploy **WhatsApp Message Scheduler** to **[Render](https://render.com)**, connect your WhatsApp account, and ensure all scheduled messages trigger reliably **even when your browser tab is closed**.

---

## 📌 Table of Contents
1. [How the Scheduler Runs in the Background (Closing the Tab)](#1-how-the-scheduler-runs-in-the-background)
2. [Recommended Deployment: Docker on Render (Zero Configuration)](#2-recommended-deployment-docker-on-render)
3. [Connecting WhatsApp after Going Live](#3-connecting-whatsapp-after-going-live)
4. [Preventing Free Tier Sleep (Keep-Alive Setup)](#4-preventing-free-tier-sleep-keep-alive-setup)
5. [Free Tier vs. Render Starter Plan (Persistent Storage)](#5-free-tier-vs-render-starter-plan)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Pre-Flight Verification Checklist](#7-pre-flight-verification-checklist)

---

## 1. How the Scheduler Runs in the Background

> **Key Rule**: The scheduler engine runs on the **Node.js backend server**, NOT in your browser!

- When you schedule a message, it is stored in the server's SQLite database (`scheduler.db`).
- Every second, the backend checks for due messages and dispatches them via WhatsApp Web.
- **You can safely close the browser tab or shut down your personal computer**: the cloud server will keep running and sending scheduled messages until tasks are completed.

---

## 2. Recommended Deployment: Docker on Render

Because WhatsApp Web (`whatsapp-web.js`) uses headless Chromium, deploying via **Docker** is the cleanest and most reliable method (all required Linux libraries and Chromium are bundled automatically).

### Step-by-Step Instructions:

1. **Push your code to GitHub / GitLab**:
   ```bash
   git add .
   git commit -m "feat: render deployment configuration, keep-alive, and tests"
   git push origin main
   ```

2. **Log in to [Render Dashboard](https://dashboard.render.com/)**:
   - Click **New +** > **Web Service**.
   - Connect your GitHub repository (`auto-whatsapp` or `whatsapp-message-scheduler`).

3. **Configure the Web Service**:
   - **Name**: `whatsapp-message-scheduler` (or your preferred name)
   - **Region**: Choose the region closest to you (e.g., `Singapore` or `Frankfurt`).
   - **Runtime**: Select **Docker** (Render will automatically detect the [Dockerfile](file:///d:/NodeJs/whatsapp/Dockerfile)).
   - **Instance Type**: **Free** (or **Starter** for 24/7 persistent storage).

4. **Add Environment Variables** (under *Advanced*):
   | Key | Value | Description |
   |-----|-------|-------------|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `5000` | Port listened by Express |
   | `HOST` | `0.0.0.0` | Bind address for cloud routing |
   | `DEFAULT_TIMEZONE` | `Asia/Kolkata` | Your local timezone (e.g. `America/New_York`, `Asia/Kolkata`) |
   | `DEFAULT_COUNTRY_CODE` | `+91` | Your default dial code |
   | `WHATSAPP_MOCK` | `false` | Real WhatsApp live session |
   | `KEEP_ALIVE` | `true` | Keeps Render free tier awake |

5. **Set Health Check Path**:
   - Health Check Path: `/api/health`

6. **Deploy**:
   - Click **Create Web Service**.
   - Render will build the Docker container and start your service.
   - Once deployment completes, you will receive a public URL (e.g., `https://whatsapp-scheduler-xxxx.onrender.com`).

---

## 3. Connecting WhatsApp after Going Live

Once your Render service is live:

1. Open your public Render URL in any browser:
   ```
   https://your-service-name.onrender.com
   ```
2. In the navigation sidebar, click on **WhatsApp Connection**.
3. You will see a live QR code.
4. On your mobile phone:
   - Open **WhatsApp**.
   - Go to **Settings** (or triple dots on Android) > **Linked Devices**.
   - Tap **Link a Device** and point your phone camera at the QR code on your screen.
5. Within 5–10 seconds, the status will turn **Connected** (Green badge) displaying your linked phone number and profile name.
6. Now you can create your schedules (One-time, Daily, Weekly, Intervals, Auto-increment counter).
7. **Close your browser tab!** The server will execute every scheduled message on time.

---

## 4. Preventing Free Tier Sleep (Keep-Alive Setup)

Render's Free Tier automatically puts web services to sleep after 15 minutes of inbound HTTP inactivity.

### Method A: Built-in Keep-Alive (Automatic)
Your server now has a built-in keep-alive pinger.
When deployed on Render, Render automatically sets the environment variable `RENDER_EXTERNAL_URL`. The server pings its own `/api/health` endpoint every 10 minutes through Render's public router, preventing the 15-minute sleep timer from expiring.

### Method B: Free External Uptime Monitor (100% Recommended Backup)
To guarantee 24/7 uptime without relying solely on internal pings:
1. Go to **[UptimeRobot](https://uptimerobot.com)** (Free).
2. Click **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `WhatsApp Scheduler Keep-Alive`
   - **URL (or IP)**: `https://your-service-name.onrender.com/api/health`
   - **Monitoring Interval**: `5 minutes` or `10 minutes`.
3. Save the monitor. This sends an HTTP ping every 5–10 minutes, ensuring your Render server never sleeps.

---

## 5. Free Tier vs. Render Starter Plan

| Feature | Render Free Tier | Render Starter Plan ($7/mo) |
|---|---|---|
| **Monthly Free Hours** | 750 hours/month (enough for 1 service 24/7) | Unlimited |
| **Sleep after 15 mins** | Yes (prevented via Keep-Alive/UptimeRobot) | Never sleeps |
| **Filesystem / Storage** | Ephemeral (resets on container restart) | Persistent Disk available ($0.25/GB/mo) |
| **WhatsApp Session** | Kept in active RAM/disk while awake | 100% persisted across reboots |
| **Recommended For** | Personal tasks, batch campaigns | Production mission-critical 24/7 scheduling |

> 💡 **Tip for Free Tier**: As long as you keep the service awake with UptimeRobot, the container will remain running and keep your WhatsApp session active. If Render ever restarts the container (e.g. during maintenance), simply reopen the dashboard and scan the QR code again.

---

## 6. Environment Variables Reference

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | Port listened by server |
| `HOST` | `0.0.0.0` | Network interface (0.0.0.0 required for Docker/Render) |
| `NODE_ENV` | `production` | Node environment |
| `CLIENT_URL` | *(empty)* | Allowed CORS origin (leave empty to allow same-host & *.onrender.com) |
| `DATA_DIR` | `./data` | Custom folder for SQLite and session storage (e.g. `/var/data` for persistent disks) |
| `DEFAULT_TIMEZONE` | `Asia/Kolkata` | Default IANA timezone |
| `DEFAULT_COUNTRY_CODE` | `+91` | Default phone dial code |
| `WHATSAPP_MOCK` | `false` | Set `true` only for testing without scanning real WhatsApp |
| `KEEP_ALIVE` | `true` | Enables periodic self-ping |
| `KEEP_ALIVE_INTERVAL_MINUTES` | `10` | Frequency of keep-alive pings |

---

## 7. Pre-Flight Verification Checklist

Before you push to live, verify that all local checks pass:

- [x] All 42 automated tests pass (`npm test`).
- [x] Host binding configured to `0.0.0.0`.
- [x] Cross-Origin (CORS) handles Render subdomains (`*.onrender.com`).
- [x] Puppeteer memory flags optimized for cloud containers (`--single-process`, `--disable-dev-shm-usage`, etc.).
- [x] Stale Chromium lockfiles auto-cleaned upon restart.
- [x] Keep-alive background pinger implemented to prevent Free Tier sleep.
- [x] Client production build verified (`npm run build`).
- [x] Dockerfile and `render.yaml` created and ready.
