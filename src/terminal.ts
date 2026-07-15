import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

export async function readLine(prompt: string): Promise<string> {
  const input = createInterface({ input: stdin, output: stdout });
  try {
    return await input.question(prompt);
  } finally {
    input.close();
  }
}

export async function readSecret(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    throw new Error("Interactive terminal required");
  }

  stdout.write(prompt);
  const wasRaw = stdin.isRaw;
  const wasPaused = stdin.isPaused();
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    let finished = false;

    function finish(result: { value: string } | { error: Error }): void {
      if (finished) return;
      finished = true;
      stdin.removeListener("data", onData);
      stdin.setRawMode(Boolean(wasRaw));
      if (wasPaused) stdin.pause();
      stdout.write("\n");
      if ("error" in result) reject(result.error);
      else resolve(result.value);
    }

    function onData(data: Buffer | string): void {
      for (const character of String(data)) {
        if (character === "\u0003" || character === "\u0004") {
          finish({ error: new Error("Input canceled") });
          return;
        }
        if (character === "\r" || character === "\n") {
          finish({ value });
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = Array.from(value).slice(0, -1).join("");
            stdout.write("\b \b");
          }
          continue;
        }

        value += character;
        stdout.write("*");
      }
    }

    stdin.on("data", onData);
  });
}
