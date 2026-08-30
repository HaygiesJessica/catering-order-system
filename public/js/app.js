'use strict';

/* ================= helpers ================= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money  = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const money2 = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n);
const fmtDay = iso => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const STATUS_COLORS = {
  pending: '#e9b64a', confirmed: '#74c69d', preparing: '#f4845f',
  ready: '#ffd166', delivered: '#9db8a9', cancelled: '#e07a69',
  cannot_accommodate: '#b87fa8', completed: '#7d8ca3'
};
const STATUS_LABELS = {
  pending: 'pending', confirmed: 'confirmed', preparing: 'preparing', ready: 'ready',
  delivered: 'delivered', cancelled: 'cancelled', cannot_accommodate: 'Cannot accommodate',
  completed: 'Completed'
};
const statusLabel = s => STATUS_LABELS[s] || s;
const CATEGORY_HUES = {
  'Appetizers':        'radial-gradient(circle at 30% 25%, #fbe6cf, #f3d3ae)',
  'Mains':             'radial-gradient(circle at 30% 25%, #e8e2c9, #d9cfa9)',
  'Pasta and Noodles': 'radial-gradient(circle at 30% 25%, #f6e3b8, #ecd394)',
  'Veggies':           'radial-gradient(circle at 30% 25%, #e2ecd6, #cfe0bd)',
  'Desserts':          'radial-gradient(circle at 30% 25%, #f9e3da, #f0cfc0)'
};

/* ================= ApiClient ================= */
class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('ss_token') || null;
  }
  setToken(t) {
    this.token = t;
    t ? localStorage.setItem('ss_token', t) : localStorage.removeItem('ss_token');
  }
  async request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new Error('Kitchen is offline — is the server running?');
    }
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  get(p)         { return this.request(p); }
  post(p, body)  { return this.request(p, { method: 'POST', body }); }
  patch(p, body) { return this.request(p, { method: 'PATCH', body }); }
}

