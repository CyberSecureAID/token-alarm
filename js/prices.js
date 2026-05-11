// ============================================================
//  prices.js — Multi-source price & data fetching
//
//  Sources (no API key required):
//    1. GeckoTerminal  — price, volume, liquidity, mktcap, 1h/24h/7d Δ, txns, pool age
//    2. DexScreener    — buys/sells pressure, pair data, fallback price
//
//  CORS-safe on GitHub Pages via corsproxy.io for DexScreener
// ============================================================

const GECKO_API         = 'https://api.geckoterminal.com/api/v2';
const DEXSCREENER_BASE  = 'https://api.dexscreener.com/latest/dex/tokens/';
const CORS_PROXY        = 'https://corsproxy.io/?url=';

let _activeSource     = 'gecko';
let _simulatedPrices  = {};
let _onPriceUpdate    = null;
let _consecutiveFails = 0;
let _pollTimer        = null;

function setPriceUpdateCallback(fn) { _onPriceUpdate = fn; }

// ============================================================
//  MAIN FETCH LOOP
// ============================================================
async function fetchAllPrices() {
  try {
    if (_activeSource === 'gecko') {
      const ok = await fetchViaGecko();
      if (!ok) {
        console.warn('[prices] GeckoTerminal failed → DexScreener');
        _activeSource = 'dexscreener';
        await fetchViaDexscreener();
      } else {
        // Also enrich with DexScreener buy/sell data in background
        enrichWithDexscreener().catch(() => {});
      }
    } else {
      const ok = await fetchViaDexscreener();
      if (!ok) {
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
//  Returns: price, 1h/24h/7d Δ, volume, mktcap, fdv,
//           liquidity, txns 24h, pool created_at
// ============================================================
async function fetchViaGecko() {
  const addresses = TOKENS.map(t => t.address.toLowerCase()).join(',');
  const url = `${GECKO_API}/networks/bsc/tokens/multi/${addresses}?include=top_pools`;

  try {
    const res  = await fetch(url, {
      headers: { 'Accept': 'application/json;version=20230302' },
      cache:   'no-store',
    });
    if (!res.ok) throw new Error(`gecko ${res.status}`);
    const json = await res.json();

    const tokensData = json.data     || [];
    const poolsData  = json.included || [];

    const poolById = {};
    poolsData.forEach(p => { if (p.type === 'pool') poolById[p.id] = p; });

    let anyOk = false;

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

      // Find best pool (highest 24h volume)
      const rels = tData.relationships?.top_pools?.data || [];
      let bestPool = null, bestVol = -1;
      rels.forEach(ref => {
        const pool = poolById[ref.id];
        if (pool) {
          const vol = parseFloat(pool.attributes?.volume_usd?.h24 || 0);
          if (vol > bestVol) { bestVol = vol; bestPool = pool; }
        }
      });

      const rawPrice   = parseFloat(attrs.price_usd || 0);
      const finalPrice = _simulatedPrices[token.address] !== undefined
        ? _simulatedPrices[token.address]
        : rawPrice;

      const pca = bestPool?.attributes?.pool_created_at || null;

      // Transactions from pool
      const txns   = bestPool?.attributes?.transactions?.h24 || {};
      const buys   = parseInt(txns.buys   || 0);
      const sells  = parseInt(txns.sells  || 0);

      // Volume breakdown
      const volAttrs = bestPool?.attributes?.volume_usd || {};

      state.prevPrice      = state.price;
      state.price          = finalPrice || null;
      state.priceChange1h  = parseFloat(attrs.price_change_percentage?.h1  || attrs.price_change_percentage?.m5 || 0);
      state.priceChange    = parseFloat(attrs.price_change_percentage?.h24 || 0);
      state.priceChange7d  = parseFloat(attrs.price_change_percentage?.d7  || attrs.price_change_percentage?.h24 || 0);
      state.volume24h      = parseFloat(attrs.volume_usd?.h24 || bestVol || 0);
      state.liquidity      = bestPool ? parseFloat(bestPool.attributes?.reserve_in_usd || 0) : null;
      state.marketCap      = parseFloat(attrs.market_cap_usd || 0) || null;
      state.fdv            = parseFloat(attrs.fdv_usd || 0) || null;
      state.txns24h        = buys + sells || null;
      state.buys24h        = buys   || null;
      state.sells24h       = sells  || null;
      state.pairCreatedAt  = pca;
      state.lastUpdated    = new Date();
      state.error          = false;
      state.loading        = false;
      state.source         = 'gecko';
      state.symbol         = attrs.symbol || token.symbol;
      state.name           = attrs.name   || token.name;

      token.symbol = state.symbol;
      token.name   = state.name;

      if (rawPrice > 0) anyOk = true;
    });

    return anyOk;

  } catch (err) {
    console.warn('[prices] GeckoTerminal error:', err.message);
    return false;
  }
}

// ============================================================
//  SOURCE 2 — DexScreener (primary fallback + buy/sell enrichment)
//  Returns: price, 24h Δ (m5/h1/h6/h24), buys, sells,
//           volume, liquidity, mktcap, pool age
// ============================================================
async function fetchViaDexscreener() {
  const addresses = TOKENS.map(t => t.address).join(',');
  const url = CORS_PROXY + encodeURIComponent(DEXSCREENER_BASE + addresses);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`dexscreener ${res.status}`);
    const data = await res.json();

    if (!data.pairs || data.pairs.length === 0) {
      markAllError();
      return false;
    }

    // Map pairs by token address
    const pairsByToken = {};
    data.pairs.forEach(pair => {
      [pair.baseToken?.address, pair.quoteToken?.address].forEach(a => {
        if (!a) return;
        const key = a.toLowerCase();
        if (!pairsByToken[key]) pairsByToken[key] = [];
        pairsByToken[key].push(pair);
      });
    });

    TOKENS.forEach(t => {
      const addr  = t.address.toLowerCase();
      const pairs = pairsByToken[addr];
      const state = priceState[t.address];

      if (!pairs || pairs.length === 0) {
        state.error   = true;
        state.loading = false;
        return;
      }

      // Best pair = highest liquidity
      const best = pairs.reduce((a, b) =>
        (parseFloat(b.liquidity?.usd || 0) > parseFloat(a.liquidity?.usd || 0) ? b : a)
      );

      const isBase   = best.baseToken?.address?.toLowerCase() === addr;
      const rawPrice = isBase
        ? parseFloat(best.priceUsd || 0)
        : (1 / parseFloat(best.priceUsd || 1));

      const finalPrice = _simulatedPrices[t.address] !== undefined
        ? _simulatedPrices[t.address]
        : rawPrice;

      const txns = best.txns?.h24 || {};

      state.prevPrice      = state.price;
      state.price          = finalPrice;
      state.priceChange1h  = parseFloat(best.priceChange?.h1  || 0);
      state.priceChange    = parseFloat(best.priceChange?.h24 || 0);
      state.priceChange7d  = parseFloat(best.priceChange?.h24 || 0); // DexScreener has no 7d, reuse
      state.volume24h      = parseFloat(best.volume?.h24 || 0);
      state.liquidity      = parseFloat(best.liquidity?.usd || 0);
      state.marketCap      = parseFloat(best.marketCap || 0) || null;
      state.fdv            = parseFloat(best.fdv || 0) || null;
      state.buys24h        = parseInt(txns.buys  || 0) || null;
      state.sells24h       = parseInt(txns.sells || 0) || null;
      state.txns24h        = (state.buys24h || 0) + (state.sells24h || 0) || null;
      state.pairCreatedAt  = best.pairCreatedAt ? new Date(best.pairCreatedAt).toISOString() : null;
      state.lastUpdated    = new Date();
      state.error          = false;
      state.loading        = false;
      state.source         = 'dexscreener';
      state.symbol         = (isBase ? best.baseToken?.symbol : best.quoteToken?.symbol) || t.symbol;
      state.name           = (isBase ? best.baseToken?.name   : best.quoteToken?.name)   || t.name;

      t.symbol = state.symbol;
      t.name   = state.name;
    });

    return true;

  } catch (err) {
    console.warn('[prices] DexScreener error:', err.message);
    markAllError();
    return false;
  }
}

