'use strict';

/** Chat panel — gumagamit ng helpers ($, esc) at window.app mula sa app.js. */
class ChatPanel {
  constructor(app) {
    this.app = app;
    this.open = false;
    this.activeClientId = null;
    this.lastSeenId = 0;
    this.timer = null;
    this.userId = null;
    this.bind();
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
      this.lastSeenId = 0;
      this.load();
    });
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    $('#chatPanel').classList.toggle('open', this.open);
    $('#chatFab').hidden = this.open;
    if (this.open) this.start(); else this.stop();
  }

  async start() {
    // kung nagpalit ng user (logout/login), i-reset ang conversation
    if (this.userId !== this.app.user.id) {
      this.userId = this.app.user.id;
      this.activeClientId = null;
      this.lastSeenId = 0;
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
      const last = messages.length ? messages[messages.length - 1].id : 0;
      if (last !== this.lastSeenId || !silent) {
        this.lastSeenId = last;
        this.render(messages);
      }
    } catch (err) {
      if (err.status === 401) { this.stop(); this.toggle(false); return; }
      if (!silent) this.app.toast.show(err.message, 'error');
    }
  }

  render(messages) {
    const wrap = $('#chatMessages');
    wrap.innerHTML = messages.length
      ? messages.map(m => `
        <div class="chat-msg ${m.userId === this.app.user.id ? 'mine' : 'theirs'}">
          <div class="chat-meta">${esc(m.senderName)} · ${new Date(m.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="chat-bubble">${esc(m.text)}</div>
        </div>`).join('')
      : '<p class="chat-empty">No messages yet — say kamusta! 👋</p>';
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