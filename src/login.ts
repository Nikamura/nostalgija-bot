import { TelegramClient } from "@mtcute/node";
import { ensureSessionDirectory, loadLoginConfig } from "./config.js";
import { readLine, readSecret } from "./terminal.js";

process.umask(0o077);

const config = loadLoginConfig();
ensureSessionDirectory(config.sessionPath);
const client = new TelegramClient({
  apiId: config.apiId,
  apiHash: config.apiHash,
  storage: config.sessionPath,
});

try {
  const user = await client.start({
    phone: async () => (await readLine("phone > ")).trim(),
    code: async () => (await readLine("code > ")).trim(),
    password: async () => await readSecret("2fa password > "),
  });
  console.log(`Telegram client session ready for ${user.displayName}`);
  const dialog = (await client.findDialogs(config.chatId))[0];
  if (!dialog) throw new Error(`Target chat ${config.chatId} was not found`);
  console.log(`Target chat ready: ${dialog.peer.displayName}`);
} finally {
  await client.destroy();
}
