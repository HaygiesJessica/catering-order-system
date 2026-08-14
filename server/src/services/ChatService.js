'use strict';

const { ApiError } = require('../ApiError');

/** Client ↔ admin messaging, stored in the JSON pantry. */
class ChatService {
  constructor(db) {
    this.db = db;
  }

  #user(id) {
    return this.db.findOne('users', u => u.id === id);
  }

  /** One thread per client. */
  getThread(clientId) {
    return this.db
      .find('messages', m => m.clientId === clientId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(m => ({ ...m, senderName: (this.#user(m.userId) || {}).name || 'Unknown' }));
  }

  sendMessage(sender, clientId, text) {
    const client = this.#user(clientId);
    if (!client) throw new ApiError(404, 'Conversation not found.');
    const body = String(text || '').trim();
    if (!body) throw new ApiError(400, 'Message is empty.');
    if (body.length > 500) throw new ApiError(400, 'Message is too long (max 500 characters).');

    const msg = {
      id: this.db.nextId('messages'),
      clientId,
      userId: sender.id,
      senderRole: sender.role || 'client',
      text: body,
      createdAt: new Date().toISOString()
    };
    this.db.insert('messages', msg);
    return msg;
  }

  /** Admin only: list of all client conversations with last-message preview. */
  getThreads() {
    const clients = this.db.find('users', u => (u.role || 'client') === 'client');
    return clients
      .map(c => {
        const msgs = this.db
          .find('messages', m => m.clientId === c.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const last = msgs[msgs.length - 1] || null;
        return {
          clientId: c.id,
          clientName: c.name,
          clientEmail: c.email,
          count: msgs.length,
          last: last ? { text: last.text, at: last.createdAt, fromAdmin: last.senderRole === 'admin' } : null
        };
      })
      .sort((a, b) => (b.last ? b.last.at : '').localeCompare(a.last ? a.last.at : ''));
  }
}

module.exports = { ChatService };