// ============================================================
//  app.js — Main controller
//  Handles: audio unlock, polling, order evaluation,
//           settings panel, test mode, all event listeners
// ============================================================

// ============================================================
//  STATE
// ============================================================
let _pollInterval  = 30000;
let _soundMuted    = false;
let _settingsOpen  = false;

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Render skeleton cards immediately so UI feels alive
  renderTokenCards();
  renderOrders();
  renderHistory();
  populateTokenSelects();
  populateSoundSelector();
  loadSettings();
  bindEvents();

  // Status: initializing
  setStatus('loading', 'INICIALIZANDO');
});

// ============================================================
//  AUDIO UNLOCK — THE CRITICAL FIX
//  The Web Audio API requires a user gesture to create the
//  AudioContext. We intercept the first click on the overlay,
//  initialize audio, then hide the overlay and start the app.
// ============================================================
function handleUnlock() {
  initAudio();

  // Request browser notification permission while we have the gesture
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  // Hide overlay with a smooth fade
  const overlay = document.getElementById('audio-unlock-overlay');
  overlay.style.transition = 'opacity 0.5s ease';
  overlay.style.opacity    = '0';
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.style.opacity = '';
  }, 500);

  // Boot the app
  bootApp();
}

function bootApp() {
  setStatus('loading', 'CARGANDO PRECIOS');

  // Wire price update callback
  setPriceUpdateCallback(onPriceUpdate);

  // Start polling
  startPolling(_pollInterval);

  // Resolve logos in background (non-blocking)
  setTimeout(resolveAllLogos, 1500);
}

// ============================================================
//  PRICE UPDATE CALLBACK
//  Called by prices.js after every fetch cycle
// ============================================================
function onPriceUpdate() {
  // Update status indicator
  const anyError = TOKENS.every(t => priceState[t.address].error);
  const anyOk    = TOKENS.some(t => priceState[t.address].price !== null && !priceState[t.address].error);

  if (anyError) {
    setStatus('error', 'SIN DATOS');
    setSourceBadge('error');
  } else if (anyOk) {
    setStatus('live', 'EN VIVO');
    setSourceBadge(getActiveSource());
  } else {
    setStatus('loading', 'CARGANDO');
  }

  // Update each card price live (no full re-render)
  TOKENS.forEach(t => updateCardPrice(t.address));

  // Update ticker
  updateTicker();

  // Update order symbols if needed
  updateOrderSymbols();

  // Evaluate limit orders
  const fired = evaluateOrders();
  fired.forEach(order => {
    fireAlert({ order, currentPrice: order.currentPrice });
    // Flash the card
    const card = document.getElementById('card-' + order.tokenAddress);
    if (card) {
      card.classList.add('alert-triggered');
      setTimeout(() => card.classList.remove('alert-triggered'), 1200);
    }
    // Refresh orders list
    renderOrders();
  });

  // Refresh history if alerts were fired
  if (fired.length > 0) renderHistory();
}

