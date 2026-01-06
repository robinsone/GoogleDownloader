const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const cheerio = require('cheerio');
const { GetFileList } = require('google-drive-getfilelist');
const AdmZip = require('adm-zip');

class DriveDownloader {
  constructor() {
    this.baseUrl = 'https://www.googleapis.com/drive/v3';
    this.onProgress = null; // Callback for progress updates
  }

  emitProgress(data) {
    if (this.onProgress) {
      this.onProgress(data);
    }
  }

  async listFilesInFolder(folderId) {
    try {
      const fileExtensions = config.get('fileExtensions');
      const apiKey = config.get('apiKey');

      logger.info(`Listing files in public folder: ${folderId}`);

      // Use google-drive-getfilelist package (works without API key!)
      try {
        logger.info('Using google-drive-getfilelist package...');

        const resource = {
          folderId: folderId,
        };

        const res = await GetFileList(resource);

        if (res && res.fileList && res.fileList.length > 0) {
          let files = res.fileList[0].files || [];

          // Filter out folders
          files = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');

          // Filter by extension if specified
          if (fileExtensions && fileExtensions.length > 0) {
            files = files.filter(file => {
              const ext = path.extname(file.name).toLowerCase();
              return fileExtensions.includes(ext);
            });
          }

          logger.info(`Found ${files.length} file(s) to download`);
          return files;
        }
      } catch (getFileListError) {
        logger.warn(`google-drive-getfilelist failed: ${getFileListError.message}`);
        logger.info('Falling back to manual methods...');
      }

      // Fallback: Try API method with API key
      if (apiKey) {
        try {
          const url = `${this.baseUrl}/files`;
          const params = {
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType, size, modifiedTime)',
            pageSize: 1000,
            key: apiKey
          };

          const response = await axios.get(url, { params });
          let files = response.data.files || [];

          // Filter out folders and only keep files
          files = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');

          // Filter by extension if specified
          if (fileExtensions && fileExtensions.length > 0) {
            files = files.filter(file => {
              const ext = path.extname(file.name).toLowerCase();
              return fileExtensions.includes(ext);
            });
          }

          logger.info(`Found ${files.length} file(s) to download via API`);
          return files;
        } catch (apiError) {
          logger.warn('API method failed, falling back to web scraping...');
        }
      } else {
        logger.info('No API key provided, using web scraping method...');
      }

      // Fallback: Web scraping method (works without API key)
      return await this.listFilesViaWebScraping(folderId, fileExtensions);

    } catch (error) {
      logger.error('Error listing files:', error);
      throw error;
    }
  }

  async listFilesViaWebScraping(folderId, fileExtensions) {
    try {
      // Fetch the public folder page
      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      logger.info('Using web scraping method (no API key required)...');

      const response = await axios.get(folderUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });

      const html = response.data;

      // Debug: Save HTML to file for analysis
      try {
        await fs.writeFile(path.join(__dirname, '../logs/drive-page.html'), html);
        logger.info('Saved page HTML to logs/drive-page.html for debugging');
      } catch (e) {
        // Ignore save errors
      }

      const files = [];

      // Try multiple extraction patterns

      // Pattern 1: Look for data in JavaScript arrays
      const dataPattern = /\[["']([a-zA-Z0-9_-]{25,})["'][^\]]*["']([^"']+\.\w+)["']/g;
      let match;
      const fileMap = new Map();

      while ((match = dataPattern.exec(html)) !== null) {
        const [, id, name] = match;
        if (id && name && id.length >= 25 && !name.includes('/')) {
          fileMap.set(id, { id, name, mimeType: 'application/octet-stream' });
        }
      }

      // Pattern 2: Look for file data in embedded JSON
      const jsonPattern = /"([a-zA-Z0-9_-]{25,})"[^}]*"title"\s*:\s*"([^"]+\.\w+)"/g;
      while ((match = jsonPattern.exec(html)) !== null) {
        const [, id, name] = match;
        if (id && name && !name.includes('/')) {
          fileMap.set(id, { id, name, mimeType: 'application/octet-stream' });
        }
      }

      // Pattern 3: Alternative structure
      const altPattern = /\["([a-zA-Z0-9_-]{25,})",null,\["([^"]+\.\w+)"/g;
      while ((match = altPattern.exec(html)) !== null) {
        const [, id, name] = match;
        if (id && name && !name.includes('/')) {
          fileMap.set(id, { id, name, mimeType: 'application/octet-stream' });
        }
      }

      logger.info(`Extracted ${fileMap.size} potential files from page`);

      // Convert to array and filter
      fileMap.forEach((file) => {
        // Filter by extension if specified
        if (fileExtensions && fileExtensions.length > 0) {
          const ext = path.extname(file.name).toLowerCase();
          if (fileExtensions.includes(ext)) {
            files.push(file);
          }
        } else {
          files.push(file);
        }
      });

      if (files.length === 0) {
        logger.warn('No files found using scraping method. Trying alternative extraction...');
        return await this.listFilesViaAlternativeMethod(folderId, fileExtensions);
      }

      logger.info(`Found ${files.length} file(s) to download via web scraping`);
      return files;

    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('Folder not found. Make sure the folder ID is correct and the folder is publicly shared.');
      }
      logger.warn('Web scraping failed, trying alternative method...');
      return await this.listFilesViaAlternativeMethod(folderId, fileExtensions);
    }
  }

  async listFilesViaAlternativeMethod(folderId, fileExtensions) {
    try {
      logger.info('Trying alternative method: Direct HTML parsing...');

      // Try multiple endpoints
      const urls = [
        `https://drive.google.com/embeddedfolderview?id=${folderId}`,
        `https://drive.google.com/drive/u/0/folders/${folderId}`,
      ];

      for (const url of urls) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml',
            }
          });

          const html = response.data;
          const files = [];
          const fileMap = new Map();

          // Try parsing with cheerio
          const $ = cheerio.load(html);

          // Look for data attributes
          $('[data-id]').each((i, elem) => {
            const id = $(elem).attr('data-id');
            const title = $(elem).attr('data-title') || $(elem).attr('title') || $(elem).text().trim();

            if (id && title && title.includes('.') && id.length >= 25) {
              fileMap.set(id, {
                id: id,
                name: title,
                mimeType: 'application/octet-stream'
              });
            }
          });

          // Also try text-based extraction
          const textPattern = /data-id="([a-zA-Z0-9_-]{25,})"[^>]*>([^<]+\.\w+)</g;
          let match;
          while ((match = textPattern.exec(html)) !== null) {
            const [, id, name] = match;
            if (id && name) {
              fileMap.set(id, { id, name: name.trim(), mimeType: 'application/octet-stream' });
            }
          }

          // Convert to array and filter
          fileMap.forEach((file) => {
            if (fileExtensions && fileExtensions.length > 0) {
              const ext = path.extname(file.name).toLowerCase();
              if (fileExtensions.includes(ext)) {
                files.push(file);
              }
            } else {
              files.push(file);
            }
          });

          if (files.length > 0) {
            logger.info(`Found ${files.length} file(s) via alternative method`);
            return files;
          }
        } catch (err) {
          logger.warn(`Failed to fetch ${url}: ${err.message}`);
        }
      }

      logger.error('All alternative methods failed');
      throw new Error('Unable to list files without an API key. The folder structure may not be compatible with web scraping. Please add a Google API key in the configuration.');

    } catch (error) {
      logger.error('Alternative method also failed:', error.message);
      throw new Error('Unable to list files. Please ensure: 1) The folder is set to "Anyone with the link can view", 2) The folder ID is correct');
    }
  }

  async downloadFile(fileId, fileName, destPath) {
    const maxRetries = config.get('maxRetries') || 3;
    let attempt = 0;

    // Normalize the destination path for Windows
    destPath = path.normalize(destPath);

    while (attempt < maxRetries) {
      try {
        attempt++;
        logger.info(`Downloading ${fileName} (attempt ${attempt}/${maxRetries})...`);

        const dest = path.join(destPath, fileName);

        // Check if file exists and overwrite setting
        if (fs.existsSync(dest) && !config.get('overwriteExisting')) {
          logger.info(`File ${fileName} already exists, skipping... `);
          return { success: true, skipped: true };
        }

        // Ensure destination directory exists (creates all parent directories)
        await fs.ensureDir(destPath);

        const apiKey = config.get('apiKey');
        let url;

        // Use different download methods based on API key availability
        if (apiKey) {
          url = `${this.baseUrl}/files/${fileId}?alt=media&key=${apiKey}`;
        } else {
          // Use direct download link (works without API key for public files)
          url = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }

        // Download with streaming
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          maxRedirects: 5,
          headers: {
            'Referer': 'https://drive.google.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        const writer = fs.createWriteStream(dest);

        return new Promise((resolve, reject) => {
          let downloadedBytes = 0;

          response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
          });

          response.data.on('end', () => {
            logger.info(`✓ Downloaded ${fileName} (${this.formatBytes(downloadedBytes)})`);
          });

          response.data.on('error', (err) => {
            logger.error(`Error downloading ${fileName}:`, err);
            reject(err);
          });

          writer.on('finish', async () => {
            // After download completes, extract the zip file
            try {
              logger.info(`Extracting ${fileName}...`);
              const zip = new AdmZip(dest);
              zip.extractAllTo(destPath, true); // true = overwrite existing files
              logger.info(`✓ Extracted ${fileName} to ${destPath}`);

              // Delete the zip file after extraction
              fs.unlinkSync(dest);
              logger.info(`✓ Deleted zip file: ${fileName}`);

              resolve({ success: true, skipped: false, size: downloadedBytes, extracted: true });
            } catch (extractError) {
              logger.error(`Failed to extract ${fileName}:`, extractError.message);
              // Still consider download successful even if extraction fails
              resolve({ success: true, skipped: false, size: downloadedBytes, extracted: false });
            }
          });

          writer.on('error', (err) => {
            reject(err);
          });

          response.data.pipe(writer);
        });
      } catch (error) {
        logger.error(`Attempt ${attempt} failed for ${fileName}:`, error.message);

        // Clean up partial download
        const dest = path.join(destPath, fileName);
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }

        if (attempt >= maxRetries) {
          return { success: false, error: error.message };
        }

        // Wait before retrying (exponential backoff)
        await this.sleep(1000 * Math.pow(2, attempt));
      }
    }
  }

  async downloadFolder() {
    try {
      const folderId = config.get('driveFolderId');
      const downloadPath = config.get('downloadPath');

      if (!folderId) {
        throw new Error('Drive folder ID not configured.  Run setup first.');
      }

      logger.info('='.repeat(50));
      logger.info('Starting download process...');
      logger.info(`Folder ID: ${folderId}`);
      logger.info(`Download Path: ${downloadPath}`);
      logger.info('='.repeat(50));

      const files = await this.listFilesInFolder(folderId);

      if (files.length === 0) {
        logger.info('No files to download');
        return { total: 0, successful: 0, failed: 0, skipped: 0 };
      }

      // Log file details for debugging
      logger.info(`All files found:`);
      files.forEach((file, idx) => {
        logger.info(`  ${idx + 1}. ${file.name} (modified: ${file.modifiedTime || 'unknown'})`);
      });

      // Sort files by modified time (newest first) and take only the latest
      // If no modifiedTime, try to extract version from filename, otherwise use alphabetical order
      files.sort((a, b) => {
        // First try sorting by modifiedTime if available
        if (a.modifiedTime && b.modifiedTime) {
          const dateA = new Date(a.modifiedTime);
          const dateB = new Date(b.modifiedTime);
          return dateB - dateA; // Descending order (newest first)
        }

        // Fallback: Try to extract version numbers from filename (e.g., "1.78", "1.77")
        const versionRegex = /(\d+\.?\d*)/g;
        const versionsA = a.name.match(versionRegex);
        const versionsB = b.name.match(versionRegex);

        if (versionsA && versionsB) {
          // Compare version numbers (last number found in filename)
          const versionA = parseFloat(versionsA[versionsA.length - 1]);
          const versionB = parseFloat(versionsB[versionsB.length - 1]);
          if (!isNaN(versionA) && !isNaN(versionB)) {
            return versionB - versionA; // Descending order (highest version first)
          }
        }

        // Final fallback: alphabetical descending (Z to A)
        return b.name.localeCompare(a.name);
      });

      const latestFile = files[0];
      logger.info(`Determined latest file: ${latestFile.name}`);

      // Emit initial progress
      this.emitProgress({ total: 1, completed: 0 });

      const results = {
        total: 1,
        successful: 0,
        failed: 0,
        skipped: 0,
        totalSize: 0
      };

      this.emitProgress({ current: latestFile.name });
      const result = await this.downloadFile(latestFile.id, latestFile.name, downloadPath);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.successful++;
          results.totalSize += result.size || 0;
        }
      } else {
        results.failed++;
      }

      this.emitProgress({ completed: results.successful + results.skipped });

      logger.info('='.repeat(50));
      logger.info('Download Summary:');
      logger.info(`Total files: ${results.total}`);
      logger.info(`Successful: ${results.successful}`);
      logger.info(`Skipped: ${results.skipped}`);
      logger.info(`Failed: ${results.failed}`);
      logger.info(`Total size: ${this.formatBytes(results.totalSize)}`);
      logger.info('='.repeat(50));

      return results;
    } catch (error) {
      logger.error('Download process failed:', error);
      throw error;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DriveDownloader;
