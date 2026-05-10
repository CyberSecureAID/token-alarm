// ============================================================
//  alerts.js — Alert system: sound, browser notifications, history
// ============================================================

const HISTORY_KEY  = 'token_alarm_history';
const MAX_HISTORY  = 100;

let _audioCtx      = null;
let _soundEnabled  = true;
let _volume        = 0.7;
let _soundType     = 'alarm';
let _audioUnlocked = false;

// ---- Audio Context ----
function initAudio() {
  try {
    _audioCtx      = new (window.AudioContext || window.webkitAudioContext)();
    _audioUnlocked = true;
  } catch (e) {
    console.warn('[alerts] Web Audio API not available');
  }
}

function setSoundEnabled(v) { _soundEnabled = v; }
function setVolume(v)       { _volume = parseFloat(v); }
function setSoundType(v)    { _soundType = v; }

// ---- Sound Generators ----
function playSound(type) {
  if (!_audioUnlocked || !_soundEnabled || !_audioCtx) return;

  const ctx = _audioCtx;
  const vol = _volume;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol, ctx.currentTime);

  switch (type) {
    case 'beep':    playBeep(ctx, gain); break;
    case 'alarm':   playAlarm(ctx, gain); break;
    case 'chime':   playChime(ctx, gain); break;
    case 'siren':   playSiren(ctx, gain); break;
    default:        playAlarm(ctx, gain);
  }
}

function playBeep(ctx, gain) {
  const osc = ctx.createOscillator();
  osc.connect(gain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

function playAlarm(ctx, gain) {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t + i * 0.25);
    osc.frequency.linearRampToValueAtTime(880, t + i * 0.25 + 0.12);
    gain.gain.setValueAtTime(gain.gain.value, t + i * 0.25);
    gain.gain.linearRampToValueAtTime(0, t + i * 0.25 + 0.22);
    osc.start(t + i * 0.25);
    osc.stop(t + i * 0.25 + 0.23);
  }
}

function playChime(ctx, gain) {
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g2 = ctx.createGain();
    osc.connect(g2);
    g2.connect(ctx.destination);
    g2.gain.setValueAtTime(_volume, ctx.currentTime + i * 0.15);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.5);
  });
}

function playSiren(ctx, gain) {
  const osc = ctx.createOscillator();
  osc.connect(gain);
  osc.type = 'sawtooth';
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.linearRampToValueAtTime(1200, t + 0.4);
  osc.frequency.linearRampToValueAtTime(300, t + 0.8);
  osc.frequency.linearRampToValueAtTime(1200, t + 1.2);
  gain.gain.setValueAtTime(_volume, t);
  gain.gain.linearRampToValueAtTime(0, t + 1.4);
  osc.start(t);
  osc.stop(t + 1.5);
}

// ---- Browser Notifications ----
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

function sendBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon:    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="24" font-size="24">🔔</text></svg>',
    badge:   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="24" font-size="24">⚡</text></svg>',
    vibrate: [200, 100, 200],
  });
  setTimeout(() => n.close(), 8000);
}

// ---- Alert History ----
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(h) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
}

function addHistoryEntry(entry) {
  const h = loadHistory();
  h.unshift({ ...entry, id: Date.now().toString(36), ts: new Date().toISOString() });
  saveHistory(h);
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// ---- Fire an alert ----
function fireAlert({ order, currentPrice, isTest = false }) {
  const symbol = order.tokenSymbol || shortAddress(order.tokenAddress);
  const direction = order.type === 'below' ? '📉 cayó por debajo de' : '📈 subió sobre';
  const title = `⚡ ${symbol} ${direction} ${formatPrice(order.price)}`;
  const body  = `Precio actual: ${formatPrice(currentPrice)}${order.note ? ` — ${order.note}` : ''}`;

  // Play sound
  playSound(_soundType);

  // Browser notification
  if (order.browserNotify !== false) {
    sendBrowserNotification(title, body);
  }

  // Toast
  showToast(title, body, isTest ? 'info' : 'danger');

  // History
  addHistoryEntry({
    type:          order.type,
    tokenAddress:  order.tokenAddress,
    tokenSymbol:   symbol,
    targetPrice:   order.price,
    currentPrice,
    note:          order.note,
    isTest,
  });

  return { title, body };
}

// ---- Show Toast ----
let _toastTimer = null;
function showToast(title, msg, variant = 'danger') {
  const toast   = document.getElementById('alert-toast');
  const tTitle  = document.getElementById('toast-title');
  const tMsg    = document.getElementById('toast-msg');

  tTitle.textContent = title;
  tMsg.textContent   = msg;
  toast.className = 'alert-toast' + (variant === 'success' ? ' success' : '');
  toast.classList.remove('hidden');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(closeToast, 7000);
}

function closeToast() {
  document.getElementById('alert-toast').classList.add('hidden');
}
