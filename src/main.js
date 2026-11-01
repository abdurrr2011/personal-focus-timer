const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
  nativeImage,
  Tray,
  Menu,
} = require('electron');
const {
  DEFAULT_SETTINGS,
  MODES,
  durationFor,
  createTimerState,
  remainingMs,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  selectMode,
  finishSession,
  restoreTimerState,
} = require('./timer');
const { createStore, sanitizeSettings } = require('./store');
const { addFocusSession, buildStatistics } = require('./statistics');
const { createSessionRecord } = require('./session-history');
const { createHistoryCsv, createStatisticsCsv } = require('./csv-export');

const APP_ID = 'com.focus-tracker.desktop';
const TICK_INTERVAL_MS = 250;
const DEFAULT_SOUND_FILE = 'faceit_accept_sound_epic_-8962405019821701368.mp3';
let mainWindow = null;
let tray = null;
let store = null;
let settings = { ...DEFAULT_SETTINGS };
let timerState = null;
let tickHandle = null;
let shouldQuit = false;
let dailyActivity = {};
let sessionHistory = [];
let microMode = false;
let expiredModeWhileClosed = 'focus';
let startupCompletionPending = false;

app.setAppUserModelId(APP_ID);
if (!app.isPackaged && process.env.FOCUS_TRACKER_USER_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.FOCUS_TRACKER_USER_DATA_DIR));
}
const gotLock = app.requestSingleInstanceLock();

function snapshot() {
  return {
    timer: { ...timerState, remainingMs: remainingMs(timerState, Date.now()) },
    statistics: buildStatistics(dailyActivity),
    settings: {
      ...settings,
      soundAlertUrl: pathToFileURL(settings.soundAlertFile
        ? path.join(app.getPath('userData'), 'sounds', settings.soundAlertFile)
        : path.join(__dirname, '..', 'assets', DEFAULT_SOUND_FILE)).href,
    },
    runtime: {
      packaged: app.isPackaged,
      platform: process.platform,
      windowMode: microMode ? 'micro' : 'dashboard',
    },
  };
}

function persist() {
  if (!store || !timerState) return;
  try {
    store.save({ settings, timer: timerState, activity: dailyActivity });
  } catch (error) {
    console.error('Could not persist Focus Tracker state:', error);
  }
}

function recordCompletedSession(mode, completedAt, durationMs) {
  const record = createSessionRecord(mode, completedAt, durationMs);
  sessionHistory = [record, ...sessionHistory];
  if (store) {
    try {
      sessionHistory = store.saveSessionHistory(sessionHistory);
    } catch (error) {
      console.error('Could not persist completed session history:', error);
      mainWindow?.webContents.send('history:error');
    }
  }
  if (mode === 'focus') dailyActivity = addFocusSession(dailyActivity, completedAt, durationMs / 60_000);
}

function sendSnapshot(completed = false, completedMode = null) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) return;
  const snapshotData = snapshot();
  if (completed) snapshotData.completedMode = completedMode;
  const channel = completed ? 'timer:complete' : 'timer:tick';
  mainWindow.webContents.send(channel, snapshotData);
}

function showCompletionNotification(previousMode) {
  if (!settings.notifications || !Notification.isSupported()) return;
  const text = previousMode === 'focus'
    ? `Focus session ${timerState.completedSessions} complete. ${timerState.mode === 'longBreak' ? 'Your long break is ready.' : 'Take a short breather.'}`
    : 'Break complete. Your next focus session is ready.';
  try {
    new Notification({ title: 'Focus Tracker', body: text, silent: true }).show();
  } catch (error) {
    console.error('Desktop notification failed:', error);
  }
}

function runCommand(action, value) {
  const now = Date.now();
  const previousTimer = timerState;
  let completedMode = null;
  switch (action) {
    case 'start': timerState = startTimer(timerState, now, settings); break;
    case 'pause': {
      const previousMode = timerState.mode;
      timerState = pauseTimer(timerState, now, settings);
      if (timerState.status === 'idle' && timerState.mode !== previousMode) completedMode = previousMode;
      break;
    }
    case 'resume': {
      const previousMode = timerState.mode;
      timerState = resumeTimer(timerState, now, settings);
      if (timerState.status === 'idle' && timerState.mode !== previousMode) completedMode = previousMode;
      break;
    }
    case 'reset': timerState = resetTimer(timerState, settings); break;
    case 'mode':
      if (!MODES.includes(value)) throw new RangeError('Unknown timer mode');
      timerState = selectMode(timerState, value, settings);
      break;
    default: throw new RangeError('Unknown timer command');
  }
  if (completedMode !== null) {
    const completedAt = Number.isFinite(previousTimer.deadlineAt) ? new Date(previousTimer.deadlineAt) : new Date(now);
    recordCompletedSession(completedMode, completedAt, durationFor(completedMode, settings));
  }
  persist();
  updateTrayMenu();
  if (completedMode !== null) {
    showCompletionNotification(completedMode);
    sendSnapshot(true, completedMode);
  } else {
    sendSnapshot();
  }
  return snapshot();
}

