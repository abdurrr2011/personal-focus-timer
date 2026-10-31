const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_SETTINGS } = require('./timer');

const BOOLEAN_KEYS = ['notifications', 'alwaysOnTop', 'soundAlerts', 'launchAtLogin'];
const MINUTE_KEYS = ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'];
const SOUND_FILE_PATTERN = /^alert-[a-f0-9-]{36}\.(wav|mp3|ogg|m4a)$/i;

function sanitizeSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const settings = { ...DEFAULT_SETTINGS, soundAlertFile: null };
  for (const key of MINUTE_KEYS) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) settings[key] = Math.min(120, Math.max(1, Math.round(value)));
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') settings[key] = source[key];
  }
  if (typeof source.soundAlertFile === 'string' && SOUND_FILE_PATTERN.test(source.soundAlertFile)) {
    settings.soundAlertFile = source.soundAlertFile;
  }
  return settings;
}

function createStore(directory) {
  const filePath = path.join(directory, 'settings.json');

  function load() {
    try {
      const contents = fs.readFileSync(filePath, 'utf8');
      if (contents.length > 64_000) throw new Error('Settings file is too large');
      const data = JSON.parse(contents);
      return {
        settings: sanitizeSettings(data.settings),
        timer: data.timer && typeof data.timer === 'object' && !Array.isArray(data.timer) ? data.timer : null,
      };
    } catch {
      return { settings: sanitizeSettings(), timer: null };
    }
  }

  function save(data) {
    fs.mkdirSync(directory, { recursive: true });
    const payload = {
      settings: sanitizeSettings(data?.settings),
      timer: data?.timer && typeof data.timer === 'object' && !Array.isArray(data.timer) ? data.timer : null,
    };
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      try { fs.unlinkSync(temporaryPath); } catch {}
      throw error;
    }
  }

  return { directory, filePath, load, save };
}

module.exports = { createStore, sanitizeSettings };
