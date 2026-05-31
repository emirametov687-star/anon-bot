// ===== ADMIN COMMANDS =====

bot.command('unban', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔️ Нет доступа.");

  const args = ctx.message.text.split(' ');
  if (!args[1]) return ctx.reply("Использование: /unban USER_ID");

  const unbanId = parseInt(args[1]);
  blockedUsers.delete(unbanId);

  bot.telegram.sendMessage(unbanId, "✅ Ты разблокирован!").catch(() => {});
  ctx.reply(`✅ Пользователь ${unbanId} разблокирован.`);
});

bot.command('givevip', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔️ Нет доступа.");

  const args = ctx.message.text.split(' ');
  if (!args[1] || !args[2]) {
    return ctx.reply("Использование: /givevip USER_ID ЧАСЫ");
  }

  const targetId = parseInt(args[1]);
  const hours = parseInt(args[2]);

  addVIPTime(targetId, hours);

  bot.telegram.sendMessage(
    targetId,
    👑 Администратор выдал тебе ${hours} часов VIP!
  ).catch(() => {});

  ctx.reply(`✅ Выдано ${hours} часов VIP пользователю ${targetId}.`);
});

bot.command('reports', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔️ Нет доступа.");

  if (reports.length === 0) return ctx.reply("📭 Жалоб нет.");

  const text = reports
    .map((r, i) => `${i + 1}. От: ${r.from} на: ${r.on}\nТекст: ${r.text}`)
    .join('\n\n');

  ctx.reply(`🚫 Жалобы:\n\n${text}`);
});


// ===== MESSAGE HANDLER =====

bot.on('message', async (ctx) => {
  const userId = ctx.from.id;

  if (isBlocked(userId)) return;

  // Ждём выбор пола
  if (waitingForGenderSetup[userId]) {
    return ctx.reply("Пожалуйста, выбери свой пол 👇", genderSetupMenu);
  }

  // ===== ЖАЛОБА =====
  if (waitingForReport[userId]) {
    delete waitingForReport[userId];

    const partnerId = activeChats[userId];
    const reportText = ctx.message.text || "Без текста";

    reports.push({
      from: userId,
      on: partnerId || "неизвестен",
      text: reportText
    });

    bot.telegram.sendMessage(
      ADMIN_ID,
      🚫 Жалоба!\nОт: ${userId} (@${ctx.from.username || 'нет'})\nНа: ${partnerId || 'неизвестен'}\nТекст: ${reportText}\nЗабанить: /ban ${partnerId || ''}
    ).catch(() => {});

    return ctx.reply("✅ Жалоба отправлена. Спасибо!", chatMenu);
  }

  // ===== МЕНЕДЖЕР =====
  if (waitingForManager[userId]) {
    delete waitingForManager[userId];

    const msgText = ctx.message.text || "Без текста";
    const username = ctx.from.username ? @${ctx.from.username} : "нет username";
    const firstName = ctx.from.first_name || "Без имени";

    await bot.telegram.sendMessage(
      ADMIN_ID,
      📩 Сообщение!\n\n👤 ${firstName}\n🔗 ${username}\n🆔 ${userId}\n\n💬 ${msgText}
    ).catch(() => {});

    return ctx.reply(
      ✅ Сообщение отправлено!\nМенеджер ответит: @${ADMIN_USERNAME},
      mainMenu
    );
  }

  // ===== ПЕРЕСЫЛКА ЧАТА =====
  if (!activeChats[userId]) {
    return ctx.reply("Нажми 🔍 чтобы найти собеседника!", mainMenu);
  }

  const partnerId = activeChats[userId];
  const msg = ctx.message;

  try {
    if (msg.text) {
      await bot.telegram.sendMessage(partnerId, msg.text);
    } else if (msg.photo) {
      await bot.telegram.sendPhoto(
        partnerId,
        msg.photo[msg.photo.length - 1].file_id,
        { caption: msg.caption || "" }
      );
    } else if (msg.sticker) {
      await bot.telegram.sendSticker(partnerId, msg.sticker.file_id);
    } else if (msg.voice) {
      await bot.telegram.sendVoice(partnerId, msg.voice.file_id);
    } else if (msg.video) {
      await bot.telegram.sendVideo(
        partnerId,
        msg.video.file_id,
        { caption: msg.caption || "" }
      );
    } else if (msg.document) {
      await bot.telegram.sendDocument(
        partnerId,
        msg.document.file_id,
        { caption: msg.caption || "" }
      );
    } else if (msg.audio) {
      await bot.telegram.sendAudio(
        partnerId,
        msg.audio.file_id,
        { caption: msg.caption || "" }
      );
    }

  } catch (e) {
    delete activeChats[userId];
    delete activeChats[partnerId];
    ctx.reply("⚠️ Собеседник недоступен. Чат завершён.", mainMenu);
  }
});

bot.
launch();
console.log("✅ Бот запущен!");
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
