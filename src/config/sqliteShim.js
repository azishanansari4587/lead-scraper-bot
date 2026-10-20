// Lightweight sqlite3-compatible wrapper around better-sqlite3 for Sequelize on Node 24+
const BetterSqlite3 = require('better-sqlite3');

function sanitizeValue(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && !(val instanceof Buffer)) {
    return JSON.stringify(val);
  }
  return val;
}

function formatParams(params) {
  if (!params) return [];
  if (Array.isArray(params)) {
    return params.map(sanitizeValue);
  }
  if (typeof params === 'object') {
    const formatted = {};
    for (const key of Object.keys(params)) {
      const sanitized = sanitizeValue(params[key]);
      const cleanKey = key.startsWith('$') || key.startsWith(':') || key.startsWith('@')
        ? key.slice(1)
        : key;
      formatted[cleanKey] = sanitized;
      formatted[key] = sanitized;
    }
    return formatted;
  }
  return sanitizeValue(params);
}

class DatabaseShim {
  constructor(filename, mode, callback) {
    if (typeof mode === 'function') {
      callback = mode;
      mode = null;
    }
    try {
      this.db = new BetterSqlite3(filename);
      if (callback) process.nextTick(() => callback(null));
    } catch (err) {
      if (callback) process.nextTick(() => callback(err));
    }
  }

  close(callback) {
    try {
      this.db.close();
      if (callback) process.nextTick(() => callback(null));
    } catch (err) {
      if (callback) process.nextTick(() => callback(err));
    }
  }

  serialize(callback) {
    if (callback) callback();
  }

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const stmt = this.db.prepare(sql);
      const args = formatParams(params);
      let rows = [];
      if (stmt.reader) {
        rows = Array.isArray(args) ? stmt.all(...args) : stmt.all(args);
      } else {
        if (Array.isArray(args)) stmt.run(...args);
        else stmt.run(args);
      }
      if (callback) process.nextTick(() => callback(null, rows));
    } catch (err) {
      if (callback) process.nextTick(() => callback(err));
    }
  }

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const stmt = this.db.prepare(sql);
      const args = formatParams(params);
      let context = { lastID: 0, changes: 0 };
      if (!stmt.reader) {
        const result = Array.isArray(args) ? stmt.run(...args) : stmt.run(args);
        context = {
          lastID: Number(result.lastInsertRowid),
          changes: result.changes
        };
      } else {
        if (Array.isArray(args)) stmt.all(...args);
        else stmt.all(args);
      }
      if (callback) process.nextTick(() => callback.call(context, null));
    } catch (err) {
      if (callback) process.nextTick(() => callback(err));
    }
  }

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const stmt = this.db.prepare(sql);
      const args = formatParams(params);
      let row = null;
      if (stmt.reader) {
        row = Array.isArray(args) ? stmt.get(...args) : stmt.get(args);
      } else {
        if (Array.isArray(args)) stmt.run(...args);
        else stmt.run(args);
      }
      if (callback) process.nextTick(() => callback(null, row));
    } catch (err) {
      if (callback) process.nextTick(() => callback(err));
    }
  }

  exec(sql, callback) {
    try {
      this.db.exec(sql);
      if (callback) process.nextTick(() => callback(null));
    } catch (err) {
      if (callback) process.nextTick(() => callback(err));
    }
  }
}

module.exports = {
  Database: DatabaseShim,
  verbose: () => module.exports
};
