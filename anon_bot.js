const { Telegraf, Markup } = require('telegraf');

// ============================
const TOKEN = "8468856811:AAEcnj1O6Aw6uRiO1pzwObZcko07N4D50uI";
const ADMIN_ID = 7950449116; // ЗАМЕНИ НА СВОЙ TELEGRAM ID
// ============================

const bot = new Telegraf(TOKEN);

let waitingUsers = [];
let activeChats = {};
let blockedUsers = new Set();
let reports = [];
let dailyChats = 0;
let totalOnline = 0;

// Сброс счётчика каждый день
setInterval(() => { dailyChats = 0; }, 24 * 60 * 60 * 1000);

// Меню когда НЕ в чате
const mainMenu = Markup.keyboard([
  ['🔍 Найти собеседника'],
  ['📊 Онлайн', '❓ Помощь'],
  ['📩 Связаться с менеджером']
]).resize();

// Меню когда В чате
const chatMenu = Markup.keyboard([
  ['❌ Завершить чат', '⏭ Следующий'],
  ['🚫 Пожаловаться']
]).resize();

// Проверка блокировки
const isBlocked = (userId) => blockedUsers.has(userId);

// /start
bot.start((ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return ctx.reply("🚫 Ты заблокирован в этом боте.");
  ctx.reply(
    "🎭 Добро пожаловать в анонимный чат!\n\n" +
    "Здесь ты можешь общаться с незнакомцами — никто не узнает кто ты.\n\n" +
    "📌 Команды:\n" +
    "🔍 /search — найти собеседника\n" +
    "❌ /stop — завершить чат\n" +
    "⏭ /next — следующий собеседник\n" +
    "❓ /help — помощь\n\n" +
    "Нажми кнопку ниже чтобы начать! 👇",
    mainMenu
  );
});

// /help
bot.command('help', (ctx) => {
  ctx.reply(
    "❓ Помощь\n\n" +
    "🔍 /search — найти случайного собеседника\n" +
    "❌ /stop — завершить текущий чат\n" +
    "⏭ /next — найти следующего собеседника\n" +
    "🚫 Пожаловаться — пожаловаться на собеседника\n" +
    "📩 Связаться с менеджером — написать администратору\n" +
    "📊 Онлайн — посмотреть сколько людей онлайн\n\n" +
    "По всем вопросам: кнопка 📩 Связаться с менеджером"
  );
});

// Онлайн
const getOnlineCount = () => {
  return waitingUsers.length + Object.keys(activeChats).length;
};

// Поиск
const doSearch = (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return ctx.reply("🚫 Ты заблокирован.");
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);
  if (waitingUsers.includes(userId)) return ctx.reply("⏳ Ты уже в очереди...");

  if (waitingUsers.length > 0) {
    const partnerId = waitingUsers.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;

    bot.telegram.sendMessage(partnerId,
      "✅ Собеседник найден! Общайтесь анонимно 🎭\n/stop чтобы выйти", chatMenu);
    ctx.reply("✅ Собеседник найден! Общайтесь анонимно 🎭\n/stop чтобы выйти", chatMenu);
  } else {
    waitingUsers.push(userId);
    ctx.reply(`🔍 Ищем собеседника...\n👥 Сейчас онлайн: ${getOnlineCount()} чел.`);
  }
};

// Стоп
const doStop = (ctx) => {
  const userId = ctx.from.id;

  if (waitingUsers.includes(userId)) {
    waitingUsers = waitingUsers.filter(id => id !== userId);
    return ctx.reply("❌ Поиск отменён.", mainMenu);
  }

  if (activeChats[userId]) {
    const partnerId = activeChats[userId];
    delete activeChats[userId];
    delete activeChats[partnerId];
    bot.telegram.sendMessage(partnerId,
      "❌ Собеседник завершил чат.\nНажми 🔍 для нового.", mainMenu);
    ctx.reply("❌ Чат завершён.", mainMenu);
  } else {
    ctx.reply("Ты не в чате. Нажми 🔍!", mainMenu);
  }
};

