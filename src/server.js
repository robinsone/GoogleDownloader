#!/usr/bin/env node

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const winston = require('winston');
const config = require('./config');
const logger = require('./logger');
const DriveDownloader = require('./downloader');
const Scheduler = require('./scheduler');
const fs = require('fs-extra');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Global state
let scheduler = null;
let isDownloading = false;
let downloadStatus = {
  inProgress: false,
  current: null,
  total: 0,
  completed: 0,
  errors: []
};

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send current status on connection
  socket.emit('status', {
    schedulerRunning: scheduler !== null,
    downloadStatus
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Broadcast status updates to all connected clients
function broadcastStatus() {
  io.emit('status', {
    schedulerRunning: scheduler !== null,
    downloadStatus
  });
}

// Broadcast log message to all connected clients
function broadcastLog(message) {
  io.emit('log', { message });
}

// Add custom Winston transport to broadcast logs to Socket.io clients
const SocketTransport = winston.transports.Stream;
const { Writable } = require('stream');

class SocketStream extends Writable {
  _write(chunk, encoding, callback) {
    const logData = chunk.toString().trim();
    if (logData) {
      broadcastLog(logData);
    }
    callback();
  }
}

logger.add(new SocketTransport({
  stream: new SocketStream(),
  format: winston.format.combine(
    winston.format.simple()
  )
}));

// API Routes

// Get current configuration
app.get('/api/config', (req, res) => {
  try {
    const currentConfig = config.load();
    res.json(currentConfig);
  } catch (error) {
    logger.error('Failed to load config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Update configuration
app.post('/api/config', (req, res) => {
  try {
    const updates = req.body;
    config.update(updates);
    logger.info('Configuration updated via web interface');
    res.json({ success: true, message: 'Configuration updated successfully' });
    broadcastStatus();
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Start manual download
app.post('/api/download/start', async (req, res) => {
  if (isDownloading) {
    return res.status(409).json({ error: 'Download already in progress' });
  }

  try {
    isDownloading = true;
    downloadStatus = {
      inProgress: true,
      current: null,
      total: 0,
      completed: 0,
      errors: []
    };
    broadcastStatus();

    res.json({ success: true, message: 'Download started' });

    // Create downloader with progress callback
    const downloader = new DriveDownloader();

    // Set up progress callback
    downloader.onProgress = (data) => {
      if (data.total) downloadStatus.total = data.total;
      if (data.completed !== undefined) downloadStatus.completed = data.completed;
      if (data.current) downloadStatus.current = data.current;
      if (data.error) downloadStatus.errors.push(data.error);
      broadcastStatus();
    };

    await downloader.downloadFolder();

    downloadStatus.inProgress = false;
    downloadStatus.current = null;
    isDownloading = false;
    broadcastStatus();

  } catch (error) {
    logger.error('Download failed:', error);
    downloadStatus.inProgress = false;
    downloadStatus.errors.push(error.message);
    isDownloading = false;
    broadcastStatus();
  }
});

// Get download status
app.get('/api/download/status', (req, res) => {
  res.json(downloadStatus);
});

// Start scheduler
app.post('/api/scheduler/start', (req, res) => {
  if (scheduler) {
    return res.status(409).json({ error: 'Scheduler already running' });
  }

  try {
    scheduler = new Scheduler();
    scheduler.start();
    logger.info('Scheduler started via web interface');
    res.json({ success: true, message: 'Scheduler started successfully' });
    broadcastStatus();
  } catch (error) {
    logger.error('Failed to start scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

// Stop scheduler
app.post('/api/scheduler/stop', (req, res) => {
  if (!scheduler) {
    return res.status(409).json({ error: 'Scheduler not running' });
  }

  try {
    scheduler.stop();
    scheduler = null;
    logger.info('Scheduler stopped via web interface');
    res.json({ success: true, message: 'Scheduler stopped successfully' });
    broadcastStatus();
  } catch (error) {
    logger.error('Failed to stop scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

// Get scheduler status
app.get('/api/scheduler/status', (req, res) => {
  res.json({
    running: scheduler !== null
  });
});

// Get recent logs
app.get('/api/logs', async (req, res) => {
  try {
    const logDir = path.join(__dirname, '../logs');
    const logFile = path.join(logDir, 'combined.log');

    if (!await fs.pathExists(logFile)) {
      return res.json({ logs: [] });
    }

    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const recentLogs = lines.slice(-100); // Last 100 lines

    res.json({ logs: recentLogs });
  } catch (error) {
    logger.error('Failed to read logs:', error);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`\n=== Google Drive Downloader Web Interface ===`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Open your browser to access the interface\n`);
  logger.info(`Web server started on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down web server...');
  if (scheduler) {
    scheduler.stop();
  }
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  if (scheduler) {
    scheduler.stop();
  }
  server.close(() => {
    process.exit(0);
  });
});
