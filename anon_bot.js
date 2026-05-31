const { Telegraf, Markup } = require('telegraf');

// ============================
const TOKEN = "8468856811:AAEcnj1O6Aw6uRiO1pzwObZcko07N4D50uI";
const ADMIN_ID = 7950449116; // ЗАМЕНИ НА СВОЙ TELEGRAM ID
const ADMIN_USERNAME = "fominya7"; // ЗАМЕНИ НА СВОЙ USERNAME (без @)
// ============================

const bot = new Telegraf(TOKEN);

let waitingUsers = [];
let waitingMale = [];
let waitingFemale = [];
let activeChats = {};
let blockedUsers = new Set();
let reports = [];
let dailyChats = 0;
let waitingForManager = {};
let waitingForReport = {};
let waitingForGender = {}; // ждём выбор пола при VIP поиске

// Подписки: { userId: { expiry: Date, gender: 'male'|'female'|null } }
let subscriptions = {};

// Статистика пользователей: { userId: { chats: 0, referrals: 0 } }
let userStats = {};

// Рефералы: { referralCode: userId }
let referralCodes = {};

setInterval(() => { dailyChats = 0; }, 24 * 60 * 60 * 1000);

// ===== HELPERS =====

const isBlocked = (userId) => blockedUsers.has(userId);

const getOnlineCount = () =>
  waitingUsers.length + waitingMale.length + waitingFemale.length + Object.keys(activeChats).length;

const hasVIP = (userId) => {
  const sub = subscriptions[userId];
  if (!sub) return false;
  return new Date() < new Date(sub.expiry);
};

const getVIPExpiry = (userId) => {
  const sub = subscriptions[userId];
  if (!sub) return null;
  return new Date(sub.expiry);
};

const addVIPTime = (userId, hours) => {
  const now = new Date();
  if (hasVIP(userId)) {
    subscriptions[userId].expiry = new Date(new Date(subscriptions[userId].expiry).getTime() + hours * 60 * 60 * 1000);
  } else {
    subscriptions[userId] = { expiry: new Date(now.getTime() + hours * 60 * 60 * 1000) };
  }
};

const getReferralCode = (userId) => {
  // Ищем существующий код
  for (const [code, id] of Object.entries(referralCodes)) {
    if (id === userId) return code;
  }
  // Создаём новый
  const code = `ref_${userId}`;
  referralCodes[code] = userId;
  return code;
};

const initUserStats = (userId) => {
  if (!userStats[userId]) userStats[userId] = { chats: 0, referrals: 0 };
};

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

const genderMenu = Markup.keyboard([
  ['👦 Парень', '👧 Девушка'],
  ['❌ Отмена']
]).resize();

// ===== СТАРТ =====

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return ctx.reply("🚫 Ты заблокирован в этом боте.");
  initUserStats(userId);

  // Проверяем реферальную ссылку
  const startParam = ctx.startPayload;
  if (startParam && startParam.startsWith('ref_')) {
    const referrerId = referralCodes[startParam];
    if (referrerId && referrerId !== userId) {
      initUserStats(referrerId);
      userStats[referrerId].referrals++;
      addVIPTime(referrerId, 1);
      bot.telegram.sendMessage(referrerId,
        `🎉 По твоей ссылке пришёл новый пользователь!\n` +
        `+1 час VIP подписки начислен! 👑`
      ).catch(() => {});
    }
  }

  ctx.reply(
    "🎭 Добро пожаловать в анонимный чат!\n\n" +
    "Здесь ты можешь общаться с незнакомцами — никто не узнает кто ты.\n\n" +
    "👑 VIP подписка — поиск по полу!\n" +
    "🎁 Приглашай друзей — получай VIP бесплатно!\n\n" +
    "Нажми кнопку ниже чтобы начать! 👇",
    mainMenu
  );
});

// ===== HELP =====

bot.command('help', (ctx) => {
  ctx.reply(
    "❓ Помощь\n\n" +
    "🔍 Найти собеседника — случайный поиск\n" +
    "👑 VIP поиск — поиск по полу (подписка)\n" +
    "❌ Завершить чат — выйти из диалога\n" +
    "⏭ Следующий — найти другого\n" +
    "🚫 Пожаловаться — жалоба на собеседника\n" +
    "🎁 Реферальная ссылка — пригласи друга, получи 1 час VIP\n" +
    "📊 Онлайн — сколько людей онлайн\n" +
    "📩 Связаться с менеджером — написать администратору"
  );
});

// ===== ПОИСК =====