// Следующий
const doNext = (ctx) => {
  const userId = ctx.from.id;

  if (activeChats[userId]) {
    const partnerId = activeChats[userId];
    delete activeChats[userId];
    delete activeChats[partnerId];
    bot.telegram.sendMessage(partnerId,
      "❌ Собеседник вышел.\nНажми 🔍 для нового.", mainMenu);
  }

  if (waitingUsers.length > 0) {
    const partnerId = waitingUsers.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;
    bot.telegram.sendMessage(partnerId, "✅ Собеседник найден!", chatMenu);
    ctx.reply("✅ Новый собеседник найден!", chatMenu);
  } else {
    waitingUsers.push(userId);
    ctx.reply("🔍 Ищем нового собеседника...");
  }
};

// Команды
bot.command('search', doSearch);
bot.command('stop', doStop);
bot.command('next', doNext);

// Кнопки меню
bot.hears('🔍 Найти собеседника', doSearch);
bot.hears('❌ Завершить чат', doStop);
bot.hears('⏭ Следующий', doNext);

// Онлайн кнопка
bot.hears('📊 Онлайн', (ctx) => {
  ctx.reply(`👥 Сейчас онлайн: ${getOnlineCount()} человек`);
});

// Помощь кнопка
bot.hears('❓ Помощь', (ctx) => {
  ctx.reply(
    "❓ Помощь\n\n" +
    "🔍 Найти собеседника — начать поиск\n" +
    "❌ Завершить чат — выйти из диалога\n" +
    "⏭ Следующий — найти другого собеседника\n" +
    "🚫 Пожаловаться — пожаловаться на собеседника\n" +
    "📩 Связаться с менеджером — написать администратору"
  );
});

// Связь с менеджером
bot.hears('📩 Связаться с менеджером', (ctx) => {
  const userId = ctx.from.id;
  ctx.reply("📩 Напиши своё сообщение и я передам его менеджеру.\n\nОтправь текст прямо сейчас:");
  // Ставим флаг что ждём сообщение
  ctx.session = ctx.session || {};
  waitingForManager = waitingForManager || {};
  waitingForManager[userId] = true;
});

// Хранилище для ожидающих сообщений менеджеру
let waitingForManager = {};

// Жалоба
bot.hears('🚫 Пожаловаться', (ctx) => {
  const userId = ctx.from.id;
  if (!activeChats[userId]) return ctx.reply("Ты не в чате.", mainMenu);
  waitingForReport = waitingForReport || {};
  waitingForReport[userId] = true;
  ctx.reply("🚫 Опишите вашу жалобу на собеседника.\n\nНапример: спам, оскорбления, неприемлемый контент.\n\nНапишите текст жалобы:");
});

let waitingForReport = {};

// Админ команды
bot.command('stats', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  ctx.reply(
    `📊 Статистика за сегодня:\n\n` +
    `💬 Диалогов за день: ${dailyChats}\n` +
    `👥 Сейчас онлайн: ${getOnlineCount()}\n` +
    `⏳ В очереди: ${waitingUsers.length}\n` +
    `🔴 Заблокировано: ${blockedUsers.size}\n` +
    `🚫 Жалоб: ${reports.length}`
  );
});

bot.command('ban', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  const args = ctx.message.text.split(' ');
  if (!args[1]) return ctx.reply("Использование: /ban USER_ID");
  const banId = parseInt(args[1]);
  blockedUsers.add(banId);

  // Выгоняем из чата если там
  if (activeChats[banId]) {
    const partnerId = activeChats[banId];
    delete activeChats[banId];
    delete activeChats[partnerId];
    bot.telegram.sendMessage(partnerId, "❌ Собеседник покинул чат.", mainMenu).catch(() => {});
  }
  waitingUsers = waitingUsers.filter(id => id !== banId);
  bot.telegram.sendMessage(banId, "🚫 Ты заблокирован администратором.").catch(() => {});
  ctx.reply(`✅ Пользователь ${banId} заблокирован.`);
});

