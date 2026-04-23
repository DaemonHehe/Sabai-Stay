type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = {
  [key: string]: unknown;
};

function normalizeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function stringify(payload: LogPayload) {
  return JSON.stringify(payload, (_key, value) => {
    if (value instanceof Error) {
      return normalizeError(value);
    }
    return value;
  });
}

export function logEvent(level: LogLevel, message: string, payload: LogPayload = {}) {
  const entry = stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...payload,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.log(entry);
}

