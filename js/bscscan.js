// ============================================================
//  bscscan.js — Integración Etherscan V2 API (multi-chain) v1.0
//  Chain objetivo: BNB Smart Chain (chainid=56)
//
//  Endpoints usados:
//    - contract / getsourcecode      → verificado, compilador, proxy, licencia
//    - contract / getcontractcreation→ creador, tx de creación
//    - account  / balance            → BNB que tiene el propio contrato
//    - stats    / tokensupply        → supply on-chain (cross-check con Gecko)
//    - token    / tokenholderlist    → holders (puede requerir plan superior;
//                                      degrada a "—" si la key no tiene acceso)
//
//  NOTA: límite free tier Etherscan V2 ≈ 5 req/seg combinado entre
//  TODAS las chains. Por eso todo pasa por una cola con throttle.
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

// ── getsourcecode: verificación, compilador, proxy, licencia ──
async function fetchContractSource(address) {
  try {
    const result = await _callEtherscan({
      module: 'contract', action: 'getsourcecode', address,
    });
    const entry = Array.isArray(result) ? result[0] : null;
    if (!entry) return null;

    const isVerified = !!(entry.SourceCode && entry.SourceCode.length > 0);
    return {
      verified:        isVerified,
      contractName:    entry.ContractName || null,
      compilerVersion: entry.CompilerVersion || null,
      isProxy:         entry.Proxy === '1',
      license:         entry.LicenseType || null,
      optimizationUsed: entry.OptimizationUsed === '1',
    };
  } catch (err) {
    console.warn(`[bscscan] getsourcecode error (${contractTag(address)}):`, err.message);
    return null;
  }
}

// ── getcontractcreation: creador + tx de creación ──
async function fetchContractCreation(address) {
  try {
    const result = await _callEtherscan({
      module: 'contract', action: 'getcontractcreation', contractaddresses: address,
    });
    const entry = Array.isArray(result) ? result[0] : null;
    if (!entry) return null;
    return {
      creator: entry.contractCreator || null,
      txHash:  entry.txHash || null,
    };
  } catch (err) {
    console.warn(`[bscscan] getcontractcreation error (${contractTag(address)}):`, err.message);
    return null;
  }
}

// ── Timestamp de creación real, vía el bloque de la tx de creación ──
async function fetchCreationTimestamp(txHash) {
  if (!txHash) return null;
  try {
    const result = await _callEtherscan({
      module: 'block', action: 'getblocknobytime',
      timestamp: Math.floor(Date.now() / 1000), closest: 'before',
    });
    // No usamos este resultado directamente; en su lugar pedimos el receipt
    const receipt = await _callEtherscan({
      module: 'proxy', action: 'eth_getTransactionByHash', txhash: txHash,
    });
    if (!receipt || !receipt.blockNumber) return null;
    const blockInfo = await _callEtherscan({
      module: 'proxy', action: 'eth_getBlockByNumber',
      tag: receipt.blockNumber, boolean: 'false',
    });
    if (!blockInfo || !blockInfo.timestamp) return null;
    return parseInt(blockInfo.timestamp, 16) * 1000; // ms
  } catch (err) {
    console.warn('[bscscan] timestamp de creación no disponible:', err.message);
    return null;
  }
}

// ── balance de BNB que tiene el propio contrato ──
async function fetchContractBnbBalance(address) {
  try {
    const result = await _callEtherscan({
      module: 'account', action: 'balance', address, tag: 'latest',
    });
    if (result === null || result === undefined) return null;
    const wei = parseFloat(result);
    if (!isFinite(wei)) return null;
    return wei / 1e18;
  } catch (err) {
    console.warn(`[bscscan] balance error (${contractTag(address)}):`, err.message);
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

// ── holders — puede no estar disponible en plan gratuito ──
async function fetchHolderCount(address) {
  try {
    const result = await _callEtherscan({
      module: 'token', action: 'tokenholderlist',
      contractaddress: address, page: 1, offset: 1,
    });
    // Este endpoint no da el TOTAL directamente en todos los planes;
    // si la key no tiene acceso, Etherscan tira error y lo capturamos abajo.
    if (Array.isArray(result)) {
      // No es el conteo total — algunos planes exponen un campo aparte.
      // Lo dejamos como "no disponible de forma confiable" salvo que
      // el plan del usuario devuelva algo distinto a una lista paginada.
      return null;
    }
    return null;
  } catch (err) {
    // Esperado en planes free — no es un error real del sistema.
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

  const [source, creation, bnbBalance, supply] = await Promise.all([
    fetchContractSource(address),
    fetchContractCreation(address),
    fetchContractBnbBalance(address),
    fetchOnchainSupply(address),
  ]);

  let creationTs = null;
  if (creation?.txHash) {
    creationTs = await fetchCreationTimestamp(creation.txHash);
  }

  const holders = await fetchHolderCount(address);

  const data = {
    verified:         source?.verified ?? null,
    contractName:     source?.contractName ?? null,
    compilerVersion:  source?.compilerVersion ?? null,
    isProxy:          source?.isProxy ?? null,
    license:          source?.license ?? null,
    creator:          creation?.creator ?? null,
    creationTxHash:   creation?.txHash ?? null,
    creationTs:       creationTs,
    contractBnbBalance: bnbBalance,
    onchainSupplyRaw: supply,
    holders:          holders,
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

// Helper de formato — fecha de creación
function formatBscScanDate(tsMs) {
  if (!tsMs) return '—';
  return new Date(tsMs).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
}

window._debugBscScan = () => {
  console.table(TOKENS.map(t => ({
    tag:      contractTag(t.address),
    verified: priceState[t.address]?.bscscan?.verified,
    creator:  priceState[t.address]?.bscscan?.creator,
    holders:  priceState[t.address]?.bscscan?.holders,
    bnbBal:   priceState[t.address]?.bscscan?.contractBnbBalance,
  })));
};
