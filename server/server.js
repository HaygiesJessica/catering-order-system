'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const { JsonDatabase } = require('./src/JsonDatabase');
const { AuthService } = require('./src/services/AuthService');
const { OrderService } = require('./src/services/OrderService');
const { seedDatabase } = require('./src/seed');
const { ChatService } = require('./src/services/ChatService');
const { chatRoutes } = require('./src/routes/chat.routes');

const PORT = process.env.PORT || 3000;

/* ---- bootstrap: file-backed store + OOP services ---- */
const db = new JsonDatabase(path.join(__dirname, 'data', 'db.json'));
seedDatabase(db);

const authService = new AuthService(db);
const orderService = new OrderService(db);
const chatService = new ChatService(db);

const app = express();

/* ---- static frontend (with helpful diagnostics) ---- */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
console.log('[static] Serving frontend from:', PUBLIC_DIR);
if (!fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  console.warn('⚠️  WARNING: public/index.html NOT found at the path above!');
}

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

/* ---- middleware ---- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = authService.getSession(token);
  if (!user) return res.status(401).json({ error: 'Please sign in first.' });
  req.user = user;
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Staff only — admins required.' });
  next();
}

/* ================= AUTH ================= */
app.post('/api/auth/login', (req, res) => {
  const { user, token } = authService.login(req.body || {});
  res.json({ user, token });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  authService.logout(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

/* ================= MENU & ORDERS ================= */
app.get('/api/menu', (req, res) => {
  res.json(orderService.getMenu());
});

app.get('/api/ticker', (req, res) => {
  res.json({ orders: orderService.getTicker(8) });
});

app.get('/api/orders', requireAuth, (req, res) => {
  res.json({ orders: orderService.getOrdersForUser(req.user.id) });
});

app.post('/api/orders', requireAuth, (req, res) => {
  const order = orderService.createOrder(req.user, req.body || {});
  res.status(201).json({ order });
});

app.patch('/api/orders/:id/cancel', requireAuth, (req, res) => {
  res.json({ order: orderService.cancelOrder(req.user, req.params.id) });
});

app.patch('/api/orders/:id/complete', requireAuth, (req, res) => {
  res.json({ order: orderService.completeOrder(req.user, req.params.id) });
});

/* ================= ADMIN ================= */
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  res.json({ stats: orderService.getStats() });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, (req, res) => {
  res.json({ orders: orderService.getAllOrders() });
});

app.patch('/api/admin/orders/:id/status', requireAuth, requireAdmin, (req, res) => {
  res.json({ order: orderService.updateOrderStatus(req.params.id, (req.body || {}).status) });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.collection('users').map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || 'client',
    createdAt: u.createdAt,
    orders: db.find('orders', o => o.userId === u.id).length
  }));
  res.json({ users });
});

app.patch('/api/admin/menu/:id/availability', requireAuth, requireAdmin, (req, res) => {
  res.json(orderService.setMenuAvailability(req.params.id, (req.body || {}).available));
});

/* ================= CHAT ================= */
app.use('/api/chat', chatRoutes({ requireAuth, requireAdmin, chatService }));

/* ---- fallback for "/" with a friendly message ---- */
app.get('/', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send(
    `<h1>Almost there! 🥘</h1>
     <p>The server is running, but it can't find the frontend.</p>
     <p>It's looking here: <code>${indexPath}</code></p>
     <p>Make sure <b>public/index.html</b> exists at that exact location.</p>`
  );
});

/* ---- 404 for unknown API routes + central error plate ---- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: err.statusCode ? err.message : 'Something burned in the kitchen — try again.'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🥘  Cai-nan Feast → http://localhost:${PORT}`);
    console.log('    Storage: server/data/db.json');
  });
}

module.exports = app;