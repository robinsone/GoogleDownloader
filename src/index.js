#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const config = require('./config');
const logger = require('./logger');
const DriveDownloader = require('./downloader');
const Scheduler = require('./scheduler');

const program = new Command();

program
  .name('gdrive-downloader')
  .description('Google Drive folder downloader with scheduling')
  .version('1.0.0');

// Setup command
program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    try {
      console.log('\n=== Google Drive Downloader Setup ===\n');
      console.log('This tool downloads from PUBLIC Google Drive folders.');
      console.log('Make sure your folder has "Anyone with the link" access.\n');

      const currentConfig = config.load();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'driveFolderId',
          message: 'Google Drive Folder ID (from the folder URL):',
          default: currentConfig.driveFolderId,
          validate: (input) => input.length > 0 || 'Folder ID is required'
        },
        {
          type: 'input',
          name: 'downloadPath',
          message: 'Download destination path:',
          default: currentConfig.downloadPath,
          validate: (input) => input.length > 0 || 'Download path is required'
        },
        {
          type: 'input',
          name: 'schedule',
          message: 'Cron schedule (e.g., "0 9 * * *" for 9 AM daily):',
          default: currentConfig.schedule,
          validate: (input) => {
            const cron = require('node-cron');
            return cron.validate(input) || 'Invalid cron expression';
          }
        },
        {
          type: 'confirm',
          name: 'overwriteExisting',
          message: 'Overwrite existing files?',
          default: currentConfig.overwriteExisting
        },
        {
          type: 'input',
          name: 'apiKey',
          message: 'Google API Key (optional, for higher rate limits):',
          default: currentConfig.apiKey || ''
        }
      ]);

      config.update(answers);
      console.log('\n✓ Configuration saved successfully!');
      console.log('\nHow to get the Folder ID:');
      console.log('1. Open the folder in Google Drive');
      console.log('2. Copy the ID from the URL: ');
      console.log('   https://drive.google.com/drive/folders/YOUR_FOLDER_ID');
      console.log('\nNext steps:');
      console.log('- Run "npm run download" to test download');
      console.log('- Run "npm run schedule" to start scheduler\n');
    } catch (error) {
      logger.error('Setup failed:', error);
      console.error('Setup failed:', error.message);
    }
  });

// Download command
program
  .command('download')
  .description('Download files from Google Drive folder (one-time)')
  .action(async () => {
    try {
      const downloader = new DriveDownloader();
      await downloader.downloadFolder();
      process.exit(0);
    } catch (error) {
      logger.error('Download failed:', error);
      console.error('Download failed:', error.message);
      process.exit(1);
    }
  });

// Schedule command
program
  .command('schedule')
  .description('Start the scheduler to run downloads automatically')
  .action(async () => {
    try {
      const scheduler = new Scheduler();
      scheduler.start();

      // Keep process running
      process.on('SIGINT', () => {
        console.log('\nStopping scheduler...');
        scheduler.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        scheduler.stop();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Scheduler failed:', error);
      console.error('Scheduler failed:', error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const currentConfig = config.load();
    console.log('\nCurrent Configuration:');
    console.log(JSON.stringify(currentConfig, null, 2));
    console.log('');
  });

// Parse arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