const doSearch = (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return ctx.reply("🚫 Ты заблокирован.");
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);
  if (waitingUsers.includes(userId) || waitingMale.includes(userId) || waitingFemale.includes(userId))
    return ctx.reply("⏳ Ты уже в очереди...");

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
  waitingMale = waitingMale.filter(id => id !== userId);
  waitingFemale = waitingFemale.filter(id => id !== userId);

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
    userStats[userId].chats++;
    bot.telegram.sendMessage(partnerId, "✅ Собеседник найден!", chatMenu);
    ctx.reply("✅ Новый собеседник найден!", chatMenu);
  } else {
    waitingUsers.push(userId);
    ctx.reply("🔍 Ищем нового собеседника...");
  }
};

// ===== VIP ПОИСК ПО ПОЛУ =====

bot.hears('👑 VIP поиск', (ctx) => {
  const userId = ctx.from.id;

  if (!hasVIP(userId)) {
    return ctx.reply(
      "👑 VIP подписка\n\n" +
      "Поиск по полу доступен только VIP пользователям.\n\n" +
      "💫 Стоимость: 100 ⭐ за 7 дней\n" +
      "🎁 Или пригласи друга и получи 1 час бесплатно!\n\n" +
      "Нажми кнопку чтобы оплатить 👇",
      Markup.inlineKeyboard([
        [Markup.button.callback("💳 Купить 100 ⭐ / 7 дней", "buy_vip")]
      ])
    );
  }

  const expiry = getVIPExpiry(userId);
  const expiryStr = expiry.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  ctx.reply(
    `👑 VIP активен до: ${expiryStr}\n\n` +
    `Выбери кого ищешь:`,
    genderMenu
  );
});

// Обработка покупки VIP
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

// Предпроверка платежа
bot.on('pre_checkout_query', (ctx) => {
  ctx.answerPreCheckoutQuery(true);
});

// Успешная оплата
bot.on('successful_payment', (ctx) => {
  const userId = ctx.from.id;
  addVIPTime(userId, 7 * 24);
  const expiry = getVIPExpiry(userId);
  const expiryStr = expiry.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

  ctx.reply(
    `✅ Оплата прошла! Добро пожаловать в VIP! 👑\n\n` +
    `Подписка активна до: ${expiryStr}\n\n` +
    `Теперь нажми 👑 VIP поиск чтобы найти собеседника по полу!`,
    mainMenu
  );

  bot.telegram.sendMessage(ADMIN_ID,
    `💰 Новая оплата!\n👤 ID: ${userId}\n💫 100 Stars — VIP 7 дней`
  ).catch(() => {});
});

// Выбор пола
bot.hears('👦 Парень', (ctx) => {
  const userId = ctx.from.id;
  if (!hasVIP(userId)) return ctx.reply("👑 Нужна VIP подписка!", mainMenu);
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);

  // Ищем девушку
  if (waitingFemale.length > 0) {
    const partnerId = waitingFemale.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;
    bot.telegram.sendMessage(partnerId, "✅ Найден собеседник! Общайтесь анонимно 🎭", chatMenu);
    ctx.reply("✅ Найдена собеседница! Общайтесь анонимно 🎭", chatMenu);
  } else {
    waitingMale.push(userId);
    ctx.reply("🔍 Ищем собеседницу...\nОжидай — как только появится девушка, соединим!", chatMenu.reply_markup ? chatMenu : mainMenu);
  }
});

bot.hears('👧 Девушка', (ctx) => {
  const userId = ctx.from.id;
  if (!hasVIP(userId)) return ctx.reply("👑 Нужна VIP подписка!", mainMenu);
  if (activeChats[userId]) return ctx.reply("⚠️ Ты уже в чате.", chatMenu);

  // Ищем парня
  if (waitingMale.length > 0) {
    const partnerId = waitingMale.shift();
    activeChats[userId] = partnerId;
    activeChats[partnerId] = userId;
    dailyChats++;
    bot.telegram.sendMessage(partnerId, "✅ Найдена собеседница! Общайтесь анонимно 🎭", chatMenu);
    ctx.reply("✅ Найден собеседник! Общайтесь анонимно 🎭", chatMenu);
  } else {
    waitingFemale.push(userId);
    ctx.reply("🔍 Ищем собеседника...\nОжидай — как только появится парень, соединим!");
  }
});

bot.hears('❌ Отмена', (ctx) => {
  ctx.reply("Отменено.", mainMenu);
});

// ===== РЕФЕРАЛЬНАЯ СИСТЕМА =====

