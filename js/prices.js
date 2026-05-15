--- js/prices.js (原始)
// ============================================================
//  prices.js — Multi-source price fetching v4.2
//
//  CORRECCIONES v4.2 (fix token 0877 y tokens sin liquidez):
//    1. Endpoint DexScreener actualizado a /tokens/v1/bsc/<address>
//       (el antiguo /latest/dex/tokens/ omite tokens con liquidez ~0)
//    2. chainId normalizado: se acepta 'bsc' y cualquier variante
//       que contenga 'bsc' (ej: 'binance-smart-chain' no aplica pero
//       el nuevo endpoint devuelve 'bsc' directamente)
//    3. Fallback gecko mejorado: si el fetch multi-token no devuelve
//       datos para un token, se intenta fetch individual por address
//    4. Sin filtro de chainId en el nuevo endpoint (ya viene filtrado
//       por la URL /bsc/)
//    5. Resto de lógica idéntica a v4.1
//
//  FUENTES:
//    1. DexScreener /tokens/v1/bsc/ (primaria) — CORS nativo, sin proxy
//    2. GeckoTerminal (fallback)                — CORS nativo
// ============================================================

// ── ENDPOINTS ─────────────────────────────────────────────
// Nuevo endpoint v1 (más confiable para tokens con baja liquidez)
const DEXSCREENER_TOKEN_V1   = 'https://api.dexscreener.com/tokens/v1/bsc/';
// Endpoint de pares por pairAddress (sigue siendo el viejo, funciona bien)
const DEXSCREENER_PAIRS_API  = 'https://api.dexscreener.com/latest/dex/pairs/bsc/';
const GECKO_API              = 'https://api.geckoterminal.com/api/v2';

// BNB price sources
const BNB_PRICE_APIS = [
  'https://api.dexscreener.com/latest/dex/pairs/bsc/0x58f876857a02d6762e0101bb5c46a8c1ed44dc16', // BNB/BUSD
  'https://api.dexscreener.com/latest/dex/pairs/bsc/0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE', // BNB/USDT
];

let _activeSource      = 'dexscreener';
let _simulatedPrices   = {};
let _onPriceUpdate     = null;
let _pollTimer         = null;
let _watcherTimer      = null;
let _consecutiveFails  = 0;
let _maxFails          = 5;
let _backoffMs         = 5000;
let _currentBnbPrice   = null;
let _lastSuccessfulFetch = 0;

function setPriceUpdateCallback(fn) { _onPriceUpdate = fn; }

// ============================================================
//  BNB PRICE
// ============================================================
async function fetchBnbPrice() {
  for (const url of BNB_PRICE_APIS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const pairs = data.pairs || (data.pair ? [data.pair] : []);
      for (const pair of pairs) {
        const p = parseFloat(pair.priceUsd || 0);
        if (p > 100 && p < 10000) {
          _currentBnbPrice = p;
          return p;
        }
      }
    } catch {}
  }
  try {
    const res = await fetch(
      `${GECKO_API}/networks/bsc/tokens/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`,
      { headers: { 'Accept': 'application/json;version=20230302' } }
    );
    if (res.ok) {
      const data = await res.json();
      const attrs = data.data?.[0]?.attributes || {};
      const p = parseFloat(attrs.price_usd || 0);
      if (p > 100 && p < 10000) {
        _currentBnbPrice = p;
        return p;
      }
    }
  } catch {}
  return _currentBnbPrice;
}

// ============================================================
//  MAIN FETCH
// ============================================================
async function fetchAllPrices() {
  fetchBnbPrice().catch(() => {});

  let anyOk = false;

  try {
    anyOk = await fetchViaDexscreener();

    if (!anyOk) {
      console.warn('[prices] DexScreener failed → GeckoTerminal');
      _activeSource = 'gecko';
      anyOk = await fetchViaGecko();
    } else {
      _activeSource = 'dexscreener';
    }
  } catch (err) {
    console.error('[prices] fetchAllPrices error:', err);
    markAllError('Error de conexión');
  }

  if (anyOk) {
    _consecutiveFails    = 0;
    _backoffMs           = 5000;
    _lastSuccessfulFetch = Date.now();
  } else {
    _consecutiveFails++;
    console.warn(`[prices] Fallo #${_consecutiveFails}`);
    if (_consecutiveFails >= _maxFails) {
      scheduleReconnect();
    }
  }

  if (_onPriceUpdate) _onPriceUpdate();
}