/* ================= ToastManager ================= */
class ToastManager {
  constructor(root) { this.root = root; }
  show(message, type = 'info', ms = 3800) {
    const icons = { success: '✔', error: '✕', info: '✦' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="t-ico">${icons[type] || '✦'}</span><span>${esc(message)}</span>`;
    this.root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }
}

/* ================= Cart ================= */
class Cart {
  constructor() {
    this.lines = new Map();
    try {
      const raw = JSON.parse(localStorage.getItem('ss_cart') || '{}');
      this.lines = new Map(Object.entries(raw.lines || {}));
    } catch { /* fresh basket */ }
  }
  persist() { localStorage.setItem('ss_cart', JSON.stringify({ lines: Object.fromEntries(this.lines) })); }
  add(menuId, qty = 1) { this.lines.set(menuId, (this.lines.get(menuId) || 0) + qty); this.persist(); }
  setQty(menuId, qty) { qty <= 0 ? this.lines.delete(menuId) : this.lines.set(menuId, qty); this.persist(); }
  clear() { this.lines.clear(); this.persist(); }
  get count() { let c = 0; for (const q of this.lines.values()) c += q; return c; }
}

/* ================= MapPicker (Google tiles via Leaflet) ================= */
class MapPicker {
  constructor(onPick) {
    this.map = null; this.marker = null; this.pin = null; this.onPick = onPick;
  }
  ensure() {
    if (this.map || typeof L === 'undefined') return;
    this.map = L.map('mapPicker', { center: [14.5995, 120.9842], zoom: 12 });
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20, attribution: 'Map data © Google'
    }).addTo(this.map);
    this.map.on('click', e => this.setPin(e.latlng.lat, e.latlng.lng));
  }
  refresh() { if (this.map) setTimeout(() => this.map.invalidateSize(), 250); }
  setPin(lat, lng) {
    this.pin = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    if (!this.marker) this.marker = L.marker([lat, lng]).addTo(this.map);
    else this.marker.setLatLng([lat, lng]);
    this.onPick(this.pin);
  }
}

/* ================= App orchestrator ================= */
class App {
  constructor() {
    this.api = new ApiClient();
    this.toast = new ToastManager($('#toasts'));
    this.cart = new Cart();
    this.user = null;
    this.menu = [];
    this.fees = { serviceRate: 0.12, deliveryFee: 250, freeDeliveryOver: 5000 };
    this.activeCategory = 'All';
    this.adminOrders = [];
    this.adminFilter = { groupBy: 'eventDate', status: 'all' };
    this.mapPicker = new MapPicker(pin => this.onPin(pin));
    this.reveal = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); this.reveal.unobserve(e.target); } });
    }, { threshold: 0.08 });
  }

  async init() {
    this.bindTabs(); this.bindAuthForms(); this.bindNav();
    this.bindMenuGrid(); this.bindCartDrawer(); this.bindAdminMenu();
    this.bindAdminTabs(); this.bindAdminOrderFilters();
    this.setDateMin();
    try {
      const { user } = await this.api.get('/auth/me');
      await this.enterApp(user, { silent: true });
    } catch {
      this.showAuth();
    }
  }

  showAuth() {
    $('#appView').hidden = true;
    $('#authView').hidden = false;
    document.body.classList.remove('booting');
  }

  async enterApp(user, { silent = false } = {}) {
    this.user = user;
    $('#authView').hidden = true;
    $('#appView').hidden = false;
    document.body.classList.remove('booting');

    $('#userName').textContent = user.name.split(' ')[0];
    $('#userInitials').textContent = user.initials || user.name[0].toUpperCase();
    this.setGreeting();

    const isAdmin = user.role === 'admin';
    $$('.client-only').forEach(el => el.hidden = isAdmin);
    $$('.admin-only').forEach(el => el.hidden = !isAdmin);
    $('#cartBtn').hidden = isAdmin;

    if (isAdmin) {
      this.switchView('admin');
      if (!silent) this.toast.show('Welcome back, Chef — the board is yours.', 'success');
      return;
    }

    try { await this.loadMenu(); } catch (err) { this.toast.show(err.message, 'error'); }
    this.renderFilters(); this.renderMenu();
    this.updateCartBadge(false); this.renderCart();
    this.switchView('menu');
    if (!silent) this.toast.show(`Welcome, ${user.name.split(' ')[0]} — handaan na!`, 'success');
  }

  switchView(name) {
    $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('#menuView').hidden = name !== 'menu';
    $('#ordersView').hidden = name !== 'orders';
    $('#adminView').hidden = name !== 'admin';
    if (name === 'orders') this.loadOrders();
    if (name === 'admin') this.loadAdmin();
  }

  setGreeting() {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    $('#greeting').textContent = `${part}, ${this.user.name.split(' ')[0]}`;
    $('#todayLine').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' · Kitchen open until 22:00';
  }

    setDateMin() {
    const dateEl = $('#evDate');
    const timeEl = $('#evTime');
    const todayStr = () => new Date().toISOString().slice(0, 10);
    dateEl.min = todayStr();
    const syncTimeMin = () => {
      if (dateEl.value === todayStr()) {
        const n = new Date();
        timeEl.min = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      } else {
        timeEl.removeAttribute('min');
      }
    };
    dateEl.addEventListener('change', syncTimeMin);
    syncTimeMin();
  }
  
  /* ---------- AUTH ---------- */
  bindTabs() {
    $$('.tab').forEach(tab => tab.addEventListener('click', () => {
      $('.tabs').dataset.active = tab.dataset.tab;
      $('#loginForm').hidden = tab.dataset.tab !== 'login';
      $('#registerForm').hidden = tab.dataset.tab !== 'register';
    }));
    $$('.pw-toggle').forEach(btn => btn.addEventListener('click', () => {
      const input = $('#' + btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    }));
    $('#registerPassword').addEventListener('input', e => this.paintStrength(e.target.value));
  }

  paintStrength(pw) {
    const bar = $('#strengthBar'), label = $('#strengthLabel');
    if (!pw) { bar.dataset.score = 0; label.textContent = ''; return; }
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
    s = Math.max(1, Math.min(4, s));
    bar.dataset.score = s;
    label.textContent = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][s];
  }

  bindAuthForms() {
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      hideMsg('login');
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;
      if (!email || !password) return showMsg('login', 'Enter your email and password.');
      setLoading($('#loginBtn'), true);
      try {
        const { user, token } = await this.api.post('/auth/login', { email, password });
        this.api.setToken(token);
        e.target.reset();
        await this.enterApp(user);
      } catch (err) {
        showMsg('login', err.message);
        this.shakeCard();
      } finally { setLoading($('#loginBtn'), false); }
    });

    $('#registerForm').addEventListener('submit', async e => {
      e.preventDefault();
      hideMsg('register');
      const name = $('#registerName').value.trim();
      const email = $('#registerEmail').value.trim();
      const password = $('#registerPassword').value;
      const confirm = $('#registerConfirm').value;
      if (name.length < 2) return showMsg('register', 'Please tell us your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMsg('register', "That email address doesn't look right.");
      if (password.length < 8) return showMsg('register', 'Password must be at least 8 characters.');
      if (password !== confirm) return showMsg('register', "Passwords don't match.");
      setLoading($('#registerBtn'), true);
      try {
        const { user, token } = await this.api.post('/auth/register', { name, email, password });
        this.api.setToken(token);
        e.target.reset();
        this.paintStrength('');
        await this.enterApp(user);
      } catch (err) {
        showMsg('register', err.message);
        this.shakeCard();
      } finally { setLoading($('#registerBtn'), false); }
    });
  }

  shakeCard() {
    const card = $('#authCard');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  /* ---------- MENU ---------- */
  async loadMenu() {
    const data = await this.api.get('/menu');
    this.menu = data.menu;
    this.fees = data.fees;
    const sel = $('#evType');
    sel.innerHTML = data.eventTypes.map(t => `<option>${esc(t)}</option>`).join('');
  }

  renderFilters() {
    const cats = ['All', ...new Set(this.menu.map(m => m.category))];
    const wrap = $('#categoryFilters');
    wrap.innerHTML = cats.map(c => `<button class="chip ${c === this.activeCategory ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $$('.chip', wrap).forEach(chip => chip.addEventListener('click', () => {
      this.activeCategory = chip.dataset.cat;
      this.renderFilters();
      this.renderMenu();
    }));
  }

  renderMenu() {
    const grid = $('#menuGrid');
    const list = this.activeCategory === 'All' ? this.menu : this.menu.filter(m => m.category === this.activeCategory);
    grid.innerHTML = list.map(item => {
      const soldout = item.available === false;
      return `
      <article class="dish-card ${soldout ? 'soldout' : ''}" data-id="${item.id}">
        <div class="dish-tile" style="background:${CATEGORY_HUES[item.category] || '#eee'}">
          <img class="dish-img" src="${item.img}" alt="${esc(item.name)}" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
          <span class="dish-fallback" style="display:none">${esc(item.name.charAt(0))}</span>
          ${soldout ? '<span class="soldout-tag">Not available</span>' : ''}
        </div>
        <div class="dish-body">
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.desc)}</p>
          <div class="dish-meta">
            <span class="price mono">${money(item.price)}</span>
            <span class="unit">${esc(item.unit)}</span>
          </div>
          <div class="dish-actions">
            ${soldout
              ? '<button type="button" class="btn btn-add" disabled>Not available</button>'
              : `<div class="stepper">
                  <button type="button" class="st-btn" data-dir="-1">−</button>
                  <span class="st-val mono">1</span>
                  <button type="button" class="st-btn" data-dir="1">+</button>
                </div>
                <button type="button" class="btn btn-primary btn-add" data-add="${item.id}">Add</button>`}
          </div>
        </div>
      </article>`;
    }).join('');
    $$('.dish-card', grid).forEach(card => this.reveal.observe(card));
  }

  bindMenuGrid() {
    $('#menuGrid').addEventListener('click', e => {
      const card = e.target.closest('.dish-card');
      if (!card || card.classList.contains('soldout')) return;
      const stBtn = e.target.closest('.st-btn');
      if (stBtn) {
        const valEl = $('.st-val', card);
        valEl.textContent = Math.min(40, Math.max(1, +valEl.textContent + +stBtn.dataset.dir));
        return;
      }
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        this.cart.add(card.dataset.id, +$('.st-val', card).textContent);
        this.updateCartBadge(true);
        this.flashAdded(addBtn);
      }
    });
  }

  flashAdded(btn) {
    const original = btn.textContent;
    btn.classList.add('added'); btn.textContent = 'Added ✓'; btn.disabled = true;
    setTimeout(() => { btn.classList.remove('added'); btn.textContent = original; btn.disabled = false; }, 1100);
  }

  /* ---------- CART ---------- */
  bindCartDrawer() {
    $('#cartBtn').addEventListener('click', () => this.openDrawer());
    $('#closeCartBtn').addEventListener('click', () => this.closeDrawer());
    $('#cartScrim').addEventListener('click', () => this.closeDrawer());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeDrawer(); });

    $('#cartLines').addEventListener('click', e => {
      const row = e.target.closest('.cart-line');
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest('[data-inc]')) { this.cart.setQty(id, this.cart.lines.get(id) + 1); }
      else if (e.target.closest('[data-dec]')) { this.cart.setQty(id, this.cart.lines.get(id) - 1); }
      else if (e.target.closest('[data-remove]')) { this.cart.lines.delete(id); this.cart.persist(); }
      else return;
      this.renderCart(); this.updateCartBadge(false);
    });

    ['input', 'change'].forEach(evt => $('.drawer-event').addEventListener(evt, () => this.renderTotals()));

    $('#placeOrderBtn').addEventListener('click', () => this.placeOrder());
  }

  openDrawer() {
    this.renderCart();
    this.mapPicker.ensure();
    this.mapPicker.refresh();
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    const scrim = $('#cartScrim');
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('show'));
  }
  closeDrawer() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    const scrim = $('#cartScrim');
    scrim.classList.remove('show');
    setTimeout(() => { scrim.hidden = true; }, 300);
  }

  updateCartBadge(pop = true) {
    const badge = $('#cartCount');
    badge.hidden = this.cart.count === 0;
    badge.textContent = this.cart.count;
    if (pop && this.cart.count) {
      badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
    }
  }

  cartTotals() {
    let subtotal = 0;
    for (const [menuId, qty] of this.cart.lines) {
      const dish = this.menu.find(m => m.id === menuId);
      if (dish) subtotal += dish.price * qty;
    }
    const serviceFee = Math.round(subtotal * this.fees.serviceRate * 100) / 100;
    const delivery = subtotal === 0 ? 0 : (subtotal >= this.fees.freeDeliveryOver ? 0 : this.fees.deliveryFee);
    return { subtotal, serviceFee, delivery, total: subtotal + serviceFee + delivery };
  }

  renderCart() {
    const wrap = $('#cartLines');
    if (!this.cart.count) {
      wrap.innerHTML = `<div class="empty-state"><span class="big">🍽️</span>Your basket is empty.<br>The menu is waiting.</div>`;
    } else {
      wrap.innerHTML = [...this.cart.lines].map(([menuId, qty]) => {
        const dish = this.menu.find(m => m.id === menuId);
        if (!dish) return '';
        return `
          <div class="cart-line" data-id="${menuId}">
            <div class="cart-thumb">
              <img src="${dish.img}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
              <span class="cart-fallback" style="display:none">${esc(dish.name.charAt(0))}</span>
            </div>
            <div>
              <div class="cl-name">${esc(dish.name)}</div>
              <div class="cl-unit">${money(dish.price)} · ${esc(dish.unit)}</div>
              <div class="stepper">
                <button type="button" class="st-btn" data-dec>−</button>
                <span class="st-val mono">${qty}</span>
                <button type="button" class="st-btn" data-inc>+</button>
              </div>
            </div>
            <div class="cl-right">
              <div class="cl-total mono">${money2(dish.price * qty)}</div>
              <button type="button" class="cl-remove" data-remove>remove</button>
            </div>
          </div>`;
      }).join('');
    }
    this.renderTotals();
  }

  renderTotals() {
    const t = this.cartTotals();
    $('#sumSubtotal').textContent = money2(t.subtotal);
    $('#sumService').textContent = money2(t.serviceFee);
    $('#sumDelivery').textContent = t.delivery === 0 && t.subtotal > 0 ? 'FREE' : money2(t.delivery);
    $('#sumTotal').textContent = money2(t.total);
    $('#placeOrderBtn').disabled = this.cart.count === 0;
  }

  async placeOrder() {
    if (!this.cart.count) return;
    const eventDate = $('#evDate').value;
    const guests = +$('#evGuests').value;
    let address = $('#evAddress').value.trim();
    const pin = this.mapPicker.pin;
    if (!address && pin) address = `${pin.lat}, ${pin.lng}`;
    const eventTime = $('#evTime').value;
    const eventWhen = new Date(`${eventDate}T${eventTime || '00:00'}:00`);
    if (!eventDate || !eventTime) return this.toast.show('Pick a date and time for your event.', 'error');
    if (Number.isNaN(eventWhen.getTime())) return this.toast.show('Please set a valid event date and time.', 'error');
    if (eventWhen <= new Date()) return this.toast.show('The event date and time cannot be in the past — same-day orders must be for a later time.', 'error');
    if (!pin && address.length < 10) return this.toast.show('Drop a pin on the map (or write the complete address).', 'error');

    const payload = {
      items: [...this.cart.lines].map(([menuId, qty]) => ({ menuId, qty })),
      guests, address, location: pin || undefined,
      eventDate,
      eventTime,
      eventType: $('#evType').value,
      notes: $('#evNotes').value.trim()
    };

    const btn = $('#placeOrderBtn');
    setLoading(btn, true);
    try {
      const { order } = await this.api.post('/orders', payload);
      this.toast.show(`Order #${order.id} sent to the kitchen ✦`, 'success');
      this.cart.clear();
      $('#evNotes').value = '';
      this.updateCartBadge(false);
      this.closeDrawer();
      this.switchView('orders');
    } catch (err) {
      this.toast.show(err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  }

  onPin(pin) {
    $('#mapHint').textContent = `Pinned: ${pin.lat}, ${pin.lng} — fetching address…`;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pin.lat}&lon=${pin.lng}`)
      .then(r => r.json())
      .then(d => {
        $('#evAddress').value = d && d.display_name ? d.display_name : `${pin.lat}, ${pin.lng}`;
        $('#mapHint').textContent = 'Pinned! 📍 Address auto-filled (editable).';
      })
      .catch(() => {
        $('#evAddress').value = `${pin.lat}, ${pin.lng}`;
        $('#mapHint').textContent = 'Pinned! 📍 (lookup failed — coordinates saved)';
      });
  }

  /* ---------- CLIENT ORDERS ---------- */
  async loadOrders() {
    try {
      const { orders } = await this.api.get('/orders');
      this.renderOrders(orders);
      const badge = $('#orderCountBadge');
      badge.hidden = orders.length === 0;
      badge.textContent = orders.length;
    } catch (err) {
      this.toast.show(err.message, 'error');
    }
  }

    renderOrders(orders) {
    const wrap = $('#ordersList');
    if (!orders.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="big">🎪</span>No orders yet — your first feast awaits.</div>`;
      return;
    }
    const STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    wrap.innerHTML = orders.map(o => {
      const idx = STEPS.indexOf(o.status);
      const dead = o.status === 'cancelled' || o.status === 'cannot_accommodate';
      const doneAll = o.status === 'completed';
      const closed = dead || doneAll;
      const timeline = `
        <div class="timeline ${dead ? 'cancelled' : ''} ${doneAll ? 'completed' : ''}">
          ${STEPS.map((s, i) => `<span class="step ${!dead && (doneAll || i <= idx) ? 'done' : ''} ${i === idx ? 'now' : ''}"><i></i>${s}</span>`).join('')}
        </div>`;
      const summary = o.items.slice(0, 3).map(i => `${i.qty}× ${esc(i.name)}`).join(' · ') +
        (o.items.length > 3 ? ` <em>+${o.items.length - 3} more</em>` : '');
      return `
        <article class="order-card ${closed ? 'done' : ''}">
          <header>
            <div>
              <span class="mono oid">#${esc(o.id)}</span>
              <span class="odate">placed ${new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <span class="pill ${esc(o.status)}">${esc(statusLabel(o.status))}</span>
          </header>
          <p class="ometa">${esc(o.eventType)} · ${o.guests} guests · ${fmtDay(o.eventDate)}${o.eventTime ? ' at ' + esc(o.eventTime) : ''}</p>
          ${o.address || o.location ? `<p class="oaddr">📍 ${esc(o.address || '')}${o.location ? ` · <a class="maps-link" target="_blank" href="https://www.google.com/maps?q=${o.location.lat},${o.location.lng}">View on Google Maps</a>` : ''}</p>` : ''}
          <p class="oitems">${summary}</p>
          ${timeline}
          <footer>
            <span class="ototal mono">${money2(o.total)}</span>
            ${o.status === 'pending' || o.status === 'confirmed' ? `<button class="btn ghost danger" data-cancel="${esc(o.id)}">Cancel order</button>` : ''}
            ${o.status === 'delivered' ? `<button class="btn ghost ok" data-complete="${esc(o.id)}">Confirm pickup ✓</button>` : ''}
          </footer>
        </article>`;
    }).join('');

    $$('[data-cancel]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Cancel this order?')) return;
      try {
        await this.api.patch(`/orders/${btn.dataset.cancel}/cancel`);
        this.toast.show('Order cancelled.', 'info');
        this.loadOrders();
      } catch (err) { this.toast.show(err.message, 'error'); }
    }));

    $$('[data-complete]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Confirm that you picked up / received this order?')) return;
      try {
        await this.api.patch(`/orders/${btn.dataset.complete}/complete`);
        this.toast.show('Order completed — salamat! 🎉', 'success');
        this.loadOrders();
      } catch (err) { this.toast.show(err.message, 'error'); }
    }));
  }

  /* ---------- ADMIN ---------- */
  async loadAdmin() {
    try {
      const [{ stats }, { orders }, { users }, menuData] = await Promise.all([
        this.api.get('/admin/stats'),
        this.api.get('/admin/orders'),
        this.api.get('/admin/users'),
        this.api.get('/menu')
      ]);
      this.renderAdminStats(stats);
      this.renderAdminMenu(menuData.menu);
      this.renderAdminOrders(orders);
      this.renderAdminUsers(users);
    } catch (err) { this.toast.show(err.message, 'error'); }
  }

  renderAdminStats(s) {
    $('#adminStats').innerHTML = `
      <div class="stat hot"><div class="num">${s.pending}</div><div class="lbl">Pending tickets</div></div>
      <div class="stat"><div class="num">${s.upcoming}</div><div class="lbl">In progress</div></div>
      <div class="stat"><div class="num">${s.delivered}</div><div class="lbl">Delivered</div></div>
      <div class="stat"><div class="num">${money2(s.revenue)}</div><div class="lbl">Revenue</div></div>
      <div class="stat"><div class="num">${s.guests.toLocaleString()}</div><div class="lbl">Guests fed</div></div>`;
  }

  /* Tabs: iisa lang ang nakikitang section */
  bindAdminTabs() {
    $$('.admin-tab').forEach(btn => btn.addEventListener('click', () => {
      $$('.admin-tab').forEach(b => b.classList.toggle('active', b === btn));
      const t = btn.dataset.atab;
      $('#adminSecOrders').hidden = t !== 'orders';
      $('#adminSecMenu').hidden = t !== 'menu';
      $('#adminSecAccounts').hidden = t !== 'accounts';
    }));
  }

  /* Filters ng Client orders */
  bindAdminOrderFilters() {
    $('#adminGroupBy').addEventListener('change', e => {
      this.adminFilter.groupBy = e.target.value;
      this.renderAdminOrders(this.adminOrders);
    });
    $('#adminStatusFilter').addEventListener('change', e => {
      this.adminFilter.status = e.target.value;
      this.renderAdminOrders(this.adminOrders);
    });
  }

  renderAdminMenu(menu) {
    $('#adminMenu').innerHTML = menu.map(item => `
      <div class="avail-row">
        <span class="avail-thumb">
          <img src="${item.img}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
          <span class="avail-fallback" style="display:none">${esc(item.name.charAt(0))}</span>
        </span>
        <div class="avail-info">
          <div class="cl-name">${esc(item.name)}</div>
          <div class="cl-unit">${esc(item.category)} · ${money(item.price)} · ${esc(item.unit)}</div>
        </div>
        <button type="button" class="avail-toggle ${item.available ? '' : 'off'}" data-menu-toggle="${item.id}" data-available="${item.available}">
          ${item.available ? 'Available' : 'Not available'}
        </button>
      </div>`).join('');
  }

  bindAdminMenu() {
    $('#adminMenu').addEventListener('click', async e => {
      const btn = e.target.closest('[data-menu-toggle]');
      if (!btn) return;
      const nowAvailable = btn.dataset.available !== 'true';
      try {
        const res = await this.api.patch(`/admin/menu/${btn.dataset.menuToggle}/availability`, { available: nowAvailable });
        this.toast.show(`${res.name}: ${nowAvailable ? 'available na ulit ✔' : 'marked NOT available ✕'}`, 'success');
        const data = await this.api.get('/menu');
        this.renderAdminMenu(data.menu);
      } catch (err) { this.toast.show(err.message, 'error'); }
    });
  }

  /* Grouped + first-order-first-serve na listahan ng orders */
  renderAdminOrders(orders) {
    this.adminOrders = orders;
    const wrap = $('#adminOrders');
    const { groupBy, status } = this.adminFilter;

    let list = orders.slice();
    if (status !== 'all') list = list.filter(o => o.status === status);

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="big">🧑🍳</span>No tickets match this filter.</div>`;
      return;
    }

    const firstServe = (a, b) => a.createdAt.localeCompare(b.createdAt); // unang order, unang atendido
    let html = '';

    if (groupBy === 'none') {
      list.sort(firstServe);
      html = list.map(o => this.adminOrderCard(o)).join('');
    } else {
      const keyOf = o => groupBy === 'createdAt' ? (o.createdAt || '').slice(0, 10) : (o.eventDate || 'TBD');
      const groups = new Map();
      for (const o of list) {
        const k = keyOf(o);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(o);
      }
      const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
      for (const k of keys) {
        const items = groups.get(k).sort(firstServe);
        const label = groupBy === 'createdAt' ? `Ordered: ${fmtDay(k)}` : `Event date: ${fmtDay(k)}`;
        html += `
          <div class="order-group">
            <div class="order-group-head">📅 ${esc(label)} <span class="og-count">${items.length} order${items.length === 1 ? '' : 's'}</span></div>
            ${items.map(o => this.adminOrderCard(o)).join('')}
          </div>`;
      }
    }

    wrap.innerHTML = html;

    $$('select[data-status-for]', wrap).forEach(sel => sel.addEventListener('change', async () => {
      try {
        await this.api.patch(`/admin/orders/${sel.dataset.statusFor}/status`, { status: sel.value });
        this.toast.show(`#${sel.dataset.statusFor} → ${statusLabel(sel.value)}`, 'success');
        this.loadAdmin();
      } catch (err) { this.toast.show(err.message, 'error'); this.loadAdmin(); }
    }));
  }

    adminOrderCard(o) {
    const ALL = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cannot_accommodate'];
    const done = ['completed', 'cancelled', 'cannot_accommodate'].includes(o.status);
    const opts = ALL.includes(o.status) ? ALL : [...ALL, o.status];
    return `
      <article class="order-card ${done ? 'done' : ''}">
        <header>
          <div>
            <span class="mono oid">#${esc(o.id)}</span>
            <span class="odate">${esc(o.clientName)}${o.clientEmail ? ' · ' + esc(o.clientEmail) : ''}</span>
          </div>
          <span class="pill ${esc(o.status)}">${esc(statusLabel(o.status))}</span>
        </header>
        <p class="ometa">${esc(o.eventType)} · ${o.guests} guests · ${fmtDay(o.eventDate)}${o.eventTime ? ' at ' + esc(o.eventTime) : ''}</p>
        ${o.address || o.location ? `<p class="oaddr">📍 ${esc(o.address || '')}${o.location ? ` · <a class="maps-link" target="_blank" href="https://www.google.com/maps?q=${o.location.lat},${o.location.lng}">View on Google Maps</a>` : ''}</p>` : ''}
        <p class="oitems">${o.items.slice(0, 3).map(i => `${i.qty}× ${esc(i.name)}`).join(' · ')}${o.items.length > 3 ? ` <em>+${o.items.length - 3} more</em>` : ''}</p>
        <footer>
          <span class="ototal mono">${money2(o.total)}</span>
          <label class="status-picker">Status
            <select data-status-for="${esc(o.id)}" ${done ? 'disabled' : ''}>
              ${opts.map(st => `<option value="${st}" ${st === o.status ? 'selected' : ''}>${esc(statusLabel(st))}</option>`).join('')}
            </select>
          </label>
        </footer>
      </article>`;
  }

  renderAdminUsers(users) {
    const wrap = $('#adminUsers');
    if (!users.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="big">👤</span>No registered accounts yet.</div>`;
      return;
    }
    wrap.innerHTML = users.map(u => `
      <article class="order-card" style="display:flex;align-items:center;gap:14px">
        <div class="initials">${esc((u.name[0] || '?').toUpperCase())}</div>
        <div style="flex:1">
          <div class="cl-name">${esc(u.name)} ${u.role === 'admin' ? '<span class="pill confirmed">admin</span>' : ''}</div>
          <div class="cl-unit">${esc(u.email)} · joined ${fmtDay(u.createdAt.slice(0, 10))}</div>
        </div>
        <span class="ototal mono">${u.orders} order${u.orders === 1 ? '' : 's'}</span>
      </article>`).join('');
  }

  /* ---------- nav / logout ---------- */
  bindNav() {
    $$('.navbtn').forEach(btn => btn.addEventListener('click', () => this.switchView(btn.dataset.view)));
    $('#logoutBtn').addEventListener('click', async () => {
      try { await this.api.post('/auth/logout'); } catch { /* server may be gone */ }
      this.api.setToken(null);
      this.cart.clear();
      this.user = null;
      this.updateCartBadge(false);
      this.showAuth();
      this.toast.show('Logged out. Come back hungry.');
    });
  }
}

/* ---------- tiny utilities ---------- */
function setLoading(btn, on) { btn.classList.toggle('loading', on); btn.disabled = on; }
function showMsg(which, text) { const el = $(`#${which}Msg`); el.textContent = text; el.hidden = false; }
function hideMsg(which) { $(`#${which}Msg`).hidden = true; }

window.app = new App();
window.app.init();