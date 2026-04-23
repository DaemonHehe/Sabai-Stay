import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  sleepScheduleSchema,
  cleanlinessSchema,
  genderPreferenceSchema,
  studyHabitSchema,
} from "@shared/schema";
import { storage } from "../storage";

export type AuthActor = {
  userId: string;
  role: "student" | "owner";
  fullName: string | null | undefined;
};

export const bookingRequestSchema = z
  .object({
    listingId: z.string(),
    guestName: z.string().min(1),
    guestEmail: z.string().email(),
    guestPhone: z.string().min(1),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    guests: z.coerce.number().int().min(1).default(1),
    requestNote: z.string().optional(),
  })
  .refine((data) => data.checkIn < data.checkOut, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

export const utilityEstimateQuerySchema = z.object({
  electricityUsageUnits: z.coerce.number().optional(),
  waterUsageUnits: z.coerce.number().optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const roommateProfileRequestSchema = z.object({
  userId: z.string(),
  universityId: z.string(),
  displayName: z.string().min(1),
  bio: z.string().min(1),
  studyHabit: studyHabitSchema,
  sleepSchedule: sleepScheduleSchema,
  cleanliness: cleanlinessSchema,
  genderPreference: genderPreferenceSchema,
  budgetMin: z.coerce.number().int().nonnegative(),
  budgetMax: z.coerce.number().int().nonnegative(),
  preferredMoveIn: z.coerce.date(),
  preferredLeaseMonths: z.coerce.number().int().positive(),
  openToVisitors: z.boolean(),
  isActive: z.boolean(),
});

export const roommateMessageRequestSchema = z.object({
  matchId: z.string(),
  senderProfileId: z.string(),
  message: z.string().min(1),
});

export const reviewResponseSchema = z.object({
  response: z.string().min(1),
});

export function formatZodError(error: z.ZodError) {
  return error.errors
    .map((detail) => {
      const path = detail.path.join(".") || "input";
      return `${path}: ${detail.message}`;
    })
    .join(", ");
}

export function calculateBookingTotal(
  monthlyPrice: number,
  checkIn: Date,
  checkOut: Date,
) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const durationInDays = Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / millisecondsPerDay),
  );

  return Math.max(0, Math.round((monthlyPrice / 30) * durationInDays));
}

let authClient:
  | ReturnType<typeof createClient>
  | null = null;

function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  authClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return authClient;
}

async function getAuthActor(req: Request): Promise<AuthActor | null> {
  const authorization = req.header("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) {
    return null;
  }

  const client = getAuthClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const appUser = await storage.getAppUserById(data.user.id);
  if (!appUser) {
    return null;
  }

  return {
    userId: appUser.id,
    role: appUser.role,
    fullName: appUser.fullName,
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
): Promise<AuthActor | null> {
  const actor = await getAuthActor(req);

  if (!actor) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return actor;
}

export async function requireRole(
  req: Request,
  res: Response,
  roles: AuthActor["role"][],
): Promise<AuthActor | null> {
  const actor = await requireAuth(req, res);
  if (!actor) {
    return null;
  }

  if (!roles.includes(actor.role)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return actor;
}
