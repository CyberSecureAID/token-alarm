// ============================================================
//  app.js — Main controller v4.1-fix
//  Fix: handleUnlock blindado con try/catch; log de errores
//       visible en consola para diagnóstico.
// ============================================================

let _pollInterval    = 30000;
let _soundMuted      = false;
let _settingsOpen    = false;
let _stalePriceTimer = null;

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    renderTokenCards();
    renderOrders();
    renderHistory();
    populateTokenSelects();
    populateSoundSelector();
    loadSettings();
    bindEvents();
    setStatus('loading', 'INICIALIZANDO');
  } catch (e) {
    console.error('[boot] Error en DOMContentLoaded:', e);
  }
});

// ============================================================
//  AUDIO UNLOCK  — blindado
// ============================================================
function handleUnlock() {
  try {
    initAudio();
  } catch (e) {
    console.warn('[unlock] initAudio error:', e);
  }

  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch (e) { /* ignorar */ }

  const overlay = document.getElementById('audio-unlock-overlay');
  if (overlay) {
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity    = '0';
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.style.opacity = '';
    }, 500);
  }

  try {
    bootApp();
  } catch (e) {
    console.error('[unlock] bootApp error:', e);
    setStatus('error', 'ERROR DE INICIO');
  }
}

function bootApp() {
  setStatus('loading', 'CARGANDO PRECIOS');
  setPriceUpdateCallback(onPriceUpdate);
  startPolling(_pollInterval);
  setTimeout(resolveAllLogos, 2000);
  startStaleWatcher();
}

// ============================================================
//  STALE WATCHER
// ============================================================
function startStaleWatcher() {
  const STALE_THRESHOLD = 90000;
  if (_stalePriceTimer) clearInterval(_stalePriceTimer);
  _stalePriceTimer = setInterval(() => {
    const now = Date.now();
    let allStale = true;
    TOKENS.forEach(t => {
      const s = priceState[t.address];
      if (s.lastUpdated && (now - new Date(s.lastUpdated).getTime()) < STALE_THRESHOLD) {
        allStale = false;
      }
    });
    if (allStale && TOKENS.some(t => !priceState[t.address].loading)) {
      console.warn('[watcher] Precios estancados → forzando actualización');
      setStatus('loading', 'RECONECTANDO');
      fetchAllPrices();
    }
  }, 45000);
}

// ============================================================
//  PRICE UPDATE CALLBACK
// ============================================================
function onPriceUpdate() {
  const allError = TOKENS.every(t => priceState[t.address].error);
  const anyOk    = TOKENS.some(t =>
    !priceState[t.address].error &&
    (priceState[t.address].price !== null || priceState[t.address].priceNative !== null)
  );

  if (allError) {
    setStatus('error', 'SIN DATOS');
    setSourceBadge('error');
  } else if (anyOk) {
    setStatus('live', 'EN VIVO');
    setSourceBadge(getActiveSource());
  } else {
    setStatus('loading', 'CARGANDO');
  }

  TOKENS.forEach(t => updateCardPrice(t.address));
  updateTicker();
  updateOrderSymbols();

  const fired = evaluateOrders();
  fired.forEach(order => {
    fireAlert({ order, currentPrice: order.currentPrice });
    const card = document.getElementById('card-' + order.tokenAddress);
    if (card) {
      card.classList.add('alert-triggered');
      setTimeout(() => card.classList.remove('alert-triggered'), 1200);
    }
    renderOrders();
  });

  if (fired.length > 0) renderHistory();
}

