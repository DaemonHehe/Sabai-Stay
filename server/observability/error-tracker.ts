import { logEvent } from "./logger";

type TrackedError = {
  timestamp: string;
  message: string;
  name: string;
  stack?: string;
  context: Record<string, unknown>;
};

const MAX_TRACKED_ERRORS = 100;
const trackedErrors: TrackedError[] = [];

function asError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "Unknown error");
}

export function trackError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const resolvedError = asError(error);
  const item: TrackedError = {
    timestamp: new Date().toISOString(),
    message: resolvedError.message,
    name: resolvedError.name,
    stack: resolvedError.stack,
    context,
  };

  trackedErrors.unshift(item);
  if (trackedErrors.length > MAX_TRACKED_ERRORS) {
    trackedErrors.length = MAX_TRACKED_ERRORS;
  }

  logEvent("error", "tracked_error", item);
}

export function getTrackedErrors() {
  return trackedErrors;
}

