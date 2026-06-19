// ============================================================
//  bscscan.js — Integración Etherscan V2 API (multi-chain) v1.1
//  Chain objetivo: BNB Smart Chain (chainid=56)
//
//  v1.1: se eliminan del flujo los campos que el plan free de
//  Etherscan V2 no puede entregar de forma confiable:
//    - getcontractcreation (creador, tx, fecha de creación) → Pro
//    - account/balance (balance BNB del contrato)            → no fiable en free
//    - isProxy / license / compilerVersion                   → no se muestran
//  Se mantiene únicamente "verified" (getsourcecode), que sí
//  funciona con key gratuita. Holders sigue sin implementarse
//  (ya documentado como no disponible en plan free).
// ============================================================

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';

// ⚠️ API KEY — reemplazar por la propia si se agota el límite gratuito
// (5 req/seg). Obtené una key gratis en https://etherscan.io/apidashboard
const BSCSCAN_API_KEY = 'BUS6DPJ84DWQ1N9XCN8PIUHTNFM5TXE2HU';

const BSC_CHAIN_ID = 56;

const BSCSCAN_CACHE_KEY = 'token_alarm_bscscan_cache';
const BSCSCAN_TTL_MS    = 6 * 60 * 60 * 1000; // 6 horas

// ── Cola con throttle (4 req/seg de margen, bajo el límite de 5) ──
let _queue   = [];
let _running = false;

function _enqueue(fn) {
  return new Promise((resolve, reject) => {
    _queue.push({ fn, resolve, reject });
    _processQueue();
  });
}

async function _processQueue() {
  if (_running) return;
  _running = true;
  while (_queue.length > 0) {
    const { fn, resolve, reject } = _queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    }
    await new Promise(r => setTimeout(r, 260)); // ~3.8 req/seg
  }
  _running = false;
}

// ── Cache persistente en localStorage ──
function _loadCache() {
  try { return JSON.parse(localStorage.getItem(BSCSCAN_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function _saveCache(cache) {
  try { localStorage.setItem(BSCSCAN_CACHE_KEY, JSON.stringify(cache)); } catch {}
}
function _getCached(address) {
  const cache = _loadCache();
  const entry = cache[address.toLowerCase()];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > BSCSCAN_TTL_MS) return null;
  return entry.data;
}
function _setCached(address, data) {
  const cache = _loadCache();
  cache[address.toLowerCase()] = { data, fetchedAt: Date.now() };
  _saveCache(cache);
}

// ── Llamada base ──
async function _callEtherscan(params) {
  const url = new URL(ETHERSCAN_V2_BASE);
  url.searchParams.set('chainid', BSC_CHAIN_ID);
  url.searchParams.set('apikey', BSCSCAN_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  return _enqueue(async () => {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
    const json = await res.json();
    // Etherscan devuelve status "0" tanto para error real como para "No data found"
    if (json.status === '0' && json.message !== 'No transactions found') {
      throw new Error(json.result || json.message || 'Etherscan error');
    }
    return json.result;
  });
}

// ── getsourcecode: verificación (único dato confiable en plan free) ──
async function fetchContractSource(address) {
  try {
    const result = await _callEtherscan({
      module: 'contract', action: 'getsourcecode', address,
    });
    const entry = Array.isArray(result) ? result[0] : null;
    if (!entry) return null;

    const isVerified = !!(entry.SourceCode && entry.SourceCode.length > 0);
    return {
      verified:     isVerified,
      contractName: entry.ContractName || null,
    };
  } catch (err) {
    console.warn(`[bscscan] getsourcecode error (${contractTag(address)}):`, err.message);
    return null;
  }
}

// ── supply on-chain (cross-check con Gecko) ──
async function fetchOnchainSupply(address) {
  try {
    const result = await _callEtherscan({
      module: 'stats', action: 'tokensupply', contractaddress: address,
    });
    if (result === null || result === undefined) return null;
    return result; // string en unidades base, hay que dividir por decimals al usar
  } catch (err) {
    console.warn(`[bscscan] tokensupply error (${contractTag(address)}):`, err.message);
    return null;
  }
}

// ============================================================
//  ORQUESTADOR — un token completo
// ============================================================
async function fetchBscScanDataForToken(token) {
  const address = token.address;
  const cached  = _getCached(address);
  if (cached) {
    _applyToState(address, cached);
    return cached;
  }

  const [source, supply] = await Promise.all([
    fetchContractSource(address),
    fetchOnchainSupply(address),
  ]);

  const data = {
    verified:         source?.verified ?? null,
    contractName:     source?.contractName ?? null,
    onchainSupplyRaw: supply,
  };

  _setCached(address, data);
  _applyToState(address, data);
  return data;
}

function _applyToState(address, data) {
  const state = priceState[address];
  if (!state) return;
  state.bscscan = data;
}

// ── Disparador principal — corre con delay tras el boot, en serie por token ──
async function fetchAllBscScanData() {
  for (const token of TOKENS) {
    try {
      await fetchBscScanDataForToken(token);
      if (typeof updateCardOnchainInfo === 'function') {
        updateCardOnchainInfo(token.address);
      }
    } catch (err) {
      console.warn(`[bscscan] Error general para ${contractTag(token.address)}:`, err.message);
    }
  }
}

window._debugBscScan = () => {
  console.table(TOKENS.map(t => ({
    tag:      contractTag(t.address),
    verified: priceState[t.address]?.bscscan?.verified,
  })));
};