// ============================================================
//  ENRICHMENT — called after Gecko fetch to fill buy/sell data
//  from DexScreener (Gecko doesn't always have txn breakdown)
// ============================================================
async function enrichWithDexscreener() {
  const addresses = TOKENS.map(t => t.address).join(',');
  const url = CORS_PROXY + encodeURIComponent(DEXSCREENER_BASE + addresses);

  try {
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.pairs) return;

    const pairsByToken = {};
    data.pairs.forEach(pair => {
      [pair.baseToken?.address, pair.quoteToken?.address].forEach(a => {
        if (!a) return;
        const key = a.toLowerCase();
        if (!pairsByToken[key]) pairsByToken[key] = [];
        pairsByToken[key].push(pair);
      });
    });

    TOKENS.forEach(t => {
      const addr  = t.address.toLowerCase();
      const pairs = pairsByToken[addr];
      const state = priceState[t.address];
      if (!pairs || pairs.length === 0) return;

      const best = pairs.reduce((a, b) =>
        (parseFloat(b.liquidity?.usd || 0) > parseFloat(a.liquidity?.usd || 0) ? b : a)
      );

      const txns = best.txns?.h24 || {};
      if (!state.buys24h && txns.buys)   state.buys24h  = parseInt(txns.buys);
      if (!state.sells24h && txns.sells) state.sells24h = parseInt(txns.sells);
      if (!state.txns24h)                state.txns24h  = (state.buys24h || 0) + (state.sells24h || 0) || null;
      if (!state.pairCreatedAt && best.pairCreatedAt)
        state.pairCreatedAt = new Date(best.pairCreatedAt).toISOString();

      // Volume breakdown (buy vol ≈ total * buys/(buys+sells))
      if (state.volume24h && state.buys24h && state.sells24h) {
        const total = state.buys24h + state.sells24h;
        if (total > 0) {
          state.buyVolume24h  = state.volume24h * (state.buys24h  / total);
          state.sellVolume24h = state.volume24h * (state.sells24h / total);
        }
      }
    });

    if (_onPriceUpdate) _onPriceUpdate();
  } catch {}
}

// ============================================================
//  HELPERS
// ============================================================
function markAllError() {
  TOKENS.forEach(t => {
    const s = priceState[t.address];
    s.error   = true;
    s.loading = false;
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

function getActiveSource() {
  // Return actual source from first non-errored token
  for (const t of TOKENS) {
    const s = priceState[t.address];
    if (s.source) return s.source;
  }
  return _activeSource;
}

// ---- Polling ----
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
