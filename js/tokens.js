// ============================================================
//  tokens.js — Token definitions, state & logo resolution
//  v5.2 — + campo bscscan en priceState (datos on-chain Etherscan V2)
//         (resto idéntico a v5.1)
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
//  TOKENS — cargados desde localStorage + defaults
// ============================================================
const DEFAULT_TOKENS = [
  {
    address:      '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    symbol:       'USDT.z',
    name:         'Tether USD Bridged ZET20',
    chain:        'bsc',
    color:        '#26a17b',
    pairAddress:  null,
    isBaseToken:  true,
    verified:     true,
    logoOverride: null,
  },
  {
    address:      '0xf15c7f1F86398520b70505e9cC285A8b18D9A21f',
    symbol:       'USDT.z',
    name:         'Tether USD Bridged ZET20',
    chain:        'bsc',
    color:        '#26a17b',
    pairAddress:  null,
    isBaseToken:  true,
    verified:     true,
    logoOverride: null,
  },
  {
    address:      '0xd242797cBe7629C216f95f3deaFE79a9856Cb520',
    symbol:       'USDT.z',
    name:         'Tether USD Bridged ZET20',
    chain:        'bsc',
    color:        '#26a17b',
    pairAddress:  null,
    isBaseToken:  true,
    verified:     true,
    logoOverride: null,
  },
];

const CUSTOM_TOKENS_KEY = 'token_alarm_custom_tokens';

function loadCustomTokens() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || '[]'); }
  catch { return []; }
}

function saveCustomTokens(tokens) {
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

function addCustomToken({ address, symbol, name, color }) {
  address = address.trim();
  if (!address.startsWith('0x')) address = '0x' + address;

  if (TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())) {
    return { error: 'Este contrato ya está en la lista.' };
  }

  const token = {
    address,
    symbol:       (symbol || address.slice(-6)).toUpperCase(),
    name:         name   || 'Token ' + address.slice(-6),
    chain:        'bsc',
    color:        color  || '#c9a84c',
    pairAddress:  null,
    isBaseToken:  false,
    verified:     false,
    logoOverride: null,
    custom:       true,
  };

  const customs = loadCustomTokens();
  customs.push(token);
  saveCustomTokens(customs);

  TOKENS.push(token);
  initTokenState(token);
  return { ok: true, token };
}

function removeCustomToken(address) {
  const idx = TOKENS.findIndex(t => t.address.toLowerCase() === address.toLowerCase() && t.custom);
  if (idx === -1) return false;
  TOKENS.splice(idx, 1);
  delete priceState[address];
  const customs = loadCustomTokens().filter(t => t.address.toLowerCase() !== address.toLowerCase());
  saveCustomTokens(customs);
  return true;
}

const TOKENS = [...DEFAULT_TOKENS];

(function loadSavedCustoms() {
  loadCustomTokens().forEach(t => {
    if (!TOKENS.find(x => x.address.toLowerCase() === t.address.toLowerCase())) {
      TOKENS.push(t);
    }
  });
})();

// ============================================================
//  PRICE STATE
// ============================================================
const priceState = {};

function initTokenState(token) {
  priceState[token.address] = {
    price:           null,
    priceNative:     null,
    prevPrice:       null,
    prevPriceNative: null,
    priceChange1h:   null,
    priceChange:     null,
    priceChange7d:   null,
    volume24h:       null,
    liquidity:       null,
    marketCap:       null,
    fdv:             null,
    holders:         null,   // ver bscscan.js — puede requerir plan superior de Etherscan
    totalSupply:     null,   // unidades de token (ya dividido por decimals)
    decimals:        null,
    bscscan:         null,   // datos on-chain (Etherscan V2 / BscScan) — ver bscscan.js
    txns24h:         null,
    buys24h:         null,
    sells24h:        null,
    buyVolume24h:    null,
    sellVolume24h:   null,
    pairCreatedAt:   null,
    symbol:          token.symbol,
    name:            token.name,
    pairAddress:     token.pairAddress,
    logoUrl:         token.logoOverride || USDT_LOGO_URL,
    verified:        !!token.verified,
    logoResolved:    !!token.logoOverride,
    source:          null,
    lastUpdated:     null,
    error:           false,
    loading:         true,
    errorMsg:        null,
    bnbPriceUsd:     null,
  };
}

TOKENS.forEach(initTokenState);

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
  if (!state) return;

  if (token.logoOverride) {
    state.logoUrl      = token.logoOverride;
    state.logoResolved = true;
    _patchCardLogo(token.address, token.logoOverride, true);
    return;
  }

  const candidates = [
    twLogo(token.address),
    twLogo(token.address.toLowerCase()),
    USDT_LOGO_URL,
  ];
  for (const url of candidates) {
    const ok = await testImage(url, 3000);
    if (ok) {
      state.logoUrl = url;
      _patchCardLogo(token.address, url, token.verified || false);
      return;
    }
  }
  const avatar = generateAvatarSVG(token.symbol, token.color);
  state.logoUrl = avatar;
  _patchCardLogo(token.address, avatar, false);
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

function formatSupply(n) {
  if (n === null || n === undefined || isNaN(n) || n <= 0) return '—';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
