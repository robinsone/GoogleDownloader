// Socket.io connection
const socket = io();

// DOM Elements
const downloadBtn = document.getElementById('downloadBtn');
const startSchedulerBtn = document.getElementById('startSchedulerBtn');
const stopSchedulerBtn = document.getElementById('stopSchedulerBtn');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const configForm = document.getElementById('configForm');
const progressSection = document.getElementById('progressSection');
const schedulerStatus = document.getElementById('schedulerStatus');
const downloadStatus = document.getElementById('downloadStatus');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressCount = document.getElementById('progressCount');
const currentFile = document.getElementById('currentFile');
const logContainer = document.getElementById('logContainer');
const toastContainer = document.getElementById('toastContainer');

// State
let currentConfig = {};
let logVisible = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadLogs();
  setupLogToggle();
});

// Socket.io event handlers
socket.on('status', (data) => {
  updateStatus(data);
});

socket.on('log', (data) => {
  appendLog(data.message);
});

socket.on('connect', () => {
  showToast('Connected to server', 'success');
});

socket.on('disconnect', () => {
  showToast('Disconnected from server', 'error');
});

// API Functions
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    currentConfig = config;
    populateConfigForm(config);
  } catch (error) {
    showToast('Failed to load configuration', 'error');
    console.error('Load config error:', error);
  }
}

async function saveConfig(configData) {
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(configData),
    });

    if (response.ok) {
      showToast('Configuration saved successfully', 'success');
      currentConfig = configData;
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to save configuration', 'error');
    }
  } catch (error) {
    showToast('Failed to save configuration', 'error');
    console.error('Save config error:', error);
  }
}

async function startDownload() {
  try {
    downloadBtn.disabled = true;
    const response = await fetch('/api/download/start', {
      method: 'POST',
    });

    if (response.ok) {
      showToast('Download started', 'success');
      progressSection.style.display = 'block';
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to start download', 'error');
      downloadBtn.disabled = false;
    }
  } catch (error) {
    showToast('Failed to start download', 'error');
    console.error('Start download error:', error);
    downloadBtn.disabled = false;
  }
}

async function startScheduler() {
  try {
    startSchedulerBtn.disabled = true;
    const response = await fetch('/api/scheduler/start', {
      method: 'POST',
    });

    if (response.ok) {
      showToast('Scheduler started', 'success');
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to start scheduler', 'error');
      startSchedulerBtn.disabled = false;
    }
  } catch (error) {
    showToast('Failed to start scheduler', 'error');
    console.error('Start scheduler error:', error);
    startSchedulerBtn.disabled = false;
  }
}

async function stopScheduler() {
  try {
    stopSchedulerBtn.disabled = true;
    const response = await fetch('/api/scheduler/stop', {
      method: 'POST',
    });

    if (response.ok) {
      showToast('Scheduler stopped', 'success');
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to stop scheduler', 'error');
      stopSchedulerBtn.disabled = false;
    }
  } catch (error) {
    showToast('Failed to stop scheduler', 'error');
    console.error('Stop scheduler error:', error);
    stopSchedulerBtn.disabled = false;
  }
}

async function loadLogs() {
  try {
    const response = await fetch('/api/logs');
    const data = await response.json();
    displayLogs(data.logs);
  } catch (error) {
    showToast('Failed to load logs', 'error');
    console.error('Load logs error:', error);
  }
}

