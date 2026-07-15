import type { InputPeerLike, Message, TelegramClient } from "@mtcute/node";
import { DateTime } from "luxon";

export interface HistoryWindow {
  start: Date;
  end: Date;
  label: string;
}

export function anniversaryWindow(
  now: Date,
  timezone: string,
  yearsAgo: number,
  dayStartHour = 2,
): HistoryWindow {
  if (!Number.isSafeInteger(yearsAgo) || yearsAgo < 1) {
    throw new Error("yearsAgo must be a positive safe integer");
  }
  if (
    !Number.isSafeInteger(dayStartHour) ||
    dayStartHour < 0 ||
    dayStartHour > 23
  ) {
    throw new Error("dayStartHour must be an integer from 0 through 23");
  }
  const localNow = DateTime.fromJSDate(now, { zone: timezone });
  if (!localNow.isValid) {
    throw new Error(`Invalid TELEGRAM_CHAT_LOCATION: ${timezone}`);
  }

  const activeChatDay =
    localNow.hour < dayStartHour ? localNow.minus({ days: 1 }) : localNow;
  const start = activeChatDay
    .minus({ years: yearsAgo })
    .startOf("day")
    .plus({ hours: dayStartHour });
  const end = start.plus({ days: 1 });

  return {
    start: start.toJSDate(),
    end: end.toJSDate(),
    label: start.toISODate(),
  };
}

export function previousYearWindow(
  now: Date,
  timezone: string,
): HistoryWindow {
  return anniversaryWindow(now, timezone, 1);
}

export function availableBonusYears(
  now: Date,
  timezone: string,
  oldestMessageDate: Date,
  dayStartHour = 2,
): number[] {
  const years: number[] = [];
  for (let yearsAgo = 2; ; yearsAgo += 1) {
    const window = anniversaryWindow(
      now,
      timezone,
      yearsAgo,
      dayStartHour,
    );
    if (window.end.getTime() <= oldestMessageDate.getTime()) break;
    years.push(yearsAgo);
  }
  return years;
}

export async function fetchOldestMessageDate(
  client: TelegramClient,
  chatId: InputPeerLike,
): Promise<Date | null> {
  for await (const message of client.iterHistory(chatId, {
    offset: { id: 1, date: 0 },
    reverse: true,
    limit: 1,
  })) {
    return message.date;
  }
  return null;
}

export async function fetchHistoryForWindow(
  client: TelegramClient,
  chatId: InputPeerLike,
  window: HistoryWindow,
): Promise<Message[]> {
  const messages: Message[] = [];
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();

  for await (const message of client.iterHistory(chatId, {
    offset: { id: 0, date: Math.floor(endMs / 1000) },
  })) {
    const timestamp = message.date.getTime();
    if (timestamp >= endMs) continue;
    if (timestamp < startMs) break;
    messages.push(message);
  }

  return messages;
}
