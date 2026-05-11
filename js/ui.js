// ============================================================
//  ui.js — DOM rendering & UI updates v4.0
//
//  CAMBIOS:
//    - Precio BNB como referencia principal en cada tarjeta
//    - Precio USD como valor secundario
//    - Panel desplegable con gráfica de DexScreener por tarjeta
//    - "SIN DATOS" muestra mensaje descriptivo + retry
//    - Ticker muestra precio BNB
// ============================================================

// ============================================================
//  TICKER — Infinite seamless scroll via JS
// ============================================================
let _tickerRAF   = null;
let _tickerX     = 0;
let _tickerSpeed = 0.6;
let _tickerWidth = 0;

function buildTickerHTML() {
  let items = '';
  TOKENS.forEach(t => {
    const s    = priceState[t.address];
    const ch   = (s && s.priceChange) ? s.priceChange : 0;
    const cls  = ch >= 0 ? 'up' : 'down';
    const sgn  = ch >= 0 ? '+' : '';
    const tag  = contractTag(t.address);
    const sym  = (s && s.symbol) ? s.symbol : t.symbol;

    // Mostrar precio BNB (primario) en el ticker
    const priceBNB = (s && s.priceNative !== null) ? formatPriceBNB(s.priceNative) : '—';
    const priceUSD = (s && s.price !== null)       ? formatPrice(s.price)           : '';

    items += `<span class="ticker-item">` +
      `<span class="name">${sym}</span>` +
      `<span class="ticker-tag">(${tag})</span>` +
      `&nbsp;<span class="ticker-bnb">${priceBNB}</span>&nbsp;` +
      (priceUSD ? `<span class="ticker-usd">${priceUSD}</span>&nbsp;` : '') +
      `<span class="${cls}">${sgn}${ch.toFixed(2)}%</span>` +
      `</span>`;
  });
  return items;
}

function updateTicker() {
  const innerA = document.getElementById('ticker-inner-a');
  const innerB = document.getElementById('ticker-inner-b');
  if (!innerA || !innerB) return;

  const html = buildTickerHTML();
  innerA.innerHTML = html;
  innerB.innerHTML = html;

  requestAnimationFrame(() => {
    _tickerWidth = innerA.offsetWidth;
    if (!_tickerRAF) startTickerLoop();
  });
}

function startTickerLoop() {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  function step() {
    _tickerX -= _tickerSpeed;
    if (_tickerWidth > 0 && Math.abs(_tickerX) >= _tickerWidth) {
      _tickerX = 0;
    }
    track.style.transform = `translateX(${_tickerX}px)`;
    _tickerRAF = requestAnimationFrame(step);
  }

  if (_tickerRAF) cancelAnimationFrame(_tickerRAF);
  _tickerRAF = requestAnimationFrame(step);
}

// ============================================================
//  TOKEN CARDS
// ============================================================
function renderTokenCards() {
  const grid = document.getElementById('tokens-grid');
  if (!grid) return;
  grid.innerHTML = '';

  TOKENS.forEach(token => {
    const state = priceState[token.address];
    const card  = buildTokenCard(token, state);
    grid.appendChild(card);
  });

  const countEl = document.getElementById('tokens-count');
  if (countEl) countEl.textContent = `${TOKENS.length} tokens`;
}

