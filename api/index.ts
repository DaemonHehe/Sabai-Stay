import "../env";
import type { Request, Response } from "express";
import { bootstrapApp } from "../server/app";

let appPromise: Promise<import("express").Express> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = bootstrapApp({ mode: "api-only" }).then(({ app }) => app);
  }
  return appPromise;
}

function normalizeRewrittenApiUrl(req: Request) {
  const url = new URL(req.url || "/api", "https://sabai-stay.local");
  const rewrittenPath = url.searchParams.get("path");

  if (!rewrittenPath) {
    return;
  }

  url.searchParams.delete("path");

  const path = rewrittenPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
  const query = url.searchParams.toString();

  req.url = `/api/${path}${query ? `?${query}` : ""}`;
}

export default async function handler(req: Request, res: Response) {
  normalizeRewrittenApiUrl(req);
  const app = await getApp();
  return app(req, res);
}