// ============================================================
//  EVENT BINDINGS
// ============================================================
function bindEvents() {
  // ---- Unlock button ----
  const unlockBtn = document.getElementById('unlock-btn');
  if (unlockBtn) unlockBtn.addEventListener('click', handleUnlock);

  // Also allow clicking anywhere on the overlay
  const audioOverlay = document.getElementById('audio-unlock-overlay');
  if (audioOverlay) {
    audioOverlay.addEventListener('click', e => {
      // Only fire if clicking overlay itself or the button
      if (e.target === audioOverlay || e.target.id === 'unlock-btn') {
        handleUnlock();
      }
    });
  }

  // ---- Header controls ----
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    setStatus('loading', 'ACTUALIZANDO');
    fetchAllPrices();
  });

  document.getElementById('sound-btn')?.addEventListener('click', () => {
    _soundMuted = !_soundMuted;
    setSoundEnabled(!_soundMuted);
    const btn = document.getElementById('sound-btn');
    if (btn) {
      btn.textContent = _soundMuted ? '🔕' : '🔔';
      btn.classList.toggle('active', !_soundMuted);
    }
  });

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    if (_settingsOpen) closeSettings(); else openSettings();
    _settingsOpen = !_settingsOpen;
  });

  document.getElementById('close-settings-btn')?.addEventListener('click', () => {
    closeSettings();
    _settingsOpen = false;
  });

  // ---- Order form ----
  document.getElementById('add-order-btn')?.addEventListener('click', openOrderForm);
  document.getElementById('cancel-order-btn')?.addEventListener('click', closeOrderForm);

  document.getElementById('save-order-btn')?.addEventListener('click', () => {
    const address     = document.getElementById('order-token')?.value;
    const type        = document.getElementById('order-type')?.value;
    const priceRaw    = document.getElementById('order-price')?.value;
    const note        = document.getElementById('order-note')?.value?.trim();
    const repeat      = document.getElementById('order-repeat')?.checked;
    const browserNotify = document.getElementById('order-notify')?.checked;

    const price = parseFloat(priceRaw);
    if (!address || !type || isNaN(price) || price <= 0) {
      showToast('⚠ Error', 'Completá todos los campos correctamente.', 'alert');
      return;
    }

    addOrder({ tokenAddress: address, type, price, note, repeat, browserNotify });
    closeOrderForm();
    renderOrders();
    renderTokenCards(); // refresh chips
    showToast('✓ Orden creada', `Alerta configurada a ${formatPrice(price)}`, 'success');
  });

  // ---- Alert history ----
  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    clearHistory();
    renderHistory();
  });

  // ---- Settings: refresh interval ----
  document.getElementById('refresh-interval')?.addEventListener('change', e => {
    _pollInterval = parseInt(e.target.value);
    restartPolling(_pollInterval);
    saveSettings();
  });

  // ---- Settings: volume ----
  const volSlider = document.getElementById('alert-volume');
  const volDisplay = document.getElementById('volume-display');
  volSlider?.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (volDisplay) volDisplay.textContent = Math.round(v * 100) + '%';
    saveSettings();
  });

  // ---- Settings: sound type ----
  document.getElementById('alert-sound')?.addEventListener('change', e => {
    setSoundType(e.target.value);
    saveSettings();
  });

  // ---- Settings: test sound button ----
  document.getElementById('test-sound-btn')?.addEventListener('click', () => {
    const type = document.getElementById('alert-sound')?.value || 'executive';
    playSound(type, 1);
  });

  // ---- Settings: browser notifications ----
  document.getElementById('browser-notifications')?.addEventListener('change', async e => {
    if (e.target.checked) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        e.target.checked = false;
        showToast('⚠ Notificaciones', 'Permiso denegado por el navegador.', 'alert');
      }
    }
    saveSettings();
  });

  // ---- Test mode: custom price row toggle ----
  document.getElementById('test-direction')?.addEventListener('change', e => {
    const row = document.getElementById('custom-price-row');
    if (row) row.classList.toggle('hidden', e.target.value !== 'custom');
  });

  // ---- Test mode: run simulation ----
  document.getElementById('run-test-btn')?.addEventListener('click', runTestMode);

  // ---- Price source selector ----
  document.getElementById('price-source')?.addEventListener('change', e => {
    // For future extension; currently source auto-switches
    saveSettings();
  });
}

