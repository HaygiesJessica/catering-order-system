'use strict';

/**
 * Format timestamp for chat:
 * - today → "14:30"
 * - within 7 days → "Mon · 14:30"
 * - older → "Aug 29 · 14:30"
 */
function formatMsgTime(iso) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' · ' + timeStr;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + timeStr;
}

/** Date divider label (shown once per day in the chat). */
function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Chat panel — uses helpers ($, esc), window.app, and window.sounds. */
class ChatPanel {
  constructor(app) {
    this.app = app;
    this.open = false;
    this.activeClientId = null;
    this.lastRendered = '';
    this.timer = null;
    this.userId = null;
    this.lastUnread = 0;
    this.prevLastId = 0;
    this.bind();
    // Background unread poller — tumatakbo kahit nakasara ang panel
    this.unreadTimer = setInterval(() => this.pollUnread(), 5000);
    this.pollUnread();
  }

  get isAdmin() { return !!(this.app.user && this.app.user.role === 'admin'); }
  get clientId() { return this.isAdmin ? this.activeClientId : (this.app.user ? this.app.user.id : null); }

  bind() {
    $('#chatFab').addEventListener('click', () => this.toggle());
    $('#chatClose').addEventListener('click', () => this.toggle(false));
    $('#chatSend').addEventListener('click', () => this.send());
    $('#chatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.send(); }
    });
    $('#chatClientSelect').addEventListener('change', e => {
      this.activeClientId = Number(e.target.value) || null;
      this.lastRendered = '';
      this.load();
    });
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    $('#chatPanel').classList.toggle('open', this.open);
    $('#chatFab').hidden = this.open;
    if (this.open) {
      this.markSeen();
      this.start();
    } else {
      this.stop();
    }
  }

  /* ---- unread badge + buzz + sound ---- */
  async pollUnread() {
    if (!this.app.user) return;
    try {
      const { unread } = await this.app.api.get('/chat/unread');
      this.setBadge(unread);
    } catch { /* offline or logged out — ignore */ }
  }

  setBadge(n) {
    const badge = $('#chatBadge');
    const fab = $('#chatFab');
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 9 ? '9+' : String(n);
      if (n > this.lastUnread && !this.open) {
        fab.classList.remove('buzz');
        void fab.offsetWidth;
        fab.classList.add('buzz');
        if (window.sounds) window.sounds.chat();   // 🔔 chat sound kapag naka-close ang panel
      }
    } else {
      badge.hidden = true;
    }
    this.lastUnread = n;
  }

  markSeen() {
    this.app.api.post('/chat/seen')
      .then(() => this.setBadge(0))
      .catch(() => {});
  }

  /* ---- thread loading ---- */
  async start() {
    if (this.userId !== this.app.user.id) {
      this.userId = this.app.user.id;
      this.activeClientId = null;
      this.lastRendered = '';
      this.prevLastId = 0;
    }
    $('#chatClientSelect').hidden = !this.isAdmin;
    if (this.isAdmin && this.activeClientId == null) await this.loadThreads();
    if (!this.isAdmin) this.activeClientId = this.app.user.id;
    await this.load();
    this.stop();
    this.timer = setInterval(() => this.load(true), 3500);
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  async loadThreads() {
    try {
      const { threads } = await this.app.api.get('/chat/threads');
      const sel = $('#chatClientSelect');
      sel.innerHTML = threads.length
        ? threads.map(t => `<option value="${t.clientId}">${esc(t.clientName)}</option>`).join('')
        : '<option value="">No client accounts</option>';
      if (threads.length && this.activeClientId == null) this.activeClientId = threads[0].clientId;
      sel.value = String(this.activeClientId || '');
    } catch (err) { this.app.toast.show(err.message, 'error'); }
  }

  async load(silent = false) {
    if (this.clientId == null) return;
    try {
      const { messages } = await this.app.api.get(`/chat/thread/${this.clientId}`);

      // 🔔 chat sound kapag BUAKS ang panel at may bagong message mula sa kabilang side
      const lastMsg = messages.length ? messages[messages.length - 1] : null;
      const lastId = lastMsg ? lastMsg.id : 0;
      if (this.open && lastMsg && this.prevLastId && lastId > this.prevLastId &&
          lastMsg.userId !== this.app.user.id && window.sounds) {
        window.sounds.chat();
      }
      this.prevLastId = lastId;

      const hash = messages.map(m => `${m.id}:${m.deliveredAt || ''}`).join('|');
      if (hash !== this.lastRendered) {
        this.lastRendered = hash;
        this.render(messages);
        if (this.open) this.markSeen();
      }
    } catch (err) {
      if (err.status === 401) { this.stop(); this.toggle(false); return; }
      if (!silent) this.app.toast.show(err.message, 'error');
    }
  }

  render(messages) {
    const wrap = $('#chatMessages');
    if (!messages.length) {
      wrap.innerHTML = '<p class="chat-empty">No messages yet — say kamusta! 👋</p>';
      return;
    }

    let html = '';
    let lastDay = null;
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        html += `<div class="chat-date-divider">${esc(formatDateLabel(m.createdAt))}</div>`;
        lastDay = day;
      }

      const isMine = m.userId === this.app.user.id;
      let status = '';
      if (isMine) {
        status = m.deliveredAt
          ? '<span class="chat-status seen" title="Delivered">✓✓</span>'
          : '<span class="chat-status" title="Sent">✓</span>';
      }

      html += `
        <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
          <div class="chat-meta">${esc(m.senderName)} · ${esc(formatMsgTime(m.createdAt))}${status}</div>
          <div class="chat-bubble">${esc(m.text)}</div>
        </div>`;
    }

    wrap.innerHTML = html;
    wrap.scrollTop = wrap.scrollHeight;
  }

  async send() {
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text || this.clientId == null) return;
    input.value = '';
    try {
      await this.app.api.post(`/chat/thread/${this.clientId}`, { text });
      this.load();
    } catch (err) { this.app.toast.show(err.message, 'error'); }
  }
}

window.chat = new ChatPanel(window.app);