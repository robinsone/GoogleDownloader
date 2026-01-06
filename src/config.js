const fs = require('fs-extra');
const path = require('path');

// Detect if running in Electron
const isElectron = process.env.ELECTRON === 'true' || process.versions.electron;

// Use appropriate config directory
let CONFIG_DIR;
if (isElectron) {
  // In Electron, use userData directory (writable location)
  const { app } = require('electron');
  CONFIG_DIR = path.join(app.getPath('userData'), 'config');
} else {
  // In regular Node.js, use project directory
  CONFIG_DIR = path.join(__dirname, '../config');
}

const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  driveFolderId: '',
  downloadPath: './downloads',
  schedule: '0 9 * * *',
  overwriteExisting: false,
  apiKey: '',
  fileExtensions: ['.zip'],
  maxRetries: 3
};

// Cache for config
let configCache = null;

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function load() {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    save(DEFAULT_CONFIG);
    configCache = { ...DEFAULT_CONFIG };
    return configCache;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    return configCache;
  } catch (error) {
    console.error('Error reading config file:', error);
    configCache = { ...DEFAULT_CONFIG };
    return configCache;
  }
}

function save(config) {
  ensureConfigDir();

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    configCache = { ...config };
    return true;
  } catch (error) {
    console.error('Error writing config file:', error);
    return false;
  }
}

function update(updates) {
  const current = load();

  // Normalize the downloadPath if it's being updated
  if (updates.downloadPath) {
    // Normalize Windows paths: convert forward slashes to backslashes and resolve the path
    updates.downloadPath = path.normalize(updates.downloadPath);
  }

  const updated = { ...current, ...updates };
  return save(updated);
}

function get(key) {
  if (!configCache) {
    load();
  }
  return configCache[key];
}

module.exports = {
  load,
  save,
  update,
  get,
  DEFAULT_CONFIG
};
