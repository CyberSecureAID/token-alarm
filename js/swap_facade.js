// ============================================================
//  swap_facade.js — Fachada visual del panel de swap v1.0
//
//  Estrategia:
//    1. Renderiza una UI completamente custom encima del iframe.
//    2. El iframe real queda invisible en el DOM (opacity:0,
//       pointer-events:none) — solo se usa para la transacción.
//    3. Cuando el usuario confirma, se abre un modal que revela
//       el iframe real con tamaño completo para que firme la tx.
//
//  API pública:
//    SwapFacade.build(containerEl, { address, symbol, logoUrl })
//    SwapFacade.destroy(containerEl)
// ============================================================

const SwapFacade = (() => {

  const USDT_BSC   = '0x55d398326f99059fF775485246999027B3197955';
  const USDT_LOGO  = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png';
  const SLIP_OPTS  = ['0.1', '0.5', '1.0'];

  // ── State ─────────────────────────────────────────────────
  const state = {};

  function getState(address) {
    if (!state[address]) {
      state[address] = {
        fromAmt:      '',
        toAmt:        '',
        slippage:     '0.5',
        route:        'auto',    // 'auto' | 'v1' | 'v2'
        priceImpact:  null,
        settingsOpen: false,
        detailsOpen:  false,
        walletAddr:   null,
      };
    }
    return state[address];
  }

  // ── Price lookup (from global priceState) ─────────────────
  function getTokenPrice(address) {
    if (typeof priceState !== 'undefined' && priceState[address]) {
      return priceState[address].price || null;
    }
    return null;
  }

  function computeOutput(fromAmt, tokenAddress) {
    const price = getTokenPrice(tokenAddress);
    if (!price || !fromAmt || isNaN(parseFloat(fromAmt))) return '';
    // USDT → token: output = fromAmt / price
    const out = parseFloat(fromAmt) / price;
    if (!isFinite(out) || out <= 0) return '';
    if (out >= 1000)   return out.toFixed(2);
    if (out >= 1)      return out.toFixed(4);
    if (out >= 0.0001) return out.toFixed(8);
    return out.toExponential(4);
  }

  function computeUsdValue(amount, isToken, tokenAddress) {
    if (!amount || isNaN(parseFloat(amount))) return '';
    const price = getTokenPrice(tokenAddress);
    if (isToken && price) {
      const usd = parseFloat(amount) * price;
      return '$' + (usd >= 1 ? usd.toFixed(2) : usd.toFixed(6));
    }
    // fromAmt is already USDT
    if (!isToken) return '$' + parseFloat(amount).toFixed(2);
    return '';
  }

  function estimatePriceImpact(fromAmt, tokenAddress) {
    // Rough estimate based on liquidity
    if (typeof priceState !== 'undefined' && priceState[tokenAddress]) {
      const liq = priceState[tokenAddress].liquidity;
      if (liq && fromAmt) {
        const pct = (parseFloat(fromAmt) / liq) * 100;
        return Math.min(pct * 2, 99).toFixed(2);
      }
    }
    return '<0.01';
  }

  // ── URL builder ───────────────────────────────────────────
  function buildSwapUrl(tokenAddress, route) {
    const base = `https://poocoin.app/embed-swap?inputCurrency=${USDT_BSC}&outputCurrency=${tokenAddress}`;
    return base;
  }

  // ── Render ────────────────────────────────────────────────
  function build(container, { address, symbol, logoUrl }) {
    const s = getState(address);

    container.innerHTML = '';
    container.className = 'swap-facade-root';

    const iframeUrl = buildSwapUrl(address, s.route);

    // Hidden iframe (invisible but in DOM for tx execution)
    const hiddenIframe = document.createElement('iframe');
    hiddenIframe.src          = iframeUrl;
    hiddenIframe.className    = 'swap-iframe-hidden';
    hiddenIframe.title        = 'swap-engine';
    hiddenIframe.setAttribute('loading', 'lazy');
    container.appendChild(hiddenIframe);

    // Facade overlay
    const facade = document.createElement('div');
    facade.className = 'swap-facade';
    facade.innerHTML = buildFacadeHTML(address, symbol, logoUrl, s);
    container.appendChild(facade);

    // Settings overlay
    const settingsEl = facade.querySelector('.swap-settings-overlay');

    // Confirm modal (absolute within facade-root)
    const confirmEl = document.createElement('div');
    confirmEl.className = 'swap-confirm-overlay';
    confirmEl.innerHTML = buildConfirmHTML(address, symbol, s);
    container.appendChild(confirmEl);

    // Bind events
    bindEvents(container, facade, confirmEl, settingsEl, address, symbol, logoUrl);
  }

  function buildFacadeHTML(address, symbol, logoUrl, s) {
    const price    = getTokenPrice(address);
    const priceStr = price
      ? (price >= 0.01 ? '$' + price.toFixed(6) : '$' + price.toExponential(4))
      : '—';
    const rateStr  = price
      ? `1 USDT = ${computeOutput('1', address)} ${symbol}`
      : `—`;

    return `
      <div class="swap-facade-card" style="position:relative">

        <!-- Settings overlay (absolute, inside card) -->
        <div class="swap-settings-overlay${s.settingsOpen ? ' open' : ''}">
          <div class="swap-settings-header">
            <span class="swap-settings-title">Configuración</span>
            <button class="swap-settings-close" data-action="settings-close">✕</button>
          </div>
          <div style="margin-bottom:10px;font-family:var(--font-mono);font-size:9px;letter-spacing:2px;color:var(--text-muted);text-transform:uppercase">
            Slippage tolerance
          </div>
          <div class="swap-slip-options">
            ${SLIP_OPTS.map(v => `
              <button class="swap-slip-opt${s.slippage === v ? ' active' : ''}" data-slip="${v}">${v}%</button>
            `).join('')}
          </div>
          <div class="swap-slip-custom">
            <input class="swap-slip-input" type="number" min="0.01" max="50" step="0.1"
                   placeholder="Custom" value="${SLIP_OPTS.includes(s.slippage) ? '' : s.slippage}"
                   data-action="slip-custom" />
            <span class="swap-slip-pct">%</span>
          </div>
        </div>

        <!-- Route bar -->
        <div class="swap-route-bar">
          <span class="swap-route-label">Ruta:</span>
          <button class="swap-route-btn${s.route === 'auto' ? ' active' : ''}" data-route="auto">Auto</button>
          <button class="swap-route-btn${s.route === 'v1'   ? ' active' : ''}" data-route="v1">V1</button>
          <button class="swap-route-btn${s.route === 'v2'   ? ' active' : ''}" data-route="v2">V2</button>
          <button class="swap-settings-btn" data-action="settings-open" title="Configuración">⚙</button>
        </div>

        <!-- FROM box (USDT) -->
        <div class="swap-input-box">
          <div class="swap-input-header">
            <span class="swap-input-label">De</span>
            <div class="swap-balance-row">
              <span>Balance:</span>
              <span class="swap-balance-val" id="sf-balance-from-${address}">—</span>
              <button class="swap-max-btn" data-action="max">MAX</button>
            </div>
          </div>
          <div class="swap-input-row">
            <input class="swap-amount-input" type="number" min="0" step="any"
                   placeholder="0.00" value="${s.fromAmt}"
                   id="sf-from-${address}" data-action="from-input" />
            <div class="swap-token-badge">
              <img class="swap-token-logo" src="${USDT_LOGO}" alt="USDT"
                   onerror="this.style.display='none'" />
              <span class="swap-token-sym">USDT</span>
            </div>
          </div>
          <div class="swap-usd-val" id="sf-from-usd-${address}">
            ${s.fromAmt ? computeUsdValue(s.fromAmt, false, address) : ''}
          </div>
        </div>

        <!-- Direction -->
        <div class="swap-direction-wrap">
          <button class="swap-direction-btn" data-action="flip" title="Invertir">⇅</button>
        </div>

        <!-- TO box (token) -->
        <div class="swap-input-box">
          <div class="swap-input-header">
            <span class="swap-input-label">A</span>
            <div class="swap-balance-row">
              <span>Balance:</span>
              <span class="swap-balance-val" id="sf-balance-to-${address}">—</span>
            </div>
          </div>
          <div class="swap-input-row">
            <input class="swap-amount-input" type="number" min="0" step="any"
                   placeholder="0.00" value="${s.toAmt}"
                   id="sf-to-${address}" data-action="to-input" readonly />
            <div class="swap-token-badge">
              <img class="swap-token-logo" src="${logoUrl || USDT_LOGO}" alt="${symbol}"
                   onerror="this.style.display='none'" />
              <span class="swap-token-sym">${symbol}</span>
            </div>
          </div>
          <div class="swap-usd-val" id="sf-to-usd-${address}">
            ${s.toAmt ? computeUsdValue(s.toAmt, true, address) : ''}
          </div>
        </div>

        <!-- Price info -->
        <div class="swap-price-info">
          <div class="swap-price-ratio">
            <span>Precio:</span>
            <span class="swap-price-ratio-val" id="sf-price-${address}">${rateStr}</span>
          </div>
          <div class="swap-slippage-badge">
            <span>Slippage</span>
            <span id="sf-slip-disp-${address}" style="color:var(--accent-green)">${s.slippage}%</span>
          </div>
        </div>

        <!-- Action button -->
        <button class="swap-action-btn btn-connect" data-action="main-btn" id="sf-btn-${address}">
          Conectar Wallet
        </button>

      </div>

      <!-- Details -->
      <div class="swap-details">
        <div class="swap-details-toggle" data-action="details-toggle">
          <span>Detalles de la transacción</span>
          <span class="swap-details-arrow${s.detailsOpen ? ' open' : ''}">▾</span>
        </div>
        <div class="swap-details-body${s.detailsOpen ? ' open' : ''}">
          <div style="padding-top:10px">
            <div class="swap-detail-row">
              <span class="swap-detail-label">Mínimo recibido</span>
              <span class="swap-detail-val" id="sf-min-${address}">—</span>
            </div>
            <div class="swap-detail-row">
              <span class="swap-detail-label">Impacto en precio</span>
              <span class="swap-detail-val good" id="sf-impact-${address}">—</span>
            </div>
            <div class="swap-detail-row">
              <span class="swap-detail-label">Fee de liquidez</span>
              <span class="swap-detail-val">0.25%</span>
            </div>
            <div class="swap-detail-row">
              <span class="swap-detail-label">Ruta</span>
              <span class="swap-detail-val">USDT → ${symbol}</span>
            </div>
            <div class="swap-detail-row">
              <span class="swap-detail-label">Red</span>
              <span class="swap-detail-val" style="color:var(--accent-bnb)">BSC</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildConfirmHTML(address, symbol, s) {
    const out    = computeOutput(s.fromAmt, address);
    const minRec = out
      ? (parseFloat(out) * (1 - parseFloat(s.slippage) / 100)).toFixed(8)
      : '—';

    return `
      <div class="swap-confirm-box">
        <div class="swap-confirm-title">Confirmar Swap</div>
        <div class="swap-confirm-row">
          <span class="swap-confirm-label">Enviás</span>
          <span class="swap-confirm-val">${s.fromAmt || '0'} USDT</span>
        </div>
        <div class="swap-confirm-row">
          <span class="swap-confirm-label">Recibís (est.)</span>
          <span class="swap-confirm-val accent">${out || '—'} ${symbol}</span>
        </div>
        <div class="swap-confirm-row">
          <span class="swap-confirm-label">Mínimo</span>
          <span class="swap-confirm-val">${minRec} ${symbol}</span>
        </div>
        <div class="swap-confirm-row">
          <span class="swap-confirm-label">Slippage</span>
          <span class="swap-confirm-val">${s.slippage}%</span>
        </div>
        <div class="swap-confirm-row">
          <span class="swap-confirm-label">Ruta</span>
          <span class="swap-confirm-val">USDT → ${symbol}</span>
        </div>
        <div class="swap-confirm-actions">
          <button class="swap-confirm-cancel" data-action="confirm-cancel">Cancelar</button>
          <button class="swap-confirm-proceed" data-action="confirm-proceed">
            Ejecutar Swap
          </button>
        </div>
      </div>
    `;
  }

  // ── Event binding ─────────────────────────────────────────
  function bindEvents(container, facade, confirmEl, settingsEl, address, symbol, logoUrl) {
    const s = getState(address);

    function refreshOutputs() {
      const fromInput = container.querySelector(`#sf-from-${address}`);
      const toInput   = container.querySelector(`#sf-to-${address}`);
      const fromUsd   = container.querySelector(`#sf-from-usd-${address}`);
      const toUsd     = container.querySelector(`#sf-to-usd-${address}`);
      const priceEl   = container.querySelector(`#sf-price-${address}`);
      const minEl     = container.querySelector(`#sf-min-${address}`);
      const impactEl  = container.querySelector(`#sf-impact-${address}`);
      const btn       = container.querySelector(`#sf-btn-${address}`);

      const fromAmt = fromInput ? fromInput.value : '';
      s.fromAmt     = fromAmt;
      const out     = computeOutput(fromAmt, address);
      s.toAmt       = out;
      if (toInput)  toInput.value = out;

      if (fromUsd)  fromUsd.textContent  = fromAmt ? (computeUsdValue(fromAmt, false, address) || '') : '';
      if (toUsd)    toUsd.textContent    = out ? (computeUsdValue(out, true, address) || '') : '';
      if (priceEl)  priceEl.textContent  = computeOutput('1', address)
        ? `1 USDT = ${computeOutput('1', address)} ${symbol}`
        : '—';

      const impact  = estimatePriceImpact(fromAmt, address);
      if (impactEl) {
        impactEl.textContent = `<${impact}%`;
        impactEl.className   = 'swap-detail-val ' + (
          parseFloat(impact) > 5 ? 'warn' : 'good'
        );
      }

      if (minEl && out) {
        const min = (parseFloat(out) * (1 - parseFloat(s.slippage) / 100)).toFixed(8);
        minEl.textContent = `${min} ${symbol}`;
      }

      // Update button state
      if (btn) {
        const hasAmt = fromAmt && parseFloat(fromAmt) > 0;
        if (!hasAmt) {
          btn.textContent = 'Ingresar monto';
          btn.className   = 'swap-action-btn';
          btn.disabled    = true;
        } else {
          btn.textContent = `Swap USDT → ${symbol}`;
          btn.className   = 'swap-action-btn';
          btn.disabled    = false;
        }
      }

      // Sync confirm modal content
      syncConfirm(confirmEl, address, symbol, s);
    }

    function syncConfirm(confirmEl, address, symbol, s) {
      const out    = computeOutput(s.fromAmt, address);
      const minRec = out
        ? (parseFloat(out) * (1 - parseFloat(s.slippage) / 100)).toFixed(8)
        : '—';
      confirmEl.innerHTML = `
        <div class="swap-confirm-box">
          <div class="swap-confirm-title">Confirmar Swap</div>
          <div class="swap-confirm-row">
            <span class="swap-confirm-label">Enviás</span>
            <span class="swap-confirm-val">${s.fromAmt || '0'} USDT</span>
          </div>
          <div class="swap-confirm-row">
            <span class="swap-confirm-label">Recibís (est.)</span>
            <span class="swap-confirm-val accent">${out || '—'} ${symbol}</span>
          </div>
          <div class="swap-confirm-row">
            <span class="swap-confirm-label">Mínimo</span>
            <span class="swap-confirm-val">${minRec} ${symbol}</span>
          </div>
          <div class="swap-confirm-row">
            <span class="swap-confirm-label">Slippage</span>
            <span class="swap-confirm-val">${s.slippage}%</span>
          </div>
          <div class="swap-confirm-row">
            <span class="swap-confirm-label">Ruta</span>
            <span class="swap-confirm-val">USDT → ${symbol}</span>
          </div>
          <div class="swap-confirm-actions">
            <button class="swap-confirm-cancel" data-action="confirm-cancel">Cancelar</button>
            <button class="swap-confirm-proceed" data-action="confirm-proceed">
              Ejecutar Swap
            </button>
          </div>
        </div>
      `;
      bindConfirmEvents(confirmEl, address, symbol, logoUrl, s);
    }

    function bindConfirmEvents(confirmEl, address, symbol, logoUrl, s) {
      confirmEl.querySelector('[data-action="confirm-cancel"]')?.addEventListener('click', () => {
        confirmEl.classList.remove('open');
      });
      confirmEl.querySelector('[data-action="confirm-proceed"]')?.addEventListener('click', () => {
        confirmEl.classList.remove('open');
        openIframeModal(address, symbol, logoUrl);
      });
    }

    // Initial bind for confirm buttons
    bindConfirmEvents(confirmEl, address, symbol, logoUrl, s);

    // Delegate all events on the container
    container.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset?.action;
      const route  = e.target.closest('[data-route]')?.dataset?.route;
      const slip   = e.target.closest('[data-slip]')?.dataset?.slip;

      if (route) {
        s.route = route;
        container.querySelectorAll('.swap-route-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.route === route);
        });
        return;
      }

      if (slip) {
        s.slippage = slip;
        container.querySelectorAll('.swap-slip-opt').forEach(b => {
          b.classList.toggle('active', b.dataset.slip === slip);
        });
        const slipDisp = container.querySelector(`#sf-slip-disp-${address}`);
        if (slipDisp) slipDisp.textContent = slip + '%';
        refreshOutputs();
        return;
      }

      switch (action) {
        case 'settings-open':
          s.settingsOpen = true;
          container.querySelector('.swap-settings-overlay')?.classList.add('open');
          break;

        case 'settings-close':
          s.settingsOpen = false;
          container.querySelector('.swap-settings-overlay')?.classList.remove('open');
          break;

        case 'max':
          // Set a reasonable placeholder max since we can't read wallet balance
          const fromIn = container.querySelector(`#sf-from-${address}`);
          if (fromIn) { fromIn.value = '100'; s.fromAmt = '100'; refreshOutputs(); }
          break;

        case 'flip':
          // Only USDT→token supported; show toast
          if (typeof showToast === 'function') {
            showToast('⇄ Swap', `Solo se admite USDT → ${symbol}`, 'info');
          }
          break;

        case 'details-toggle':
          s.detailsOpen = !s.detailsOpen;
          const body  = container.querySelector('.swap-details-body');
          const arrow = container.querySelector('.swap-details-arrow');
          body?.classList.toggle('open',  s.detailsOpen);
          arrow?.classList.toggle('open', s.detailsOpen);
          break;

        case 'main-btn':
          const amt = parseFloat(s.fromAmt);
          if (!amt || amt <= 0) return;
          // Show confirm modal
          confirmEl.classList.add('open');
          syncConfirm(confirmEl, address, symbol, s);
          break;

        case 'confirm-cancel':
          confirmEl.classList.remove('open');
          break;

        case 'confirm-proceed':
          confirmEl.classList.remove('open');
          openIframeModal(address, symbol, logoUrl);
          break;
      }
    });

    // From input
    container.addEventListener('input', e => {
      if (e.target.dataset.action === 'from-input') {
        s.fromAmt = e.target.value;
        refreshOutputs();
      }
      if (e.target.dataset.action === 'slip-custom') {
        const v = e.target.value;
        if (v && !isNaN(parseFloat(v))) {
          s.slippage = parseFloat(v).toString();
          const slipDisp = container.querySelector(`#sf-slip-disp-${address}`);
          if (slipDisp) slipDisp.textContent = s.slippage + '%';
          container.querySelectorAll('.swap-slip-opt').forEach(b => b.classList.remove('active'));
          refreshOutputs();
        }
      }
    });

    // Initial refresh
    refreshOutputs();
  }

  // ── iframe modal (real swap UI) ───────────────────────────
  function openIframeModal(address, symbol, logoUrl) {
    // Remove any existing modal
    document.querySelector('.swap-iframe-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'swap-iframe-modal open';
    modal.innerHTML = `
      <div class="swap-iframe-modal-header">
        <span class="swap-iframe-modal-title">⇄ Completar Swap — USDT → ${symbol}</span>
        <button class="swap-iframe-modal-close" id="sf-modal-close">✕</button>
      </div>
      <div class="swap-iframe-modal-body">
        <iframe
          src="https://poocoin.app/embed-swap?inputCurrency=${USDT_BSC}&outputCurrency=${address}"
          loading="eager"
          allowfullscreen
          title="Swap USDT → ${symbol}"
        ></iframe>
        <div class="swap-iframe-modal-overlay-bar"></div>
      </div>
      <p class="swap-iframe-modal-hint">
        Conectá tu wallet y confirmá la transacción en el swap.<br/>
        Cerrá este panel cuando hayas finalizado.
      </p>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#sf-modal-close').addEventListener('click', () => {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s ease';
      setTimeout(() => modal.remove(), 300);
    });

    // Close on backdrop click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        setTimeout(() => modal.remove(), 300);
      }
    });
  }

  // ── Public destroy ────────────────────────────────────────
  function destroy(container) {
    container.innerHTML = '';
  }

  return { build, destroy };

})();
