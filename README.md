# Google Drive Folder Downloader

A desktop application to automatically download files from **public** Google Drive folders with scheduling capabilities.

<img width="1186" height="646" alt="image" src="https://github.com/user-attachments/assets/12605d6d-bfb5-408d-b7f2-551d8a688d66" />

## Features

- 📁 Download from public Google Drive folders (no authentication needed)
- 🖥️ Desktop application with user-friendly interface
- ⏰ Automatic scheduling with cron expressions
- 📦 Automatic ZIP extraction to destination folder
- 🔄 Downloads only the latest version from folder
- 📊 Real-time progress tracking
- 📋 Live activity logs
- 💾 Persistent configuration

## Download & Installation

### Option 1: Download Pre-built Executable (Recommended)

1. Go to [Releases](https://github.com/robinsone/GoogleDownloader/releases)
2. Download the latest `Google Drive Downloader.exe`
3. Run the executable - no installation required!

**Note:** Windows may show a security warning because the app is not signed. Click "More info" → "Run anyway"

### Option 2: Run from Source

If you have Node.js installed:

```bash
git clone https://github.com/robinsone/GoogleDownloader.git
cd GoogleDownloader
npm install
npm run web
```
Then open your browser to `http://localhost:3000`

## Getting Started

### 1. Make Your Google Drive Folder Public

1. Open your folder in Google Drive
2. Click the "Share" button
3. Change access to "Anyone with the link" → "Viewer"
4. Copy the **folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/YOUR_FOLDER_ID_HERE
   ```

### 2. Configure the Application

When you first launch the app:

1. **Google Drive Folder ID**: Paste the folder ID you copied
2. **Download Destination Path**: Where files will be extracted (e.g., `C:\Games\WoW\Interface\AddOns`)
3. **Cron Schedule**: When to automatically check for updates (e.g., `0 9 * * *` for 9 AM daily)
4. **Overwrite existing files**: Check this to always get the latest version

Click **Save Configuration** to store your settings.

## How to Use

### Manual Download

Click **Download Now** to immediately download and extract the latest file from your Google Drive folder.

The app will:
1. Connect to your public Google Drive folder
2. Find the latest version (by version number in filename)
3. Download the file
4. Extract the contents to your destination folder
5. Delete the temporary ZIP file

### Automatic Scheduling

1. Click **Start Scheduler** to enable automatic downloads
2. The app will check your folder according to the schedule you set
3. Click **Stop Scheduler** to disable automatic downloads

### Activity Log

Click on **📋 Activity Log** to expand the log viewer and see:
- Download progress
- File extraction status
- Any errors or warnings
- Schedule execution times

## Schedule Format (Cron)

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Common Examples:**
- `0 9 * * *` - Every day at 9:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 4 * * *` - Every day at 4:00 AM
- `0 0 * * 1` - Every Monday at midnight

## Use Cases

### World of Warcraft AddOn Updates

Perfect for automatically updating WoW addons from shared Google Drive folders:

1. Set **Folder ID** to your addon developer's public folder
2. Set **Destination Path** to `C:\Program Files (x86)\World of Warcraft\_retail_\Interface\AddOns`
3. Set schedule to check daily: `0 9 * * *`
4. Enable **Start Scheduler**

Your addons will automatically update every morning!

### Any Regular File Updates

Use this for any scenario where files are regularly updated in a Google Drive folder:
- Game mods
- Shared documents
- Software updates
- Backup restores

## Troubleshooting

### "Folder not found or not accessible"
- Verify the folder ID is correct
- Make sure the folder is set to "Anyone with the link" can view
- Check that the folder contains files

### Download Fails
- Check your internet connection
- Verify the Google Drive folder is still accessible
- Look at the Activity Log for specific error messages

### Files Not Extracting
- Ensure the downloaded file is a valid ZIP archive
- Check that you have write permissions to the destination folder
- Make sure the destination path exists

### Windows SmartScreen Warning
This is normal for unsigned applications. The app is safe to run - just click "More info" → "Run anyway"

## Configuration Storage

Your settings are stored in:
- **Packaged App**: `%APPDATA%\gdrive-folder-downloader\config\config.json`
- **From Source**: `<project-folder>\config\config.json`

## Support

Found a bug or have a feature request? [Open an issue](https://github.com/robinsone/GoogleDownloader/issues)
- Reduce the number of files or frequency of downloads
- Add delays between downloads (will implement if needed)

### Schedule not working
- Verify cron expression at [crontab.guru](https://crontab.guru/)
- Check system time is correct
- Review logs for errors

## Security Notes

✅ **No authentication required** - Works with public folders only<br>
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
