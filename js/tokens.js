// ============================================================
//  tokens.js — Token definitions & state
// ============================================================

const TOKENS = [
  {
    address:  '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    symbol:   'TKN1',
    name:     'Token 1',
    chain:    'bsc',
    color:    '#00d4ff',   // card accent color
    pairAddress: null,     // filled after first price fetch
  },
  {
    address:  '0xf15c7f1F00000000b70505e9cC285A8b18D9A21f',
    symbol:   'TKN2',
    name:     'Token 2',
    chain:    'bsc',
    color:    '#7b61ff',
    pairAddress: null,
  },
  {
    address:  '0xd242797cBe7629C216f95f3deaFE79a9856Cb520',
    symbol:   'TKN3',
    name:     'Token 3',
    chain:    'bsc',
    color:    '#00e676',
    pairAddress: null,
  },
];

// Live price state per token address
const priceState = {};

TOKENS.forEach(t => {
  priceState[t.address] = {
    price:        null,
    priceChange:  null,   // % 24h
    volume24h:    null,
    liquidity:    null,
    marketCap:    null,
    lastUpdated:  null,
    prevPrice:    null,
    symbol:       t.symbol,
    name:         t.name,
    error:        false,
    loading:      true,
  };
});

// Helpers
function getToken(address) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

function shortAddress(addr) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function formatPrice(price) {
  if (price === null || price === undefined) return '—';
  if (price >= 1)        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (price >= 0.0001)   return '$' + price.toFixed(8);
  return '$' + price.toExponential(4);
}

function formatNumber(n, suffix = '') {
  if (n === null || n === undefined) return '—';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B' + suffix;
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M' + suffix;
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(2) + 'K' + suffix;
  return '$' + n.toFixed(2) + suffix;
}