// ============================================================
//  DEXSCREENER — FUENTE PRIMARIA v4.2
//
//  Cambio clave: se usa el endpoint /tokens/v1/bsc/<address>
//  que devuelve pares incluso para tokens con liquidez ~0,
//  a diferencia del antiguo /latest/dex/tokens/<address>
// ============================================================
async function fetchViaDexscreener() {
  const tokensWithPair    = TOKENS.filter(t => t.pairAddress);
  const tokensWithoutPair = TOKENS.filter(t => !t.pairAddress);

  let anyOk = false;

  // --- Fetch tokens con pairAddress conocido ---
  if (tokensWithPair.length > 0) {
    const pairAddresses = tokensWithPair.map(t => t.pairAddress).join(',');
    try {
      const url = `${DEXSCREENER_PAIRS_API}${pairAddresses}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const pairs = data.pairs || (data.pair ? [data.pair] : []);

        tokensWithPair.forEach(token => {
          const pair = pairs.find(p =>
            p.pairAddress?.toLowerCase() === token.pairAddress?.toLowerCase()
          );
          if (pair) {
            const ok = applyPairData(token, pair);
            if (ok) anyOk = true;
          } else {
            // pairAddress ya no es válido, redescubrir
            token.pairAddress = null;
            priceState[token.address].pairAddress = null;
            tokensWithoutPair.push(token);
          }
        });
      }
    } catch (err) {
      console.warn('[prices] DexScreener pairs fetch error:', err.message);
      tokensWithPair.forEach(t => {
        t.pairAddress = null;
        priceState[t.address].pairAddress = null;
        tokensWithoutPair.push(t);
      });
    }
  }

  // --- Auto-descubrimiento con el nuevo endpoint v1 ---
  if (tokensWithoutPair.length > 0) {
    for (const token of tokensWithoutPair) {
      try {
        // ── CAMBIO v4.2: nuevo endpoint /tokens/v1/bsc/<address> ──
        // Este endpoint NO requiere filtrar por chainId (ya viene por red)
        // y devuelve pares aunque la liquidez sea 0 o muy baja.
        const url = `${DEXSCREENER_TOKEN_V1}${token.address}`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
          console.warn(`[prices] DexScreener v1 HTTP ${res.status} para ${contractTag(token.address)}`);
          markTokenError(token.address, `HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();

        // El nuevo endpoint devuelve directamente un array de pares en data.pairs
        // SIN necesidad de filtrar por chainId (ya viene filtrado por /bsc/)
        const pairs = Array.isArray(data) ? data : (data.pairs || []);

        if (pairs.length === 0) {
          console.warn(`[prices] Sin pares para ${contractTag(token.address)} en endpoint v1`);
          markTokenError(token.address, 'Sin pares disponibles');
          continue;
        }

        // Seleccionar mejor par: mayor liquidez; si empatan, mayor volumen 24h
        const bestPair = pairs.reduce((best, p) => {
          const liqP    = parseFloat(p.liquidity?.usd || 0);
          const liqBest = parseFloat(best.liquidity?.usd || 0);
          if (liqP > liqBest) return p;
          if (liqP === liqBest) {
            const volP    = parseFloat(p.volume?.h24 || 0);
            const volBest = parseFloat(best.volume?.h24 || 0);
            return volP > volBest ? p : best;
          }
          return best;
        });

        token.pairAddress = bestPair.pairAddress;
        priceState[token.address].pairAddress = bestPair.pairAddress;

        const ok = applyPairData(token, bestPair);
        if (ok) anyOk = true;

      } catch (err) {
        console.warn(`[prices] Discovery error para ${contractTag(token.address)}:`, err.message);
        markTokenError(token.address, 'Error de red');
      }

      await sleep(120);
    }
  }

  return anyOk;
}

