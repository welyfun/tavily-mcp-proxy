const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();

function timestamp(): string {
  return new Date().toISOString();
}

export function logInfo(message: string, extra?: Record<string, unknown>): void {
  if (LOG_LEVEL === "silent") return;
  const extraStr = extra ? " " + JSON.stringify(extra) : "";
  process.stdout.write(`[${timestamp()}] [INFO] ${message}${extraStr}\n`);
}

export function logError(message: string, err?: unknown): void {
  let extraStr = "";
  if (err instanceof Error) {
    extraStr = " " + err.message;
    if (err.stack) {
      extraStr += "\n" + err.stack;
    }
  } else if (err !== undefined) {
    extraStr = " " + JSON.stringify(err);
  }
  process.stderr.write(`[${timestamp()}] [ERROR] ${message}${extraStr}\n`);
}

export function keyPreview(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 8) + "..." + key.slice(-4);
}