function applyLoginSetting() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, path: app.getPath('exe') });
  } catch (error) {
    console.error('Could not update Windows startup setting:', error);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const actionLabel = timerState?.status === 'running' ? 'Pause timer' : timerState?.status === 'paused' ? 'Resume timer' : 'Start timer';
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Focus Tracker', enabled: false },
    { type: 'separator' },
    { label: actionLabel, click: () => runCommand(timerState.status === 'running' ? 'pause' : timerState.status === 'paused' ? 'resume' : 'start') },
    { label: 'Reset current session', click: () => runCommand('reset') },
    { label: 'Show dashboard', click: showWindow },
    { type: 'separator' },
    { label: 'Quit Focus Tracker', click: () => app.quit() },
  ]));
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function setMicroMode() {
  if (!mainWindow) return microMode;
  microMode = true;
  mainWindow.setMinimumSize(208, 38);
  mainWindow.setSize(320, 52, true);
  return true;
}

function expandDashboard() {
  if (!mainWindow) return false;
  microMode = false;
  mainWindow.setMinimumSize(900, 640);
  mainWindow.setSize(1160, 740, true);
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: microMode ? 320 : 1160,
    height: microMode ? 52 : 740,
    minWidth: microMode ? 208 : 900,
    minHeight: microMode ? 38 : 640,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#111127',
    title: 'Focus Tracker',
    icon: path.join(__dirname, '..', 'assets', 'focus-mark.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    console.log('Focus Tracker window is ready.');
    mainWindow.show();
    sendSnapshot();
  });
  mainWindow.webContents.on('did-finish-load', () => console.log('Focus Tracker UI loaded.'));
  mainWindow.webContents.on('did-finish-load', () => {
    if (startupCompletionPending) {
      startupCompletionPending = false;
      sendSnapshot(true, expiredModeWhileClosed);
    }
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => console.error('Focus Tracker UI failed to load:', code, description, url));
  mainWindow.on('close', (event) => {
    if (!shouldQuit) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Focus Tracker renderer exited:', details.reason);
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'focus-mark.png')).resize({ width: 16, height: 16 }));
  tray.setToolTip('Focus Tracker');
  tray.on('click', showWindow);
  updateTrayMenu();
}

