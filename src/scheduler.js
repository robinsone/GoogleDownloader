const cron = require('node-cron');
const config = require('./config');
const logger = require('./logger');
const DriveDownloader = require('./downloader');

class Scheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  start() {
    const schedule = config.get('schedule');

    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron schedule: ${schedule}`);
    }

    logger.info(`Starting scheduler with schedule: ${schedule}`);
    logger.info('Cron format: minute hour day month weekday');
    logger.info('Example: "0 9 * * *" = Every day at 9:00 AM');

    this.task = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.warn('Previous download still running, skipping this execution');
        return;
      }

      try {
        this.isRunning = true;
        logger.info('Scheduled download triggered');

        const downloader = new DriveDownloader();
        await downloader.downloadFolder();

        logger.info('Scheduled download completed successfully');
      } catch (error) {
        logger.error('Scheduled download failed:', error);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Scheduler started successfully');
    logger.info('Press Ctrl+C to stop');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info('Scheduler stopped');
    }
  }
}

module.exports = Scheduler;