// ============================================================
//  Aplica datos de un par al estado del token
// ============================================================
function applyPairData(token, pair) {
  const state   = priceState[token.address];
  const addr    = token.address.toLowerCase();

  const isBase  = pair.baseToken?.address?.toLowerCase() === addr;
  const isQuote = pair.quoteToken?.address?.toLowerCase() === addr;

  if (!isBase && !isQuote) {
    console.warn(`[prices] Token ${contractTag(token.address)} no encontrado en par, usando baseToken`);
  }

  let rawPriceUsd    = parseFloat(pair.priceUsd || 0);
  let rawPriceNative = parseFloat(pair.priceNative || 0);

  if (isQuote && !isBase) {
    if (rawPriceNative > 0) rawPriceNative = 1 / rawPriceNative;
    if (rawPriceUsd > 0) {
      const quoteSymbol = pair.quoteToken?.symbol?.toUpperCase() || '';
      if (quoteSymbol === 'BNB' || quoteSymbol === 'WBNB') {
        rawPriceUsd = rawPriceNative * (_currentBnbPrice || 0);
      } else if (quoteSymbol === 'USDT' || quoteSymbol === 'USDC' || quoteSymbol === 'BUSD') {
        rawPriceUsd = rawPriceNative;
      } else {
        rawPriceUsd = rawPriceNative * parseFloat(pair.priceUsd || 0);
      }
    }
  }

  if (!isFinite(rawPriceUsd)    || rawPriceUsd < 0)    rawPriceUsd = 0;
  if (!isFinite(rawPriceNative) || rawPriceNative < 0) rawPriceNative = 0;

  const quoteTokenSymbol = (pair.quoteToken?.symbol || '').toUpperCase();
  if (rawPriceUsd === 0 && rawPriceNative > 0) {
    if (quoteTokenSymbol === 'BNB' || quoteTokenSymbol === 'WBNB') {
      rawPriceUsd = rawPriceNative * (_currentBnbPrice || 0);
    } else if (quoteTokenSymbol === 'USDT' || quoteTokenSymbol === 'USDC' || quoteTokenSymbol === 'BUSD') {
      rawPriceUsd = rawPriceNative;
    }
  }

  const finalPriceUsd    = _simulatedPrices[token.address] !== undefined
    ? _simulatedPrices[token.address]
    : rawPriceUsd;

  const finalPriceNative = _simulatedPrices[token.address] !== undefined
    ? (_currentBnbPrice > 0 ? _simulatedPrices[token.address] / _currentBnbPrice : rawPriceNative)
    : rawPriceNative;

  const txns  = pair.txns?.h24 || {};
  const buys  = parseInt(txns.buys  || 0);
  const sells = parseInt(txns.sells || 0);

  state.prevPrice         = state.price;
  state.prevPriceNative   = state.priceNative;
  state.price             = finalPriceUsd    > 0 ? finalPriceUsd    : null;
  state.priceNative       = finalPriceNative > 0 ? finalPriceNative : null;
  state.priceChange1h     = parseFloat(pair.priceChange?.h1  || 0);
  state.priceChange       = parseFloat(pair.priceChange?.h24 || 0);
  state.priceChange7d     = parseFloat(pair.priceChange?.h24 || 0);
  state.volume24h         = parseFloat(pair.volume?.h24  || 0);
  state.liquidity         = parseFloat(pair.liquidity?.usd || 0);
  state.marketCap         = parseFloat(pair.marketCap || pair.fdv || 0) || null;
  state.fdv               = parseFloat(pair.fdv || 0) || null;
  state.buys24h           = buys   || null;
  state.sells24h          = sells  || null;
  state.txns24h           = (buys + sells) || null;
  state.pairAddress       = pair.pairAddress || state.pairAddress;
  state.pairCreatedAt     = pair.pairCreatedAt
    ? (typeof pair.pairCreatedAt === 'number'
        ? new Date(pair.pairCreatedAt).toISOString()
        : pair.pairCreatedAt)
    : null;
  state.lastUpdated       = new Date();
  state.error             = false;
  state.errorMsg          = null;
  state.loading           = false;
  state.source            = 'dexscreener';
  state.symbol            = token.symbol;
  state.name              = token.name;
  state.bnbPriceUsd       = _currentBnbPrice;

  return state.price !== null || state.priceNative !== null;
}

