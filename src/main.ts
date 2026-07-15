import { TelegramClient, type Message } from "@mtcute/node";
import { Bot } from "grammy";
import { ensureSessionDirectory, loadConfig } from "./config.js";
import {
  anniversaryWindow,
  availableBonusYears,
  fetchHistoryForWindow,
  fetchOldestMessageDate,
} from "./history.js";
import {
  chooseBonus,
  formatMotd,
  selectExceptionalMessage,
  selectMessage,
  type AnniversarySelection,
} from "./selection.js";
import { sendMotd, toNostalgiaMessage } from "./telegram.js";

process.umask(0o077);

async function main(): Promise<void> {
  const config = loadConfig();
  ensureSessionDirectory(config.sessionPath);
  const client = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    storage: config.sessionPath,
  });

  try {
    await client.connect();
    try {
      await client.getMe();
    } catch (error) {
      throw new Error(
        "Telegram user session is not authorized; run `pnpm run login` interactively first",
        { cause: error },
      );
    }

    const dialog = (await client.findDialogs(config.chatId))[0];
    if (!dialog) throw new Error(`Target chat ${config.chatId} was not found`);
    const now = new Date();
    const primaryWindow = anniversaryWindow(
      now,
      config.chatLocation,
      1,
      config.dayStartHour,
    );
    const primaryHistory = await fetchHistoryForWindow(
      client,
      dialog.peer,
      primaryWindow,
    );
    console.log(`Messages on ${primaryWindow.label}: ${primaryHistory.length}`);

    const primary = selectMessage(primaryHistory.map(toNostalgiaMessage));
    if (!primary) {
      console.log(`No viable MOTD message found for ${primaryWindow.label}`);
      // A bonus is additive to the daily one-year memory, never a replacement.
      return;
    }

    console.log(
      `Selected 1-year message ${primary.message.id} based on ${primary.type}`,
    );

    const oldestMessageDate = await fetchOldestMessageDate(client, dialog.peer);
    const bonusYears = oldestMessageDate
      ? availableBonusYears(
          now,
          config.chatLocation,
          oldestMessageDate,
          config.dayStartHour,
        )
      : [];
    console.log(
      bonusYears.length > 0
        ? `Checking bonus anniversaries: ${bonusYears.join(", ")} years ago`
        : "No older anniversary history available",
    );

    const bonusCandidates: AnniversarySelection<Message>[] = [];
    for (const yearsAgo of bonusYears) {
      const window = anniversaryWindow(
        now,
        config.chatLocation,
        yearsAgo,
        config.dayStartHour,
      );
      const history = await fetchHistoryForWindow(client, dialog.peer, window);
      console.log(`Messages on ${window.label}: ${history.length}`);
      const selection = selectExceptionalMessage(
        history.map(toNostalgiaMessage),
        {
          minReactions: config.bonusMinReactions,
          minReplies: config.bonusMinReplies,
        },
      );
      if (selection) bonusCandidates.push({ yearsAgo, selection });
    }

    const bonus = chooseBonus(bonusCandidates, {
      minReactions: config.bonusMinReactions,
      minReplies: config.bonusMinReplies,
    });
    if (bonus) {
      console.log(
        `Selected ${bonus.yearsAgo}-year bonus message ${bonus.selection.message.id} ` +
          `with ${bonus.selection.reactionCount} reactions and ${bonus.selection.replyCount} replies`,
      );
    } else {
      console.log("No exceptional bonus anniversary found");
    }

    if (config.dryRun) {
      console.log("TELEGRAM_DRY_RUN=true, not sending MOTD");
      console.log("\n--- 1-year MOTD ---");
      console.log(formatMotd(primary));
      if (bonus) {
        console.log(`\n--- ${bonus.yearsAgo}-year bonus MOTD ---`);
        console.log(
          formatMotd(bonus.selection, {
            yearsAgo: bonus.yearsAgo,
            bonus: true,
          }),
        );
      }
      return;
    }

    const bot = new Bot(config.botToken);
    await sendMotd(bot, client, config.chatId, primary);
    if (bonus) {
      await sendMotd(bot, client, config.chatId, bonus.selection, {
        yearsAgo: bonus.yearsAgo,
        bonus: true,
      });
    }
  } finally {
    await client.destroy();
  }
}

await main();