function buildTokenCard(token, state) {
  const card = document.createElement('div');
  card.className = 'token-card' + (state.loading ? ' card-loading' : '');
  card.id = 'card-' + token.address;
  card.style.setProperty('--card-accent', token.color || '#26a17b');

  const tag         = contractTag(token.address);
  const logoSrc     = state.logoUrl || USDT_LOGO_URL;
  const tokenOrders = getOrders().filter(o =>
    o.tokenAddress.toLowerCase() === token.address.toLowerCase() && !o.triggered
  );
  const isSimulated = isSimulating(token.address);

  const totalTxns    = (state.buys24h || 0) + (state.sells24h || 0);
  const buyPct       = totalTxns > 0 ? Math.round((state.buys24h / totalTxns) * 100) : 50;
  const sellPct      = 100 - buyPct;
  const pressureColor = buyPct > 60
    ? 'var(--accent-green)'
    : buyPct < 40 ? 'var(--accent-red)' : 'var(--accent-gold)';

  // Dirección del precio
  const priceDir = (state.prevPrice !== null && state.price !== null)
    ? (state.price > state.prevPrice ? 'up' : state.price < state.prevPrice ? 'down' : '')
    : '';

  // Bloque de precio
  let priceBlock = '';
  if (state.loading) {
    priceBlock = `<div class="price-bnb" id="price-bnb-${token.address}">···</div>
                  <div class="price-usd" id="price-usd-${token.address}">···</div>`;
  } else if (state.error || (state.price === null && state.priceNative === null)) {
    priceBlock = `<div class="price-error" id="price-bnb-${token.address}">
                    SIN DATOS
                    <span class="error-hint">${state.errorMsg || 'Par no encontrado'}</span>
                  </div>`;
  } else {
    priceBlock = `
      <div class="price-bnb ${priceDir}" id="price-bnb-${token.address}">
        ${formatPriceBNB(state.priceNative)}
        ${isSimulated ? '<span class="sim-badge">[SIM]</span>' : ''}
      </div>
      <div class="price-usd" id="price-usd-${token.address}">
        ${state.price !== null ? formatPrice(state.price) : ''}
      </div>`;
  }

  // Gráfica URL de DexScreener (embed iframe)
  const pairAddr = state.pairAddress || token.pairAddress;
  const chartUrl = pairAddr
    ? `https://dexscreener.com/bsc/${pairAddr}?embed=1&theme=dark&info=0&trades=0`
    : `https://dexscreener.com/bsc/${token.address}?embed=1&theme=dark&info=0&trades=0`;

  card.innerHTML = `
    <!-- TOP -->
    <div class="card-top">
      <div class="token-logo-wrap">
        <img class="token-logo"
             src="${logoSrc}"
             alt="${state.symbol}"
             onerror="this.src='${USDT_LOGO_URL}'"
        />
        <span class="verified-badge" title="Token verificado">✓</span>
      </div>

      <div class="token-identity">
        <div class="token-symbol">${state.symbol || token.symbol}</div>
        <div class="token-name">${state.name || token.name}</div>
        ${state.pairCreatedAt
          ? `<div class="token-age">Pool: ${formatAge(state.pairCreatedAt)}</div>`
          : ''}
      </div>

      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="token-address" onclick="copyAddress('${token.address}')" title="Copiar dirección">
          <span class="contract-tag">${tag}</span>
          <span style="opacity:0.4">⎘</span>
        </div>
        <!-- Botón para abrir gráfica -->
        <button class="chart-toggle-btn" onclick="toggleChart('${token.address}')"
                id="chart-btn-${token.address}" title="Ver gráfica en vivo">
          <span class="chart-btn-icon">▾</span> CHART
        </button>
      </div>
    </div>

    <!-- PRECIO — BNB primario, USD secundario -->
    <div class="card-price">
      ${priceBlock}
      <div class="price-timeframes">
        ${buildChangePill(state.priceChange1h, '1H')}
        ${buildChangePill(state.priceChange,   '24H')}
        ${buildChangePill(state.priceChange7d, '7D')}
      </div>
    </div>

    <!-- STATS -->
    <div class="card-stats">
      <div class="stat-item">
        <div class="stat-label">VOL 24H</div>
        <div class="stat-value">${formatNumber(state.volume24h)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">LIQUIDEZ</div>
        <div class="stat-value">${formatNumber(state.liquidity)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">MKT CAP</div>
        <div class="stat-value">${formatNumber(state.marketCap)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">FDV</div>
        <div class="stat-value">${formatNumber(state.fdv)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">TXNS 24H</div>
        <div class="stat-value">${formatCount(state.txns24h)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">ALERTAS</div>
        <div class="stat-value" style="color:var(--accent-gold)">${tokenOrders.length}</div>
      </div>
    </div>

    <!-- PRESIÓN COMPRA/VENTA -->
    ${totalTxns > 0 ? `
    <div class="pressure-section">
      <div class="pressure-labels">
        <span class="pressure-buy">▲ ${formatCount(state.buys24h)} (${buyPct}%)</span>
        <span class="pressure-sell">${sellPct}% (${formatCount(state.sells24h)}) ▼</span>
      </div>
      <div class="pressure-bar">
        <div class="pressure-fill" style="width:${buyPct}%; background:${pressureColor}"></div>
      </div>
    </div>` : ''}

    <!-- ALERTAS ACTIVAS -->
    <div class="card-alerts">
      <div class="alerts-label">ALERTAS ACTIVAS</div>
      <div class="alerts-chips" id="chips-${token.address}">
        ${renderOrderChips(token.address, tokenOrders)}
      </div>
    </div>

    <!-- GRÁFICA DESPLEGABLE -->
    <div class="chart-panel" id="chart-${token.address}" style="display:none">
      <div class="chart-panel-header">
        <span class="chart-panel-title">GRÁFICA EN VIVO — ${state.symbol} (${tag})</span>
        <a class="chart-ext-link"
           href="https://dexscreener.com/bsc/${pairAddr || token.address}"
           target="_blank" rel="noopener" title="Abrir en DexScreener">
          ↗ ABRIR EN DEXSCREENER
        </a>
      </div>
      <div class="chart-iframe-wrap" id="chart-iframe-wrap-${token.address}">
        <!-- El iframe se inyecta cuando se abre para no cargar hasta que se necesite -->
      </div>
    </div>
  `;

  return card;
}

