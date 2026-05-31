const { Telegraf, Markup } = require('telegraf');

// ============================
const TOKEN = "8468856811:AAEcnj1O6Aw6uRiO1pzwObZcko07N4D50uI";
const ADMIN_ID = 7950449116;
const ADMIN_USERNAME = "fominya7";
const TIMEZONE_OFFSET = 3; // UTC+3 (Москва). Турция = UTC+3 тоже
// ============================

const bot = new Telegraf(TOKEN);

let waitingUsers = [];
let waitingForMale = [];   // девушки которые ищут парня
let waitingForFemale = []; // парни которые ищут девушку
let activeChats = {};
let blockedUsers = new Set();
let reports = [];
let dailyChats = 0;
let waitingForManager = {};
let waitingForReport = {};
let waitingForGenderSetup = {}; // ждём выбор своего пола при старте

// userProfiles: { userId: { gender: 'male'|'female' } }
let userProfiles = {};

// subscriptions: { userId: { expiry: timestamp } }
let subscriptions = {};

// userStats: { userId: { chats: 0, referrals: 0 } }
let userStats = {};

// referralCodes: { 'ref_userId': userId }
let referralCodes = {};

setInterval(() => { dailyChats = 0; }, 24 * 60 * 60 * 1000);

// ===== HELPERS =====

const isBlocked = (userId) => blockedUsers.has(userId);

const getOnlineCount = () =>
  waitingUsers.length + waitingForMale.length + waitingForFemale.length + Object.keys(activeChats).length;

const hasVIP = (userId) => {
  const sub = subscriptions[userId];
  if (!sub) return false;
  return Date.now() < sub.expiry;
};

const getVIPExpiryStr = (userId) => {
  const sub = subscriptions[userId];
  if (!sub) return null;
  const date = new Date(sub.expiry + TIMEZONE_OFFSET * 60 * 60 * 1000);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const mins = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
};

const addVIPTime = (userId, hours) => {
  const now = Date.now();
  if (hasVIP(userId)) {
    subscriptions[userId].expiry += hours * 60 * 60 * 1000;
  } else {
    subscriptions[userId] = { expiry: now + hours * 60 * 60 * 1000 };
  }
};

const getReferralCode = (userId) => {
  for (const [code, id] of Object.entries(referralCodes)) {
    if (id === userId) return code;
  }
  const code = `ref_${userId}`;
  referralCodes[code] = userId;
  return code;
};

const initUserStats = (userId) => {
  if (!userStats[userId]) userStats[userId] = { chats: 0, referrals: 0 };
};

const getUserGender = (userId) => userProfiles[userId]?.gender || null;

// ===== МЕНЮ =====

const mainMenu = Markup.keyboard([
  ['🔍 Найти собеседника', '👑 VIP поиск'],
  ['📊 Онлайн', '❓ Помощь'],
  ['🎁 Реферальная ссылка', '📩 Связаться с менеджером']
]).resize();

const chatMenu = Markup.keyboard([
  ['❌ Завершить чат', '⏭ Следующий'],
  ['🚫 Пожаловаться']
]).resize();

const genderSetupMenu = Markup.keyboard([
  ['👦 Я парень', '👧 Я девушка']
]).resize();

const vipGenderMenu = Markup.keyboard([
  ['🔍 Искать девушку', '🔍 Искать парня'],
  ['◀️ Назад']
]).resize();

// ===== СТАРТ =====

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return ctx.reply("🚫 Ты заблокирован в этом боте.");
  initUserStats(userId);

  // Реферальная ссылка
  const startParam = ctx.startPayload;
  if (startParam && startParam.startsWith('ref_')) {
    const referrerId = referralCodes[startParam];
    if (referrerId && referrerId !== userId) {
      initUserStats(referrerId);
      userStats[referrerId].referrals++;
      addVIPTime(referrerId, 1);
      bot.telegram.sendMessage(referrerId,
        `🎉 По твоей ссылке пришёл новый пользователь!\n+1 час VIP начислен! 👑`
      ).catch(() => {});
    }
  }

  // Если пол уже выбран — показываем главное меню
  if (getUserGender(userId)) {
    return ctx.reply(
      "🎭 Добро пожаловать обратно!\n\nНажми кнопку чтобы начать! 👇",
      mainMenu
    );
  }

  // Новый пользователь — просим выбрать пол
  waitingForGenderSetup[userId] = true;
  ctx.reply(
    "🎭 Добро пожаловать в анонимный чат!\n\n" +
    "Прежде всего — укажи свой пол.\nЭто нужно для VIP поиска 👇",
    genderSetupMenu
  );
});

