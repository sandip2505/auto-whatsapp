# Personal WhatsApp Message Scheduler — Node.js & React

A local, full-stack, enterprise-grade personal scheduling application that enables you to schedule one-time and recurring WhatsApp messages to specific phone numbers at exact dates and times. The application runs locally on your computer and links securely with your personal WhatsApp account using WhatsApp Web's Linked Devices feature (`whatsapp-web.js` + `LocalAuth`).

---

## Table of Contents

1. [Features](#features)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Windows Setup & Installation](#windows-setup--installation)
4. [Running the Application](#running-the-application)
5. [Linking Your Personal WhatsApp Account (QR Code)](#linking-your-personal-whatsapp-account-qr-code)
6. [Creating Your First Recurring Schedule](#creating-your-first-recurring-schedule)
7. [Scheduling Engine & Guarantees](#scheduling-engine--guarantees)
   - [Offline Handling & Missed-Job Policy](#offline-handling--missed-job-policy)
   - [Delivery States: Attempted vs Accepted vs Confirmed](#delivery-states-attempted-vs-accepted-vs-confirmed)
   - [Duplicate Send & Overlap Prevention](#duplicate-send--overlap-prevention)
8. [Automated Testing & Mock Mode](#automated-testing--mock-mode)
9. [Database Backup & Restore](#database-backup--restore)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Privacy & Security Protections](#privacy--security-protections)
12. [Feature Roadmap & Ideas (FEATURES.md)](FEATURES.md)

---

## Features

- **WhatsApp Web Integration**: Scan a QR code to link your account using WhatsApp Linked Devices. Authenticated sessions are securely persisted locally via `LocalAuth`.
- **Flexible Scheduling**:
  - **One-time**: Exact future date and time.
  - **Every 10 Minutes**: Triggers continuously every 10 minutes (:00, :10, :20, :30, :40, :50) in your timezone.
  - **Daily**: Runs every day at a configured time (e.g., 09:00 AM).
  - **Weekly**: Runs on selected days of the week (e.g., Mondays & Fridays).
  - **Monthly**: Runs on a specific day of the month (1–31) with smart month-end clamping (e.g., 31st clamps to 28th/29th in February).
- **Timezone Awareness**: Full IANA timezone support, defaulting to `Asia/Kolkata` (+05:30) with daylight saving handling for international zones.
- **Human-Readable Confirmation**: Displays plain-English previews before enabling any schedule (e.g., *"Send 'Good morning!' to +919876543210 every day at 09:00 AM IST"*).
- **Full Schedule Management**: Search, filter, view details, pause/resume, edit, duplicate, and delete schedules.
- **Audit & Execution History**: Tracks every scheduled occurrence key uniquely with recipient phone masking (`+91 98****3210`), message snippet, WhatsApp message ID, attempt count, and error codes.
- **Ambiguity & Duplicate Prevention**: Unambiguous status lifecycle (`pending`, `sending`, `accepted`, `failed`, `skipped`, `uncertain`). Uncertain network timeouts require explicit user confirmation before retrying to prevent duplicate messages.
- **Modern React SaaS UI**: Clean minimal aesthetic, white surfaces, emerald-green WhatsApp accents, real-time timezone clock, and responsive controls with Lucide icons.
- **Zero Cloud Costs**: Runs entirely on your local machine using SQLite.

---

## Architecture & Technology Stack

- **Backend**: Node.js LTS (v20+) with Express.js (`127.0.0.1` binding)
- **Database**: SQLite with WAL mode, foreign keys, and unique occurrence constraints (`sqlite3` & `sqlite`)
- **WhatsApp Engine**: `whatsapp-web.js` with `puppeteer` and `LocalAuth`
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React
- **Timezone & Calculations**: `luxon` (IANA-compliant)
- **Automated Test Runner**: Node.js native test runner (`node --test`)

---

## Windows Setup & Installation

### 1. Prerequisites
- **Operating System**: Windows 10 or Windows 11
- **Node.js**: Node.js 20.x LTS or higher
- **Browser**: Google Chrome or Microsoft Edge (installed by default on Windows)

### 2. Clone or Open Workspace
Open PowerShell in the project directory:
```powershell
cd d:\NodeJs\whatsapp
```

### 3. Install Dependencies
Run npm install from the root directory to install all monorepo dependencies:
```powershell
npm install
npm --prefix server install
npm --prefix client install
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```

Review the `.env` settings:
```ini
PORT=5000
HOST=127.0.0.1
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_PATH=./data/scheduler.db
WHATSAPP_SESSION_PATH=./data/whatsapp_session
DEFAULT_TIMEZONE=Asia/Kolkata
DEFAULT_COUNTRY_CODE=+91
MISSED_JOB_POLICY=skip
WHATSAPP_MOCK=false
```

### 5. Initialize the SQLite Database
Run the database migration script:
```powershell
npm run db:migrate
```

---

## Running the Application

### Development Mode (Recommended)
Starts both the Express backend (`http://127.0.0.1:5000`) and the Vite React frontend (`http://127.0.0.1:5173`):
```powershell
npm run dev
```
Open your browser and navigate to:
```
http://localhost:5173
```

### Production / Standalone Mode
Build the React production bundle and run the unified server:
```powershell
npm run build
npm start
```
Navigate to:
```
http://127.0.0.1:5000
```

---

## Linking Your Personal WhatsApp Account (QR Code)

1. Start the application and open the dashboard in your browser.
2. In the left navigation sidebar, click **WhatsApp Connection**.
3. A QR code will be generated on screen.
4. On your mobile phone, open **WhatsApp**:
   - **Android**: Tap the three vertical dots `⋮` at the top right > **Linked Devices**.
   - **iPhone**: Go to **Settings** > **Linked Devices**.
5. Tap **Link a Device**.
6. Point your phone camera at the QR code on your computer screen.
7. Once scanned, the status badge will immediately turn to **Connected (Ready)** and display your WhatsApp push name.

> **Note**: Your session credentials are saved exclusively on your local computer in `./data/whatsapp_session`. The application never sees or stores your phone password, PIN, or message logs.

---

## Creating Your First Recurring Schedule

1. In the sidebar, click **Create Schedule**.
2. Fill in the schedule details:
   - **Schedule Name**: e.g., *"Daily Team Standup"* (optional)
   - **Recipient Name**: e.g., *"Team Lead"* (optional)
   - **WhatsApp Phone Number**: Must include leading `+` and country code (e.g., `+919876543210` for India, `+14155552671` for US).
   - **Message Text**: Enter your message body (up to 4096 characters). Check the live WhatsApp preview card on the right.
   - **Schedule Type**: Select **Daily**, **Weekly**, or **Monthly**.
   - **Execution Time**: Select the time in 24-hour format (e.g., `09:30`).
   - **Timezone**: Confirm or select your timezone (defaults to `Asia/Kolkata`).
3. Click **Review & Enable Schedule**.
4. A confirmation dialog will display a human-readable verification:
   > *"Send 'Good morning team!' to Team Lead (+919876543210) every day at 09:30 AM (IST)."*
5. Click **Confirm & Enable Schedule**. The job will be registered in SQLite and the scheduler engine will queue the next execution automatically.

---

## Scheduling Engine & Guarantees

### Offline Handling & Missed-Job Policy
What happens if your computer is turned off or sleep mode prevents a message from triggering?
- When the application starts up, it automatically queries SQLite for overdue occurrences whose scheduled time passed while the application was offline.
- By default, `MISSED_JOB_POLICY=skip` records each overdue occurrence as `skipped` in the execution log with reason *"Missed while application was offline"*, and advances the schedule to the next future occurrence.
- This prevents your phone from spamming recipients with late messages when turning on your laptop.
- You can review skipped jobs in **Execution History** and manually trigger a retry if desired.

### Delivery States: Attempted vs Accepted vs Confirmed
| Status | Meaning |
|---|---|
| `pending` / `sending` | The scheduler triggered the job and is dispatching the message to the local headless browser. |
| `accepted` | WhatsApp Web accepted the message and returned an acknowledgment message ID. |
| `uncertain` | A network timeout or socket disconnect occurred before WhatsApp Web acknowledged receipt. |
| `failed` | Delivery failed definitely (e.g. invalid phone number or client disconnected). |
| `skipped` | The occurrence was skipped due to offline time or schedule pause. |

> **Important**: Local WhatsApp Web automation operates through the web interface. While `accepted` confirms receipt by the WhatsApp Web gateway, WhatsApp does not provide delivery/read receipt APIs to unofficial clients. If a timeout occurs during send, the app flags the outcome as `uncertain` and prevents automatic retries to protect against duplicate messages.

### Duplicate Send & Overlap Prevention
1. **In-Memory Lock**: Prevents overlapping execution of the same schedule if a previous send attempt is taking longer than expected.
2. **Database Unique Occurrence Key**: Every scheduled execution is assigned a unique key `occ_<schedule_id>_<iso_occurrence_time>`. The database enforces a `UNIQUE` constraint, making it impossible for duplicate executions to be recorded or triggered.

---

## Automated Testing & Mock Mode

The project includes an automated test suite covering timezone calculations, recurrence logic, phone validations, duplicate execution locks, database persistence, and API endpoints.

To run the full test suite:
```powershell
npm test
```

### Mock Mode (`WHATSAPP_MOCK=true`)
To run or develop without scanning a QR code or launching Chromium:
1. In `.env`, set `WHATSAPP_MOCK=true`.
2. The WhatsApp service will simulate the connection, display a mock QR code, and simulate message dispatching with generated message IDs.

---

## Database Backup & Restore

### Backup
Your SQLite database is located at `./data/scheduler.db`. To make a safe backup:
```powershell
# Create a backup copy while preserving file integrity
Copy-Item .\data\scheduler.db .\data\scheduler_backup.db
```

### Restore
To restore from a backup:
1. Stop the application (`Ctrl+C`).
2. Replace `.\data\scheduler.db` with your backup file:
```powershell
Copy-Item .\data\scheduler_backup.db .\data\scheduler.db -Force
```
3. Restart the application: `npm run dev`.

---

## Troubleshooting Guide

### 1. Chromium / Puppeteer Issues on Windows
If Puppeteer fails to launch Chromium:
- Ensure Google Chrome or Microsoft Edge is installed on your computer.
- In `.env`, uncomment `PUPPETEER_EXECUTABLE_PATH` and specify your Chrome path:
  ```ini
  PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
  ```

### 2. QR Code Does Not Appear or Connection Times Out
- Navigate to **WhatsApp Connection** in the sidebar.
- Click **Reconnect Client**.
- Ensure your computer has active internet access.

### 3. Safely Logging Out and Clearing Local Sessions
- Go to **WhatsApp Connection** > click **Disconnect & Logout**.
- This will cleanly terminate the browser instance and delete `./data/whatsapp_session` from your disk.

### 4. Timezone & DST Differences
- Schedules calculate execution using IANA timezone identifiers (e.g. `Asia/Kolkata`, `America/New_York`).
- If you move between timezones, update the timezone on your schedule or change the default in **Settings**.

---

## Privacy & Security Protections

- **Loopback Binding**: Express binds to `127.0.0.1` by default to prevent exposure on local networks.
- **Strict CORS**: Only requests from the local client origin are permitted.
- **Private Data Storage**: WhatsApp session files and SQLite databases are stored in `./data/` and excluded in `.gitignore`.
- **Masked Logs**: Recipient numbers are masked in audit tables (`+91 98****3210`).
- **No Remote Code Execution**: User messages are parameterized in SQLite and never evaluated as dynamic code.

---

## Definition of Done Verification

- [x] Dependencies install cleanly on Windows without C++ compiler issues
- [x] Local application boots with unified scripts (`npm run dev`, `npm run build`, `npm start`)
- [x] QR code pairing works via `whatsapp-web.js` + `LocalAuth`
- [x] One-time, Daily, Weekly, and Monthly recurrence engine
- [x] Timezone awareness with `Asia/Kolkata` default and DST support
- [x] Full Schedule CRUD (view, edit, pause, resume, duplicate, delete)
- [x] Overdue & offline reconciliation with configurable `missed_job_policy`
- [x] Execution history with success, failure, skipped, and uncertain states
- [x] Duplicate execution prevention with SQLite unique constraints
- [x] Modern responsive React dashboard with Lucide icons
- [x] 29 automated tests pass with 100% success rate
