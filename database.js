const Database = require('better-sqlite3');

const db = new Database('database.db');

// создаём таблицу пользователей
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  gender TEXT,
  vip_expiry INTEGER DEFAULT 0,
  chats INTEGER DEFAULT 0,
  referrals INTEGER DEFAULT 0
);
`);

console.log("SQLite подключена ✅");

module.exports = db;console.log("SQLite test") 
