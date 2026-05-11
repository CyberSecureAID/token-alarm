// ============================================================
//  ui.js — DOM rendering & UI updates
//  Features: token logo + verified badge, extended data cards,
//            buy/sell pressure bar, multi-timeframe % changes
// ============================================================

// ---- Token Cards ----
function renderTokenCards() {
  const grid = document.getElementById('tokens-grid');
  grid.innerHTML = '';

  TOKENS.forEach(token => {
    const state = priceState[token.address];
    const card  = buildTokenCard(token, state);
    grid.appendChild(card);
  });

  document.getElementById('tokens-count').textContent = `${TOKENS.length} tokens`;
}

function buildTokenCard(token, state) {
  const card = document.createElement('div');
  card.className = 'token-card' + (state.loading ? ' card-loading' : '');
  card.id = 'card-' + token.address;
  card.style.setProperty('--card-accent', token.color);

  const price     = state.price;
  const prevPrice = state.prevPrice;
  const priceDir  = (prevPrice !== null && price !== null)
    ? (price > prevPrice ? 'up' : price < prevPrice ? 'down' : '')
    : '';

  // Buy/sell pressure percentage
  const totalTxns = (state.buys24h || 0) + (state.sells24h || 0);
  const buyPct    = totalTxns > 0 ? Math.round((state.buys24h / totalTxns) * 100) : 50;
  const sellPct   = 100 - buyPct;
  const pressureColor = buyPct > 60 ? 'var(--accent-green)' : buyPct < 40 ? 'var(--accent-red)' : 'var(--accent-gold)';

  // Timeframe % changes
  const c1h  = state.priceChange1h;
  const c24h = state.priceChange;
  const c7d  = state.priceChange7d;

  const tokenOrders = getOrders().filter(o =>
    o.tokenAddress.toLowerCase() === token.address.toLowerCase() && !o.triggered
  );

  const isSimulated = isSimulating(token.address);

  card.innerHTML = `
    <div class="card-top">
      <!-- Logo + verified badge -->
      <div class="token-logo-wrap">
        <img class="token-logo"
             src="${state.logoUrl || generateAvatarSVG(state.symbol || token.symbol, token.color)}"
             alt="${state.symbol}"
             onerror="this.src='${generateAvatarSVG(state.symbol || token.symbol, token.color)}'"
        />
        <span class="verified-badge${state.verified ? '' : ' hidden'}" title="Verificado en Trust Wallet">✓</span>
      </div>

      <!-- Identity -->
      <div class="token-identity">
        <div class="token-symbol">${state.symbol || token.symbol}</div>
        <div class="token-name">${state.name || token.name}</div>
        ${state.pairCreatedAt
          ? `<div class="token-age">Pool: ${formatAge(state.pairCreatedAt)}</div>`
          : ''}
      </div>

      <!-- Address copy -->
      <div class="token-address" onclick="copyAddress('${token.address}')" title="Copiar dirección">
        ${shortAddress(token.address)} <span style="opacity:0.4">⎘</span>
      </div>
    </div>

    <!-- Price block -->
    <div class="card-price">
      <div class="price-value ${priceDir}" id="price-${token.address}">
        ${state.error ? 'SIN DATOS' : (state.loading ? '···' : formatPrice(price))}
        ${isSimulated ? '<span class="sim-badge">[SIM]</span>' : ''}
      </div>

      <!-- Multi-timeframe changes -->
      <div class="price-timeframes">
        ${buildChangePill(c1h, '1H')}
        ${buildChangePill(c24h, '24H')}
        ${buildChangePill(c7d, '7D')}
      </div>
    </div>

    <!-- Extended stats grid -->
    <div class="card-stats">
      <div class="stat-item">
        <div class="stat-label">VOLUMEN 24H</div>
        <div class="stat-value">${formatNumber(state.volume24h)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">LIQUIDEZ</div>
        <div class="stat-value">${formatNumber(state.liquidity)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">MARKET CAP</div>
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
        <div class="stat-label">ÓRDENES</div>
        <div class="stat-value" style="color:var(--accent-gold)">${tokenOrders.length}</div>
      </div>
    </div>

    <!-- Buy/Sell pressure bar -->
    ${totalTxns > 0 ? `
    <div class="pressure-section">
      <div class="pressure-labels">
        <span class="pressure-buy">▲ ${formatCount(state.buys24h)} compras (${buyPct}%)</span>
        <span class="pressure-sell">${sellPct}% (${formatCount(state.sells24h)} ventas) ▼</span>
      </div>
      <div class="pressure-bar">
        <div class="pressure-fill" style="width:${buyPct}%; background:${pressureColor}"></div>
      </div>
    </div>` : ''}

    <!-- Active alerts -->
    <div class="card-alerts">
      <div class="alerts-label">ALERTAS ACTIVAS</div>
      <div class="alerts-chips" id="chips-${token.address}">
        ${renderOrderChips(token.address, tokenOrders)}
      </div>
    </div>
  `;

  return card;
}

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

