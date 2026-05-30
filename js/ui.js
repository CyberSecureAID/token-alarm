// ============================================================
//  ui.js — DOM rendering & UI updates v5.4
//  CAMBIOS v5.4:
//    - Panel SWAP rebranding Token Alarm
//    - Overlay inferior oculta el branding externo del embed
//    - Título y links del panel SWAP sin referencias al proveedor
//    - swap-outer-wrap + swap-brand-overlay
// ============================================================

const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';

// ============================================================
//  TICKER
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
    const priceUSD = (s && s.price !== null)       ? formatPrice(s.price)          : '—';
    const priceBNB = (s && s.priceNative !== null) ? formatPriceBNB(s.priceNative) : '';

    items += `<span class="ticker-item">` +
      `<span class="name">${sym}</span>` +
      `<span class="ticker-tag">(${tag})</span>` +
      `&nbsp;<span class="ticker-usd-main">${priceUSD}</span>&nbsp;` +
      (priceBNB ? `<span class="ticker-bnb-sec">${priceBNB}</span>&nbsp;` : '') +
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
    if (_tickerWidth > 0 && Math.abs(_tickerX) >= _tickerWidth) _tickerX = 0;
    track.style.transform = `translateX(${_tickerX}px)`;
    _tickerRAF = requestAnimationFrame(step);
  }
  if (_tickerRAF) cancelAnimationFrame(_tickerRAF);
  _tickerRAF = requestAnimationFrame(step);
}

// ============================================================
//  CHART SOURCE PER CARD  (dexscreener | poocoin)
// ============================================================
const _chartSource = {};
const _chartLoaded = new Set();

function getChartSource(address) {
  return _chartSource[address] || 'dexscreener';
}

function chartUrlFor(address, source) {
  const token    = getToken(address);
  const state    = priceState[address];
  const pairAddr = state?.pairAddress || token?.pairAddress;

  if (source === 'poocoin') {
    return `https://poocoin.app/tokens/${address}`;
  }
  return pairAddr
    ? `https://dexscreener.com/bsc/${pairAddr}?embed=1&theme=dark&info=0&trades=0`
    : `https://dexscreener.com/bsc/${address}?embed=1&theme=dark&info=0&trades=0`;
}

function swapUrlFor(address) {
  return `https://poocoin.app/embed-swap?inputCurrency=${USDT_BSC}&outputCurrency=${address}`;
}

function buildChartIframe(address, source) {
  const url = chartUrlFor(address, source);
  return `<iframe
    src="${url}"
    class="chart-iframe"
    frameborder="0"
    allowfullscreen
    loading="lazy"
    title="Chart ${contractTag(address)}"
  ></iframe>`;
}

function buildSwapIframe(address) {
  return `<iframe
    src="${swapUrlFor(address)}"
    class="swap-iframe"
    frameborder="0"
    allowfullscreen
    loading="lazy"
    title="Token Swap ${contractTag(address)}"
  ></iframe>`;
}

function _injectIframe(wrap, address, source) {
  const overlay = wrap.querySelector('.chart-brand-overlay');
  wrap.innerHTML = buildChartIframe(address, source);
  if (overlay) wrap.appendChild(overlay);
  wrap.classList.toggle('poocoin-mode', source === 'poocoin');
}

function switchChartSource(address, source) {
  _chartSource[address] = source;

  const wrap = document.getElementById('chart-iframe-wrap-' + address);
  if (wrap && _chartLoaded.has(address)) {
    _injectIframe(wrap, address, source);
  }

  ['dexscreener', 'poocoin'].forEach(s => {
    const btn = document.getElementById(`chart-src-${s}-${address}`);
    if (btn) btn.classList.toggle('active', s === source);
  });

  const extLink = document.getElementById('chart-ext-' + address);
  if (extLink) {
    const token    = getToken(address);
    const state    = priceState[address];
    const pairAddr = state?.pairAddress || token?.pairAddress;
    extLink.href = source === 'poocoin'
      ? `https://poocoin.app/tokens/${address}`
      : (pairAddr ? `https://dexscreener.com/bsc/${pairAddr}` : `https://dexscreener.com/bsc/${address}`);
  }
}