// ============================================================
//  EVENTS
// ============================================================
function bindEvents() {
  // Unlock — botón
  const unlockBtn = document.getElementById('unlock-btn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleUnlock();
    });
  }

  // Unlock — click en el overlay (pero NO en el botón, para evitar doble disparo)
  const audioOverlay = document.getElementById('audio-unlock-overlay');
  if (audioOverlay) {
    audioOverlay.addEventListener('click', (e) => {
      if (e.target === audioOverlay) handleUnlock();
    });
  }

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
    closeSettings(); _settingsOpen = false;
  });

  document.getElementById('add-order-btn')?.addEventListener('click', openOrderForm);
  document.getElementById('cancel-order-btn')?.addEventListener('click', closeOrderForm);

  document.getElementById('save-order-btn')?.addEventListener('click', () => {
    const address       = document.getElementById('order-token')?.value;
    const type          = document.getElementById('order-type')?.value;
    const priceRaw      = document.getElementById('order-price')?.value;
    const note          = document.getElementById('order-note')?.value?.trim();
    const repeat        = document.getElementById('order-repeat')?.checked;
    const browserNotify = document.getElementById('order-notify')?.checked;

    const price = parseFloat(priceRaw);
    if (!address || !type || isNaN(price) || price <= 0) {
      showToast('⚠ Error', 'Completá todos los campos correctamente.', 'alert');
      return;
    }

    addOrder({ tokenAddress: address, type, price, note, repeat, browserNotify });
    closeOrderForm();
    renderOrders();
    renderTokenCards();
    showToast('✓ Alerta creada', `Alerta configurada en ${formatPrice(price)}`, 'success');
  });

  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    clearHistory(); renderHistory();
  });

  document.getElementById('refresh-interval')?.addEventListener('change', e => {
    _pollInterval = parseInt(e.target.value);
    restartPolling(_pollInterval);
    saveSettings();
  });

  const volSlider  = document.getElementById('alert-volume');
  const volDisplay = document.getElementById('volume-display');
  volSlider?.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (volDisplay) volDisplay.textContent = Math.round(v * 100) + '%';
    saveSettings();
  });

  document.getElementById('alert-sound')?.addEventListener('change', e => {
    setSoundType(e.target.value);
    saveSettings();
  });

  document.getElementById('test-sound-btn')?.addEventListener('click', () => {
    const type = document.getElementById('alert-sound')?.value || 'executive';
    playSound(type, 1);
  });

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

  document.getElementById('test-direction')?.addEventListener('change', e => {
    const row = document.getElementById('custom-price-row');
    if (row) row.classList.toggle('hidden', e.target.value !== 'custom');
  });

  document.getElementById('run-test-btn')?.addEventListener('click', runTestMode);
  document.getElementById('price-source')?.addEventListener('change', () => saveSettings());
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
  const base  = (state?.price !== null && state?.price > 0) ? state.price : 0.001;

  let simPrice;
  switch (direction) {
    case 'crash':       simPrice = base * 0.70; break;
    case 'pump':        simPrice = base * 1.40; break;
    case 'slight_down': simPrice = base * 0.95; break;
    case 'slight_up':   simPrice = base * 1.05; break;
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

  simulatePrice(tokenAddr, simPrice);
  updateCardPrice(tokenAddr);
  updateTicker();

  const fired = evaluateOrders();
  fired.forEach(order => {
    fireAlert({ order, currentPrice: simPrice, isTest: true });
    renderOrders();
  });
  renderHistory();

  const sym      = state?.symbol || 'USDT.z';
  const tag      = contractTag(tokenAddr);
  const dirLabel = {
    crash: 'CRASH −30%', pump: 'PUMP +40%',
    slight_down: 'Baja leve −5%', slight_up: 'Suba leve +5%', custom: 'Precio manual',
  }[direction] || direction;

  playSound(document.getElementById('alert-sound')?.value || 'executive', 1);
  showToast(`🧪 ${sym} (${tag}) · ${dirLabel}`, `Precio simulado: ${formatPrice(simPrice)}`, 'info');
  addHistoryEntry({
    type: 'test', tokenAddress: tokenAddr, tokenSymbol: sym,
    targetPrice: simPrice, currentPrice: simPrice,
    note: `Simulación: ${dirLabel}`, isTest: true,
  });
  renderHistory();
  showTestResult(`✓ Simulación activa: ${sym} (${tag}) → ${formatPrice(simPrice)}`, 'success');

  setTimeout(() => {
    clearSimulation(tokenAddr);
    TOKENS.forEach(t => updateCardPrice(t.address));
    updateTicker();
    showTestResult('↺ Precios reales restaurados.', 'warning');
    setTimeout(() => { if (resultEl) resultEl.classList.add('hidden'); }, 4000);
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
    pollInterval:    _pollInterval,
    soundMuted:      _soundMuted,
    volume:          parseFloat(document.getElementById('alert-volume')?.value || 0.7),
    soundType:       document.getElementById('alert-sound')?.value || 'executive',
    notifications:   document.getElementById('browser-notifications')?.checked || false,
    priceSource:     document.getElementById('price-source')?.value || 'dexscreener',
    refreshInterval: document.getElementById('refresh-interval')?.value || '30000',
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
      const slider  = document.getElementById('alert-volume');
      const display = document.getElementById('volume-display');
      if (slider)  slider.value = String(s.volume);
      if (display) display.textContent = Math.round(s.volume * 100) + '%';
    }

    if (s.soundType) {
      setSoundType(s.soundType);
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
