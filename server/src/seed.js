'use strict';

const crypto = require('crypto');
const { MENU, FEES } = require('./seed-data');
const { hashPassword } = require('./passwords');

function seedAdmin(db) {
  if (db.findOne('users', u => u.email === 'admin@saffronsage.test')) return;
  const salt = crypto.randomBytes(16).toString('hex');
  db.insert('users', {
    id: db.nextId('users'), name: 'Head Chef', email: 'admin@saffronsage.test', phone: '',
    passwordHash: hashPassword('admin1234', salt), salt, role: 'admin', createdAt: new Date().toISOString()
  });
  console.log('[db] Admin ready → admin@saffronsage.test / admin1234');
}

function seedDemoClient(db) {
  if (db.findOne('users', u => u.email === 'chef@saffronsage.test')) return;
  const salt = crypto.randomBytes(16).toString('hex');
  db.insert('users', {
    id: db.nextId('users'), name: 'Demo Chef', email: 'chef@saffronsage.test', phone: '',
    passwordHash: hashPassword('butter-thyme', salt), salt, role: 'client', createdAt: new Date().toISOString()
  });
  console.log('[db] Demo client ready → chef@saffronsage.test / butter-thyme');
}

function seedDatabase(db) {
  seedAdmin(db);
  seedDemoClient(db);
  if (db.meta.seeded) return;

  const menuById = new Map(MENU.map(i => [i.id, i]));
  const now = Date.now();
  const H = 60 * 60 * 1000;

  const specs = [
    { age: 1.2 * H,  status: 'pending',   eventType: 'Birthday',        guests: 32,  inDays: 2,   lines: [['m07', 2], ['m24', 1], ['m13', 2]] },
    { age: 5 * H,    status: 'confirmed', eventType: 'Corporate lunch', guests: 60,  inDays: 4,   lines: [['m03', 5], ['m06', 2], ['m16', 4]] },
    { age: 26 * H,   status: 'confirmed', eventType: 'Garden party',    guests: 45,  inDays: 6,   lines: [['m02', 4], ['m18', 3], ['m23', 2]] },
    { age: 49 * H,   status: 'delivered', eventType: 'Wedding',         guests: 120, inDays: -2,  lines: [['m05', 10], ['m08', 6], ['m25', 4]] },
    { age: 75 * H,   status: 'delivered', eventType: 'Product launch',  guests: 80,  inDays: -4,  lines: [['m01', 7], ['m10', 4], ['m22', 3]] },
    { age: 120 * H,  status: 'delivered', eventType: 'Family reunion',  guests: 28,  inDays: -6,  lines: [['m12', 3], ['m14', 2], ['m21', 2]] }
  ];

  specs.forEach((spec, i) => {
    const items = spec.lines.map(([menuId, qty]) => {
      const dish = menuById.get(menuId);
      return { menuId, name: dish.name, unit: dish.unit, price: dish.price, qty, lineTotal: dish.price * qty };
    });
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const serviceFee = Math.round(subtotal * FEES.serviceRate * 100) / 100;
    const deliveryFee = subtotal >= FEES.freeDeliveryOver ? 0 : FEES.deliveryFee;

    db.insert('orders', {
      id: `SS-${1037 + i}`, userId: 'seed', items,
      guests: spec.guests, eventType: spec.eventType,
      eventDate: new Date(now + spec.inDays * 24 * H).toISOString().slice(0, 10),
      eventTime: '17:00', notes: '', address: 'Casa Real Events Pavilion, Silang, Cavite', location: null,
      subtotal, serviceFee, deliveryFee, total: subtotal + serviceFee + deliveryFee,
      status: spec.status, createdAt: new Date(now - spec.age).toISOString()
    });
  });

  db.data.meta.counters.orders = specs.length;
  db.data.meta.seeded = true;
  db.save();
  console.log('[db] Pantry seeded with demo tickets ✦');
}

module.exports = { seedDatabase };