// ============================================================
//  prices.js — Multi-source price fetching (GitHub Pages safe)
//
//  Source priority:
//    1. GeckoTerminal API  — CORS open, free, no key
//    2. DexScreener via corsproxy.io — fallback
//
//  Both work from any static host (GitHub Pages, Netlify, etc.)
// ============================================================

const GECKO_API      = 'https://api.geckoterminal.com/api/v2';
const DEXSCREENER_PROXY = 'https://corsproxy.io/?url=https://api.dexscreener.com/latest/dex/tokens/';

// Which source is currently working
let _activeSource = 'gecko'; // 'gecko' | 'dexscreener'

let _simulatedPrices = {};
let _onPriceUpdate   = null;
let _consecutiveFails = 0;

function setPriceUpdateCallback(fn) { _onPriceUpdate = fn; }

// ============================================================
//  MAIN FETCH — tries gecko first, falls back to dexscreener
// ============================================================
async function fetchAllPrices() {
  try {
    if (_activeSource === 'gecko') {
      const ok = await fetchViaGecko();
      if (!ok) {
        console.warn('[prices] GeckoTerminal failed, switching to DexScreener proxy');
        _activeSource = 'dexscreener';
        await fetchViaDexscreener();
      }
    } else {
      const ok = await fetchViaDexscreener();
      if (!ok) {
        // Try switching back to gecko
        _activeSource = 'gecko';
        _consecutiveFails++;
      } else {
        _consecutiveFails = 0;
      }
    }
  } catch (err) {
    console.error('[prices] Unexpected error:', err);
    markAllError();
  }

  if (_onPriceUpdate) _onPriceUpdate();
}

// ============================================================
//  SOURCE 1 — GeckoTerminal
//  Endpoint: GET /networks/bsc/tokens/{address}
//  Docs: https://www.geckoterminal.com/dex-api
// ============================================================
async function fetchViaGecko() {
  let anyOk = false;

  // GeckoTerminal supports multi-address in one call (comma separated, max 30)
  const addresses = TOKENS.map(t => t.address.toLowerCase()).join(',');
  const url = `${GECKO_API}/networks/bsc/tokens/multi/${addresses}?include=top_pools`;

  try {
    const res  = await fetch(url, {
      headers: { 'Accept': 'application/json;version=20230302' },
      cache:   'no-store',
    });

    if (!res.ok) throw new Error(`gecko HTTP ${res.status}`);
    const json = await res.json();

    // json.data is an array of token objects
    const tokensData = json.data || [];
    const poolsData  = json.included || [];

    // Build a pool lookup by id
    const poolById = {};
    poolsData.forEach(p => { if (p.type === 'pool') poolById[p.id] = p; });

    TOKENS.forEach(token => {
      const addr  = token.address.toLowerCase();
      const tData = tokensData.find(d =>
        d.attributes?.address?.toLowerCase() === addr
      );
      const state = priceState[token.address];

      if (!tData) {
        state.error   = true;
        state.loading = false;
        return;
      }

      const attrs = tData.attributes || {};

      // Find best pool for this token (highest volume)
      const relationships = tData.relationships?.top_pools?.data || [];
      let bestPool = null;
      let bestVol  = -1;
      relationships.forEach(ref => {
        const pool = poolById[ref.id];
        if (pool) {
          const vol = parseFloat(pool.attributes?.volume_usd?.h24 || 0);
          if (vol > bestVol) { bestVol = vol; bestPool = pool; }
        }
      });

      const rawPrice = parseFloat(attrs.price_usd || 0);
      const finalPrice = _simulatedPrices[token.address] !== undefined
        ? _simulatedPrices[token.address]
        : rawPrice;

      state.prevPrice   = state.price;
      state.price       = finalPrice || null;
      state.priceChange = parseFloat(attrs.price_change_percentage?.h24 || 0);
      state.volume24h   = parseFloat(attrs.volume_usd?.h24 || bestVol || 0);
      state.liquidity   = bestPool ? parseFloat(bestPool.attributes?.reserve_in_usd || 0) : null;
      state.marketCap   = parseFloat(attrs.market_cap_usd || attrs.fdv_usd || 0);
      state.lastUpdated = new Date();
      state.error       = !rawPrice && rawPrice !== 0 ? true : false;
      state.loading     = false;
      state.symbol      = attrs.symbol  || token.symbol;
      state.name        = attrs.name    || token.name;
      state.source      = 'gecko';

      token.symbol = state.symbol;
      token.name   = state.name;

      if (rawPrice > 0 || rawPrice === 0) anyOk = true;
    });

    return anyOk;

  } catch (err) {
    console.warn('[prices] GeckoTerminal error:', err.message);
    return false;
  }
}