function registerIpc() {
  ipcMain.handle('state:get', () => snapshot());
  ipcMain.handle('history:get', () => sessionHistory);
  ipcMain.handle('history:clear', async () => {
    if (sessionHistory.length === 0) return false;
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Clear History',
      message: 'Clear all session history?',
      detail: 'This permanently removes the saved session records. Statistics will not be affected.',
      buttons: ['Cancel', 'Clear History'],
      defaultId: 0,
      cancelId: 0,
    });
    if (confirmation.response !== 1) return false;
    sessionHistory = store.saveSessionHistory([]);
    return true;
  });
  ipcMain.handle('data:export', async (_event, kind) => {
    if (kind !== 'history' && kind !== 'statistics') throw new RangeError('Unknown export type');
    const date = new Date();
    const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const isHistory = kind === 'history';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${isHistory ? 'History' : 'Statistics'}`,
      defaultPath: path.join(app.getPath('documents'), `focus-tracker-${kind}-${dateLabel}.csv`),
      filters: [{ name: 'CSV file', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return null;
    const csv = isHistory
      ? createHistoryCsv(sessionHistory)
      : createStatisticsCsv(dailyActivity, date);
    fs.writeFileSync(result.filePath, csv, 'utf8');
    return path.basename(result.filePath);
  });
  ipcMain.handle('timer:command', (_event, request) => {
    if (!request || typeof request !== 'object') throw new TypeError('Invalid timer command');
    return runCommand(request.action, request.value);
  });
  ipcMain.handle('settings:save', (_event, submitted) => {
    const mergedSettings = sanitizeSettings({ ...settings, ...(submitted && typeof submitted === 'object' ? submitted : {}) });
    const durationsChanged = mergedSettings.focusMinutes !== settings.focusMinutes
      || mergedSettings.shortBreakMinutes !== settings.shortBreakMinutes
      || mergedSettings.longBreakMinutes !== settings.longBreakMinutes;
    const breakCycleChanged = mergedSettings.sessionsUntilLongBreak !== settings.sessionsUntilLongBreak;
    settings = mergedSettings;
    applyLoginSetting();
    if (durationsChanged) timerState = resetTimer(timerState, settings);
    else if (breakCycleChanged) timerState = { ...timerState, focusInCycle: 0 };
    mainWindow?.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
    persist();
    sendSnapshot();
    return snapshot();
  });
  ipcMain.handle('sound:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a session alert sound',
      properties: ['openFile'],
      filters: [{ name: 'Audio files', extensions: ['wav', 'mp3', 'ogg', 'm4a'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const sourcePath = result.filePaths[0];
    const extension = path.extname(sourcePath).slice(1).toLowerCase();
    const allowedExtensions = ['wav', 'mp3', 'ogg', 'm4a'];
    if (!allowedExtensions.includes(extension)) throw new TypeError('Unsupported alert sound format');
    const fileInfo = fs.statSync(sourcePath);
    if (!fileInfo.isFile() || fileInfo.size === 0 || fileInfo.size > 10 * 1024 * 1024) {
      throw new RangeError('Choose an audio file smaller than 10 MB');
    }

    const fileName = `alert-${randomUUID()}.${extension}`;
    const soundDirectory = path.join(app.getPath('userData'), 'sounds');
    fs.mkdirSync(soundDirectory, { recursive: true });
    fs.copyFileSync(sourcePath, path.join(soundDirectory, fileName));
    settings = sanitizeSettings({ ...settings, soundAlertFile: fileName });
    persist();
    sendSnapshot();
    return snapshot();
  });
  ipcMain.handle('sound:reset', () => {
    settings = sanitizeSettings({ ...settings, soundAlertFile: null });
    persist();
    sendSnapshot();
    return snapshot();
  });
  ipcMain.handle('window:action', (_event, action) => {
    if (action === 'minimize') mainWindow?.minimize();
    else if (action === 'hide') mainWindow?.hide();
    else if (action === 'micro') return setMicroMode();
    else if (action === 'expand') return expandDashboard();
    else throw new RangeError('Unknown window action');
    return true;
  });
}

function beginTimerLoop() {
  clearInterval(tickHandle);
  tickHandle = setInterval(() => {
    if (timerState.status === 'running' && remainingMs(timerState, Date.now()) <= 0) {
      const previousMode = timerState.mode;
      const completedAt = Number.isFinite(timerState.deadlineAt) ? new Date(timerState.deadlineAt) : new Date();
      const completedDuration = durationFor(previousMode, settings);
      timerState = finishSession(timerState, settings);
      recordCompletedSession(previousMode, completedAt, completedDuration);
      persist();
      updateTrayMenu();
      showCompletionNotification(previousMode);
      sendSnapshot(true, previousMode);
      return;
    }
    sendSnapshot();
  }, TICK_INTERVAL_MS);
}

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    console.log('Focus Tracker main process started.');
    store = createStore(app.getPath('userData'));
    const saved = store.load();
    sessionHistory = store.loadSessionHistory();
    settings = sanitizeSettings(saved.settings);
    dailyActivity = saved.activity;
    const now = Date.now();
    const restoredMode = saved.timer?.mode;
    const validRestoredMode = MODES.includes(restoredMode);
    const expiredWhileClosed = validRestoredMode
      && saved.timer?.status === 'running'
      && Number.isFinite(saved.timer.deadlineAt)
      && saved.timer.deadlineAt <= now;
    const restoredPausedAtZero = validRestoredMode
      && saved.timer?.status === 'paused'
      && Number.isFinite(saved.timer.remainingMs)
      && saved.timer.remainingMs <= 0;
    const completedAtStartup = expiredWhileClosed || restoredPausedAtZero;
    expiredModeWhileClosed = validRestoredMode ? restoredMode : 'focus';
    startupCompletionPending = completedAtStartup;
    timerState = restoreTimerState(saved.timer, settings, now);
    if (completedAtStartup) {
      recordCompletedSession(
        expiredModeWhileClosed,
        new Date(expiredWhileClosed ? saved.timer.deadlineAt : now),
        durationFor(expiredModeWhileClosed, settings),
      );
    }
    applyLoginSetting();
    registerIpc();
    createWindow();
    createTray();
    beginTimerLoop();
    if (completedAtStartup) {
      persist();
      showCompletionNotification(expiredModeWhileClosed);
    }
  }).catch((error) => {
    console.error('Focus Tracker could not start:', error);
    app.quit();
  });

  app.on('activate', showWindow);
  app.on('before-quit', () => {
    shouldQuit = true;
    clearInterval(tickHandle);
    persist();
    tray?.destroy();
  });
}