// ============================================================
//  GECKO TERMINAL — FALLBACK v4.2
//
//  Mejora: si el fetch multi-token no devuelve datos para un
//  token específico, se intenta fetch individual. Esto soluciona
//  tokens que GeckoTerminal no incluye en respuestas multi.
// ============================================================
async function fetchViaGecko() {
  const addresses = TOKENS.map(t => t.address.toLowerCase()).join(',');
  const url = `${GECKO_API}/networks/bsc/tokens/multi/${addresses}?include=top_pools`;

  // Resultado del fetch multi
  let tokensData = [];
  let poolsData  = [];

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json;version=20230302' },
      cache:   'no-store',
    });
    if (!res.ok) throw new Error(`gecko HTTP ${res.status}`);
    const json = await res.json();

    tokensData = json.data     || [];
    poolsData  = json.included || [];
  } catch (err) {
    console.warn('[prices] GeckoTerminal multi error:', err.message);
    // No retornamos false todavía — intentamos fetch individual por cada token
  }

  const poolById = {};
  poolsData.forEach(p => { if (p.type === 'pool') poolById[p.id] = p; });

  let anyOk = false;

  for (const token of TOKENS) {
    const addr  = token.address.toLowerCase();
    let tData   = tokensData.find(d =>
      d.attributes?.address?.toLowerCase() === addr
    );

    // ── NUEVO v4.2: si no vino en el multi, fetch individual ──
    if (!tData) {
      try {
        const indRes = await fetch(
          `${GECKO_API}/networks/bsc/tokens/${addr}?include=top_pools`,
          {
            headers: { 'Accept': 'application/json;version=20230302' },
            cache:   'no-store',
          }
        );
        if (indRes.ok) {
          const indJson = await indRes.json();
          // El endpoint individual devuelve data como objeto, no array
          const indData  = indJson.data;
          const indPools = indJson.included || [];
          if (indData) {
            tData = indData;
            // Agregar pools al poolById
            indPools.forEach(p => { if (p.type === 'pool') poolById[p.id] = p; });
          }
        }
      } catch (indErr) {
        console.warn(`[prices] GeckoTerminal individual fetch error para ${contractTag(token.address)}:`, indErr.message);
      }
      await sleep(150);
    }

    const state = priceState[token.address];

    if (!tData) {
      markTokenError(token.address, 'No encontrado en GeckoTerminal');
      continue;
    }

    const attrs = tData.attributes || {};

    const rels = tData.relationships?.top_pools?.data || [];
    let bestPool = null, bestVol = -1;
    rels.forEach(ref => {
      const pool = poolById[ref.id];
      if (pool) {
        const vol = parseFloat(pool.attributes?.volume_usd?.h24 || 0);
        if (vol > bestVol) { bestVol = vol; bestPool = pool; }
      }
    });

    const rawPriceUsd = parseFloat(attrs.price_usd || 0);

    let rawPriceNative = 0;
    if (bestPool) {
      const poolAttrs = bestPool.attributes || {};
      rawPriceNative = parseFloat(poolAttrs.base_token_price_native_currency || 0);
    }

    const finalPrice = _simulatedPrices[token.address] !== undefined
      ? _simulatedPrices[token.address]
      : rawPriceUsd;

    const pca   = bestPool?.attributes?.pool_created_at || null;
    const txns  = bestPool?.attributes?.transactions?.h24 || {};
    const buys  = parseInt(txns.buys  || 0);
    const sells = parseInt(txns.sells || 0);

    state.prevPrice         = state.price;
    state.price             = finalPrice > 0 ? finalPrice : null;
    state.priceNative       = rawPriceNative > 0 ? rawPriceNative : null;
    state.priceChange1h     = parseFloat(attrs.price_change_percentage?.h1  || 0);
    state.priceChange       = parseFloat(attrs.price_change_percentage?.h24 || 0);
    state.priceChange7d     = parseFloat(attrs.price_change_percentage?.d7  || state.priceChange || 0);
    state.volume24h         = parseFloat(attrs.volume_usd?.h24 || bestVol || 0);
    state.liquidity         = bestPool ? parseFloat(bestPool.attributes?.reserve_in_usd || 0) : null;
    state.marketCap         = parseFloat(attrs.market_cap_usd || 0) || null;
    state.fdv               = parseFloat(attrs.fdv_usd || 0) || null;
    state.txns24h           = (buys + sells) || null;
    state.buys24h           = buys   || null;
    state.sells24h          = sells  || null;
    state.pairCreatedAt     = pca;
    state.lastUpdated       = new Date();
    state.error             = false;
    state.errorMsg          = null;
    state.loading           = false;
    state.source            = 'gecko';
    state.symbol            = token.symbol;
    state.name              = token.name;

    if (rawPriceUsd > 0) anyOk = true;
  }

  return anyOk;
}

// ============================================================
//  WATCHER — reconexión automática con backoff
// ============================================================
function scheduleReconnect() {
  console.warn(`[prices] ${_consecutiveFails} fallos consecutivos → reconectando en ${_backoffMs}ms`);
  if (_watcherTimer) clearTimeout(_watcherTimer);
  _watcherTimer = setTimeout(async () => {
    console.log('[prices] Intentando reconexión...');
    _consecutiveFails = 0;
    await fetchAllPrices();
    _backoffMs = Math.min(_backoffMs * 2, 120000);
  }, _backoffMs);
}

// ============================================================
//  HELPERS
// ============================================================
function markAllError(msg = 'Sin datos') {
  TOKENS.forEach(t => markTokenError(t.address, msg));
}

function markTokenError(address, msg = 'Sin datos') {
  const s    = priceState[address];
  s.error    = true;
  s.errorMsg = msg;
  s.loading  = false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  for (const t of TOKENS) {
    const s = priceState[t.address];
    if (s.source) return s.source;
  }
  return _activeSource;
}

// ============================================================
//  POLLING
// ============================================================
function startPolling(intervalMs) {
  stopPolling();
  fetchAllPrices();
  _pollTimer = setInterval(fetchAllPrices, intervalMs);
}

function stopPolling() {
  if (_pollTimer)    { clearInterval(_pollTimer);   _pollTimer    = null; }
  if (_watcherTimer) { clearTimeout(_watcherTimer); _watcherTimer = null; }
}

function restartPolling(intervalMs) {
  stopPolling();
  startPolling(intervalMs);
}

window._debugPrices = () => {
  console.table(TOKENS.map(t => ({
    tag:         contractTag(t.address),
    pairAddress: t.pairAddress ? t.pairAddress.slice(-6) : 'N/A',
    priceUSD:    priceState[t.address].price,
    priceBNB:    priceState[t.address].priceNative,
    source:      priceState[t.address].source,
    error:       priceState[t.address].error,
    errorMsg:    priceState[t.address].errorMsg,
  })));
};