// ============================================================
//  TEST MODE
// ============================================================
function runTestMode() {
  const tokenAddr = document.getElementById('test-token')?.value;
  const direction = document.getElementById('test-direction')?.value;
  const resultEl  = document.getElementById('test-result');

  if (!tokenAddr) return;

  const state = priceState[tokenAddr];
  const base  = (state?.price !== null && state?.price > 0)
    ? state.price
    : 0.001; // fallback if no price loaded yet

  let simPrice;
  switch (direction) {
    case 'crash':      simPrice = base * 0.70; break;
    case 'pump':       simPrice = base * 1.40; break;
    case 'slight_down':simPrice = base * 0.95; break;
    case 'slight_up':  simPrice = base * 1.05; break;
    case 'custom': {
      const raw = parseFloat(document.getElementById('test-custom-price')?.value);
      if (isNaN(raw) || raw <= 0) {
        showTestResult('⚠ Ingresá un precio válido mayor a 0.', 'warning');
        return;
      }
      simPrice = raw;
      break;
    }
    default: simPrice = base;
  }

  // Apply simulation
  simulatePrice(tokenAddr, simPrice);
  updateCardPrice(tokenAddr);
  updateTicker();

  // Evaluate orders with simulated price
  const fired = evaluateOrders();
  fired.forEach(order => {
    fireAlert({ order, currentPrice: simPrice, isTest: true });
    renderOrders();
  });
  renderHistory();

  // Also fire a test alert directly to demo the sound/notification system
  const sym = state?.symbol || shortAddress(tokenAddr);
  const dirLabel = {
    crash: 'CRASH −30%', pump: 'PUMP +40%',
    slight_down: 'Baja leve −5%', slight_up: 'Suba leve +5%',
    custom: 'Precio manual',
  }[direction] || direction;

  playSound(document.getElementById('alert-sound')?.value || 'executive', 1);
  showToast(`🧪 ${sym} · ${dirLabel}`, `Precio simulado: ${formatPrice(simPrice)}`, 'info');

  addHistoryEntry({
    type:         'test',
    tokenAddress: tokenAddr,
    tokenSymbol:  sym,
    targetPrice:  simPrice,
    currentPrice: simPrice,
    note:         `Simulación: ${dirLabel}`,
    isTest:       true,
  });
  renderHistory();

  showTestResult(`✓ Simulación activa: ${sym} → ${formatPrice(simPrice)}`, 'success');

  // Restore real prices after 15s
  setTimeout(() => {
    clearSimulation(tokenAddr);
    TOKENS.forEach(t => updateCardPrice(t.address));
    updateTicker();
    showTestResult('↺ Precios reales restaurados.', 'warning');
    setTimeout(() => {
      if (resultEl) resultEl.classList.add('hidden');
    }, 4000);
  }, 15000);
}

function showTestResult(msg, type) {
  const el = document.getElementById('test-result');
  if (!el) return;
  el.textContent = msg;
  el.className   = `test-result ${type}`;
  el.classList.remove('hidden');
}

// ============================================================
//  SETTINGS PERSISTENCE
// ============================================================
const SETTINGS_KEY = 'token_alarm_settings';

function saveSettings() {
  const s = {
    pollInterval:   _pollInterval,
    soundMuted:     _soundMuted,
    volume:         parseFloat(document.getElementById('alert-volume')?.value || 0.7),
    soundType:      document.getElementById('alert-sound')?.value || 'executive',
    notifications:  document.getElementById('browser-notifications')?.checked || false,
    priceSource:    document.getElementById('price-source')?.value || 'dexscreener',
    refreshInterval:document.getElementById('refresh-interval')?.value || '30000',
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);

    if (s.pollInterval) {
      _pollInterval = s.pollInterval;
      const sel = document.getElementById('refresh-interval');
      if (sel) sel.value = String(s.pollInterval);
    }

    if (s.soundMuted !== undefined) {
      _soundMuted = s.soundMuted;
      setSoundEnabled(!_soundMuted);
      const btn = document.getElementById('sound-btn');
      if (btn) {
        btn.textContent = _soundMuted ? '🔕' : '🔔';
        btn.classList.toggle('active', !_soundMuted);
      }
    }

    if (s.volume !== undefined) {
      setVolume(s.volume);
      const slider = document.getElementById('alert-volume');
      const display = document.getElementById('volume-display');
      if (slider)  slider.value = String(s.volume);
      if (display) display.textContent = Math.round(s.volume * 100) + '%';
    }

    if (s.soundType) {
      setSoundType(s.soundType);
      // Selector populated later by populateSoundSelector(), set via timeout
      setTimeout(() => {
        const sel = document.getElementById('alert-sound');
        if (sel) sel.value = s.soundType;
      }, 50);
    }

    if (s.notifications && document.getElementById('browser-notifications')) {
      document.getElementById('browser-notifications').checked = s.notifications;
    }

    if (s.priceSource && document.getElementById('price-source')) {
      document.getElementById('price-source').value = s.priceSource;
    }
  } catch {}
}
