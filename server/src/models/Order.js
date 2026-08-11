'use strict';

/**
 * Order workflow:
 * pending -> confirmed -> preparing -> ready -> delivered
 *
 * "received by client" is intentionally separate from the delivery status.
 * The admin controls the order up to delivered; the client confirms receipt.
 */
class Order {
  static STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];

  constructor(data) {
    Object.assign(this, data);
  }

  canCancel() {
    return this.status === 'pending';
  }

  get itemCount() {
    return this.items.reduce((sum, line) => sum + line.qty, 0);
  }
}

module.exports = { Order };