// ============================================================
//  TOGGLE GRÁFICA DESPLEGABLE
// ============================================================
const _chartLoaded = new Set();

function toggleChart(address) {
  const panel = document.getElementById('chart-' + address);
  const btn   = document.getElementById('chart-btn-' + address);
  if (!panel) return;

  const isOpen = panel.style.display !== 'none';

  if (isOpen) {
    panel.style.display = 'none';
    if (btn) btn.classList.remove('active');
    if (btn) btn.querySelector('.chart-btn-icon').textContent = '▾';
  } else {
    panel.style.display = 'block';
    if (btn) btn.classList.add('active');
    if (btn) btn.querySelector('.chart-btn-icon').textContent = '▴';

    // Cargar iframe solo la primera vez (lazy load)
    if (!_chartLoaded.has(address)) {
      _chartLoaded.add(address);
      const wrap   = document.getElementById('chart-iframe-wrap-' + address);
      const token  = getToken(address);
      const state  = priceState[address];
      const pairAddr = state?.pairAddress || token?.pairAddress;

      const chartUrl = pairAddr
        ? `https://dexscreener.com/bsc/${pairAddr}?embed=1&theme=dark&info=0&trades=0`
        : `https://dexscreener.com/bsc/${address}?embed=1&theme=dark&info=0&trades=0`;

      if (wrap) {
        wrap.innerHTML = `<iframe
          src="${chartUrl}"
          class="chart-iframe"
          frameborder="0"
          allowfullscreen
          loading="lazy"
          title="Chart ${contractTag(address)}"
        ></iframe>`;
      }
    }
  }
}

// ============================================================
//  ACTUALIZACIÓN LIVE DE PRECIO (sin re-render completo)
// ============================================================
function updateCardPrice(tokenAddress) {
  const card  = document.getElementById('card-' + tokenAddress);
  const state = priceState[tokenAddress];
  if (!card || !state) return;

  // Precio BNB (primario)
  const priceBnbEl = document.getElementById('price-bnb-' + tokenAddress);
  if (priceBnbEl) {
    const priceDir = (state.prevPrice !== null && state.price !== null)
      ? (state.price > state.prevPrice ? 'up' : state.price < state.prevPrice ? 'down' : '')
      : '';

    if (state.error || (state.price === null && state.priceNative === null)) {
      priceBnbEl.className = 'price-error';
      priceBnbEl.innerHTML = `SIN DATOS <span class="error-hint">${state.errorMsg || ''}</span>`;
    } else {
      const sim = isSimulating(tokenAddress) ? '<span class="sim-badge">[SIM]</span>' : '';
      priceBnbEl.className = `price-bnb${priceDir ? ' ' + priceDir : ''}`;
      priceBnbEl.innerHTML = formatPriceBNB(state.priceNative) + sim;
    }
  }

  // Precio USD (secundario)
  const priceUsdEl = document.getElementById('price-usd-' + tokenAddress);
  if (priceUsdEl && !state.error) {
    priceUsdEl.textContent = state.price !== null ? formatPrice(state.price) : '';
  }

  // Variaciones
  const tfEl = card.querySelector('.price-timeframes');
  if (tfEl) {
    tfEl.innerHTML =
      buildChangePill(state.priceChange1h, '1H')  +
      buildChangePill(state.priceChange,   '24H') +
      buildChangePill(state.priceChange7d, '7D');
  }

  // Stats
  const sv   = card.querySelectorAll('.stat-value');
  const activeAlerts = getOrders().filter(o =>
    o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !o.triggered
  ).length;
  const vals = [
    formatNumber(state.volume24h),
    formatNumber(state.liquidity),
    formatNumber(state.marketCap),
    formatNumber(state.fdv),
    formatCount(state.txns24h),
    activeAlerts,
  ];
  sv.forEach((el, i) => {
    if (vals[i] !== undefined) {
      el.textContent = vals[i];
      if (i === 5) el.style.color = 'var(--accent-gold)';
    }
  });

  // Barra de presión
  const buyCount  = state.buys24h  || 0;
  const sellCount = state.sells24h || 0;
  const total     = buyCount + sellCount;
  if (total > 0) {
    const buyPct = Math.round(buyCount / total * 100);
    const fillEl = card.querySelector('.pressure-fill');
    if (fillEl) {
      fillEl.style.width      = buyPct + '%';
      fillEl.style.background = buyPct > 60
        ? 'var(--accent-green)'
        : buyPct < 40 ? 'var(--accent-red)' : 'var(--accent-gold)';
    }
    const labelsEl = card.querySelector('.pressure-labels');
    if (labelsEl) {
      labelsEl.innerHTML =
        `<span class="pressure-buy">▲ ${formatCount(buyCount)} (${buyPct}%)</span>` +
        `<span class="pressure-sell">${100 - buyPct}% (${formatCount(sellCount)}) ▼</span>`;
    }
  }

  // Chips de alertas
  const chipsEl = document.getElementById('chips-' + tokenAddress);
  if (chipsEl) {
    const orders = getOrders().filter(o =>
      o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !o.triggered
    );
    chipsEl.innerHTML = renderOrderChips(tokenAddress, orders);
  }
}