+++ js/prices.js (修改后)
// ============================================================
//  prices.js — Multi-source price fetching v4.2
//
//  CORRECCIONES v4.2 (fix token 0877 y tokens sin liquidez):
//    1. Endpoint DexScreener actualizado a /tokens/v1/bsc/<address>
//       (el antiguo /latest/dex/tokens/ omite tokens con liquidez ~0)
//    2. chainId normalizado: se acepta 'bsc' y cualquier variante
//       que contenga 'bsc' (ej: 'binance-smart-chain' no aplica pero
//       el nuevo endpoint devuelve 'bsc' directamente)
//    3. Fallback gecko mejorado: si el fetch multi-token no devuelve
//       datos para un token, se intenta fetch individual por address
//    4. Sin filtro de chainId en el nuevo endpoint (ya viene filtrado
//       por la URL /bsc/)
//    5. Resto de lógica idéntica a v4.1
//
//  FUENTES:
//    1. DexScreener /tokens/v1/bsc/ (primaria) — CORS nativo, sin proxy
//    2. GeckoTerminal (fallback)                — CORS nativo
// ============================================================

// ── ENDPOINTS ─────────────────────────────────────────────
// Nuevo endpoint v1 (más confiable para tokens con baja liquidez)
const DEXSCREENER_TOKEN_V1   = 'https://api.dexscreener.com/tokens/v1/bsc/';
// Endpoint de pares por pairAddress (sigue siendo el viejo, funciona bien)
const DEXSCREENER_PAIRS_API  = 'https://api.dexscreener.com/latest/dex/pairs/bsc/';
const GECKO_API              = 'https://api.geckoterminal.com/api/v2';

// BNB price sources
const BNB_PRICE_APIS = [
  'https://api.dexscreener.com/latest/dex/pairs/bsc/0x58f876857a02d6762e0101bb5c46a8c1ed44dc16', // BNB/BUSD
  'https://api.dexscreener.com/latest/dex/pairs/bsc/0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE', // BNB/USDT
];

let _activeSource      = 'dexscreener';
let _simulatedPrices   = {};
let _onPriceUpdate     = null;
let _pollTimer         = null;
let _watcherTimer      = null;
let _consecutiveFails  = 0;
let _maxFails          = 5;
let _backoffMs         = 5000;
let _currentBnbPrice   = null;
let _lastSuccessfulFetch = 0;

function setPriceUpdateCallback(fn) { _onPriceUpdate = fn; }

// ============================================================
//  BNB PRICE
// ============================================================
async function fetchBnbPrice() {
  for (const url of BNB_PRICE_APIS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const pairs = data.pairs || (data.pair ? [data.pair] : []);
      for (const pair of pairs) {
        const p = parseFloat(pair.priceUsd || 0);
        if (p > 100 && p < 10000) {
          _currentBnbPrice = p;
          return p;
        }
      }
    } catch {}
  }
  try {
    const res = await fetch(
      `${GECKO_API}/networks/bsc/tokens/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`,
      { headers: { 'Accept': 'application/json;version=20230302' } }
    );
    if (res.ok) {
      const data = await res.json();
      const attrs = data.data?.[0]?.attributes || {};
      const p = parseFloat(attrs.price_usd || 0);
      if (p > 100 && p < 10000) {
        _currentBnbPrice = p;
        return p;
      }
    }
  } catch {}
  return _currentBnbPrice;
}

// ============================================================
//  MAIN FETCH
// ============================================================
async function fetchAllPrices() {
  fetchBnbPrice().catch(() => {});

  let anyOk = false;

  try {
    anyOk = await fetchViaDexscreener();

    if (!anyOk) {
      console.warn('[prices] DexScreener failed → GeckoTerminal');
      _activeSource = 'gecko';
      anyOk = await fetchViaGecko();
    } else {
      _activeSource = 'dexscreener';
    }
  } catch (err) {
    console.error('[prices] fetchAllPrices error:', err);
    markAllError('Error de conexión');
  }

  if (anyOk) {
    _consecutiveFails    = 0;
    _backoffMs           = 5000;
    _lastSuccessfulFetch = Date.now();
  } else {
    _consecutiveFails++;
    console.warn(`[prices] Fallo #${_consecutiveFails}`);
    if (_consecutiveFails >= _maxFails) {
      scheduleReconnect();
    }
  }

  if (_onPriceUpdate) _onPriceUpdate();
}