// ============================================================
//  SOURCE 2 — DexScreener via corsproxy.io
//  corsproxy.io is a free, open CORS proxy — no key needed
// ============================================================
async function fetchViaDexscreener() {
  const addresses = TOKENS.map(t => t.address).join(',');
  const url = DEXSCREENER_PROXY + encodeURIComponent(addresses);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`dexscreener HTTP ${res.status}`);
    const data = await res.json();

    if (!data.pairs || data.pairs.length === 0) {
      markAllError();
      return false;
    }

    const pairsByToken = {};
    data.pairs.forEach(pair => {
      const base  = pair.baseToken?.address?.toLowerCase();
      const quote = pair.quoteToken?.address?.toLowerCase();
      TOKENS.forEach(t => {
        const addr = t.address.toLowerCase();
        if (base === addr || quote === addr) {
          if (!pairsByToken[addr]) pairsByToken[addr] = [];
          pairsByToken[addr].push(pair);
        }
      });
    });

    TOKENS.forEach(t => {
      const addr  = t.address.toLowerCase();
      const pairs = pairsByToken[addr];
      const state = priceState[t.address];

      if (!pairs || pairs.length === 0) {
        state.error = true; state.loading = false;
        return;
      }

      const best = pairs.reduce((a, b) =>
        (parseFloat(b.liquidity?.usd || 0) > parseFloat(a.liquidity?.usd || 0) ? b : a)
      );

      const isBase   = best.baseToken?.address?.toLowerCase() === addr;
      const rawPrice = isBase ? parseFloat(best.priceUsd) : (1 / parseFloat(best.priceUsd));

      const finalPrice = _simulatedPrices[t.address] !== undefined
        ? _simulatedPrices[t.address]
        : rawPrice;

      state.prevPrice   = state.price;
      state.price       = finalPrice;
      state.priceChange = parseFloat(best.priceChange?.h24 || 0);
      state.volume24h   = parseFloat(best.volume?.h24 || 0);
      state.liquidity   = parseFloat(best.liquidity?.usd || 0);
      state.marketCap   = parseFloat(best.marketCap || best.fdv || 0);
      state.lastUpdated = new Date();
      state.error       = false;
      state.loading     = false;
      state.symbol      = (isBase ? best.baseToken?.symbol  : best.quoteToken?.symbol)  || t.symbol;
      state.name        = (isBase ? best.baseToken?.name    : best.quoteToken?.name)    || t.name;
      state.source      = 'dexscreener';

      t.symbol = state.symbol;
      t.name   = state.name;
    });

    return true;

  } catch (err) {
    console.warn('[prices] DexScreener proxy error:', err.message);
    markAllError();
    return false;
  }
}

// ============================================================
//  Helpers
// ============================================================
function markAllError() {
  TOKENS.forEach(t => {
    priceState[t.address].error   = true;
    priceState[t.address].loading = false;
  });
}

function simulatePrice(address, price) {
  _simulatedPrices[address] = price;
}

function clearSimulation(address) {
  if (address) delete _simulatedPrices[address];
  else _simulatedPrices = {};
}

function isSimulating(address) {
  return address
    ? _simulatedPrices[address] !== undefined
    : Object.keys(_simulatedPrices).length > 0;
}

// ---- Polling ----
let _pollTimer = null;

function startPolling(intervalMs) {
  stopPolling();
  fetchAllPrices();
  _pollTimer = setInterval(fetchAllPrices, intervalMs);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function restartPolling(intervalMs) {
  stopPolling();
  startPolling(intervalMs);
}
