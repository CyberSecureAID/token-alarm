// ============================================================
//  orders.js — Limit order / price alert management (localStorage)
// ============================================================

const ORDERS_KEY = 'token_alarm_orders';

function loadOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); }
  catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function getOrders() { return loadOrders(); }

function addOrder({ tokenAddress, type, price, note, repeat, browserNotify }) {
  const orders = loadOrders();
  const token  = getToken(tokenAddress);
  const order  = {
    id:            Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    tokenAddress,
    tokenSymbol:   token?.symbol || 'USDT.z',
    type,
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
  saveOrders(loadOrders().filter(o => o.id !== id));
}

function markOrderTriggered(id) {
  const orders = loadOrders();
  const order  = orders.find(o => o.id === id);
  if (!order) return;
  if (order.repeat) {
    order.triggeredAt = new Date().toISOString();
  } else {
    order.triggered   = true;
    order.triggeredAt = new Date().toISOString();
  }
  saveOrders(orders);
}

let _lastTriggered = {};
const COOLDOWN = 60 * 1000;

function evaluateOrders() {
  const orders = loadOrders();
  const fired  = [];
  const now    = Date.now();

  orders.forEach(order => {
    if (order.triggered) return;
    const state = priceState[order.tokenAddress];
    if (!state || state.price === null || state.error) return;

    const price      = state.price;
    let shouldFire   = false;
    if (order.type === 'below' && price <= order.price) shouldFire = true;
    if (order.type === 'above' && price >= order.price) shouldFire = true;
    if (!shouldFire) return;

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
  // Todos los tokens son USDT.z — símbolo estático, no necesita actualización
}