// ============================================================
//  DEXSCREENER — FUENTE PRIMARIA v4.2
//
//  Cambio clave: se usa el endpoint /tokens/v1/bsc/<address>
//  que devuelve pares incluso para tokens con liquidez ~0,
//  a diferencia del antiguo /latest/dex/tokens/<address>
// ============================================================
async function fetchViaDexscreener() {
  const tokensWithPair    = TOKENS.filter(t => t.pairAddress);
  const tokensWithoutPair = TOKENS.filter(t => !t.pairAddress);

  let anyOk = false;

  // --- Fetch tokens con pairAddress conocido ---
  if (tokensWithPair.length > 0) {
    const pairAddresses = tokensWithPair.map(t => t.pairAddress).join(',');
    try {
      const url = `${DEXSCREENER_PAIRS_API}${pairAddresses}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const pairs = data.pairs || (data.pair ? [data.pair] : []);

        tokensWithPair.forEach(token => {
          const pair = pairs.find(p =>
            p.pairAddress?.toLowerCase() === token.pairAddress?.toLowerCase()
          );
          if (pair) {
            const ok = applyPairData(token, pair);
            if (ok) anyOk = true;
          } else {
            // pairAddress ya no es válido, redescubrir
            token.pairAddress = null;
            priceState[token.address].pairAddress = null;
            tokensWithoutPair.push(token);
          }
        });
      }
    } catch (err) {
      console.warn('[prices] DexScreener pairs fetch error:', err.message);
      tokensWithPair.forEach(t => {
        t.pairAddress = null;
        priceState[t.address].pairAddress = null;
        tokensWithoutPair.push(t);
      });
    }
  }

  // --- Auto-descubrimiento con el nuevo endpoint v1 ---
  if (tokensWithoutPair.length > 0) {
    for (const token of tokensWithoutPair) {
      try {
        // ── CAMBIO v4.2: nuevo endpoint /tokens/v1/bsc/<address> ──
        // Este endpoint NO requiere filtrar por chainId (ya viene por red)
        // y devuelve pares aunque la liquidez sea 0 o muy baja.
        const url = `${DEXSCREENER_TOKEN_V1}${token.address}`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
          console.warn(`[prices] DexScreener v1 HTTP ${res.status} para ${contractTag(token.address)}`);
          // No marcar como error inmediatamente, dejar que GeckoTerminal intente
          continue;
        }

        const data = await res.json();

        // El nuevo endpoint devuelve directamente un array de pares en data.pairs
        // SIN necesidad de filtrar por chainId (ya viene filtrado por /bsc/)
        const pairs = Array.isArray(data) ? data : (data.pairs || []);

        if (pairs.length === 0) {
          console.warn(`[prices] Sin pares para ${contractTag(token.address)} en endpoint v1 - intentando GeckoTerminal`);
          // No marcar como error todavía, dejar que GeckoTerminal intente
          continue;
        }

        // Seleccionar mejor par: mayor liquidez; si empatan, mayor volumen 24h
        const bestPair = pairs.reduce((best, p) => {
          const liqP    = parseFloat(p.liquidity?.usd || 0);
          const liqBest = parseFloat(best.liquidity?.usd || 0);
          if (liqP > liqBest) return p;
          if (liqP === liqBest) {
            const volP    = parseFloat(p.volume?.h24 || 0);
            const volBest = parseFloat(best.volume?.h24 || 0);
            return volP > volBest ? p : best;
          }
          return best;
        });

        token.pairAddress = bestPair.pairAddress;
        priceState[token.address].pairAddress = bestPair.pairAddress;

        const ok = applyPairData(token, bestPair);
        if (ok) anyOk = true;

      } catch (err) {
        console.warn(`[prices] Discovery error para ${contractTag(token.address)}:`, err.message);
        // No marcar como error inmediatamente, dejar que GeckoTerminal intente
      }

      await sleep(120);
    }
  }

  return anyOk;
}

// ============================================================
//  Aplica datos de un par al estado del token
// ============================================================
function applyPairData(token, pair) {
  const state   = priceState[token.address];
  const addr    = token.address.toLowerCase();

  const isBase  = pair.baseToken?.address?.toLowerCase() === addr;
  const isQuote = pair.quoteToken?.address?.toLowerCase() === addr;

  if (!isBase && !isQuote) {
    console.warn(`[prices] Token ${contractTag(token.address)} no encontrado en par, usando baseToken`);
  }

  let rawPriceUsd    = parseFloat(pair.priceUsd || 0);
  let rawPriceNative = parseFloat(pair.priceNative || 0);

  if (isQuote && !isBase) {
    if (rawPriceNative > 0) rawPriceNative = 1 / rawPriceNative;
    if (rawPriceUsd > 0) {
      const quoteSymbol = pair.quoteToken?.symbol?.toUpperCase() || '';
      if (quoteSymbol === 'BNB' || quoteSymbol === 'WBNB') {
        rawPriceUsd = rawPriceNative * (_currentBnbPrice || 0);
      } else if (quoteSymbol === 'USDT' || quoteSymbol === 'USDC' || quoteSymbol === 'BUSD') {
        rawPriceUsd = rawPriceNative;
      } else {
        rawPriceUsd = rawPriceNative * parseFloat(pair.priceUsd || 0);
      }
    }
  }

  if (!isFinite(rawPriceUsd)    || rawPriceUsd < 0)    rawPriceUsd = 0;
  if (!isFinite(rawPriceNative) || rawPriceNative < 0) rawPriceNative = 0;

  const quoteTokenSymbol = (pair.quoteToken?.symbol || '').toUpperCase();
  if (rawPriceUsd === 0 && rawPriceNative > 0) {
    if (quoteTokenSymbol === 'BNB' || quoteTokenSymbol === 'WBNB') {
      rawPriceUsd = rawPriceNative * (_currentBnbPrice || 0);
    } else if (quoteTokenSymbol === 'USDT' || quoteTokenSymbol === 'USDC' || quoteTokenSymbol === 'BUSD') {
      rawPriceUsd = rawPriceNative;
    }
  }

  const finalPriceUsd    = _simulatedPrices[token.address] !== undefined
    ? _simulatedPrices[token.address]
    : rawPriceUsd;

  const finalPriceNative = _simulatedPrices[token.address] !== undefined
    ? (_currentBnbPrice > 0 ? _simulatedPrices[token.address] / _currentBnbPrice : rawPriceNative)
    : rawPriceNative;

  const txns  = pair.txns?.h24 || {};
  const buys  = parseInt(txns.buys  || 0);
  const sells = parseInt(txns.sells || 0);

  state.prevPrice         = state.price;
  state.prevPriceNative   = state.priceNative;
  state.price             = finalPriceUsd    > 0 ? finalPriceUsd    : null;
  state.priceNative       = finalPriceNative > 0 ? finalPriceNative : null;
  state.priceChange1h     = parseFloat(pair.priceChange?.h1  || 0);
  state.priceChange       = parseFloat(pair.priceChange?.h24 || 0);
  state.priceChange7d     = parseFloat(pair.priceChange?.h24 || 0);
  state.volume24h         = parseFloat(pair.volume?.h24  || 0);
  state.liquidity         = parseFloat(pair.liquidity?.usd || 0);
  state.marketCap         = parseFloat(pair.marketCap || pair.fdv || 0) || null;
  state.fdv               = parseFloat(pair.fdv || 0) || null;
  state.buys24h           = buys   || null;
  state.sells24h          = sells  || null;
  state.txns24h           = (buys + sells) || null;
  state.pairAddress       = pair.pairAddress || state.pairAddress;
  state.pairCreatedAt     = pair.pairCreatedAt
    ? (typeof pair.pairCreatedAt === 'number'
        ? new Date(pair.pairCreatedAt).toISOString()
        : pair.pairCreatedAt)
    : null;
  state.lastUpdated       = new Date();
  state.error             = false;
  state.errorMsg          = null;
  state.loading           = false;
  state.source            = 'dexscreener';
  state.symbol            = token.symbol;
  state.name              = token.name;
  state.bnbPriceUsd       = _currentBnbPrice;

  return state.price !== null || state.priceNative !== null;
}

// ============================================================
//  GECKO TERMINAL — FALLBACK v4.2
//
//  Mejora: si el fetch multi-token no devuelve datos para un
//  token específico, se intenta fetch individual. Esto soluciona
//  tokens que GeckoTerminal no incluye en respuestas multi.
// ============================================================
async function fetchViaGecko() {
  const addresses = TOKENS.map(t => t.address.toLowerCase()).join(',');
  const url = `${GECKO_API}/networks/bsc/tokens/multi/${addresses}?include=top_pools`;

  // Resultado del fetch multi
  let tokensData = [];
  let poolsData  = [];

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json;version=20230302' },
      cache:   'no-store',
    });
    if (!res.ok) throw new Error(`gecko HTTP ${res.status}`);
    const json = await res.json();

    tokensData = json.data     || [];
    poolsData  = json.included || [];
  } catch (err) {
    console.warn('[prices] GeckoTerminal multi error:', err.message);
    // No retornamos false todavía — intentamos fetch individual por cada token
  }

  const poolById = {};
  poolsData.forEach(p => { if (p.type === 'pool') poolById[p.id] = p; });

  let anyOk = false;

  for (const token of TOKENS) {
    const addr  = token.address.toLowerCase();
    let tData   = tokensData.find(d =>
      d.attributes?.address?.toLowerCase() === addr
    );

    // ── NUEVO v4.2: si no vino en el multi, fetch individual ──
    if (!tData) {
      try {
        const indRes = await fetch(
          `${GECKO_API}/networks/bsc/tokens/${addr}?include=top_pools`,
          {
            headers: { 'Accept': 'application/json;version=20230302' },
            cache:   'no-store',
          }
        );
        if (indRes.ok) {
          const indJson = await indRes.json();
          // El endpoint individual devuelve data como objeto, no array
          const indData  = indJson.data;
          const indPools = indJson.included || [];
          if (indData) {
            tData = indData;
            // Agregar pools al poolById
            indPools.forEach(p => { if (p.type === 'pool') poolById[p.id] = p; });
          }
        }
      } catch (indErr) {
        console.warn(`[prices] GeckoTerminal individual fetch error para ${contractTag(token.address)}:`, indErr.message);
      }
      await sleep(150);
    }

    const state = priceState[token.address];

    if (!tData) {
      // Solo marcar error si no tiene precio de ninguna fuente
      continue;
    }

    const attrs = tData.attributes || {};

    const rels = tData.relationships?.top_pools?.data || [];
    let bestPool = null, bestVol = -1;
    rels.forEach(ref => {
      const pool = poolById[ref.id];
      if (pool) {
        const vol = parseFloat(pool.attributes?.volume_usd?.h24 || 0);
        if (vol > bestVol) { bestVol = vol; bestPool = pool; }
      }
    });

    const rawPriceUsd = parseFloat(attrs.price_usd || 0);

    let rawPriceNative = 0;
    if (bestPool) {
      const poolAttrs = bestPool.attributes || {};
      rawPriceNative = parseFloat(poolAttrs.base_token_price_native_currency || 0);
    }

    const finalPrice = _simulatedPrices[token.address] !== undefined
      ? _simulatedPrices[token.address]
      : rawPriceUsd;

    const pca   = bestPool?.attributes?.pool_created_at || null;
    const txns  = bestPool?.attributes?.transactions?.h24 || {};
    const buys  = parseInt(txns.buys  || 0);
    const sells = parseInt(txns.sells || 0);

    state.prevPrice         = state.price;
    state.price             = finalPrice > 0 ? finalPrice : null;
    state.priceNative       = rawPriceNative > 0 ? rawPriceNative : null;
    state.priceChange1h     = parseFloat(attrs.price_change_percentage?.h1  || 0);
    state.priceChange       = parseFloat(attrs.price_change_percentage?.h24 || 0);
    state.priceChange7d     = parseFloat(attrs.price_change_percentage?.d7  || state.priceChange || 0);
    state.volume24h         = parseFloat(attrs.volume_usd?.h24 || bestVol || 0);
    state.liquidity         = bestPool ? parseFloat(bestPool.attributes?.reserve_in_usd || 0) : null;
    state.marketCap         = parseFloat(attrs.market_cap_usd || 0) || null;
    state.fdv               = parseFloat(attrs.fdv_usd || 0) || null;
    state.txns24h           = (buys + sells) || null;
    state.buys24h           = buys   || null;
    state.sells24h          = sells  || null;
    state.pairCreatedAt     = pca;
    state.lastUpdated       = new Date();
    state.error             = false;
    state.errorMsg          = null;
    state.loading           = false;
    state.source            = 'gecko';
    state.symbol            = token.symbol;
    state.name              = token.name;

    if (rawPriceUsd > 0) anyOk = true;
  }

  return anyOk;
}

// ============================================================
//  WATCHER — reconexión automática con backoff
// ============================================================
function scheduleReconnect() {
  console.warn(`[prices] ${_consecutiveFails} fallos consecutivos → reconectando en ${_backoffMs}ms`);
  if (_watcherTimer) clearTimeout(_watcherTimer);
  _watcherTimer = setTimeout(async () => {
    console.log('[prices] Intentando reconexión...');
    _consecutiveFails = 0;
    await fetchAllPrices();
    _backoffMs = Math.min(_backoffMs * 2, 120000);
  }, _backoffMs);
}

// ============================================================
//  HELPERS
// ============================================================
function markAllError(msg = 'Sin datos') {
  TOKENS.forEach(t => markTokenError(t.address, msg));
}

function markTokenError(address, msg = 'Sin datos') {
  const s    = priceState[address];
  s.error    = true;
  s.errorMsg = msg;
  s.loading  = false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  for (const t of TOKENS) {
    const s = priceState[t.address];
    if (s.source) return s.source;
  }
  return _activeSource;
}

// ============================================================
//  POLLING
// ============================================================
function startPolling(intervalMs) {
  stopPolling();
  fetchAllPrices();
  _pollTimer = setInterval(fetchAllPrices, intervalMs);
}

function stopPolling() {
  if (_pollTimer)    { clearInterval(_pollTimer);   _pollTimer    = null; }
  if (_watcherTimer) { clearTimeout(_watcherTimer); _watcherTimer = null; }
}

function restartPolling(intervalMs) {
  stopPolling();
  startPolling(intervalMs);
}

window._debugPrices = () => {
  console.table(TOKENS.map(t => ({
    tag:         contractTag(t.address),
    pairAddress: t.pairAddress ? t.pairAddress.slice(-6) : 'N/A',
    priceUSD:    priceState[t.address].price,
    priceBNB:    priceState[t.address].priceNative,
    source:      priceState[t.address].source,
    error:       priceState[t.address].error,
    errorMsg:    priceState[t.address].errorMsg,
  })));
};
