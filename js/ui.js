// ============================================================
//  ui.js — DOM rendering & UI updates
// ============================================================

// ---- Token Cards ----
function renderTokenCards() {
  const grid = document.getElementById('tokens-grid');
  grid.innerHTML = '';

  TOKENS.forEach((token, idx) => {
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

  const price      = state.price;
  const prevPrice  = state.prevPrice;
  const change     = state.priceChange;
  const priceDir   = (prevPrice !== null && price !== null)
    ? (price > prevPrice ? 'up' : price < prevPrice ? 'down' : '')
    : '';

  const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const changeSign  = change > 0 ? '+' : '';

  // Count active orders for this token
  const tokenOrders = getOrders().filter(o =>
    o.tokenAddress.toLowerCase() === token.address.toLowerCase() && !o.triggered
  );

  card.innerHTML = `
    <div class="card-top">
      <div class="token-identity">
        <div class="token-symbol">${state.symbol || token.symbol}</div>
        <div class="token-name">${state.name || token.name}</div>
      </div>
      <div class="token-address" onclick="copyAddress('${token.address}')" title="Copiar dirección">
        ${shortAddress(token.address)} <span style="opacity:0.5">⎘</span>
      </div>
    </div>

    <div class="card-price">
      <div class="price-value ${priceDir}" id="price-${token.address}">
        ${state.error ? 'ERROR' : (state.loading ? '···' : formatPrice(price))}
      </div>
      <div class="price-change ${changeClass}">
        ${change !== null ? `${changeSign}${change?.toFixed(2)}% 24h` : '—'}
        ${isSimulating(token.address) ? ' <span style="color:var(--accent-yellow)">[SIM]</span>' : ''}
      </div>
    </div>

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
        <div class="stat-label">ÓRDENES ACTIVAS</div>
        <div class="stat-value" style="color:var(--accent-cyan)">${tokenOrders.length}</div>
      </div>
    </div>

    <div class="card-alerts">
      <div class="alerts-label">ALERTAS CONFIGURADAS</div>
      <div class="alerts-chips" id="chips-${token.address}">
        ${renderOrderChips(token.address, tokenOrders)}
      </div>
    </div>
  `;

  // Flash if price changed
  if (priceDir && prevPrice !== null) {
    setTimeout(() => {
      const el = card.querySelector('.price-value');
      if (el) {
        el.classList.add(priceDir);
        setTimeout(() => el.classList.remove(priceDir), 1200);
      }
    }, 50);
  }

  return card;
}

function renderOrderChips(address, orders) {
  if (!orders || orders.length === 0) {
    return '<span class="no-alerts">Sin alertas</span>';
  }
  return orders.map(o => `
    <div class="alert-chip ${o.type}">
      ${o.type === 'below' ? '▼' : '▲'} ${formatPrice(o.price)}
      <button class="chip-remove" onclick="deleteOrderAndRefresh('${o.id}')" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function updateCardPrice(tokenAddress) {
  const card  = document.getElementById('card-' + tokenAddress);
  const state = priceState[tokenAddress];
  if (!card || !state) return;

  const priceEl   = card.querySelector('.price-value');
  const changeEl  = card.querySelector('.price-change');
  const statsEls  = card.querySelectorAll('.stat-value');

  if (priceEl) {
    const priceDir = (state.prevPrice !== null && state.price !== null)
      ? (state.price > state.prevPrice ? 'up' : state.price < state.prevPrice ? 'down' : '')
      : '';
    priceEl.textContent = state.error ? 'ERROR' : formatPrice(state.price);
    priceEl.className = 'price-value' + (priceDir ? ` ${priceDir}` : '');
  }

  if (changeEl) {
    const c = state.priceChange;
    const changeClass = c > 0 ? 'up' : c < 0 ? 'down' : 'neutral';
    const changeSign  = c > 0 ? '+' : '';
    changeEl.className = `price-change ${changeClass}`;
    changeEl.innerHTML = c !== null
      ? `${changeSign}${c?.toFixed(2)}% 24h${isSimulating(tokenAddress) ? ' <span style="color:var(--accent-yellow)">[SIM]</span>' : ''}`
      : '—';
  }

  // Update stats
  const statValues = [
    formatNumber(state.volume24h),
    formatNumber(state.liquidity),
    formatNumber(state.marketCap),
    getOrders().filter(o => o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !o.triggered).length,
  ];
  statsEls.forEach((el, i) => {
    if (statValues[i] !== undefined) el.textContent = statValues[i];
  });

  // Update chips
  const chipsEl = card.querySelector(`#chips-${tokenAddress}`);
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

  // Clear existing items (keep empty state)
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
      : `Si sube a <span class="price-target">${formatPrice(order.price)}</span>`;

    const created = new Date(order.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

    item.innerHTML = `
      <div class="order-badge ${order.type}">
        ${order.type === 'below' ? '📉' : '📈'}
      </div>
      <div class="order-info">
        <div class="order-main">
          <span class="order-token-tag">${order.tokenSymbol}</span>
          <span class="order-condition ${order.type}">${condText}</span>
          ${order.triggered ? '<span style="color:var(--accent-red);font-size:11px;font-family:var(--font-mono)">✓ DISPARADA</span>' : ''}
          ${order.repeat ? '<span class="order-repeat-badge">↻ REPETIR</span>' : ''}
        </div>
        ${order.note ? `<div class="order-note">${order.note}</div>` : ''}
      </div>
      <div class="order-meta">${created}</div>
      <div class="order-actions">
        <button class="order-delete-btn" onclick="deleteOrderAndRefresh('${order.id}')" title="Eliminar orden">✕</button>
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
    const ts = new Date(entry.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const dir = entry.type === 'below' ? 'cayó por debajo de' : 'subió sobre';

    item.innerHTML = `
      <div class="history-icon">${entry.isTest ? '🧪' : (entry.type === 'below' ? '📉' : '📈')}</div>
      <div class="history-info">
        <div class="history-msg">
          <strong>${entry.tokenSymbol || shortAddress(entry.tokenAddress)}</strong> ${dir}
          ${formatPrice(entry.targetPrice)} — Precio: ${formatPrice(entry.currentPrice)}
          ${entry.note ? `<em style="color:var(--text-muted)"> (${entry.note})</em>` : ''}
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
    const s = priceState[t.address];
    const changeClass = (s.priceChange || 0) >= 0 ? 'up' : 'down';
    const sign = (s.priceChange || 0) >= 0 ? '+' : '';
    items += `
      <span class="ticker-item">
        <span class="name">${s.symbol || t.symbol}</span>&nbsp;
        ${formatPrice(s.price)}&nbsp;
        <span class="${changeClass}">${sign}${(s.priceChange || 0).toFixed(2)}%</span>
      </span>
    `;
  });

  // Double for seamless loop
  inner.innerHTML = items + items;
}

// ---- Status indicator ----
function setStatus(state, label) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-label');
  dot.className  = 'status-dot ' + state;
  text.textContent = label;
}

function setSourceBadge(source) {
  const badge = document.getElementById('source-badge');
  if (!badge) return;
  if (source === 'gecko') {
    badge.textContent = 'GeckoTerminal';
    badge.style.borderColor = 'rgba(0,230,118,0.3)';
    badge.style.color = 'var(--accent-green)';
  } else if (source === 'dexscreener') {
    badge.textContent = 'DexScreener↗';
    badge.style.borderColor = 'rgba(0,212,255,0.3)';
    badge.style.color = 'var(--accent-cyan)';
  } else {
    badge.textContent = 'SIN DATOS';
    badge.style.borderColor = 'rgba(255,56,96,0.3)';
    badge.style.color = 'var(--accent-red)';
  }
}

// ---- Populate selects ----
function populateTokenSelects() {
  const selects = ['order-token', 'test-token'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = TOKENS.map(t =>
      `<option value="${t.address}">${t.symbol} — ${shortAddress(t.address)}</option>`
    ).join('');
  });
}

// ---- Copy address ----
function copyAddress(addr) {
  navigator.clipboard?.writeText(addr)
    .then(() => showToast('Dirección copiada', addr.slice(0, 10) + '…', 'success'))
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
  document.getElementById('order-price').value  = '';
  document.getElementById('order-note').value   = '';
  document.getElementById('order-repeat').checked  = false;
  document.getElementById('order-notify').checked  = true;
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
