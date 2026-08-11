'use strict';

const crypto = require('crypto');
const { User } = require('../models/User');
const { hashPassword, verifyPassword } = require('../passwords');
const { ApiError } = require('../ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // one week

/** Registration, login, and bearer-token sessions — all against the JsonDatabase. */
class AuthService {
  constructor(db) {
    this.db = db;
  }

  register({ name = '', email = '', phone = '', password = '' }) {
    name = String(name).trim();
    email = String(email).trim().toLowerCase();

    if (name.length < 2) throw new ApiError(400, 'Please tell us your name.');
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'That email address doesn’t look right.');
    if (typeof password !== 'string' || password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters.');
    }
    if (this.db.findOne('users', u => u.email === email)) {
      throw new ApiError(409, 'An account with this email already exists — try signing in.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const user = new User({
      id: this.db.nextId('users'),
      name,
      email,
      phone: String(phone || '').trim(),
      passwordHash: hashPassword(password, salt),
      salt,
      role: 'client', // public signups are always clients — admins are seeded only
      createdAt: new Date().toISOString()
    });

    this.db.insert('users', user);
    return { user: user.toSafeJSON(), token: this.#createSession(user.id) };
  }

  login({ email = '', password = '' }) {
    email = String(email).trim().toLowerCase();
    const record = this.db.findOne('users', u => u.email === email);

    if (!record || !verifyPassword(password, record.salt, record.passwordHash)) {
      throw new ApiError(401, 'Wrong email or password. Taste it again?');
    }
    const user = new User(record);
    return { user: user.toSafeJSON(), token: this.#createSession(user.id) };
  }

  getSession(token) {
    if (!token) return null;
    const session = this.db.findOne('sessions', s => s.token === token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.db.remove('sessions', s => s.token === token);
      return null;
    }
    const record = this.db.findOne('users', u => u.id === session.userId);
    return record ? new User(record) : null;
  }

  logout(token) {
    return this.db.remove('sessions', s => s.token === token);
  }

  #createSession(userId) {
    this.#purgeExpired();
    const token = crypto.randomBytes(24).toString('hex');
    this.db.insert('sessions', { token, userId, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }

  #purgeExpired() {
    this.db.remove('sessions', s => s.expiresAt < Date.now());
  }
}

module.exports = { AuthService };