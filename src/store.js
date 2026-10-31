const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_SETTINGS } = require('./timer');

const BOOLEAN_KEYS = ['notifications', 'alwaysOnTop', 'soundAlerts', 'launchAtLogin'];
const MINUTE_KEYS = ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'];
const SOUND_FILE_PATTERN = /^alert-[a-f0-9-]{36}\.(wav|mp3|ogg|m4a)$/i;
const SESSIONS_UNTIL_LONG_BREAK_MIN = 2;
const SESSIONS_UNTIL_LONG_BREAK_MAX = 8;
const MAX_ACTIVITY_DAYS = 20_000;

function sanitizeActivity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const entries = Object.entries(input)
    .filter(([key, day]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || typeof day !== 'object' || Array.isArray(day)) return false;
      const parsedDate = new Date(`${key}T00:00:00.000Z`);
      return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === key;
    })
    .map(([key, day]) => [key, {
      completedSessions: Number.isSafeInteger(day.completedSessions) && day.completedSessions > 0 ? day.completedSessions : 0,
      focusMinutes: Number.isSafeInteger(day.focusMinutes) && day.focusMinutes > 0 ? day.focusMinutes : 0,
    }])
    .filter(([_key, day]) => day.completedSessions > 0 && day.focusMinutes > 0)
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, MAX_ACTIVITY_DAYS);
  return Object.fromEntries(entries);
}

function sanitizeSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const settings = { ...DEFAULT_SETTINGS, soundAlertFile: null };
  for (const key of MINUTE_KEYS) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) settings[key] = Math.min(120, Math.max(1, Math.round(value)));
  }
  const sessionsUntilLongBreak = Number(source.sessionsUntilLongBreak);
  if (Number.isFinite(sessionsUntilLongBreak)) {
    settings.sessionsUntilLongBreak = Math.min(
      SESSIONS_UNTIL_LONG_BREAK_MAX,
      Math.max(SESSIONS_UNTIL_LONG_BREAK_MIN, Math.round(sessionsUntilLongBreak)),
    );
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
      if (contents.length > 2_000_000) throw new Error('Settings file is too large');
      const data = JSON.parse(contents);
      return {
        settings: sanitizeSettings(data.settings),
        timer: data.timer && typeof data.timer === 'object' && !Array.isArray(data.timer) ? data.timer : null,
        activity: sanitizeActivity(data.activity),
      };
    } catch {
      return { settings: sanitizeSettings(), timer: null, activity: {} };
    }
  }

  function save(data) {
    fs.mkdirSync(directory, { recursive: true });
    const payload = {
      settings: sanitizeSettings(data?.settings),
      timer: data?.timer && typeof data.timer === 'object' && !Array.isArray(data.timer) ? data.timer : null,
      activity: sanitizeActivity(data?.activity),
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

module.exports = { createStore, sanitizeSettings, sanitizeActivity };