// Live price update (without full re-render)
function updateCardPrice(tokenAddress) {
  const card  = document.getElementById('card-' + tokenAddress);
  const state = priceState[tokenAddress];
  if (!card || !state) return;

  // Price value
  const priceEl = document.getElementById('price-' + tokenAddress);
  if (priceEl) {
    const priceDir = (state.prevPrice !== null && state.price !== null)
      ? (state.price > state.prevPrice ? 'up' : state.price < state.prevPrice ? 'down' : '')
      : '';
    const sim = isSimulating(tokenAddress) ? '<span class="sim-badge">[SIM]</span>' : '';
    priceEl.innerHTML = (state.error ? 'SIN DATOS' : formatPrice(state.price)) + sim;
    priceEl.className = 'price-value' + (priceDir ? ` ${priceDir}` : '');
  }

  // Timeframe pills
  const tfEl = card.querySelector('.price-timeframes');
  if (tfEl) {
    tfEl.innerHTML =
      buildChangePill(state.priceChange1h, '1H') +
      buildChangePill(state.priceChange,   '24H') +
      buildChangePill(state.priceChange7d, '7D');
  }

  // Stats (query all stat-value in order)
  const sv = card.querySelectorAll('.stat-value');
  const vals = [
    formatNumber(state.volume24h),
    formatNumber(state.liquidity),
    formatNumber(state.marketCap),
    formatNumber(state.fdv),
    formatCount(state.txns24h),
    getOrders().filter(o =>
      o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !o.triggered
    ).length,
  ];
  sv.forEach((el, i) => { if (vals[i] !== undefined) el.textContent = vals[i]; });

  // Pressure bar
  const buyCount  = state.buys24h  || 0;
  const sellCount = state.sells24h || 0;
  const total     = buyCount + sellCount;
  if (total > 0) {
    const buyPct = Math.round(buyCount / total * 100);
    const fillEl = card.querySelector('.pressure-fill');
    if (fillEl) {
      fillEl.style.width = buyPct + '%';
      fillEl.style.background = buyPct > 60
        ? 'var(--accent-green)'
        : buyPct < 40 ? 'var(--accent-red)' : 'var(--accent-gold)';
    }
    const labelsEl = card.querySelector('.pressure-labels');
    if (labelsEl) {
      labelsEl.innerHTML =
        `<span class="pressure-buy">▲ ${formatCount(buyCount)} compras (${buyPct}%)</span>` +
        `<span class="pressure-sell">${100 - buyPct}% (${formatCount(sellCount)} ventas) ▼</span>`;
    }
  }

  // Chips
  const chipsEl = document.getElementById('chips-' + tokenAddress);
  if (chipsEl) {
    const orders = getOrders().filter(o =>
      o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !o.triggered
    );
    chipsEl.innerHTML = renderOrderChips(tokenAddress, orders);
  }
}

