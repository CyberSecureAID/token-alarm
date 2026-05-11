// ============================================================
//  tokens.js — Token definitions, state & logo resolution
//  Logo source: Trust Wallet Assets (CORS-free, no key needed)
// ============================================================

const TRUST_WALLET_BASE =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';

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

// ============================================================
//  YOUR 6 MONITORED TOKENS
// ============================================================
const TOKENS = [
  {
    address:     '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    symbol:      'TKN1',
    name:        'Token 1',
    chain:       'bsc',
    color:       '#00d4ff',
    pairAddress: null,
    verified:    false,
  },
  {
    address:     '0xf15c7f1F86398520b70505e9cC285A8b18D9A21f',
    symbol:      'TKN2',
    name:        'Token 2',
    chain:       'bsc',
    color:       '#7b61ff',
    pairAddress: null,
    verified:    false,
  },
  {
    address:     '0xd242797cBe7629C216f95f3deaFE79a9856Cb520',
    symbol:      'TKN3',
    name:        'Token 3',
    chain:       'bsc',
    color:       '#00e676',
    pairAddress: null,
    verified:    false,
  },
  {
    address:     '0xca1df182e5f9d59149057e15a98f95e3de9e0877',
    symbol:      'TKN4',
    name:        'Token 4',
    chain:       'bsc',
    color:       '#ff9f43',
    pairAddress: null,
    verified:    false,
  },
  {
    address:     '0xa80A8cba9b40AC5dA81E84578a75c6ddA94C4444',
    symbol:      'TKN5',
    name:        'Token 5',
    chain:       'bsc',
    color:       '#ee5a24',
    pairAddress: null,
    verified:    false,
  },
  {
    address:     '0x7D19a02e543Ff0E88AB717b886cf8e76a19F76c3',
    symbol:      'TKN6',
    name:        'Token 6',
    chain:       'bsc',
    color:       '#a29bfe',
    pairAddress: null,
    verified:    false,
  },
];

// ============================================================
//  PRICE STATE — full extended data per token
// ============================================================
const priceState = {};

TOKENS.forEach(t => {
  priceState[t.address] = {
    // Price
    price:          null,
    prevPrice:      null,
    priceChange1h:  null,
    priceChange:    null,   // 24h
    priceChange7d:  null,

    // Market
    volume24h:      null,
    liquidity:      null,
    marketCap:      null,
    fdv:            null,

    // On-chain / DEX
    holders:        null,
    txns24h:        null,
    buys24h:        null,
    sells24h:       null,
    buyVolume24h:   null,
    sellVolume24h:  null,
    pairCreatedAt:  null,   // pool age

    // Token identity
    symbol:         t.symbol,
    name:           t.name,
    logoUrl:        generateAvatarSVG(t.symbol, t.color),
    verified:       t.verified,
    logoResolved:   false,

    // Source meta
    source:         null,
    lastUpdated:    null,
    error:          false,
    loading:        true,
  };
});

// ============================================================
//  LOGO RESOLUTION  (runs once on startup, non-blocking)
//  Trust Wallet stores assets at checksummed addresses.
//  We test the image — if it loads → real logo + verified badge.
//  If not → keep SVG avatar, no badge.
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
  if (state.logoResolved) return;

  const candidates = [
    twLogo(token.address),
    twLogo(token.address.toLowerCase()),
  ];

  for (const url of candidates) {
    const ok = await testImage(url);
    if (ok) {
      state.logoUrl      = url;
      state.verified     = true;
      token.verified     = true;
      state.logoResolved = true;
      _patchCardLogo(token.address, url, true);
      return;
    }
  }

  state.logoResolved = true;
}

async function resolveAllLogos() {
  for (const token of TOKENS) {
    resolveTokenLogo(token);
    await new Promise(r => setTimeout(r, 200));
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