// Выбор своего пола
bot.hears('👦 Я парень', (ctx) => {
  const userId = ctx.from.id;
  userProfiles[userId] = { gender: 'male' };
  delete waitingForGenderSetup[userId];
  ctx.reply(
    "✅ Отлично! Ты зарегистрирован как парень 👦\n\n" +
    "🎭 Добро пожаловать в анонимный чат!\n" +
    "👑 VIP подписка — поиск по полу!\n" +
    "🎁 Приглашай друзей — получай VIP бесплатно!\n\n" +
    "Нажми кнопку чтобы начать! 👇",
    mainMenu
  );
});

bot.hears('👧 Я девушка', (ctx) => {
  const userId = ctx.from.id;
  userProfiles[userId] = { gender: 'female' };
  delete waitingForGenderSetup[userId];
  ctx.reply(
    "✅ Отлично! Ты зарегистрирована как девушка 👧\n\n" +
    "🎭 Добро пожаловать в анонимный чат!\n" +
    "👑 VIP подписка — поиск по полу!\n" +
    "🎁 Приглашай друзей — получай VIP бесплатно!\n\n" +
    "Нажми кнопку чтобы начать! 👇",
    mainMenu
  );
});

// ===== ПОИСК =====

const doSearch = (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return ctx.reply("🚫 Ты заблокирован.");
  if (!getUserGender(userId)) {
    waitingForGenderSetup[userId] = true;
    return ctx.reply("Сначала укажи свой пол 👇", genderSetupMenu);
  }
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);
  if (waitingUsers.includes(userId)) return ctx.reply("⏳ Ты уже в очереди...");

  initUserStats(userId);

  if (waitingUsers.length > 0) {
    const partnerId = waitingUsers.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;
    userStats[userId].chats++;
    initUserStats(partnerId);
    userStats[partnerId].chats++;
    bot.telegram.sendMessage(partnerId, "✅ Собеседник найден! Общайтесь анонимно 🎭", chatMenu);
    ctx.reply("✅ Собеседник найден! Общайтесь анонимно 🎭", chatMenu);
  } else {
    waitingUsers.push(userId);
    ctx.reply(`🔍 Ищем собеседника...\n👥 Онлайн: ${getOnlineCount()} чел.`);
  }
};

const doStop = (ctx) => {
  const userId = ctx.from.id;
  waitingUsers = waitingUsers.filter(id => id !== userId);
  waitingForMale = waitingForMale.filter(id => id !== userId);
  waitingForFemale = waitingForFemale.filter(id => id !== userId);

  if (activeChats[userId]) {
    const partnerId = activeChats[userId];
    delete activeChats[userId];
    delete activeChats[partnerId];
    bot.telegram.sendMessage(partnerId, "❌ Собеседник завершил чат.\nНажми 🔍 для нового.", mainMenu);
    ctx.reply("❌ Чат завершён.", mainMenu);
  } else {
    ctx.reply("Ты не в чате. Нажми 🔍!", mainMenu);
  }
};

const doNext = (ctx) => {
  const userId = ctx.from.id;
  if (activeChats[userId]) {
    const partnerId = activeChats[userId];
    delete activeChats[userId];
    delete activeChats[partnerId];
    bot.telegram.sendMessage(partnerId, "❌ Собеседник вышел.\nНажми 🔍 для нового.", mainMenu);
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

// ===== VIP ПОИСК =====

bot.hears('👑 VIP поиск', (ctx) => {
  const userId = ctx.from.id;

  if (!getUserGender(userId)) {
    waitingForGenderSetup[userId] = true;
    return ctx.reply("Сначала укажи свой пол 👇", genderSetupMenu);
  }

  if (!hasVIP(userId)) {
    return ctx.reply(
      "👑 VIP подписка\n\n" +
      "Поиск по полу доступен только VIP пользователям.\n\n" +
      "💫 Стоимость: 100 ⭐ за 7 дней\n" +
      "🎁 Или пригласи друга и получи 1 час бесплатно!\n\n" +
      "Нажми чтобы оплатить 👇",
      Markup.inlineKeyboard([[Markup.button.callback("💳 Купить 100 ⭐ / 7 дней", "buy_vip")]])
    );
  }

  const gender = getUserGender(userId);
  const genderLabel = gender === 'male' ? '👦 Парень' : '👧 Девушка';
  ctx.reply(
    `👑 VIP активен до: ${getVIPExpiryStr(userId)}\n` +
    `Твой пол: ${genderLabel}\n\n` +
    `Кого ищешь?`,
    vipGenderMenu
  );
});

// VIP — искать девушку (значит пользователь парень)
bot.hears('🔍 Искать девушку', (ctx) => {
  const userId = ctx.from.id;
  if (!hasVIP(userId)) return ctx.reply("👑 Нужна VIP подписка!", mainMenu);
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);

  // Ищем в очереди девушек которые ищут парня
  if (waitingForMale.length > 0) {
    const partnerId = waitingForMale.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;
    bot.telegram.sendMessage(partnerId, "✅ Найден собеседник! Общайтесь анонимно 🎭", chatMenu);
    ctx.reply("✅ Найдена собеседница! Общайтесь анонимно 🎭", chatMenu);
  } else {
    // Добавляем в очередь парней которые ищут девушку
    if (!waitingForFemale.includes(userId)) waitingForFemale.push(userId);
    ctx.reply("🔍 Ищем собеседницу...\nКак только появится девушка — соединим!");
  }
});

// VIP — искать парня (значит пользователь девушка)
bot.hears('🔍 Искать парня', (ctx) => {
  const userId = ctx.from.id;
  if (!hasVIP(userId)) return ctx.reply("👑 Нужна VIP подписка!", mainMenu);
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);

  // Ищем в очереди парней которые ищут девушку
  if (waitingForFemale.length > 0) {
    const partnerId = waitingForFemale.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;
    bot.telegram.sendMessage(partnerId, "✅ Найдена собеседница! Общайтесь анонимно 🎭", chatMenu);
    ctx.reply("✅ Найден собеседник! Общайтесь анонимно 🎭", chatMenu);
  } else {
    // Добавляем в очередь девушек которые ищут парня
    if (!waitingForMale.includes(userId)) waitingForMale.push(userId);
    ctx.reply("🔍 Ищем собеседника...\nКак только появится парень — соединим!");
  }
});

