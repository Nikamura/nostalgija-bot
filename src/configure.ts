import "dotenv/config";
import { chmod, writeFile } from "node:fs/promises";
import { readLine, readSecret } from "./terminal.js";

function validateInteger(name: string, value: string): string {
  if (!value || !Number.isSafeInteger(Number(value)) || Number(value) === 0) {
    throw new Error(`${name} must be a non-zero safe integer`);
  }
  return value;
}

const apiId = validateInteger(
  "TELEGRAM_API_ID",
  (await readLine("Telegram API ID: ")).trim(),
);

const apiHash = (await readSecret("Telegram API hash: ")).trim();
if (!/^[a-fA-F0-9]{32}$/.test(apiHash)) {
  throw new Error("TELEGRAM_API_HASH must be 32 hexadecimal characters");
}

const chatId = validateInteger(
  "TELEGRAM_CHAT_ID",
  (await readLine("Telegram chat ID: ")).trim(),
);

const contents = [
  `TELEGRAM_API_ID=${apiId}`,
  `TELEGRAM_API_HASH=${apiHash}`,
  `TELEGRAM_API_KEY=${process.env.TELEGRAM_API_KEY ?? ""}`,
  `TELEGRAM_CHAT_ID=${chatId}`,
  `TELEGRAM_CHAT_LOCATION=${process.env.TELEGRAM_CHAT_LOCATION ?? "Europe/Vilnius"}`,
  `TELEGRAM_SESSION_PATH=${process.env.TELEGRAM_SESSION_PATH ?? "./data/nostalgija-user.session"}`,
  "TELEGRAM_DRY_RUN=true",
  `NOSTALGIA_DAY_START_HOUR=${process.env.NOSTALGIA_DAY_START_HOUR ?? "2"}`,
  `NOSTALGIA_BONUS_MIN_REACTIONS=${process.env.NOSTALGIA_BONUS_MIN_REACTIONS ?? "4"}`,
  `NOSTALGIA_BONUS_MIN_REPLIES=${process.env.NOSTALGIA_BONUS_MIN_REPLIES ?? "3"}`,
  "",
].join("\n");

await writeFile(".env", contents, { mode: 0o600 });
await chmod(".env", 0o600);
console.log("Saved protected local configuration to .env");
console.log("Next: pnpm run login");
