'use strict';

const { MENU, EVENT_TYPES, FEES } = require('../seed-data');
const { Order } = require('../models/Order');
const { ApiError } = require('../ApiError');

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Menu, availability, orders, ticker, cancellation, admin tools. */
class OrderService {
  constructor(db) {
    this.db = db;
    this.menuById = new Map(MENU.map(item => [item.id, item]));
  }

  /* ---------- menu + availability ---------- */
  #flags() {
    if (!this.db.data.menuFlags) this.db.data.menuFlags = {};
    return this.db.data.menuFlags;
  }

  isAvailable(menuId) {
    return this.#flags()[menuId] !== false;
  }

  getMenu() {
    const flags = this.#flags();
    return {
      menu: MENU.map(item => ({ ...item, available: flags[item.id] !== false })),
      eventTypes: EVENT_TYPES,
      fees: FEES
    };
  }

  setMenuAvailability(menuId, available) {
    if (!this.menuById.has(menuId)) throw new ApiError(404, 'Menu item not found.');
    this.#flags()[menuId] = available !== false;
    this.db.save();
    return { menuId, name: this.menuById.get(menuId).name, available: available !== false };
  }

  /* ---------- client orders ---------- */
  createOrder(user, payload = {}) {
    const lines = payload.items;
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new ApiError(400, 'Your basket is empty — add a few dishes first.');
    }
    if (lines.length > 30) throw new ApiError(400, 'Too many line items (max 30).');

    const items = lines.map(line => {
      const dish = this.menuById.get(line.menuId);
      if (!dish) throw new ApiError(400, 'A dish in your basket is no longer on the menu.');
      if (!this.isAvailable(line.menuId)) {
        throw new ApiError(400, `"${dish.name}" is not available right now.`);
      }
      const qty = Math.floor(Number(line.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > 40) {
        throw new ApiError(400, 'Quantities must be between 1 and 40.');
      }
      return {
        menuId: dish.id, name: dish.name, unit: dish.unit,
        price: dish.price, qty, lineTotal: dish.price * qty
      };
    });

    const guests = Math.floor(Number(payload.guests));
    if (!Number.isFinite(guests) || guests < 10 || guests > 2000) {
      throw new ApiError(400, 'Guest count must be between 10 and 2,000.');
    }

    const eventDate = new Date(`${payload.eventDate}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (Number.isNaN(eventDate.getTime())) throw new ApiError(400, 'Please pick a valid event date.');
    if (eventDate < today) throw new ApiError(400, 'The event date cannot be in the past.');

    const address = String(payload.address || '').trim();
    if (address.length < 10) throw new ApiError(400, 'Please provide the complete delivery address.');
    if (address.length > 300) throw new ApiError(400, 'Address is too long (max 300 characters).');

    let location = null;
    if (payload.location && Number.isFinite(Number(payload.location.lat)) && Number.isFinite(Number(payload.location.lng))) {
      location = { lat: Number(payload.location.lat), lng: Number(payload.location.lng) };
    }

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const serviceFee = Math.round(subtotal * FEES.serviceRate * 100) / 100;
    const deliveryFee = subtotal >= FEES.freeDeliveryOver ? 0 : FEES.deliveryFee;

    const order = new Order({
      id: `SS-${1036 + this.db.nextId('orders')}`,
      userId: user.id,
      items, guests, address, location,
      eventType: EVENT_TYPES.includes(payload.eventType) ? payload.eventType : 'Private event',
      eventDate: payload.eventDate,
      eventTime: String(payload.eventTime || ''),
      notes: String(payload.notes || '').slice(0, 300),
      subtotal, serviceFee, deliveryFee,
      total: subtotal + serviceFee + deliveryFee,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    this.db.insert('orders', order);
    return order;
  }

  getOrdersForUser(userId) {
    return this.db
      .find('orders', o => o.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getTicker(limit = 8) {
    return this.db
      .find('orders', o => o.status !== 'cancelled' && o.status !== 'cannot_accommodate')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(o => ({ id: o.id, eventType: o.eventType, guests: o.guests, status: o.status, ago: timeAgo(o.createdAt) }));
  }

  cancelOrder(user, orderId) {
    const order = this.db.findOne('orders', o => o.id === orderId);
    if (!order || order.userId !== user.id) throw new ApiError(404, 'Order not found.');
    if (!new Order(order).canCancel()) {
      throw new ApiError(409, 'This order is already being worked on — call the desk to change it.');
    }
    this.db.update('orders', o => o.id === orderId, { status: 'cancelled' });
    return { ...order, status: 'cancelled' };
  }

  /* ---------- admin ---------- */
  getAllOrders() {
    return this.db.find('orders', () => true)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(o => {
        const owner = this.db.findOne('users', u => u.id === o.userId);
        return { ...o, clientName: owner ? owner.name : 'Demo booking', clientEmail: owner ? owner.email : '' };
      });
  }

  updateOrderStatus(orderId, status) {
    const allowed = [...Order.STATUSES, 'cancelled', 'cannot_accommodate'];
    if (!allowed.includes(status)) throw new ApiError(400, 'Unknown status.');
    const order = this.db.findOne('orders', o => o.id === orderId);
    if (!order) throw new ApiError(404, 'Order not found.');
    this.db.update('orders', o => o.id === orderId, { status });
    return { ...order, status };
  }

  getStats() {
    const orders = this.db.collection('orders');
    const live = orders.filter(o => o.status !== 'cancelled' && o.status !== 'cannot_accommodate');
    return {
      totalOrders: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      upcoming: orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      revenue: live.reduce((sum, o) => sum + o.total, 0),
      guests: live.reduce((sum, o) => sum + o.guests, 0)
    };
  }
}

module.exports = { OrderService };