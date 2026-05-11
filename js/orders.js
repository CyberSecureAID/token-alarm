// ============================================================
//  orders.js — Limit order management (localStorage)
// ============================================================

const ORDERS_KEY = 'token_alarm_orders';

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  } catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function getOrders() {
  return loadOrders();
}

function addOrder({ tokenAddress, type, price, note, repeat, browserNotify }) {
  const orders = loadOrders();
  const token  = getToken(tokenAddress);
  const order  = {
    id:            Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    tokenAddress,
    tokenSymbol:   token?.symbol || shortAddress(tokenAddress),
    type,            // 'below' | 'above'
    price:         parseFloat(price),
    note:          note || '',
    repeat:        !!repeat,
    browserNotify: !!browserNotify,
    triggered:     false,
    createdAt:     new Date().toISOString(),
    triggeredAt:   null,
  };
  orders.push(order);
  saveOrders(orders);
  return order;
}

function deleteOrder(id) {
  const orders = loadOrders().filter(o => o.id !== id);
  saveOrders(orders);
}

function markOrderTriggered(id) {
  const orders = loadOrders();
  const order  = orders.find(o => o.id === id);
  if (!order) return;

  if (order.repeat) {
    order.triggeredAt = new Date().toISOString();
    // Keep active — can fire again next cycle after cooldown
  } else {
    order.triggered   = true;
    order.triggeredAt = new Date().toISOString();
  }
  saveOrders(orders);
}

// ---- Evaluate all active orders against current prices ----
let _lastTriggered = {};   // id → timestamp (cooldown for repeat orders)

function evaluateOrders() {
  const orders   = loadOrders();
  const fired    = [];
  const now      = Date.now();
  const COOLDOWN = 60 * 1000; // 60s cooldown for repeat orders

  orders.forEach(order => {
    if (order.triggered) return; // permanently done

    const state = priceState[order.tokenAddress];
    if (!state || state.price === null || state.error) return;

    const price     = state.price;
    let shouldFire  = false;

    if (order.type === 'below' && price <= order.price) shouldFire = true;
    if (order.type === 'above' && price >= order.price) shouldFire = true;

    if (!shouldFire) return;

    // Cooldown for repeat orders
    if (order.repeat) {
      const lastFire = _lastTriggered[order.id] || 0;
      if (now - lastFire < COOLDOWN) return;
      _lastTriggered[order.id] = now;
    }

    fired.push({ ...order, currentPrice: price });
    markOrderTriggered(order.id);
  });

  return fired;
}

function updateOrderSymbols() {
  const orders = loadOrders();
  let changed = false;
  orders.forEach(o => {
    const state = priceState[o.tokenAddress];
    if (state?.symbol && state.symbol !== o.tokenSymbol) {
      o.tokenSymbol = state.symbol;
      changed = true;
    }
  });
  if (changed) saveOrders(orders);
}
