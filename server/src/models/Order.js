'use strict';

/** Order model + status pipeline. */
class Order {
  static STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
  static DONE = ['completed', 'cancelled', 'cannot_accommodate'];

  constructor(data) {
    Object.assign(this, data);
  }

  /** Pwede lang mag-cancel habang pending o confirmed. */
  canCancel() {
    return this.status === 'pending' || this.status === 'confirmed';
  }

  /** Sarado na ang order — hindi na galawin. */
  isDone() {
    return Order.DONE.includes(this.status);
  }

  get itemCount() {
    return this.items.reduce((sum, line) => sum + line.qty, 0);
  }
}

module.exports = { Order };