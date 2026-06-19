// ============================================================
//  tracking_animation.js — Animación de rastreo de contratos v1.0
//  Intercepta submitAddToken() para mostrar pantalla dramática
//  de búsqueda en blockchain antes de agregar el token.
// ============================================================

(function() {

  const TRACKING_STEPS = [
    { text: 'Consultando red BSC',           delay: 0   },
    { text: 'Resolviendo contrato ERC-20',   delay: 520 },
    { text: 'Localizando par de liquidez',   delay: 1050 },
    { text: 'Verificando pool DexScreener',  delay: 1580 },
    { text: 'Analizando datos de mercado',   delay: 2100 },
    { text: 'Sincronizando precio USD/BNB',  delay: 2650 },
  ];

  const FOUND_DELAY  = 3300;
  const DONE_DELAY   = 4100;

  function randomHex(len) {
    const chars = '0123456789abcdef';
    let s = '0x';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function buildTrackingHTML(address, symbol) {
    const shortAddr = address.length >= 10
      ? address.slice(0, 10) + '...' + address.slice(-6)
      : address;
    const sym = (symbol || address.slice(-6)).toUpperCase();

    const stepsHTML = TRACKING_STEPS.map((s, i) => `
      <div class="tracking-log-item" id="tlog-${i}">
        <span class="tracking-dot"></span>
        <span>${s.text}</span>
      </div>
    `).join('');

    return `
      <div class="tracking-overlay">
        <div class="tracking-header">RASTREANDO <span class="accent">${sym}</span></div>
        <div class="tracking-addr">${shortAddr}</div>

        <div class="tracking-scanner">
          <div class="tracking-scanner-bar"></div>
        </div>

        <div class="tracking-log">
          ${stepsHTML}
        </div>

        <div class="tracking-found" id="tracking-found-msg">
          ◈ TOKEN ENCONTRADO
        </div>
        <div class="tracking-hex" id="tracking-found-hex">
          BLOCK #${randomHex(6).toUpperCase()} · BSC MAINNET
        </div>
      </div>
    `;
  }

  function runTrackingAnimation(address, symbol, onComplete) {
    const trackingEl = document.getElementById('add-token-tracking');
    const formInner  = document.getElementById('add-token-form-inner');
    if (!trackingEl || !formInner) { onComplete(); return; }

    trackingEl.innerHTML = buildTrackingHTML(address, symbol);
    formInner.style.visibility  = 'hidden';
    formInner.style.pointerEvents = 'none';
    trackingEl.style.display = 'block';

    const timers = [];

    TRACKING_STEPS.forEach((step, i) => {
      timers.push(setTimeout(() => {
        const el = document.getElementById('tlog-' + i);
        if (!el) return;

        if (i > 0) {
          const prev = document.getElementById('tlog-' + (i - 1));
          if (prev) {
            prev.classList.remove('active');
            prev.classList.add('done', 'visible');
            const dot = prev.querySelector('.tracking-dot');
            if (dot) dot.textContent = '';
          }
        }

        el.classList.add('active', 'visible');
      }, step.delay));
    });

    timers.push(setTimeout(() => {
      const last = document.getElementById('tlog-' + (TRACKING_STEPS.length - 1));
      if (last) {
        last.classList.remove('active');
        last.classList.add('done');
      }
      const foundMsg = document.getElementById('tracking-found-msg');
      const foundHex = document.getElementById('tracking-found-hex');
      if (foundMsg) foundMsg.classList.add('visible');
      if (foundHex) foundHex.classList.add('visible');
    }, FOUND_DELAY));

    timers.push(setTimeout(() => {
      trackingEl.style.opacity = '0';
      trackingEl.style.transition = 'opacity 0.35s ease';
      setTimeout(() => {
        trackingEl.style.display = 'none';
        trackingEl.style.opacity = '';
        trackingEl.style.transition = '';
        formInner.style.visibility = '';
        formInner.style.pointerEvents = '';
        onComplete();
      }, 360);
    }, DONE_DELAY));
  }

  // Sobrescribir submitAddToken globalmente
  const _originalSubmit = window.submitAddToken;

  window.submitAddToken = function() {
    const address = (document.getElementById('at-address')?.value || '').trim();
    const symbol  = (document.getElementById('at-symbol')?.value  || '').trim();
    const errEl   = document.getElementById('at-error');

    // Validación básica antes de animar
    if (!address || address.length < 10) {
      if (errEl) errEl.textContent = '⚠ Ingresá una dirección de contrato válida.';
      return;
    }

    // Verificar duplicado antes de animar
    const normalized = address.startsWith('0x') ? address : '0x' + address;
    if (typeof TOKENS !== 'undefined' &&
        TOKENS.find(t => t.address.toLowerCase() === normalized.toLowerCase())) {
      if (errEl) errEl.textContent = '⚠ Este contrato ya está en la lista.';
      return;
    }

    if (errEl) errEl.textContent = '';

    // Lanzar animación; al terminar ejecutar el flujo original
    runTrackingAnimation(normalized, symbol, function() {
      if (typeof _originalSubmit === 'function') {
        _originalSubmit();
      }
    });
  };

})();
