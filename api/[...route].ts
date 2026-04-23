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

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return app(req, res);
}