bot.hears('◀️ Назад', (ctx) => ctx.reply("Главное меню 👇", mainMenu));

// Оплата
bot.action('buy_vip', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithInvoice({
    title: "👑 VIP подписка — 7 дней",
    description: "Поиск собеседника по полу на 7 дней",
    payload: "vip_7days",
    currency: "XTR",
    prices: [{ label: "VIP 7 дней", amount: 100 }]
  });
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', (ctx) => {
  const userId = ctx.from.id;
  addVIPTime(userId, 7 * 24);
  ctx.reply(
    `✅ Оплата прошла! Добро пожаловать в VIP! 👑\n\n` +
    `Подписка активна до: ${getVIPExpiryStr(userId)}\n\n` +
    `Нажми 👑 VIP поиск чтобы начать!`,
    mainMenu
  );
  bot.telegram.sendMessage(ADMIN_ID, `💰 Оплата!\n👤 ID: ${userId}\n💫 100 Stars — VIP 7 дней`).catch(() => {});
});

// ===== РЕФЕРАЛЬНАЯ СИСТЕМА =====

bot.hears('🎁 Реферальная ссылка', async (ctx) => {
  const userId = ctx.from.id;
  initUserStats(userId);
  const code = getReferralCode(userId);
  const botInfo = await bot.telegram.getMe();
  ctx.reply(
    `🎁 Твоя реферальная ссылка:\n\n` +
    `https://t.me/${botInfo.username}?start=${code}\n\n` +
    `За каждого друга — +1 час VIP! 👑\n\n` +
    `👥 Приглашено: ${userStats[userId].referrals}\n` +
    `💬 Диалогов: ${userStats[userId].chats}`
  );
});

// ===== КНОПКИ =====

bot.command('search', doSearch);
bot.command('stop', doStop);
bot.command('next', doNext);
bot.command('help', (ctx) => ctx.reply(
  "❓ Помощь\n\n" +
  "🔍 Найти собеседника — случайный поиск\n" +
  "👑 VIP поиск — поиск по полу\n" +
  "❌ Завершить чат — выйти\n" +
  "⏭ Следующий — другой собеседник\n" +
  "🚫 Пожаловаться — жалоба\n" +
  "🎁 Реферальная ссылка — пригласи друга\n" +
  "📩 Связаться с менеджером — написать администратору"
));

bot.hears('🔍 Найти собеседника', doSearch);
bot.hears('❌ Завершить чат', doStop);
bot.hears('⏭ Следующий', doNext);
bot.hears('📊 Онлайн', (ctx) => ctx.reply(`👥 Сейчас онлайн: ${getOnlineCount()} человек`));
bot.hears('❓ Помощь', (ctx) => ctx.reply(
  "❓ Помощь\n\n" +
  "🔍 Найти собеседника — случайный поиск\n" +
  "👑 VIP поиск — поиск по полу\n" +
  "❌ Завершить чат — выйти\n" +
  "⏭ Следующий — другой собеседник\n" +
  "🎁 Реферальная ссылка — пригласи друга\n" +
  "📩 Связаться с менеджером"
));

bot.hears('📩 Связаться с менеджером', (ctx) => {
  waitingForManager[ctx.from.id] = true;
  ctx.reply("📩 Напиши сообщение — менеджер ответит лично.\n\n⚠️ Если нет username — укажи его в сообщении.\n\nОтправь текст:");
});

