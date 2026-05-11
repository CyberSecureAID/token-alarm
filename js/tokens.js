// ============================================================
//  tokens.js — Token definitions, state & logo resolution
//
//  Todos los tokens son variantes de Tether USD Bridged (USDT.z)
//  en BSC. Logotipo de USDT para todos.
//  Trust Wallet Assets como fuente primaria de logo.
// ============================================================

const TRUST_WALLET_BASE =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';

// Logo oficial de USDT (Tether) en Trust Wallet (Ethereum mainnet checksum)
const USDT_LOGO_URL = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png';

function twLogo(addr) {
  // Trust Wallet requiere checksum address (mayúsculas/minúsculas exactas)
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

// ============================================================
//  ÚLTIMAS 4 LETRAS DE CADA CONTRATO (para identificación)
// ============================================================
function last4(address) {
  return address ? address.slice(-4) : '????';
}

// ============================================================
//  6 TOKENS MONITOREADOS — Tether USD Bridged en BSC
//
//  Identificación por últimas 4 letras del contrato:
//    TKN1 → 7db4
//    TKN2 → A21f  (address termina en lowercase 'f' en chain)
//    TKN3 → b520
//    TKN4 → 0877
//    TKN5 → 4444
//    TKN6 → 76c3
// ============================================================
const TOKENS = [
  {
    address:     '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',   // verde Tether
    pairAddress: null,
    verified:    true,        // todos verificados
  },
  {
    address:     '0xf15c7f1F86398520b70505e9cC285A8b18D9A21f',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    verified:    true,
  },
  {
    address:     '0xd242797cBe7629C216f95f3deaFE79a9856Cb520',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    verified:    true,
  },
  {
    address:     '0xca1df182e5f9d59149057e15a98f95e3de9e0877',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    verified:    true,
  },
  {
    address:     '0xa80A8cba9b40AC5dA81E84578a75c6ddA94C4444',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    verified:    true,
  },
  {
    address:     '0x7D19a02e543Ff0E88AB717b886cf8e76a19F76c3',
    symbol:      'USDT.z',
    name:        'Tether USD Bridged ZET20',
    chain:       'bsc',
    color:       '#26a17b',
    pairAddress: null,
    verified:    true,
  },
];

// ============================================================
//  PRICE STATE — full extended data per token
// ============================================================
const priceState = {};

TOKENS.forEach(t => {
  priceState[t.address] = {
    price:          null,
    prevPrice:      null,
    priceChange1h:  null,
    priceChange:    null,
    priceChange7d:  null,
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
    symbol:         t.symbol,
    name:           t.name,
    // Todos arrancan con el logo de USDT
    logoUrl:        USDT_LOGO_URL,
    verified:       true,        // todos verificados desde el inicio
    logoResolved:   true,        // no necesitan resolución extra
    source:         null,
    lastUpdated:    null,
    error:          false,
    loading:        true,
  };
});

// ============================================================
//  LOGO RESOLUTION
//  Todos los tokens ya tienen el logo de USDT asignado.
//  Esta función intenta mejorar con el logo específico de BSC
//  si existe en Trust Wallet. Si no, conserva el de USDT.
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
  // El token 1 ya tiene logo correcto desde el sistema — no tocarlo
  // Para los demás intentamos BSC checksum; si falla conservamos USDT logo
  const candidates = [
    twLogo(token.address),
    twLogo(token.address.toLowerCase()),
    USDT_LOGO_URL,  // fallback garantizado
  ];

  for (const url of candidates) {
    const ok = await testImage(url, 3000);
    if (ok) {
      state.logoUrl    = url;
      state.verified   = true;
      token.verified   = true;
      _patchCardLogo(token.address, url, true);
      return;
    }
  }
  // Si todo falla, USDT logo ya está asignado — solo actualizamos el DOM
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

/** Últimas 4 letras del contrato — para identificar cada token */
function contractTag(addr) {
  if (!addr) return '????';
  return addr.slice(-4);
}

function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) return '—';
  if (price >= 1000)   return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1)      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (price >= 0.0001) return '$' + price.toFixed(8);
  return '$' + price.toExponential(4);
}

function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(2)  + 'K';
  return '$' + n.toFixed(2);
}

function formatCount(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
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
