import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integer(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function hour(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 23) {
    throw new Error(`${name} must be an integer from 0 through 23`);
  }
  return value;
}

export interface TelegramUserConfig {
  apiId: number;
  apiHash: string;
  sessionPath: string;
}

export interface AppConfig extends TelegramUserConfig {
  botToken: string;
  chatId: number;
  chatLocation: string;
  dryRun: boolean;
  dayStartHour: number;
  bonusMinReactions: number;
  bonusMinReplies: number;
}

export interface LoginConfig extends TelegramUserConfig {
  chatId: number;
}

export function loadUserConfig(): TelegramUserConfig {
  return {
    apiId: integer("TELEGRAM_API_ID"),
    apiHash: required("TELEGRAM_API_HASH"),
    sessionPath: required("TELEGRAM_SESSION_PATH"),
  };
}

export function loadConfig(): AppConfig {
  const dryRun = process.env.TELEGRAM_DRY_RUN === "true";
  const botToken = process.env.TELEGRAM_API_KEY?.trim() ?? "";
  if (!dryRun && !botToken) {
    throw new Error("TELEGRAM_API_KEY is required unless TELEGRAM_DRY_RUN=true");
  }

  return {
    ...loadUserConfig(),
    botToken,
    chatId: integer("TELEGRAM_CHAT_ID"),
    chatLocation: required("TELEGRAM_CHAT_LOCATION"),
    dryRun,
    dayStartHour: hour("NOSTALGIA_DAY_START_HOUR", 2),
    bonusMinReactions: positiveInteger(
      "NOSTALGIA_BONUS_MIN_REACTIONS",
      4,
    ),
    bonusMinReplies: positiveInteger("NOSTALGIA_BONUS_MIN_REPLIES", 3),
  };
}

export function loadLoginConfig(): LoginConfig {
  return {
    ...loadUserConfig(),
    chatId: integer("TELEGRAM_CHAT_ID"),
  };
}

export function ensureSessionDirectory(sessionPath: string): void {
  if (sessionPath !== ":memory:") {
    mkdirSync(dirname(sessionPath), { recursive: true });
  }
}