// ============================================================
//  HELPERS UI
// ============================================================
function buildChangePill(value, label) {
  if (value === null || value === undefined || isNaN(value)) {
    return `<span class="change-pill neutral"><span class="pill-label">${label}</span> —</span>`;
  }
  const cls  = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  const sign = value > 0 ? '+' : '';
  return `<span class="change-pill ${cls}"><span class="pill-label">${label}</span> ${sign}${value.toFixed(2)}%</span>`;
}

function renderOrderChips(address, orders) {
  if (!orders || orders.length === 0) {
    return '<span class="no-alerts">Sin alertas configuradas</span>';
  }
  return orders.map(o => `
    <div class="alert-chip ${o.type}">
      ${o.type === 'below' ? '▼' : '▲'} ${formatPrice(o.price)}
      <button class="chip-remove" onclick="deleteOrderAndRefresh('${o.id}')" title="Eliminar">✕</button>
    </div>
  `).join('');
}

// ============================================================
//  ORDERS
// ============================================================
function renderOrders() {
  const container = document.getElementById('orders-list');
  const empty     = document.getElementById('orders-empty');
  if (!container) return;

  const orders = getOrders();
  Array.from(container.children).forEach(c => { if (c.id !== 'orders-empty') c.remove(); });

  if (orders.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  orders.forEach(order => {
    const item = document.createElement('div');
    item.className = 'order-item' + (order.triggered ? ' triggered' : '');
    item.id = 'order-' + order.id;

    const tag  = contractTag(order.tokenAddress);
    const sym  = order.tokenSymbol || 'USDT.z';
    const condText = order.type === 'below'
      ? `Alertar si baja de <span class="price-target">${formatPrice(order.price)}</span>`
      : `Alertar si sube a <span class="price-target">${formatPrice(order.price)}</span>`;
    const created = new Date(order.createdAt).toLocaleString('es-AR', {
      dateStyle: 'short', timeStyle: 'short',
    });

    item.innerHTML = `
      <div class="order-badge ${order.type}">${order.type === 'below' ? '📉' : '📈'}</div>
      <div class="order-info">
        <div class="order-main">
          <span class="order-token-tag">${sym} <span style="opacity:0.6;font-size:9px">(${tag})</span></span>
          <span class="order-condition ${order.type}">${condText}</span>
          ${order.triggered ? '<span class="order-fired">✓ DISPARADA</span>' : ''}
          ${order.repeat    ? '<span class="order-repeat-badge">↻ REPETIR</span>' : ''}
        </div>
        ${order.note ? `<div class="order-note">${order.note}</div>` : ''}
      </div>
      <div class="order-meta">${created}</div>
      <div class="order-actions">
        <button class="order-delete-btn" onclick="deleteOrderAndRefresh('${order.id}')" title="Eliminar">✕</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// ============================================================
//  HISTORY
// ============================================================
function renderHistory() {
  const container = document.getElementById('alert-history');
  const empty     = document.getElementById('history-empty');
  if (!container) return;

  const history = loadHistory();
  Array.from(container.children).forEach(c => { if (c.id !== 'history-empty') c.remove(); });

  if (history.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = `history-item ${entry.type}${entry.isTest ? ' test' : ''}`;
    const ts  = new Date(entry.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const tag = contractTag(entry.tokenAddress);
    const dir = entry.type === 'below' ? 'bajó de' : 'subió a';

    item.innerHTML = `
      <div class="history-icon">${entry.isTest ? '🧪' : (entry.type === 'below' ? '📉' : '📈')}</div>
      <div class="history-info">
        <div class="history-msg">
          <strong>${entry.tokenSymbol || 'USDT.z'}</strong>
          <span style="opacity:0.5;font-size:10px">(${tag})</span>
          ${dir} ${formatPrice(entry.targetPrice)}
          — Precio: ${formatPrice(entry.currentPrice)}
          ${entry.note ? `<em class="history-note"> (${entry.note})</em>` : ''}
        </div>
        <div class="history-time">${ts}</div>
      </div>
      ${entry.isTest ? '<span class="history-badge test">PRUEBA</span>' : ''}
    `;
    container.appendChild(item);
  });
}

// ============================================================
//  STATUS
// ============================================================
function setStatus(state, label) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-label');
  if (dot)  dot.className    = 'status-dot ' + state;
  if (text) text.textContent = label;
}

function setSourceBadge(source) {
  const badge = document.getElementById('source-badge');
  if (!badge) return;
  const map = {
    gecko:       { text: 'GeckoTerminal', color: 'var(--accent-green)', border: 'rgba(46,204,135,0.3)'  },
    dexscreener: { text: 'DexScreener',   color: 'var(--accent-gold)',  border: 'rgba(201,168,76,0.3)'  },
    error:       { text: 'SIN DATOS',     color: 'var(--accent-red)',   border: 'rgba(224,92,110,0.3)'  },
  };
  const s = map[source] || map.error;
  badge.textContent       = s.text;
  badge.style.color       = s.color;
  badge.style.borderColor = s.border;
}

// ============================================================
//  SELECTS
// ============================================================
function populateTokenSelects() {
  ['order-token', 'test-token'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = TOKENS.map(t =>
      `<option value="${t.address}">${t.symbol} (${contractTag(t.address)})</option>`
    ).join('');
  });
}

function populateSoundSelector() {
  const sel = document.getElementById('alert-sound');
  if (!sel || typeof getSoundOptions !== 'function') return;
  const opts = getSoundOptions();
  sel.innerHTML = opts.map(o =>
    `<option value="${o.value}"${o.value === 'executive' ? ' selected' : ''}>${o.label}</option>`
  ).join('');
}

// ============================================================
//  UTILS
// ============================================================
function copyAddress(addr) {
  navigator.clipboard?.writeText(addr)
    .then(() => showToast('Dirección copiada', addr, 'success'))
    .catch(() => {});
}

function deleteOrderAndRefresh(id) {
  deleteOrder(id);
  renderOrders();
  renderTokenCards();
}

function openOrderForm() {
  const c = document.getElementById('order-form-container');
  if (c) c.classList.remove('hidden');
  const p = document.getElementById('order-price');
  if (p) p.focus();
}

function closeOrderForm() {
  const c = document.getElementById('order-form-container');
  if (c) c.classList.add('hidden');
  ['order-price', 'order-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const repeat = document.getElementById('order-repeat');
  const notify = document.getElementById('order-notify');
  if (repeat) repeat.checked = false;
  if (notify) notify.checked = true;
}

function openSettings() {
  const panel   = document.getElementById('settings-panel');
  const overlay = document.getElementById('overlay');
  if (panel)   panel.classList.remove('hidden');
  if (overlay) overlay.classList.remove('hidden');
}

function closeSettings() {
  const panel   = document.getElementById('settings-panel');
  const overlay = document.getElementById('overlay');
  if (panel)   panel.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
  if (typeof _settingsOpen !== 'undefined') _settingsOpen = false;
}
