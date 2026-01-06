# Google Drive Folder Downloader

A Node.js utility to automatically download files from **public** Google Drive folders on a schedule or on-demand.

## Features

- ✅ Download from public Google Drive folders (no authentication needed)
- ✅ Run on schedule (cron-based)
- ✅ On-demand downloads
- ✅ Filter by file extension (default: . zip files)
- ✅ Retry logic for failed downloads
- ✅ Comprehensive logging
- ✅ Windows compatible (can be extended to other platforms)

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Public Google Drive folder** (shared with "Anyone with the link")

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Make Your Google Drive Folder Public

1. Open your folder in Google Drive
2. Click the "Share" button
3. Change access to "Anyone with the link" → "Viewer"
4. Copy the folder ID from the URL: 
   ```
   https://drive.google.com/drive/folders/YOUR_FOLDER_ID_HERE
   ```

### 3. Run Setup

```bash
npm run setup
```

This will prompt you for:
- **Folder ID**: The ID from your Google Drive folder URL
- **Download Path**: Where to save downloaded files
- **Schedule**: When to run automatic downloads (cron format)
- **Overwrite Existing**: Whether to re-download existing files
- **API Key** (Optional): For higher rate limits

## Usage

### Web Interface (Recommended)

Start the web interface for easy configuration and monitoring:

```bash
npm run web
```

Then open your browser to `http://localhost:3000`

**Features:**
- 🎯 Real-time status monitoring
- ⚙️ Visual configuration editor
- 📥 One-click manual downloads
- ⏰ Scheduler control
- 📊 Live download progress
- 📋 Activity log viewer

### On-Demand Download

Download files immediately via command line: 

```bash
npm run download
```

### Scheduled Downloads

Start the scheduler to run downloads automatically:

```bash
npm run schedule
```

The scheduler will run in the background according to your cron schedule.

### View Configuration

```bash
npm start config
```

### Schedule Format (Cron)

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**
- `0 9 * * *` - Every day at 9:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Every Monday at midnight
- `30 14 * * *` - Every day at 2:30 PM

## Configuration File

Located at `config/config.json`:

```json
{
  "driveFolderId": "your-folder-id",
  "downloadPath": "C:\\Users\\YourName\\Downloads",
  "schedule":  "0 9 * * *",
  "overwriteExisting": true,
  "fileExtensions": [".zip"],
  "maxRetries": 3,
  "apiKey": ""
}
```

### Optional:  Google API Key

For higher rate limits, you can create a free API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Drive API**
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the key and add it to your config

Without an API key, you're limited to ~100 requests per 100 seconds per user.

## Running as Windows Service

To run the scheduler as a Windows service (runs at startup, background):

### Option 1: Using NSSM (Recommended)

1. Download [NSSM](https://nssm.cc/download)
2. Open Command Prompt as Administrator
3. Run: 
```cmd
nssm install GDriveDownloader "C:\Program Files\nodejs\node.exe" "C:\path\to\project\src\index.js" schedule
nssm set GDriveDownloader AppDirectory "C:\path\to\project"
nssm start GDriveDownloader
```

### Option 2: Using Task Scheduler

1. Open Windows Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., "At startup")
4. Action: Start a program
5. Program: `node`
6. Arguments: `"C:\path\to\project\src\index.js" schedule`
7. Start in: `C:\path\to\project`

## Building Executable

To create a standalone executable:

```bash
npm install -g pkg
pkg package.json
```

This creates `dist/gdrive-downloader.exe` that can run without Node.js installed.

## Logging

Logs are stored in `logs/`:
- `app.log` - All logs
- `error.log` - Error logs only

## Troubleshooting

### "Folder not found or not accessible"
- Make sure the folder ID is correct
- Verify the folder is set to "Anyone with the link" can view
- Check that the folder isn't empty

### "Access denied"
- The folder must be publicly accessible
- Go to Share settings and set to "Anyone with the link"

### Files not downloading
- Check that folder ID is correct
- Verify folder has files matching your extension filter
- Check logs in `logs/app.log`

### Rate limiting errors
- Add a Google API key to your config for higher limits
- Reduce the number of files or frequency of downloads
- Add delays between downloads (will implement if needed)

### Schedule not working
- Verify cron expression at [crontab.guru](https://crontab.guru/)
- Check system time is correct
- Review logs for errors

## Security Notes

✅ **No authentication required** - Works with public folders only
✅ **No sensitive credentials** - Optional API key can be regenerated anytime

## How It Works

1. Uses Google Drive API v3 to list files in public folder
2. Downloads files directly using file IDs
3. Saves to your specified location
4. Logs all activities for troubleshooting

## Limitations

- Only works with **public folders** (no private folder access)
- Subject to Google's API rate limits (100 requests/100 seconds without API key)
- Large files may take time to download

## License

ISC