bot.hears('🎁 Реферальная ссылка', (ctx) => {
  const userId = ctx.from.id;
  initUserStats(userId);
  const code = getReferralCode(userId);
  const botUsername = ctx.botInfo?.username || 'твой_бот';

  ctx.reply(
    `🎁 Твоя реферальная ссылка:\n\n` +
    `https://t.me/${botUsername}?start=${code}\n\n` +
    `За каждого друга который перейдёт по ссылке — ты получаешь +1 час VIP! 👑\n\n` +
    `👥 Приглашено друзей: ${userStats[userId].referrals}\n` +
    `💬 Всего диалогов: ${userStats[userId].chats}`
  );
});

// ===== ОСТАЛЬНЫЕ КНОПКИ =====

bot.command('search', doSearch);
bot.command('stop', doStop);
bot.command('next', doNext);
bot.hears('🔍 Найти собеседника', doSearch);
bot.hears('❌ Завершить чат', doStop);
bot.hears('⏭ Следующий', doNext);

bot.hears('📊 Онлайн', (ctx) => {
  ctx.reply(`👥 Сейчас онлайн: ${getOnlineCount()} человек`);
});

bot.hears('❓ Помощь', (ctx) => {
  ctx.reply(
    "❓ Помощь\n\n" +
    "🔍 Найти собеседника — случайный поиск\n" +
    "👑 VIP поиск — поиск по полу\n" +
    "❌ Завершить чат — выйти\n" +
    "⏭ Следующий — другой собеседник\n" +
    "🚫 Пожаловаться — жалоба\n" +
    "🎁 Реферальная ссылка — пригласи друга\n" +
    "📩 Связаться с менеджером — написать администратору"
  );
});

bot.hears('📩 Связаться с менеджером', (ctx) => {
  const userId = ctx.from.id;
  waitingForManager[userId] = true;
  ctx.reply(
    `📩 Напиши своё сообщение — менеджер ответит лично.\n\n` +
    `⚠️ Если нет username — укажи его в сообщении чтобы с тобой связались.\n\nОтправь текст:`
  );
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
    `📊 Статистика за сегодня:\n\n` +
    `💬 Диалогов за день: ${dailyChats}\n` +
    `👥 Сейчас онлайн: ${getOnlineCount()}\n` +
    `⏳ В очереди (обычная): ${waitingUsers.length}\n` +
    `👦 В очереди (парни): ${waitingMale.length}\n` +
    `👧 В очереди (девушки): ${waitingFemale.length}\n` +
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
  waitingMale = waitingMale.filter(id => id !== banId);
  waitingFemale = waitingFemale.filter(id => id !== banId);
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
  const text = reports.map((r, i) =>
    `${i+1}. От: ${r.from} на: ${r.on}\nТекст: ${r.text}`
  ).join('\n\n');
  ctx.reply(`🚫 Жалобы:\n\n${text}`);
});

// ===== ПЕРЕСЫЛКА СООБЩЕНИЙ =====

bot.on('message', async (ctx) => {
  const userId = ctx.from.id;
  if (isBlocked(userId)) return;

  // Жалоба
  if (waitingForReport[userId]) {
    delete waitingForReport[userId];
    const partnerId = activeChats[userId];
    const reportText = ctx.message.text || "Без текста";
    reports.push({ from: userId, on: partnerId || "неизвестен", text: reportText });
    bot.telegram.sendMessage(ADMIN_ID,
      `🚫 Новая жалоба!\nОт: ${userId} (@${ctx.from.username || 'нет'})\nНа: ${partnerId || 'неизвестен'}\nТекст: ${reportText}\nЗабанить: /ban ${partnerId}`
    ).catch(() => {});
    return ctx.reply("✅ Жалоба отправлена. Спасибо!", chatMenu);
  }

  // Сообщение менеджеру
  if (waitingForManager[userId]) {
    delete waitingForManager[userId];
    const msgText = ctx.message.text || "Без текста";
    const username = ctx.from.username ? `@${ctx.from.username}` : "нет username";
    const firstName = ctx.from.first_name || "Без имени";
    const hasUsername = !!ctx.from.username;

    await bot.telegram.sendMessage(ADMIN_ID,
      `📩 Новое сообщение!\n\n👤 Имя: ${firstName}\n🔗 Username: ${username}\n🆔 ID: ${userId}\n\n💬 Сообщение:\n${msgText}`,
      hasUsername ? {
        reply_markup: {
          inline_keyboard: [[
            { text: "💬 Написать пользователю", url: `https://t.me/${ctx.from.username}` }
          ]]
        }
      } : {}
    ).catch(() => {});

    return ctx.reply(`✅ Сообщение отправлено менеджеру!\nМенеджер ответит: @${ADMIN_USERNAME}`, mainMenu);
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