// ---- Orders List ----
function renderOrders() {
  const container = document.getElementById('orders-list');
  const empty     = document.getElementById('orders-empty');
  const orders    = getOrders();

  Array.from(container.children).forEach(c => {
    if (c.id !== 'orders-empty') c.remove();
  });

  if (orders.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  orders.forEach(order => {
    const item = document.createElement('div');
    item.className = 'order-item' + (order.triggered ? ' triggered' : '');
    item.id = 'order-' + order.id;

    const condText = order.type === 'below'
      ? `Si baja de <span class="price-target">${formatPrice(order.price)}</span>`
      : `Si sube a  <span class="price-target">${formatPrice(order.price)}</span>`;

    const created = new Date(order.createdAt).toLocaleString('es-AR', {
      dateStyle: 'short', timeStyle: 'short',
    });

    item.innerHTML = `
      <div class="order-badge ${order.type}">${order.type === 'below' ? '📉' : '📈'}</div>
      <div class="order-info">
        <div class="order-main">
          <span class="order-token-tag">${order.tokenSymbol}</span>
          <span class="order-condition ${order.type}">${condText}</span>
          ${order.triggered ? '<span class="order-fired">✓ DISPARADA</span>' : ''}
          ${order.repeat ? '<span class="order-repeat-badge">↻ REPETIR</span>' : ''}
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

// ---- Alert History ----
function renderHistory() {
  const container = document.getElementById('alert-history');
  const empty     = document.getElementById('history-empty');
  const history   = loadHistory();

  Array.from(container.children).forEach(c => {
    if (c.id !== 'history-empty') c.remove();
  });

  if (history.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = `history-item ${entry.type}${entry.isTest ? ' test' : ''}`;
    const ts  = new Date(entry.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const dir = entry.type === 'below' ? 'cayó bajo' : 'subió sobre';

    item.innerHTML = `
      <div class="history-icon">${entry.isTest ? '🧪' : (entry.type === 'below' ? '📉' : '📈')}</div>
      <div class="history-info">
        <div class="history-msg">
          <strong>${entry.tokenSymbol || shortAddress(entry.tokenAddress)}</strong>
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

// ---- Ticker ----
function updateTicker() {
  const inner = document.getElementById('ticker-inner');
  let items = '';

  TOKENS.forEach(t => {
    const s   = priceState[t.address];
    const ch  = s.priceChange || 0;
    const cls = ch >= 0 ? 'up' : 'down';
    const sgn = ch >= 0 ? '+' : '';
    items += `
      <span class="ticker-item">
        <span class="name">${s.symbol || t.symbol}</span>&nbsp;
        ${formatPrice(s.price)}&nbsp;
        <span class="${cls}">${sgn}${ch.toFixed(2)}%</span>
      </span>`;
  });

  inner.innerHTML = items + items;
}

// ---- Status ----
function setStatus(state, label) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-label');
  dot.className    = 'status-dot ' + state;
  text.textContent = label;
}

function setSourceBadge(source) {
  const badge = document.getElementById('source-badge');
  if (!badge) return;
  const map = {
    gecko:       { text: 'GeckoTerminal', color: 'var(--accent-green)',  border: 'rgba(46,204,135,0.3)'  },
    dexscreener: { text: 'DexScreener',   color: 'var(--accent-gold)',   border: 'rgba(201,168,76,0.3)'  },
    error:       { text: 'SIN DATOS',     color: 'var(--accent-red)',    border: 'rgba(224,92,110,0.3)'  },
  };
  const s = map[source] || map.error;
  badge.textContent        = s.text;
  badge.style.color        = s.color;
  badge.style.borderColor  = s.border;
}

// ---- Populate selects ----
function populateTokenSelects() {
  ['order-token', 'test-token'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = TOKENS.map(t =>
      `<option value="${t.address}">${t.symbol} — ${shortAddress(t.address)}</option>`
    ).join('');
  });
}

// Populate sound selector dynamically
function populateSoundSelector() {
  const sel = document.getElementById('alert-sound');
  if (!sel || typeof getSoundOptions !== 'function') return;
  const opts = getSoundOptions();
  sel.innerHTML = opts.map(o =>
    `<option value="${o.value}"${o.value === 'executive' ? ' selected' : ''}>${o.label}</option>`
  ).join('');
}

// ---- Copy address ----
function copyAddress(addr) {
  navigator.clipboard?.writeText(addr)
    .then(() => showToast('Dirección copiada', addr, 'success'))
    .catch(() => {});
}

// ---- Delete & refresh ----
function deleteOrderAndRefresh(id) {
  deleteOrder(id);
  renderOrders();
  renderTokenCards();
}

// ---- Order form toggle ----
function openOrderForm() {
  document.getElementById('order-form-container').classList.remove('hidden');
  document.getElementById('order-price').focus();
}

function closeOrderForm() {
  document.getElementById('order-form-container').classList.add('hidden');
  document.getElementById('order-price').value    = '';
  document.getElementById('order-note').value     = '';
  document.getElementById('order-repeat').checked = false;
  document.getElementById('order-notify').checked = true;
}

// ---- Settings panel ----
function openSettings() {
  document.getElementById('settings-panel').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-panel').classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}
