import readline from "node:readline/promises";

export async function promptLine(label) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    return await rl.question(label);
  } finally {
    rl.close();
  }
}

export async function promptSecret(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Secret prompts require an interactive terminal.");
  }

  process.stdout.write(label);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  let secret = "";

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };

    const onData = (chunk) => {
      const value = String(chunk);

      if (value === "\u0003") {
        cleanup();
        reject(new Error("Prompt cancelled."));
        return;
      }

      if (value === "\r" || value === "\n") {
        cleanup();
        resolve(secret);
        return;
      }

      if (value === "\u007f") {
        secret = secret.slice(0, -1);
        return;
      }

      secret += value;
    };

    stdin.on("data", onData);
  });
}