// ============================================================
//  PANEL ACTIVO POR CARD  ('chart' | 'swap' | null)
// ============================================================
const _activePanel = {};

function openPanel(address, panel) {
  const current = _activePanel[address];

  if (current === panel) {
    _closePanel(address);
    return;
  }

  _setPanelVisible(address, 'chart', false);
  _setPanelVisible(address, 'swap',  false);

  _activePanel[address] = panel;
  _setPanelVisible(address, panel, true);

  if (panel === 'chart') {
    preloadChart(address);
    recheckChartUrl(address);
  } else if (panel === 'swap') {
    _loadSwap(address);
  }

  _syncPanelBtns(address);
}

function _closePanel(address) {
  _setPanelVisible(address, 'chart', false);
  _setPanelVisible(address, 'swap',  false);
  _activePanel[address] = null;
  _syncPanelBtns(address);
}

function _setPanelVisible(address, panel, visible) {
  const el = document.getElementById(`${panel}-${address}`);
  if (el) el.style.display = visible ? 'block' : 'none';
}

function _syncPanelBtns(address) {
  const active = _activePanel[address];

  const chartBtn = document.getElementById('chart-btn-' + address);
  if (chartBtn) {
    const icon = chartBtn.querySelector('.chart-btn-icon');
    const isActive = active === 'chart';
    chartBtn.classList.toggle('active', isActive);
    if (icon) icon.textContent = isActive ? '▴' : '▾';
  }

  const swapBtn = document.getElementById('swap-btn-' + address);
  if (swapBtn) {
    swapBtn.classList.toggle('active', active === 'swap');
  }
}

// ============================================================
//  SWAP PANEL — carga lazy
// ============================================================
const _swapLoaded = new Set();

function _loadSwap(address) {
  if (_swapLoaded.has(address)) return;
  _swapLoaded.add(address);
  const wrap = document.getElementById('swap-iframe-wrap-' + address);
  if (!wrap) return;
  wrap.innerHTML = buildSwapIframe(address);
}

// ============================================================
//  CHART PRELOAD / RECHECK
// ============================================================
function preloadAllCharts() {
  TOKENS.forEach((token, idx) => {
    setTimeout(() => preloadChart(token.address), idx * 800);
  });
}

function preloadChart(address) {
  if (_chartLoaded.has(address)) return;
  _chartLoaded.add(address);
  const wrap = document.getElementById('chart-iframe-wrap-' + address);
  if (!wrap) return;
  _injectIframe(wrap, address, getChartSource(address));
}

function recheckChartUrl(address) {
  const wrap  = document.getElementById('chart-iframe-wrap-' + address);
  const token = getToken(address);
  const state = priceState[address];
  if (!wrap || !_chartLoaded.has(address)) return;
  if (getChartSource(address) !== 'dexscreener') return;
  const pairAddr = state?.pairAddress || token?.pairAddress;
  if (!pairAddr) return;
  const currentSrc = wrap.querySelector('iframe')?.src || '';
  if (!currentSrc.includes(pairAddr)) _injectIframe(wrap, address, 'dexscreener');
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
  setTimeout(preloadAllCharts, 1500);
  _updateTokenCount();
}

function _updateTokenCount() {
  const countEl = document.getElementById('tokens-count');
  if (countEl) countEl.textContent = `${TOKENS.length} token${TOKENS.length !== 1 ? 's' : ''}`;
}

