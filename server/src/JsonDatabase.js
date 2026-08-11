'use strict';

const fs = require('fs');
const path = require('path');

/**
 * A tiny document store persisted to a single JSON file.
 * Collections are plain arrays; every mutation flushes atomically
 * (write temp file → rename) so a crash never corrupts the pantry.
 */
class JsonDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      users: [],
      sessions: [],
      orders: [],
      meta: { counters: {}, seeded: false }
    };
    this.#load();
  }

  #load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[db] Could not read store, starting fresh:', err.message);
      }
      this.save();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  collection(name) {
    if (!Array.isArray(this.data[name])) this.data[name] = [];
    return this.data[name];
  }

  insert(name, doc) {
    this.collection(name).push(doc);
    this.save();
    return doc;
  }

  find(name, predicate) {
    return this.collection(name).filter(predicate);
  }

  findOne(name, predicate) {
    return this.collection(name).find(predicate) || null;
  }

  update(name, predicate, patch) {
    let changed = 0;
    for (const doc of this.collection(name)) {
      if (predicate(doc)) { Object.assign(doc, patch); changed++; }
    }
    if (changed) this.save();
    return changed;
  }

  remove(name, predicate) {
    const before = this.collection(name).length;
    this.data[name] = this.data[name].filter(doc => !predicate(doc));
    const removed = before - this.data[name].length;
    if (removed) this.save();
    return removed;
  }

  /** Auto-incrementing ids, the friendly way. */
  nextId(name) {
    const counters = this.data.meta.counters;
    counters[name] = (counters[name] || 0) + 1;
    this.save();
    return counters[name];
  }

  get meta() { return this.data.meta; }
}

module.exports = { JsonDatabase };