bot.hears('🚫 Пожаловаться', (ctx) => {
  const userId = ctx.from.id;
  if (!activeChats[userId]) return ctx.reply("Ты не в чате.", mainMenu);
  waitingForReport[userId] = true;
  ctx.reply("🚫 Опишите жалобу:\n\nНапример: спам, оскорбления, неприемлемый контент.");
});

// ===== АДМИН =====

bot.command('stats', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  ctx.reply(
    `📊 Статистика:\n\n` +
    `💬 Диалогов за день: ${dailyChats}\n` +
    `👥 Онлайн: ${getOnlineCount()}\n` +
    `⏳ Обычная очередь: ${waitingUsers.length}\n` +
    `👦 Ищут девушку: ${waitingForFemale.length}\n` +
    `👧 Ищут парня: ${waitingForMale.length}\n` +
    `👑 VIP пользователей: ${Object.keys(subscriptions).length}\n` +
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
  if (activeChats[banId]) {
    const partnerId = activeChats[banId];
    delete activeChats[banId];
    delete activeChats[partnerId];
    bot.telegram.sendMessage(partnerId, "❌ Собеседник покинул чат.", mainMenu).catch(() => {});
  }
  waitingUsers = waitingUsers.filter(id => id !== banId);
  waitingForMale = waitingForMale.filter(id => id !== banId);
  waitingForFemale = waitingForFemale.filter(id => id !== banId);
  bot.telegram.sendMessage(banId, "🚫 Ты заблокирован администратором.").catch(() => {});
  ctx.reply(`✅ Пользователь ${banId} заблокирован.`);
});

bot.command('unban', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  const args = ctx.message.text.split(' ');
  if (!args[1]) return ctx.reply("Использование: /unban USER_ID");
  const unbanId = parseInt(args[1]);
  blockedUsers.delete(unbanId);
  bot.telegram.sendMessage(unbanId, "✅ Ты разблокирован!").catch(() => {});
  ctx.reply(`✅ Пользователь ${unbanId} разблокирован.`);
});

bot.command('givevip', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  const args = ctx.message.text.split(' ');
  if (!args[1] || !args[2]) return ctx.reply("Использование: /givevip USER_ID ЧАСЫ");
  const targetId = parseInt(args[1]);
  const hours = parseInt(args[2]);
  addVIPTime(targetId, hours);
  bot.telegram.sendMessage(targetId, `👑 Администратор выдал тебе ${hours} часов VIP!`).catch(() => {});
  ctx.reply(`✅ Выдано ${hours} часов VIP пользователю ${targetId}.`);
});

bot.command('reports', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Нет доступа.");
  if (reports.length === 0) return ctx.reply("📭 Жалоб нет.");
  const text = reports.map((r, i) => `${i+1}. От: ${r.from} на: ${r.on}\nТекст: ${r.text}`).join('\n\n');
  ctx.reply(`🚫 Жалобы:\n\n${text}`);
});

// ===== ПЕРЕСЫЛКА =====

bot.on('message', async (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return;

  // Ждём выбор пола
  if (waitingForGenderSetup[userId]) {
    return ctx.reply("Пожалуйста, выбери свой пол 👇", genderSetupMenu);
  }

  // Жалоба
  if (waitingForReport[userId]) {
    delete waitingForReport[userId];
    const partnerId = activeChats[userId];
    const reportText = ctx.message.text || "Без текста";
    reports.push({ from: userId, on: partnerId || "неизвестен", text: reportText });
    bot.telegram.sendMessage(ADMIN_ID,
      `🚫 Жалоба!\nОт: ${userId} (@${ctx.from.username || 'нет'})\nНа: ${partnerId || 'неизвестен'}\nТекст: ${reportText}\nЗабанить: /ban ${partnerId}`
    ).catch(() => {});
    return ctx.reply("✅ Жалоба отправлена. Спасибо!", chatMenu);
  }

  // Сообщение менеджеру
  if (waitingForManager[userId]) {
    delete waitingForManager[userId];
    const msgText = ctx.message.text || "Без текста";
    const username = ctx.from.username ? `@${ctx.from.username}` : "нет username";
    const firstName = ctx.from.first_name || "Без имени";
    await bot.telegram.sendMessage(ADMIN_ID,
      `📩 Сообщение!\n\n👤 ${firstName}\n🔗 ${username}\n🆔 ${userId}\n\n💬 ${msgText}`,
      ctx.from.username ? {
        reply_markup: { inline_keyboard: [[{ text: "💬 Написать", url: `https://t.me/${ctx.from.username}` }]] }
      } : {}
    ).catch(() => {});
    return ctx.reply(`✅ Сообщение отправлено!\nМенеджер ответит: @${ADMIN_USERNAME}`, mainMenu);
  }

  // Пересылка в чате
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
