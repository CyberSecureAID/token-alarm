// ============================================================
//  alerts.js — Alert system: advanced synthesized sounds,
//              browser notifications, toast, history
// ============================================================

const HISTORY_KEY = 'token_alarm_history';
const MAX_HISTORY = 200;

let _audioCtx      = null;
let _soundEnabled  = true;
let _volume        = 0.7;
let _intensity     = 0.6;
let _repeatCount   = 1;
let _soundType     = 'executive';
let _audioUnlocked = false;

function initAudio() {
  try {
    _audioCtx      = new (window.AudioContext || window.webkitAudioContext)();
    _audioUnlocked = true;
  } catch (e) {
    console.warn('[alerts] Web Audio API not available:', e.message);
  }
}

function setSoundEnabled(v)  { _soundEnabled = !!v; }
function setVolume(v)        { _volume       = Math.max(0, Math.min(1, parseFloat(v))); }
function setIntensity(v)     { _intensity    = Math.max(0, Math.min(1, parseFloat(v))); }
function setRepeatCount(v)   { _repeatCount  = Math.max(1, Math.min(10, parseInt(v) || 1)); }
function setSoundType(v)     { _soundType    = v; }

const SOUND_CATALOG = {
  executive:    { label: 'Executive',    fn: sndExecutive    },
  pulse:        { label: 'Pulse',        fn: sndPulse        },
  chime:        { label: 'Chime',        fn: sndChime        },
  digital:      { label: 'Digital',      fn: sndDigital      },
  sonar:        { label: 'Sonar',        fn: sndSonar        },
  alarm:        { label: 'Alarm',        fn: sndAlarm        },
  notification: { label: 'Notification', fn: sndNotification },
  siren:        { label: 'Siren',        fn: sndSiren        },
};

function getSoundOptions() {
  return Object.entries(SOUND_CATALOG).map(([k, v]) => ({ value: k, label: v.label }));
}

function playSound(type, times) {
  if (!_audioUnlocked || !_soundEnabled || !_audioCtx) return;
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  const count   = times !== undefined ? times : _repeatCount;
  const profile = SOUND_CATALOG[type] || SOUND_CATALOG.executive;
  for (let i = 0; i < count; i++) {
    setTimeout(() => profile.fn(_audioCtx, _volume, _intensity), i * 900);
  }
}

function makeGain(ctx, vol, at, releaseAt) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.01);
  if (releaseAt !== undefined) {
    g.gain.setValueAtTime(vol, releaseAt - 0.01);
    g.gain.linearRampToValueAtTime(0, releaseAt);
  }
  return g;
}

function osc(ctx, type, freq, start, stop, gain) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.connect(gain);
  o.start(start);
  o.stop(stop);
  return o;
}

function sndExecutive(ctx, vol, intensity) {
  const t = ctx.currentTime;
  const baseFreq = 660 + intensity * 220;
  [0, 0.18].forEach((offset, i) => {
    const freq = i === 0 ? baseFreq : baseFreq * 1.25;
    const dur  = 0.35 - intensity * 0.1;
    const g    = makeGain(ctx, vol * 0.6, t + offset, t + offset + dur);
    const o    = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t + offset);
    o.connect(g);
    o.start(t + offset);
    o.stop(t + offset + dur + 0.05);
  });
}

function sndPulse(ctx, vol, intensity) {
  const t    = ctx.currentTime;
  const freq = 200 + intensity * 300;
  for (let i = 0; i < 2; i++) {
    const at = t + i * 0.22;
    const g  = makeGain(ctx, vol * 0.8, at, at + 0.15);
    osc(ctx, 'sine', freq, at, at + 0.18, g);
    const g2 = makeGain(ctx, vol * 0.2, at, at + 0.12);
    osc(ctx, 'sine', freq * 2, at, at + 0.15, g2);
  }
}

