import type { Message } from "@mtcute/node";
import { Bot, InputFile } from "grammy";
import type { TelegramClient } from "@mtcute/node";
import type { NostalgiaMessage, Selection } from "./selection.js";
import { formatMotd, truncate } from "./selection.js";

export function toNostalgiaMessage(message: Message): NostalgiaMessage<Message> {
  const reactions =
    message.reactions?.reactions.reduce((total, reaction) => {
      return total + reaction.count;
    }, 0) ?? 0;

  return {
    id: message.id,
    author: message.sender.displayName,
    text: message.text,
    replyToMessageId:
      message.replyToMessage?.originIs("same_chat") === true
        ? message.replyToMessage.id
        : null,
    reactionCount: reactions,
    hasPhoto: message.media?.type === "photo",
    isBot: message.sender.type === "user" && message.sender.isBot,
    source: message,
  };
}

export async function sendMotd(
  bot: Bot,
  client: TelegramClient,
  chatId: number,
  selection: Selection<Message>,
  options: { yearsAgo?: number; bonus?: boolean } = {},
): Promise<void> {
  const text = formatMotd(selection, options);
  const source = selection.message.source;
  const replyParameters = {
    message_id: source.id,
    allow_sending_without_reply: true,
  };

  if (source.media?.type === "photo") {
    const bytes = await client.downloadAsBuffer(source.media);
    await bot.api.sendPhoto(chatId, new InputFile(bytes, "nostalgija.jpg"), {
      caption: truncate(text, 1024),
      reply_parameters: replyParameters,
    });
    return;
  }

  await bot.api.sendMessage(chatId, truncate(text, 4096), {
    reply_parameters: replyParameters,
  });
}
