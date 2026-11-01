const MODE_INFO = {
  focus: { label: 'Focus Session', short: 'FOCUS', running: 'Focusing' },
  shortBreak: { label: 'Short Break', short: 'SHORT BREAK', running: 'On a short break' },
  longBreak: { label: 'Long Break', short: 'LONG BREAK', running: 'On a long break' },
};
const VIEW_TITLES = { timer: 'Timer', statistics: 'Statistics', history: 'History', settings: 'Settings' };
const state = {
  timer: null,
  settings: null,
  statistics: null,
  sessionHistory: [],
  historyRequestId: 0,
  toastTimeout: null,
  currentView: 'timer',
  previewAudio: null,
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function durationForCurrentMode() {
  const key = { focus: 'focusMinutes', shortBreak: 'shortBreakMinutes', longBreak: 'longBreakMinutes' }[state.timer.mode];
  return (state.settings?.[key] || 25) * 60_000;
}

function renderStatistics(statistics = {}) {
  $('#stat-completed').textContent = String(statistics.completedToday || 0);
  $('#stat-today-time').textContent = formatMinutes(statistics.focusMinutesToday || 0);
  $('#stat-total-time').textContent = formatMinutes(statistics.totalFocusMinutes || 0);
  $('#stat-streak').textContent = String(statistics.streakDays || 0);

  const week = Array.isArray(statistics.week) ? statistics.week : [];
  const weeklyTotal = week.reduce((total, day) => total + day.focusMinutes, 0);
  $('#weekly-total').textContent = formatMinutes(weeklyTotal);
  const maxMinutes = Math.max(60, ...week.map((day) => day.focusMinutes));
  $('#weekly-chart').replaceChildren(...week.map((day) => {
    const item = document.createElement('div');
    item.className = `weekly-day${day.isToday ? ' today' : ''}`;
    item.setAttribute('role', 'listitem');
    item.setAttribute('aria-label', `${day.label}, ${formatMinutes(day.focusMinutes)}`);
    const barArea = document.createElement('div');
    barArea.className = 'weekly-bar-area';
    const bar = document.createElement('div');
    bar.className = 'weekly-bar';
    bar.style.setProperty('--bar-height', `${day.focusMinutes ? Math.max(4, day.focusMinutes / maxMinutes * 100) : 0}%`);
    bar.title = `${day.label}: ${formatMinutes(day.focusMinutes)}`;
    barArea.append(bar);
    const label = document.createElement('span');
    label.className = 'weekly-day-label';
    label.textContent = day.label;
    item.append(barArea, label);
    return item;
  }));
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function historyDateLabel(date, today, yesterday) {
  const key = localDateKey(date);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function renderSessionHistory(records = []) {
  const container = $('#history-list');
  const sortedRecords = [...records].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  $('[data-action="clear-history"]').hidden = sortedRecords.length === 0;
  if (sortedRecords.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'No completed sessions yet. Your history will appear here.';
    container.replaceChildren(empty);
    return;
  }

  const now = new Date();
  const today = localDateKey(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);
  const groups = new Map();
  for (const record of sortedRecords) {
    const date = new Date(record.completedAt);
    const key = localDateKey(date);
    if (!groups.has(key)) groups.set(key, { date, records: [] });
    groups.get(key).records.push(record);
  }

  const sections = [...groups.values()].map(({ date, records: dayRecords }) => {
    const group = document.createElement('section');
    group.className = 'history-group';
    const heading = document.createElement('h2');
    heading.className = 'history-date';
    heading.textContent = historyDateLabel(date, today, yesterday);
    const list = document.createElement('div');
    list.className = 'history-day-list';
    list.setAttribute('role', 'list');
    for (const record of dayRecords) {
      const row = document.createElement('article');
      row.className = `history-item ${record.mode}`;
      row.setAttribute('role', 'listitem');
      const marker = document.createElement('span');
      marker.className = 'history-mode-mark';
      marker.setAttribute('aria-hidden', 'true');
      const details = document.createElement('div');
      details.className = 'history-details';
      const mode = document.createElement('strong');
      mode.textContent = MODE_INFO[record.mode].label;
      const time = document.createElement('span');
      time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(record.completedAt));
      details.append(mode, time);
      const duration = document.createElement('span');
      duration.className = 'history-duration';
      duration.textContent = formatMinutes(record.durationMinutes);
      row.append(marker, details, duration);
      list.append(row);
    }
    group.append(heading, list);
    return group;
  });
  container.replaceChildren(...sections);
}

async function refreshSessionHistory() {
  const requestId = ++state.historyRequestId;
  try {
    const history = await window.focusTracker.getSessionHistory();
    if (requestId !== state.historyRequestId) return;
    state.sessionHistory = history;
    if (state.currentView === 'history') renderSessionHistory(history);
  } catch (error) {
    console.error('Could not load session history:', error);
    showToast('Could not load session history.');
  }
}

async function clearSessionHistory() {
  const button = $('[data-action="clear-history"]');
  button.disabled = true;
  try {
    const cleared = await window.focusTracker.clearSessionHistory();
    if (!cleared) return;
    state.historyRequestId += 1;
    state.sessionHistory = [];
    renderSessionHistory([]);
    showToast('Session history cleared. Statistics are unchanged.');
  } catch (error) {
    console.error('Could not clear session history:', error);
    showToast('Could not clear session history.');
  } finally {
    button.disabled = false;
  }
}

async function exportData(kind) {
  try {
    const fileName = await window.focusTracker.exportData(kind);
    if (fileName) showToast(`${kind === 'history' ? 'History' : 'Statistics'} exported: ${fileName}`);
  } catch (error) {
    console.error(`Could not export ${kind}:`, error);
    showToast(`Could not export ${kind}.`);
  }
}

function render(snapshot) {
  if (!snapshot?.timer || !snapshot?.settings) return;
  document.body.classList.toggle('micro', snapshot.runtime?.windowMode === 'micro');
  const previousSoundUrl = state.settings?.soundAlertUrl;
  state.timer = snapshot.timer;
  state.settings = snapshot.settings;
  if (previousSoundUrl !== state.settings.soundAlertUrl) stopSoundPreview();

  const previewButton = $('#preview-sound');
  if (previewButton) previewButton.disabled = !state.settings.soundAlertUrl;
  const soundFileLabel = $('#sound-file-label');
  if (soundFileLabel) soundFileLabel.textContent = state.settings.soundAlertFile ? 'Custom sound selected' : 'Built-in MP3';
  const startupSetting = $('#launch-setting');
  const startupInput = startupSetting.querySelector('input');
  const packaged = Boolean(snapshot.runtime?.packaged);
  startupInput.disabled = !packaged;
  startupSetting.classList.toggle('is-disabled', !packaged);
  startupSetting.querySelector('small').textContent = packaged ? 'Open Focus Tracker when you sign in.' : 'Available in the installed app.';

  const timer = state.timer;
  const info = MODE_INFO[timer.mode] || MODE_INFO.focus;
  document.body.classList.toggle('break-mode', timer.mode === 'shortBreak');
  document.body.classList.toggle('long-break-mode', timer.mode === 'longBreak');
  const remaining = Math.max(0, timer.remainingMs);
  const duration = durationForCurrentMode();
  const progress = Math.min(100, Math.max(0, (1 - remaining / duration) * 100));
  const percentage = Math.floor(progress);
  const isRunning = timer.status === 'running';
  const statusText = isRunning ? info.running : timer.status === 'paused' ? 'Paused' : 'Ready';
  document.body.classList.toggle('timer-running', isRunning);

  $('#timer-value').textContent = formatTime(remaining);
  $('#micro-time').textContent = formatTime(remaining);
  $('#micro-mode').textContent = info.short;
  $('#micro-play-symbol').textContent = isRunning ? 'Ⅱ' : '▶';
  $('#micro-progress-fill').style.height = `${progress}%`;
  $('#timer-status').textContent = statusText;
  $('#top-status-text').textContent = statusText;
  $('#progress-mode-label').textContent = info.label;
  $('#progress-percent').textContent = `${percentage}%`;
  $('#pixel-progress').setAttribute('aria-valuenow', String(percentage));
  $('#progress-fill').style.width = `${progress}%`;
  $('#play-symbol').textContent = isRunning ? 'Ⅱ' : '▶';
  $('#toggle-label').textContent = isRunning ? 'Pause' : timer.status === 'paused' ? 'Resume' : timer.mode === 'focus' ? 'Start Focus' : 'Start Break';
  $$('[data-mode]').forEach((button) => {
    const selected = button.dataset.mode === timer.mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  state.statistics = snapshot.statistics;
  if (state.currentView === 'statistics') renderStatistics(state.statistics);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function selectView(view) {
  if (!Object.hasOwn(VIEW_TITLES, view)) return;
  state.currentView = view;
  for (const [name, title] of Object.entries(VIEW_TITLES)) {
    const panel = $(`#view-${name}`);
    panel.hidden = name !== view;
    const button = $(`[data-view="${name}"]`);
    button.classList.toggle('active', name === view);
    button.setAttribute('aria-pressed', String(name === view));
    if (name === view) $('#view-title').textContent = title;
  }
  if (view === 'settings') populateSettings();
  if (view === 'statistics') renderStatistics(state.statistics);
  if (view === 'history') refreshSessionHistory();
}

function populateSettings() {
  if (!state.settings) return;
  const form = $('#preferences-form');
  for (const [key, value] of Object.entries(state.settings)) {
    const input = form.elements.namedItem(key);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = value;
    else input.value = String(value);
  }
}

async function saveSettings() {
  const form = $('#preferences-form');
  if (!form.reportValidity()) return;
  const values = {};
  for (const input of form.querySelectorAll('input[name]')) {
    values[input.name] = input.type === 'checkbox' ? input.checked : Number.parseInt(input.value, 10);
  }
  try {
    const snapshot = await window.focusTracker.saveSettings(values);
    render(snapshot);
    populateSettings();
    showToast('Settings saved on this device.');
  } catch (error) {
    console.error('Could not save settings:', error);
    showToast('Could not save settings.');
  }
}

async function command(action, value) {
  try {
    const snapshot = await window.focusTracker.command(action, value);
    if (snapshot) render(snapshot);
    return snapshot || null;
  } catch (error) {
    console.error(`Timer action "${action}" failed:`, error);
    showToast('That action could not be completed.');
    return null;
  }
}

async function toggleTimer() {
  if (!state.timer) return;
  if (state.timer.status === 'running') return command('pause');
  if (state.timer.status === 'paused') return command('resume');
  return command('start');
}

async function doWindowAction(action) {
  try {
    const result = await window.focusTracker.windowAction(action);
    if (result) document.body.classList.toggle('micro', action === 'micro');
  } catch (error) {
    console.error(`Window action "${action}" failed:`, error);
    showToast('Window action unavailable.');
  }
}

async function cycleMode() {
  const modes = ['focus', 'shortBreak', 'longBreak'];
  const currentIndex = modes.indexOf(state.timer?.mode);
  await command('mode', modes[(currentIndex + 1) % modes.length]);
}

async function chooseAlertSound() {
  try {
    const snapshot = await window.focusTracker.chooseAlertSound();
    if (!snapshot) return;
    render(snapshot);
    showToast('Custom alert sound saved.');
  } catch (error) {
    console.error('Could not select alert sound:', error);
    showToast('Could not select alert sound.');
  }
}

async function resetAlertSound() {
  try {
    const snapshot = await window.focusTracker.resetAlertSound();
    render(snapshot);
    showToast('Built-in MP3 restored.');
  } catch (error) {
    console.error('Could not restore the built-in MP3 alert:', error);
    showToast('Could not restore built-in MP3.');
  }
}

function stopSoundPreview() {
  if (!state.previewAudio) return;
  state.previewAudio.pause();
  state.previewAudio = null;
}

function previewAlertSound() {
  const soundUrl = state.settings?.soundAlertUrl;
  if (!soundUrl) {
    showToast('Default alert sound is unavailable.');
    return;
  }
  stopSoundPreview();
  const audio = new Audio(soundUrl);
  state.previewAudio = audio;
  audio.addEventListener('ended', () => {
    if (state.previewAudio === audio) state.previewAudio = null;
  }, { once: true });
  audio.play().catch((error) => {
    if (state.previewAudio === audio) state.previewAudio = null;
    console.error('Alert sound preview failed:', error);
    showToast('Could not play alert sound.');
  });
}

function playCompletionSound(snapshot) {
  if (!snapshot.settings?.soundAlerts || !snapshot.settings.soundAlertUrl) return;
  const audio = new Audio(snapshot.settings.soundAlertUrl);
  audio.play().catch((error) => console.error('Alert sound failed:', error));
}

function bindInteractions() {
  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      selectView(viewButton.dataset.view);
      return;
    }
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton) {
      command('mode', modeButton.dataset.mode);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const actions = {
      'toggle-timer': toggleTimer,
      reset: () => command('reset'),
      stop: async () => { if (await command('reset')) showToast('Session stopped and reset.'); },
      'save-settings': saveSettings,
      'choose-sound': chooseAlertSound,
      'preview-sound': previewAlertSound,
      expand: () => doWindowAction('expand'),
      micro: () => doWindowAction('micro'),
      'cycle-mode': cycleMode,
      'reset-sound': resetAlertSound,
      'clear-history': clearSessionHistory,
      'export-history': () => exportData('history'),
      'export-statistics': () => exportData('statistics'),
      minimize: () => doWindowAction('minimize'),
      close: () => doWindowAction('hide'),
    };
    actions[actionButton.dataset.action]?.();
  });

  document.addEventListener('keydown', (event) => {
    const isTyping = event.target.matches('input, textarea, select, [contenteditable="true"]');
    if (isTyping || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); toggleTimer(); }
    if (event.key.toLowerCase() === 'r') command('reset');
    const mode = { '1': 'focus', '2': 'shortBreak', '3': 'longBreak' }[event.key];
    if (mode) {
      event.preventDefault();
      command('mode', mode);
    }
  });

  window.focusTracker.onTick(render);
  window.focusTracker.onComplete((snapshot) => {
    render(snapshot);
    if (state.currentView === 'history') refreshSessionHistory();
    playCompletionSound(snapshot);
    const completedMode = snapshot.completedMode || snapshot.timer.mode;
    const completedLabel = completedMode === 'longBreak' ? 'Long break' : completedMode === 'shortBreak' ? 'Short break' : 'Focus';
    showToast(`${completedLabel} complete.`);
  });
  window.focusTracker.onHistoryError(() => {
    showToast('Session completed, but its history could not be saved.');
  });
}

async function initialize() {
  bindInteractions();
  try {
    const snapshot = await window.focusTracker.getSnapshot();
    render(snapshot);
    populateSettings();
  } catch (error) {
    console.error('Could not load saved session:', error);
    showToast('Could not load saved session.');
  }
}

initialize();