function sndChime(ctx, vol, intensity) {
  const t     = ctx.currentTime;
  const scale = [1, 1.25, 1.5, 2];
  const base  = 440 + intensity * 220;
  scale.forEach((ratio, i) => {
    const at  = t + i * 0.13;
    const dur = 0.5 - i * 0.05;
    const g   = makeGain(ctx, vol * 0.5, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc(ctx, 'sine', base * ratio, at, at + dur + 0.05, g);
  });
}

function sndDigital(ctx, vol, intensity) {
  const t     = ctx.currentTime;
  const freq  = 800 + intensity * 800;
  const steps = [1, 0.8, 1, 1.2];
  steps.forEach((ratio, i) => {
    const at = t + i * 0.06;
    const g  = makeGain(ctx, vol * 0.7, at, at + 0.05);
    osc(ctx, 'square', freq * ratio, at, at + 0.06, g);
  });
}

function sndSonar(ctx, vol, intensity) {
  const t    = ctx.currentTime;
  const freq = 220 + intensity * 180;
  const g    = makeGain(ctx, vol * 0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.8);
  o.connect(g); o.start(t); o.stop(t + 1.3);
  const g2 = makeGain(ctx, vol * 0.3, t + 0.5);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(freq, t + 0.5);
  o2.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 1.2);
  o2.connect(g2); o2.start(t + 0.5); o2.stop(t + 1.6);
}

function sndAlarm(ctx, vol, intensity) {
  const t    = ctx.currentTime;
  const lo   = 300 + intensity * 200;
  const hi   = lo * 2.2;
  const reps = Math.max(2, Math.round(intensity * 4));
  for (let i = 0; i < reps; i++) {
    const at  = t + i * 0.22;
    const dur = 0.18;
    const g   = makeGain(ctx, vol, at, at + dur);
    const o   = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(lo, at);
    o.frequency.linearRampToValueAtTime(hi, at + dur);
    o.connect(g); o.start(at); o.stop(at + dur + 0.02);
  }
}

function sndNotification(ctx, vol, intensity) {
  const t    = ctx.currentTime;
  const freq = 1000 + intensity * 500;
  const g    = makeGain(ctx, vol * 0.6, t);
  g.gain.setValueAtTime(vol * 0.6, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.75, t + 0.25);
  o.connect(g); o.start(t); o.stop(t + 0.35);
}

function sndSiren(ctx, vol, intensity) {
  const t  = ctx.currentTime;
  const lo = 250 + intensity * 150;
  const hi = lo * 4;
  const g  = makeGain(ctx, vol, t);
  g.gain.setValueAtTime(vol, t + 0.9);
  g.gain.linearRampToValueAtTime(0, t + 1.2);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(lo, t);
  o.frequency.linearRampToValueAtTime(hi, t + 0.6);
  o.frequency.linearRampToValueAtTime(lo, t + 1.2);
  o.connect(g); o.start(t); o.stop(t + 1.3);
}

// ============================================================
//  BROWSER NOTIFICATIONS
// ============================================================
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  return (await Notification.requestPermission()) === 'granted';
}

function sendBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon:     'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="24" font-size="24">🔔</text></svg>',
    tag:      'token-alarm',
    renotify: true,
  });
  setTimeout(() => n.close(), 9000);
}

// ============================================================
//  HISTORY
// ============================================================
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

// ============================================================
//  FIRE ALERT
// ============================================================
function fireAlert({ order, currentPrice, isTest = false }) {
  const symbol    = order.tokenSymbol || 'USDT.z';
  const tag       = contractTag(order.tokenAddress);
  const direction = order.type === 'below' ? '📉 bajó de' : '📈 subió a';
  const title     = `⚡ ${symbol} (${tag}) ${direction} ${formatPrice(order.price)}`;
  const body      = `Precio actual: ${formatPrice(currentPrice)}${order.note ? ` — ${order.note}` : ''}`;

  playSound(_soundType);

  if (order.browserNotify !== false) {
    sendBrowserNotification(title, body);
  }

  showToast(title, body, isTest ? 'info' : 'alert');

  addHistoryEntry({
    type:         order.type,
    tokenAddress: order.tokenAddress,
    tokenSymbol:  symbol,
    targetPrice:  order.price,
    currentPrice,
    note:         order.note,
    isTest,
  });

  return { title, body };
}

// ============================================================
//  TOAST
// ============================================================
let _toastTimer = null;

function showToast(title, msg, variant = 'alert') {
  const toast  = document.getElementById('alert-toast');
  const tTitle = document.getElementById('toast-title');
  const tMsg   = document.getElementById('toast-msg');
  if (!toast || !tTitle || !tMsg) return;

  tTitle.textContent = title;
  tMsg.textContent   = msg;
  toast.className    = 'alert-toast' + (variant === 'success' ? ' success' : '');
  toast.classList.remove('hidden');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(closeToast, 8000);
}

function closeToast() {
  const t = document.getElementById('alert-toast');
  if (t) t.classList.add('hidden');
}
