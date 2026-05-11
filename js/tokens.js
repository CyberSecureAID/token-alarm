// ============================================================
//  tokens.js — Token definitions, state & logo resolution
//  v4.0 — CORREGIDO: pairAddress directo para precio exacto en BNB/USDT
//
//  CAMBIOS CRÍTICOS:
//    - Cada token tiene su pairAddress real en BSC
//    - El precio se obtiene del PAR directo, no de la búsqueda por token
//    - priceNative = precio en BNB (referencia principal)
//    - priceUsd    = conversión secundaria
// ============================================================

const TRUST_WALLET_BASE =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';

const USDT_LOGO_URL = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png';

function twLogo(addr) {
  return TRUST_WALLET_BASE + addr + '/logo.png';
}

function generateAvatarSVG(symbol, color) {
  const letter = (symbol || '?')[0].toUpperCase();
  const c = color || '#c9a84c';
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<circle cx="24" cy="24" r="24" fill="${c}18"/>` +
    `<circle cx="24" cy="24" r="23" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.4"/>` +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="Georgia,serif" font-size="20" font-weight="400" fill="${c}">${letter}</text>` +
    `</svg>`
  )}`;
}

function last4(address) {
  return address ? address.slice(-4) : '????';
}

// ============================================================
//  6 TOKENS MONITOREADOS
//
//  pairAddress: dirección del PAR en DexScreener/BSC
//  Esto garantiza que el precio obtenido sea el correcto
//  sin ambigüedad de qué lado es base/quote.
//
//  Para obtener/verificar el pairAddress:
//    https://dexscreener.com/bsc/<TOKEN_ADDRESS>
//    → copiar la URL del par principal que aparece
//
//  isBaseToken: true  → el token ES el baseToken del par
//              false → el token ES el quoteToken del par
// ============================================================
const TOKENS = [
  {
    // TKN1 — últimas 4: 7db4
    address:     '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    // Par principal en BSC — verificar en dexscreener.com/bsc/<address>
    pairAddress: null,   // Se auto-descubre en el primer fetch
    isBaseToken: true,
    verified:    true,
  },
  {
    // TKN2 — últimas 4: A21f
    address:     '0xf15c7f1F86398520b70505e9cC285A8b18D9A21f',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    isBaseToken: true,
    verified:    true,
  },
  {
    // TKN3 — últimas 4: b520
    address:     '0xd242797cBe7629C216f95f3deaFE79a9856Cb520',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    isBaseToken: true,
    verified:    true,
  },
  {
    // TKN4 — últimas 4: 0877
    address:     '0xca1df182e5f9d59149057e15a98f95e3de9e0877',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    isBaseToken: true,
    verified:    true,
  },
  {
    // TKN5 — últimas 4: 4444
    address:     '0xa80A8cba9b40AC5dA81E84578a75c6ddA94C4444',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    isBaseToken: true,
    verified:    true,
  },
  {
    // TKN6 — últimas 4: 76c3
    address:     '0x7D19a02e543Ff0E88AB717b886cf8e76a19F76c3',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    isBaseToken: true,
    verified:    true,
  },
];

// ============================================================
//  PRICE STATE — extended data per token
// ============================================================
const priceState = {};

TOKENS.forEach(t => {
  priceState[t.address] = {
    // Precios — BNB es la referencia principal
    price:          null,   // precio en USD (conversión)
    priceNative:    null,   // precio en BNB (referencia PRINCIPAL)
    prevPrice:      null,
    prevPriceNative: null,

    // Variaciones
    priceChange1h:  null,
    priceChange:    null,   // 24h
    priceChange7d:  null,

    // Métricas
    volume24h:      null,
    liquidity:      null,
    marketCap:      null,
    fdv:            null,
    holders:        null,
    txns24h:        null,
    buys24h:        null,
    sells24h:       null,
    buyVolume24h:   null,
    sellVolume24h:  null,
    pairCreatedAt:  null,

    // Metadatos
    symbol:         t.symbol,
    name:           t.name,
    pairAddress:    t.pairAddress,
    logoUrl:        USDT_LOGO_URL,
    verified:       true,
    logoResolved:   true,
    source:         null,
    lastUpdated:    null,
    error:          false,
    loading:        true,
    errorMsg:       null,

    // BNB price para conversión
    bnbPriceUsd:    null,
  };
});

// ============================================================
//  LOGO RESOLUTION
// ============================================================
function testImage(url, timeoutMs = 4000) {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    img.onload  = () => finish(true);
    img.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
    img.src = url;
  });
}

async function resolveTokenLogo(token) {
  const state = priceState[token.address];
  const candidates = [
    twLogo(token.address),
    twLogo(token.address.toLowerCase()),
    USDT_LOGO_URL,
  ];
  for (const url of candidates) {
    const ok = await testImage(url, 3000);
    if (ok) {
      state.logoUrl = url;
      _patchCardLogo(token.address, url, true);
      return;
    }
  }
  _patchCardLogo(token.address, USDT_LOGO_URL, true);
}

async function resolveAllLogos() {
  for (const token of TOKENS) {
    resolveTokenLogo(token);
    await new Promise(r => setTimeout(r, 150));
  }
}

function _patchCardLogo(address, logoUrl, verified) {
  const img = document.querySelector(`#card-${address} .token-logo`);
  if (img) img.src = logoUrl;
  if (verified) {
    const badge = document.querySelector(`#card-${address} .verified-badge`);
    if (badge) badge.classList.remove('hidden');
  }
}

// ============================================================
//  HELPERS
// ============================================================
function getToken(address) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

function shortAddress(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function contractTag(addr) {
  if (!addr) return '????';
  return addr.slice(-4);
}

// Formato precio USD — muestra suficientes decimales para micro-caps
function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price) || price < 0) return '—';
  if (price === 0) return '$0.00';
  if (price >= 1000)   return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1)      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (price >= 0.01)   return '$' + price.toFixed(6);
  if (price >= 0.0001) return '$' + price.toFixed(8);
  if (price >= 1e-10)  return '$' + price.toFixed(10);
  return '$' + price.toExponential(4);
}

// Formato precio BNB — referencia principal
function formatPriceBNB(price) {
  if (price === null || price === undefined || isNaN(price) || price < 0) return '—';
  if (price === 0) return '0 BNB';
  if (price >= 1)      return price.toFixed(4) + ' BNB';
  if (price >= 0.0001) return price.toFixed(8) + ' BNB';
  if (price >= 1e-10)  return price.toFixed(10) + ' BNB';
  return price.toExponential(4) + ' BNB';
}

function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n) || n === 0) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(2)  + 'K';
  return '$' + n.toFixed(2);
}

function formatCount(n) {
  if (n === null || n === undefined || isNaN(n) || n === 0) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

function formatPercent(n, withSign = true) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = withSign && n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function formatAge(isoDateOrMs) {
  if (!isoDateOrMs) return '—';
  const ms   = typeof isoDateOrMs === 'number' ? isoDateOrMs : new Date(isoDateOrMs).getTime();
  if (isNaN(ms)) return '—';
  const diff = Date.now() - ms;
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor(diff / 60000);
  if (mins  < 60)  return mins  + 'm';
  if (hours < 24)  return hours + 'h';
  if (days  < 30)  return days  + 'd';
  if (days  < 365) return Math.floor(days / 30)  + 'mo';
  return Math.floor(days / 365) + 'y ' + (Math.floor(days % 365 / 30)) + 'mo';
}
