'use strict';

const express = require('express');

/** Chat API — mounted at /api/chat sa server.js (isang line lang doon). */
function chatRoutes({ requireAuth, requireAdmin, chatService }) {
  const router = express.Router();

  /* Client: sariling thread lang. Admin: kahit alin. */
  router.get('/thread/:clientId', requireAuth, (req, res) => {
    const clientId = Number(req.params.clientId);
    if (req.user.role !== 'admin' && req.user.id !== clientId) {
      return res.status(403).json({ error: 'You can only view your own conversation.' });
    }
    res.json({ messages: chatService.getThread(clientId) });
  });

  router.post('/thread/:clientId', requireAuth, (req, res) => {
    const clientId = Number(req.params.clientId);
    if (req.user.role !== 'admin' && req.user.id !== clientId) {
      return res.status(403).json({ error: 'You can only send messages in your own conversation.' });
    }
    res.status(201).json({ message: chatService.sendMessage(req.user, clientId, (req.body || {}).text) });
  });

  /* Admin only: conversation picker list. */
  router.get('/threads', requireAuth, requireAdmin, (req, res) => {
    res.json({ threads: chatService.getThreads() });
  });

  return router;
}

module.exports = { chatRoutes };