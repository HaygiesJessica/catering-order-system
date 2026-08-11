'use strict';

/** User model — only two roles exist: admin and client. */
class User {
  constructor(data) {
    Object.assign(this, data);
    // Existing records without a role are treated as clients.
    this.role = data.role === 'admin' ? 'admin' : 'client';
  }

  get initials() {
    return this.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  /** Never let the hash or salt leave the kitchen. */
  toSafeJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      role: this.role,
      createdAt: this.createdAt,
      initials: this.initials
    };
  }
}

module.exports = { User };
