const { Telegraf } = require('telegraf');
const db = require('./database');

const TOKEN = "8899743634:AAHrYMRQmasuhNR7-hDvOBZ4m73NPZLrx3g";
const ADMIN_ID = 7950449116;

const bot = new Telegraf(TOKEN);

// ===================== STATE =====================
let waitingUsers = [];
let activeChats = {};

// ===================== DB =====================
const ensureUser = (id) => {
  db.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`).run(id);
};

const isBlocked = (id) => {
  const u = db.prepare(`SELECT blocked FROM users WHERE id=?`).get(id);
  return u?.blocked === 1;
};

const setBlocked = (id, val) => {
  db.prepare(`UPDATE users SET blocked=? WHERE id=?`).run(val ? 1 : 0, id);
};

// ===================== START =====================
bot.start((ctx) => {
  const id = ctx.from.id;
  ensureUser(id);

  ctx.reply("🎭 Бот запущен\n\n/search — найти собеседника");
});

// ===================== SEARCH =====================
bot.command('search', (ctx) => {
  const id = ctx.from.id;

  if (isBlocked(id)) return ctx.reply("🚫 Заблокирован");
  ensureUser(id);

  if (activeChats[id]) {
    return ctx.reply("⚠️ Ты уже в чате");
  }

  if (waitingUsers.length > 0) {
    const partner = waitingUsers.shift();

    activeChats[id] = partner;
    activeChats[partner] = id;

    ctx.reply("✅ Собеседник найден");
    bot.telegram.sendMessage(partner, "✅ Собеседник найден");
  } else {
    waitingUsers.push(id);
    ctx.reply("🔍 Поиск собеседника...");
  }
});

// ===================== STOP =====================
bot.command('stop', (ctx) => {
  const id = ctx.from.id;

  const partner = activeChats[id];

  if (partner) {
    delete activeChats[id];
    delete activeChats[partner];

    bot.telegram.sendMessage(partner, "❌ Чат завершён");
  }

  ctx.reply("🛑 Чат остановлен");
});

// ===================== MESSAGE =====================
bot.on('message', async (ctx) => {
  const id = ctx.from.id;

  if (isBlocked(id)) return;

  const partner = activeChats[id];
  if (!partner) return;

  const msg = ctx.message;

  try {
    if (msg.text) {
      await bot.telegram.sendMessage(partner, msg.text);
    } else if (msg.photo) {
      await bot.telegram.sendPhoto(partner, msg.photo.at(-1).file_id);
    } else if (msg.sticker) {
      await bot.telegram.sendSticker(partner, msg.sticker.file_id);
    } else if (msg.voice) {
      await bot.telegram.sendVoice(partner, msg.voice.file_id);
    } else if (msg.video) {
      await bot.telegram.sendVideo(partner, msg.video.file_id);
    } else if (msg.document) {
      await bot.telegram.sendDocument(partner, msg.document.file_id);
    }
  } catch (e) {
    delete activeChats[id];
    delete activeChats[partner];
  }
});

// ===================== ADMIN =====================
bot.command('testdb', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("⛔ Нет доступа");
  }

  try {
    const row = db.prepare('SELECT 1 as ok').get();
    ctx.reply("DB OK: " + row.ok);
  } catch (e) {
    ctx.reply("DB ERROR: " + e.message);
  }
});

// ===================== LAUNCH =====================
bot.launch();
console.log("✅ Bot started");