// ============================================================
//  BUILD TOKEN CARD
// ============================================================
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

  const totalTxns     = (state.buys24h || 0) + (state.sells24h || 0);
  const buyPct        = totalTxns > 0 ? Math.round((state.buys24h / totalTxns) * 100) : 50;
  const sellPct       = 100 - buyPct;
  const pressureColor = buyPct > 60
    ? 'var(--accent-green)'
    : buyPct < 40 ? 'var(--accent-red)' : 'var(--accent-gold)';

  const priceDir = (state.prevPrice !== null && state.price !== null)
    ? (state.price > state.prevPrice ? 'up' : state.price < state.prevPrice ? 'down' : '')
    : '';

  let priceBlock = '';
  if (state.loading) {
    priceBlock = `
      <div class="price-main" id="price-usd-${token.address}">···</div>
      <div class="price-secondary" id="price-bnb-${token.address}">···</div>`;
  } else if (state.error || (state.price === null && state.priceNative === null)) {
    priceBlock = `
      <div class="price-error" id="price-usd-${token.address}">
        SIN DATOS
        <span class="error-hint">${state.errorMsg || 'Par no encontrado'}</span>
      </div>`;
  } else {
    const isSimulated = isSimulating(token.address);
    const simBadge = isSimulated ? '<span class="sim-badge">[SIM]</span>' : '';
    priceBlock = `
      <div class="price-main ${priceDir}" id="price-usd-${token.address}">
        ${state.price !== null ? formatPrice(state.price) : '—'}
        ${simBadge}
      </div>
      <div class="price-secondary" id="price-bnb-${token.address}">
        ${state.priceNative !== null ? formatPriceBNB(state.priceNative) : ''}
      </div>`;
  }

  const pairAddr = state.pairAddress || token.pairAddress;
  const dexLink  = pairAddr
    ? `https://dexscreener.com/bsc/${pairAddr}`
    : `https://dexscreener.com/bsc/${token.address}`;
  const curSource = getChartSource(token.address);

  const removeBtn = token.custom
    ? `<button class="icon-btn remove-token-btn"
         onclick="removeTokenAndRefresh('${token.address}')"
         title="Eliminar contrato"
         style="color:var(--accent-red);border-color:rgba(224,92,110,0.3)">✕</button>`
    : '';

  card.innerHTML = `
    <!-- TOP -->
    <div class="card-top">
      <div class="token-logo-wrap">
        <img class="token-logo"
             src="${logoSrc}"
             alt="${state.symbol}"
             onerror="this.src='${generateAvatarSVG(token.symbol, token.color)}'"
        />
        <span class="verified-badge${state.verified ? '' : ' hidden'}" title="Token verificado">✓</span>
      </div>

      <div class="token-identity">
        <div class="token-symbol">${state.symbol || token.symbol}</div>
        <div class="token-name">${state.name || token.name}</div>
        ${state.pairCreatedAt
          ? `<div class="token-age">Pool: ${formatAge(state.pairCreatedAt)}</div>`
          : ''}
      </div>

      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div style="display:flex;gap:5px;align-items:center">
          <div class="token-address" onclick="copyAddress('${token.address}')" title="Copiar dirección">
            <span class="contract-tag">${tag}</span>
            <span style="opacity:0.4">⎘</span>
          </div>
          ${removeBtn}
        </div>
        <div style="display:flex;gap:5px">
          <button class="chart-toggle-btn"
                  onclick="openPanel('${token.address}','chart')"
                  id="chart-btn-${token.address}"
                  title="Ver gráfica en vivo">
            <span class="chart-btn-icon">▾</span> CHART
          </button>
          <button class="chart-toggle-btn swap-toggle-btn"
                  onclick="openPanel('${token.address}','swap')"
                  id="swap-btn-${token.address}"
                  title="Swap USDT → ${state.symbol || token.symbol}">
            ⇄ SWAP
          </button>
        </div>
      </div>
    </div>

    <!-- PRECIO -->
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
        <div class="pressure-fill" style="width:${buyPct}%;background:${pressureColor}"></div>
      </div>
    </div>` : ''}

    <!-- ALERTAS ACTIVAS -->
    <div class="card-alerts">
      <div class="alerts-label">ALERTAS ACTIVAS</div>
      <div class="alerts-chips" id="chips-${token.address}">
        ${renderOrderChips(token.address, tokenOrders)}
      </div>
    </div>

    <!-- PANEL: GRÁFICA -->
    <div class="chart-panel" id="chart-${token.address}" style="display:none">
      <div class="chart-panel-header">
        <span class="chart-panel-title">GRÁFICA — ${state.symbol || token.symbol} (${tag})</span>
        <div class="chart-source-tabs">
          <button id="chart-src-dexscreener-${token.address}"
                  class="chart-src-btn${curSource === 'dexscreener' ? ' active' : ''}"
                  onclick="switchChartSource('${token.address}','dexscreener')"
                  title="DexScreener">DSC</button>
          <button id="chart-src-poocoin-${token.address}"
                  class="chart-src-btn${curSource === 'poocoin' ? ' active' : ''}"
                  onclick="switchChartSource('${token.address}','poocoin')"
                  title="Vista alternativa">ALT</button>
          <a class="chart-ext-link"
             href="${curSource === 'poocoin' ? `https://poocoin.app/tokens/${token.address}` : dexLink}"
             id="chart-ext-${token.address}"
             target="_blank" rel="noopener" title="Abrir en nueva pestaña">↗</a>
        </div>
      </div>
      <div class="chart-iframe-wrap" id="chart-iframe-wrap-${token.address}">
        <div class="chart-brand-overlay">
          <span class="chart-brand-icon">◈</span>
          <span class="chart-brand-text">TOKEN<span class="chart-brand-accent">ALARM</span></span>
        </div>
      </div>
    </div>

    <!-- PANEL: SWAP -->
    <div class="chart-panel swap-panel" id="swap-${token.address}" style="display:none">
      <div class="chart-panel-header">
        <span class="chart-panel-title">⇄ SWAP — USDT → ${state.symbol || token.symbol} (${tag})</span>
        <a class="chart-ext-link"
           href="https://pancakeswap.finance/swap?inputCurrency=${USDT_BSC}&outputCurrency=${token.address}"
           target="_blank" rel="noopener" title="Abrir en PancakeSwap">↗</a>
      </div>
      <div class="swap-outer-wrap">
        <div class="swap-iframe-wrap" id="swap-iframe-wrap-${token.address}">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;
                      font-family:var(--font-mono);font-size:11px;color:var(--text-muted);
                      letter-spacing:2px;">
            CARGANDO…
          </div>
        </div>
        <div class="swap-brand-overlay">
          <span class="swap-brand-icon">◈</span>
          <span class="swap-brand-text">TOKEN<span class="swap-brand-accent">ALARM</span></span>
        </div>
      </div>
    </div>
  `;

  return card;
}

// ============================================================
//  LEGACY toggleChart — redirige al nuevo sistema
// ============================================================
function toggleChart(address) {
  openPanel(address, 'chart');
}

// ============================================================
//  LIVE PRICE UPDATE
// ============================================================
function updateCardPrice(tokenAddress) {
  const card  = document.getElementById('card-' + tokenAddress);
  const state = priceState[tokenAddress];
  if (!card || !state) return;

  const priceUsdEl = document.getElementById('price-usd-' + tokenAddress);
  if (priceUsdEl) {
    const priceDir = (state.prevPrice !== null && state.price !== null)
      ? (state.price > state.prevPrice ? 'up' : state.price < state.prevPrice ? 'down' : '')
      : '';
    if (state.error || (state.price === null && state.priceNative === null)) {
      priceUsdEl.className = 'price-error';
      priceUsdEl.innerHTML = `SIN DATOS <span class="error-hint">${state.errorMsg || ''}</span>`;
    } else {
      const sim = isSimulating(tokenAddress) ? '<span class="sim-badge">[SIM]</span>' : '';
      priceUsdEl.className = `price-main${priceDir ? ' ' + priceDir : ''}`;
      priceUsdEl.innerHTML = (state.price !== null ? formatPrice(state.price) : '—') + sim;
    }
  }

  const priceBnbEl = document.getElementById('price-bnb-' + tokenAddress);
  if (priceBnbEl && !state.error) {
    priceBnbEl.className   = 'price-secondary';
    priceBnbEl.textContent = state.priceNative !== null ? formatPriceBNB(state.priceNative) : '';
  }

  const tfEl = card.querySelector('.price-timeframes');
  if (tfEl) {
    tfEl.innerHTML =
      buildChangePill(state.priceChange1h, '1H')  +
      buildChangePill(state.priceChange,   '24H') +
      buildChangePill(state.priceChange7d, '7D');
  }

  const sv = card.querySelectorAll('.stat-value');
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

  const chipsEl = document.getElementById('chips-' + tokenAddress);
  if (chipsEl) {
    const orders = getOrders().filter(o =>
      o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !o.triggered
    );
    chipsEl.innerHTML = renderOrderChips(tokenAddress, orders);
  }

  recheckChartUrl(tokenAddress);
}

// ============================================================
//  ADD TOKEN MODAL
// ============================================================
function openAddTokenModal() {
  const presetsEl = document.getElementById('at-presets');
  if (presetsEl && presetsEl.children.length === 0) {
    ['#26a17b','#c9a84c','#3d7fff','#e05c6e','#2ecc87','#F0B90B','#9b59b6','#e67e22'].forEach(c => {
      const dot = document.createElement('span');
      dot.className = 'at-preset-dot';
      dot.style.background = c;
      dot.title = c;
      dot.onclick = () => {
        const ci = document.getElementById('at-color');
        if (ci) ci.value = c;
      };
      presetsEl.appendChild(dot);
    });
  }
  const modal = document.getElementById('add-token-modal');
  if (modal) modal.classList.remove('hidden');
  setTimeout(() => {
    const addr = document.getElementById('at-address');
    if (addr) addr.focus();
  }, 100);
}

function closeAddTokenModal() {
  const modal = document.getElementById('add-token-modal');
  if (modal) modal.classList.add('hidden');
  ['at-address','at-symbol','at-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const color = document.getElementById('at-color');
  if (color) color.value = '#c9a84c';
  const err = document.getElementById('at-error');
  if (err) err.textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('add-token-modal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeAddTokenModal();
    });
  }
});

function submitAddToken() {
  const address = (document.getElementById('at-address')?.value || '').trim();
  const symbol  = (document.getElementById('at-symbol')?.value  || '').trim();
  const name    = (document.getElementById('at-name')?.value    || '').trim();
  const color   = document.getElementById('at-color')?.value    || '#c9a84c';
  const errEl   = document.getElementById('at-error');

  if (!address || address.length < 10) {
    if (errEl) errEl.textContent = '⚠ Ingresá una dirección de contrato válida.';
    return;
  }

  const result = addCustomToken({ address, symbol, name, color });
  if (result.error) {
    if (errEl) errEl.textContent = '⚠ ' + result.error;
    return;
  }

  closeAddTokenModal();

  const grid = document.getElementById('tokens-grid');
  if (grid) {
    const card = buildTokenCard(result.token, priceState[result.token.address]);
    grid.appendChild(card);
  }

  _updateTokenCount();
  populateTokenSelects();

  if (typeof fetchAllPrices === 'function') fetchAllPrices();
  setTimeout(() => resolveTokenLogo(result.token), 1000);

  showToast('✓ Contrato agregado',
    `${result.token.symbol} (${contractTag(result.token.address)}) — buscando precio…`,
    'success');
}

function removeTokenAndRefresh(address) {
  const token = getToken(address);
  if (!token || !token.custom) return;
  const sym = token.symbol;
  const ok  = removeCustomToken(address);
  if (!ok) return;

  const card = document.getElementById('card-' + address);
  if (card) card.remove();

  _updateTokenCount();
  populateTokenSelects();
  updateTicker();
  showToast('Contrato eliminado', `${sym} (${contractTag(address)}) removido.`, 'success');
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

    const tag      = contractTag(order.tokenAddress);
    const sym      = order.tokenSymbol || 'USDT.z';
    const condText = order.type === 'below'
      ? `Alertar si baja de <span class="price-target">${formatPrice(order.price)}</span>`
      : `Alertar si sube a <span class="price-target">${formatPrice(order.price)}</span>`;
    const created  = new Date(order.createdAt).toLocaleString('es-AR', {
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
  sel.innerHTML = getSoundOptions().map(o =>
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