bot.command('unban', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  const args = ctx.message.text.split(' ');
  if (!args[1]) return ctx.reply("Использование: /unban USER_ID");
  const unbanId = parseInt(args[1]);
  blockedUsers.delete(unbanId);
  bot.telegram.sendMessage(unbanId, "✅ Ты разблокирован! Добро пожаловать обратно.").catch(() => {});
  ctx.reply(`✅ Пользователь ${unbanId} разблокирован.`);
});

bot.command('reports', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  if (reports.length === 0) return ctx.reply("📭 Жалоб нет.");
  const text = reports.map((r, i) =>
    `${i+1}. От: ${r.from} на: ${r.on}\nТекст: ${r.text}\n`
  ).join('\n');
  ctx.reply(`🚫 Жалобы:\n\n${text}`);
});

// Пересылка сообщений
bot.on('message', async (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return;

  // Ожидаем жалобу
  if (waitingForReport && waitingForReport[userId]) {
    delete waitingForReport[userId];
    const partnerId = activeChats[userId];
    const reportText = ctx.message.text || "Без текста";

    reports.push({ from: userId, on: partnerId || "неизвестен", text: reportText });

    // Уведомляем админа
    bot.telegram.sendMessage(ADMIN_ID,
      `🚫 Новая жалоба!\n\n` +
      `От: ${userId} (@${ctx.from.username || 'нет'})\n` +
      `На: ${partnerId || 'неизвестен'}\n` +
      `Текст: ${reportText}\n\n` +
      `Чтобы забанить: /ban ${partnerId}`
    ).catch(() => {});

    return ctx.reply("✅ Жалоба отправлена администратору. Спасибо!", chatMenu);
  }

  // Ожидаем сообщение менеджеру
  if (waitingForManager && waitingForManager[userId]) {
    delete waitingForManager[userId];
    const msgText = ctx.message.text || "Без текста";
    const username = ctx.from.username ? `@${ctx.from.username}` : "нет username";
    const firstName = ctx.from.first_name || "";

    bot.telegram.sendMessage(ADMIN_ID,
      `📩 Сообщение от пользователя!\n\n` +
      `👤 Имя: ${firstName}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 ID: ${userId}\n\n` +
      `💬 Сообщение:\n${msgText}\n\n` +
      `Профиль: tg://user?id=${userId}`
    ).catch(() => {});

    return ctx.reply("✅ Сообщение отправлено менеджеру! Он скоро ответит.", mainMenu);
  }

  // Обычная пересылка в чате
  if (!activeChats[userId]) {
    return ctx.reply("Нажми 🔍 чтобы найти собеседника!", mainMenu);
  }
  const partnerId = activeChats[userId];
  const msg = ctx.message;

  try {
    if (msg.text) await bot.telegram.sendMessage(partnerId, msg.text);
    else if (msg.photo) await bot.telegram.sendPhoto(partnerId, msg.photo[msg.photo.length-1].file_id, { caption: msg.caption||"" });
    else if (msg.sticker) await bot.telegram.sendSticker(partnerId, msg.sticker.file_id);
    else if (msg.voice) await bot.telegram.sendVoice(partnerId, msg.voice.file_id);
    else if (msg.video) await bot.telegram.sendVideo(partnerId, msg.video.file_id, { caption: msg.caption||"" });
    else if (msg.document) await bot.telegram.sendDocument(partnerId, msg.document.file_id, { caption: msg.caption||"" });
    else if (msg.audio) await bot.telegram.sendAudio(partnerId, msg.audio.file_id, { caption: msg.caption||"" });
  } catch(e) {
    delete activeChats[userId];
    delete activeChats[partnerId];
    ctx.reply("⚠️ Собеседник недоступен. Чат завершён.", mainMenu);
  }
});

bot.launch();
console.log("✅ Бот запущен!");
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));