// UI Update Functions
function updateStatus(data) {
  // Update scheduler status
  if (data.schedulerRunning) {
    schedulerStatus.textContent = 'Active';
    schedulerStatus.className = 'status-badge status-active';
    startSchedulerBtn.disabled = true;
    stopSchedulerBtn.disabled = false;
  } else {
    schedulerStatus.textContent = 'Inactive';
    schedulerStatus.className = 'status-badge status-inactive';
    startSchedulerBtn.disabled = false;
    stopSchedulerBtn.disabled = true;
  }

  // Update download status
  const dlStatus = data.downloadStatus;
  if (dlStatus.inProgress) {
    downloadStatus.textContent = 'Downloading';
    downloadStatus.className = 'status-badge status-downloading';
    downloadBtn.disabled = true;
    progressSection.style.display = 'block';

    // Update progress
    const percentage = dlStatus.total > 0
      ? Math.round((dlStatus.completed / dlStatus.total) * 100)
      : 0;

    progressFill.style.width = percentage + '%';
    progressText.textContent = `Progress: ${percentage}%`;
    progressCount.textContent = `${dlStatus.completed} / ${dlStatus.total}`;

    if (dlStatus.current) {
      currentFile.textContent = `Current: ${dlStatus.current}`;
    }
  } else {
    downloadStatus.textContent = 'Idle';
    downloadStatus.className = 'status-badge status-idle';
    downloadBtn.disabled = false;

    // Hide progress after a delay if download completed
    if (dlStatus.completed > 0) {
      setTimeout(() => {
        if (!dlStatus.inProgress) {
          progressSection.style.display = 'none';
        }
      }, 3000);
    }
  }
}

function populateConfigForm(config) {
  document.getElementById('driveFolderId').value = config.driveFolderId || '';
  document.getElementById('downloadPath').value = config.downloadPath || '';
  document.getElementById('schedule').value = config.schedule || '0 9 * * *';
  document.getElementById('overwriteExisting').checked = config.overwriteExisting || false;
}

function displayLogs(logs) {
  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<p class="log-empty">No logs available</p>';
    return;
  }

  logContainer.innerHTML = logs.map(log => {
    let className = 'log-entry';

    if (log.includes('error') || log.includes('ERROR') || log.includes('failed')) {
      className += ' log-error';
    } else if (log.includes('info') || log.includes('INFO')) {
      className += ' log-info';
    } else if (log.includes('success') || log.includes('SUCCESS') || log.includes('Downloaded:') || log.includes('✓')) {
      className += ' log-success';
    }

    return `<div class="${className}">${escapeHtml(log)}</div>`;
  }).join('');

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

function appendLog(message) {
  // Remove empty message if exists
  const emptyMsg = logContainer.querySelector('.log-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  // Create new log entry
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';

  if (message.includes('ERROR') || message.includes('error') || message.includes('failed')) {
    logEntry.className += ' log-error';
  } else if (message.includes('WARN') || message.includes('warn')) {
    logEntry.className += ' log-info';
  } else if (message.includes('Downloaded') || message.includes('✓') || message.includes('success')) {
    logEntry.className += ' log-success';
  } else {
    logEntry.className += ' log-info';
  }

  logEntry.textContent = message;
  logContainer.appendChild(logEntry);

  // Keep only last 100 entries
  const entries = logContainer.querySelectorAll('.log-entry');
  if (entries.length > 100) {
    entries[0].remove();
  }

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

  toastContainer.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function setupLogToggle() {
  const logHeader = document.getElementById('logHeader');
  const logSection = document.getElementById('logSection');
  const logToggle = document.getElementById('logToggle');

  logHeader.addEventListener('click', () => {
    logVisible = !logVisible;
    logSection.style.display = logVisible ? 'block' : 'none';
    logToggle.textContent = logVisible ? '▲' : '▼';
  });
}

// Event Listeners
downloadBtn.addEventListener('click', () => {
  startDownload();
});

startSchedulerBtn.addEventListener('click', () => {
  startScheduler();
});

stopSchedulerBtn.addEventListener('click', () => {
  stopScheduler();
});

refreshLogsBtn.addEventListener('click', () => {
  loadLogs();
});

clearLogsBtn.addEventListener('click', () => {
  logContainer.innerHTML = '<p class="log-empty">Logs cleared. Click "Refresh" to reload.</p>';
});

configForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const formData = new FormData(configForm);
  const configData = {
    driveFolderId: formData.get('driveFolderId'),
    downloadPath: formData.get('downloadPath'),
    schedule: formData.get('schedule'),
    overwriteExisting: formData.get('overwriteExisting') === 'on',
    apiKey: formData.get('apiKey') || ''
  };

  saveConfig(configData);
});

// Auto-refresh logs every 10 seconds when download is active
setInterval(() => {
  const dlStatus = downloadStatus.textContent;
  if (dlStatus === 'Downloading') {
    loadLogs();
  }
}, 10000);
