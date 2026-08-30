'use strict';

/* Tiny Web-Audio sound kit — no audio files needed, pure generated tones. */
class SoundKit {
  constructor() {
    this.ctx = null;
  }

  /** Buksan ang audio — tawagin pagkatapos ng user interaction (autoplay rules). */
  unlock() {
    const ctx = this.#ctx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  #ctx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) this.ctx = new AC();
    return this.ctx;
  }

  #tone(freq, delay, dur, type = 'sine', vol = 0.08) {
    const ctx = this.#ctx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  /* 💬 chat: quick high double blip */
  chat() {
    this.#tone(880, 0, 0.12);
    this.#tone(1318, 0.1, 0.16);
  }

  /* 🛎️ client: happy rising chime (order status update) */
  clientStatus() {
    this.#tone(523, 0, 0.12);
    this.#tone(659, 0.12, 0.12);
    this.#tone(784, 0.24, 0.22);
  }

  /* 📥 admin: low two-tone "new ticket" ding */
  adminOrder() {
    this.#tone(392, 0, 0.15, 'triangle');
    this.#tone(587, 0.16, 0.28, 'triangle');
  }
}
window.sounds = new SoundKit();

/* I-unlock ang audio sa unang interaction ng user (browser autoplay rules) */
['click', 'keydown', 'touchstart'].forEach(evt =>
  window.addEventListener(evt, () => window.sounds.unlock(), { passive: true })
);

/** Polls orders every 6s; plays role-specific sounds on changes. */
class OrderSoundWatcher {
  constructor(app) {
    this.app = app;
    this.known = null;
    this.NOTIFY = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'cannot_accommodate'];
    setInterval(() => this.tick(), 6000);
  }

  async tick() {
    const user = this.app.user;
    if (!user) { this.known = null; return; }
    try {
      if (user.role === 'admin') {
        /* Admin: tunog kapag may BAGONG order pumasok */
        const { orders } = await this.app.api.get('/admin/orders');
        const map = new Map(orders.map(o => [o.id, o.status]));
        if (this.known && orders.some(o => !this.known.has(o.id))) {
          window.sounds.unlock();
          window.sounds.adminOrder();
        }
        this.known = map;
      } else {
        /* Client: tunog kapag NAGBAGO ang status ng order niya */
        const { orders } = await this.app.api.get('/orders');
        const map = new Map(orders.map(o => [o.id, o.status]));
        if (this.known && orders.some(o =>
          this.known.has(o.id) &&
          this.known.get(o.id) !== o.status &&
          this.NOTIFY.includes(o.status)
        )) {
          window.sounds.unlock();
          window.sounds.clientStatus();
        }
        this.known = map;
      }
    } catch { /* offline — skip */ }
  }
}
window.orderWatcher = new OrderSoundWatcher(window.app);