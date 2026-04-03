import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  bookingStatusSchema,
  contractStatusSchema,
  insertListingSchema,
  insertReviewSchema,
  listingFiltersSchema,
  roomTypeSchema,
  sleepScheduleSchema,
  cleanlinessSchema,
  genderPreferenceSchema,
  studyHabitSchema,
  verificationStatusSchema,
  disputeStatusSchema,
} from "@shared/schema";
import { StorageError, storage } from "./storage";

type AuthActor = {
  userId: string;
  role: "student" | "owner" | "admin";
  fullName: string | null | undefined;
};

const bookingRequestSchema = z
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

const utilityEstimateQuerySchema = z.object({
  electricityUsageUnits: z.coerce.number().optional(),
  waterUsageUnits: z.coerce.number().optional(),
});

const roommateProfileRequestSchema = z.object({
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

const roommateMessageRequestSchema = z.object({
  matchId: z.string(),
  senderProfileId: z.string(),
  message: z.string().min(1),
});

const reviewResponseSchema = z.object({
  response: z.string().min(1),
});

function formatZodError(error: z.ZodError) {
  return error.errors
    .map((detail) => {
      const path = detail.path.join(".") || "input";
      return `${path}: ${detail.message}`;
    })
    .join(", ");
}

function calculateBookingTotal(monthlyPrice: number, checkIn: Date, checkOut: Date) {
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

async function requireAuth(
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

async function requireRole(
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

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const actor = await getAuthActor(req);
  if (actor?.role === "admin") {
    return false;
  }

  const adminKey = process.env.ADMIN_API_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!adminKey && !isProd) {
    return false;
  }

  if (!adminKey) {
    res.status(403).json({ error: "Admin API key not configured" });
    return true;
  }

  const providedKey = req.header("x-admin-key");
  if (providedKey !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return true;
  }

  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get("/api/config/public", (_req, res) => {
    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? null;
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      null;

    res.json({
      configured: Boolean(supabaseUrl && supabaseAnonKey),
      supabaseUrl,
      supabaseAnonKey,
    });
  });

  app.get("/api/discovery", async (_req, res) => {
    try {
      res.json(await storage.getDiscoveryData());
    } catch (error) {
      console.error("Error fetching discovery data:", error);
      res.status(500).json({ error: "Failed to fetch discovery data" });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;

      const dashboard = await storage.getDashboardData();
      const notifications = await storage.getNotifications(actor.userId);
      const ownerListings =
        actor.role === "admin"
          ? dashboard.ownerListings
          : dashboard.ownerListings.filter(
              (listing) => listing.ownerUserId === actor.userId,
            );
      const ownerBookings =
        actor.role === "admin"
          ? dashboard.ownerBookings
          : dashboard.ownerBookings.filter(
              (booking) =>
                booking.ownerUserId === actor.userId ||
                booking.studentUserId === actor.userId,
            );
      const contracts =
        actor.role === "admin"
          ? dashboard.contracts
          : dashboard.contracts.filter(
              (contract) =>
                contract.ownerUserId === actor.userId ||
                contract.studentUserId === actor.userId,
            );
      const roommateProfiles =
        actor.role === "admin"
          ? dashboard.roommateProfiles
          : dashboard.roommateProfiles.filter(
              (profile) =>
                profile.userId === actor.userId || profile.isActive,
            );

      res.json({
        ...dashboard,
        ownerListings,
        ownerBookings,
        contracts,
        roommateProfiles,
        notifications,
      });
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  app.get("/api/listings", async (req, res) => {
    try {
      const filters = listingFiltersSchema.parse({
        q: req.query.q,
        category: req.query.category,
        universityId: req.query.universityId,
        campusZoneId: req.query.campusZoneId,
        roomType: req.query.roomType,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        minCapacity: req.query.minCapacity,
        maxWalkingMinutes: req.query.maxWalkingMinutes,
      });
      res.json(await storage.getAllListings(filters));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error fetching listings:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error fetching listing:", error);
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  app.get("/api/listings/:id/utilities", async (req, res) => {
    try {
      const query = utilityEstimateQuerySchema.parse(req.query);
      res.json(
        await storage.estimateUtilities(
          req.params.id,
          query.electricityUsageUnits,
          query.waterUsageUnits,
        ),
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error estimating utilities:", error);
      res.status(500).json({ error: "Failed to estimate utilities" });
    }
  });

  app.post("/api/listings", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner", "admin"]);
      if (!actor) return;

      const validatedData = insertListingSchema.parse(req.body);
      const listing = await storage.createListing({
        ...validatedData,
        ownerUserId:
          actor.role === "admin" && validatedData.ownerUserId
            ? validatedData.ownerUserId
            : actor.userId,
      });
      res.status(201).json(listing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error creating listing:", error);
      res.status(500).json({ error: "Failed to create listing" });
    }
  });

  app.patch("/api/listings/:id", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner", "admin"]);
      if (!actor) return;

      const existingListing = await storage.getListingById(req.params.id);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (
        actor.role !== "admin" &&
        existingListing.ownerUserId !== actor.userId
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const partialListingSchema = insertListingSchema.partial();
      const validatedData = partialListingSchema.parse(req.body);
      const listing = await storage.updateListing(req.params.id, {
        ...validatedData,
        ownerUserId:
          actor.role === "admin"
            ? validatedData.ownerUserId
            : actor.userId,
      });
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error updating listing:", error);
      res.status(500).json({ error: "Failed to update listing" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;

      const validatedData = bookingRequestSchema.parse(req.body);
      const listing = await storage.getListingById(validatedData.listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const booking = await storage.createBooking({
        ...validatedData,
        studentUserId: actor.userId,
        ownerUserId: listing.ownerUserId,
        guestName: validatedData.guestName || actor.fullName || validatedData.guestEmail,
        totalPrice: calculateBookingTotal(
          listing.price,
          validatedData.checkIn,
          validatedData.checkOut,
        ),
        depositAmount: listing.price,
        depositPaid: false,
        requestNote: validatedData.requestNote ?? "",
        status: "requested",
      });
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      if (error instanceof StorageError && error.code === "BOOKING_OVERLAP") {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  app.get("/api/bookings", async (_req, res) => {
    try {
      const actor = await requireAuth(_req, res);
      if (!actor) return;
      const bookings = await storage.getBookings();
      res.json(
        actor.role === "admin"
          ? bookings
          : bookings.filter(
              (booking) =>
                booking.ownerUserId === actor.userId ||
                booking.studentUserId === actor.userId,
            ),
      );
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.patch("/api/bookings/:id/status", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner", "admin"]);
      if (!actor) return;

      const validatedData = z
        .object({ status: bookingStatusSchema })
        .parse(req.body);
      const bookings = await storage.getBookings();
      const existing = bookings.find((booking) => booking.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (actor.role !== "admin" && existing.ownerUserId !== actor.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const booking = await storage.updateBookingStatus(
        req.params.id,
        validatedData.status,
      );
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error updating booking status:", error);
      res.status(500).json({ error: "Failed to update booking status" });
    }
  });

  app.get("/api/contracts", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const contracts = await storage.getContracts();
      res.json(
        actor.role === "admin"
          ? contracts
          : contracts.filter(
              (contract) =>
                contract.ownerUserId === actor.userId ||
                contract.studentUserId === actor.userId,
            ),
      );
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.patch("/api/contracts/:id/status", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner", "admin"]);
      if (!actor) return;

      const validatedData = z
        .object({ status: contractStatusSchema })
        .parse(req.body);
      const contracts = await storage.getContracts();
      const existing = contracts.find((contract) => contract.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Contract not found" });
      }
      if (actor.role !== "admin" && existing.ownerUserId !== actor.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const contract = await storage.updateContractStatus(
        req.params.id,
        validatedData.status,
      );
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error updating contract status:", error);
      res.status(500).json({ error: "Failed to update contract status" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      const listingId = z.string().parse(req.query.listingId);
      res.json(await storage.getReviewsByListing(listingId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["student", "admin"]);
      if (!actor) return;

      const validatedReview = insertReviewSchema.parse(req.body);
      const review = await storage.createReview(
        {
          ...validatedReview,
          studentUserId: actor.userId,
          studentName: actor.fullName || validatedReview.studentName,
        },
      );
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error creating review:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  app.patch("/api/reviews/:id/response", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner", "admin"]);
      if (!actor) return;

      const { response } = reviewResponseSchema.parse(req.body);
      const existingReview = await storage.getReviewById(req.params.id);
      if (!existingReview) {
        return res.status(404).json({ error: "Review not found" });
      }
      const reviewListing = await storage.getListingById(existingReview.listingId);
      if (!reviewListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (actor.role !== "admin" && reviewListing.ownerUserId !== actor.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const review = await storage.respondToReview(req.params.id, response);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error responding to review:", error);
      res.status(500).json({ error: "Failed to respond to review" });
    }
  });

  app.get("/api/roommates/profiles", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      res.json(await storage.getRoommateProfiles());
    } catch (error) {
      console.error("Error fetching roommate profiles:", error);
      res.status(500).json({ error: "Failed to fetch roommate profiles" });
    }
  });

  app.post("/api/roommates/profiles", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["student", "admin"]);
      if (!actor) return;
      const profile = await storage.saveRoommateProfile(
        {
          ...roommateProfileRequestSchema.parse(req.body),
          userId: actor.userId,
        },
      );
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error saving roommate profile:", error);
      res.status(500).json({ error: "Failed to save roommate profile" });
    }
  });

  app.get("/api/roommates/matches", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const profileId = req.query.profileId
        ? z.string().parse(req.query.profileId)
        : undefined;
      if (profileId && actor.role !== "admin") {
        const requestedProfile = await storage.getRoommateProfileById(profileId);
        if (!requestedProfile) {
          return res.status(404).json({ error: "Roommate profile not found" });
        }
        if (requestedProfile.userId !== actor.userId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      res.json(await storage.getRoommateMatches(profileId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error fetching roommate matches:", error);
      res.status(500).json({ error: "Failed to fetch roommate matches" });
    }
  });

  app.get("/api/roommates/messages/:matchId", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      if (actor.role !== "admin") {
        const match = await storage.getRoommateMatchById(req.params.matchId);
        if (!match) {
          return res.status(404).json({ error: "Roommate match not found" });
        }
        const [profile, matchedProfile] = await Promise.all([
          storage.getRoommateProfileById(match.profileId),
          storage.getRoommateProfileById(match.matchedProfileId),
        ]);
        const isParticipant =
          profile?.userId === actor.userId || matchedProfile?.userId === actor.userId;
        if (!isParticipant) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      res.json(await storage.getRoommateMessages(req.params.matchId));
    } catch (error) {
      console.error("Error fetching roommate messages:", error);
      res.status(500).json({ error: "Failed to fetch roommate messages" });
    }
  });

  app.post("/api/roommates/messages", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["student", "admin"]);
      if (!actor) return;
      const validatedData = roommateMessageRequestSchema.parse(req.body);
      const senderProfile = await storage.getRoommateProfileById(
        validatedData.senderProfileId,
      );
      if (!senderProfile) {
        return res.status(404).json({ error: "Roommate profile not found" });
      }
      if (actor.role !== "admin" && senderProfile.userId !== actor.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const match = await storage.getRoommateMatchById(validatedData.matchId);
      if (!match) {
        return res.status(404).json({ error: "Roommate match not found" });
      }
      if (
        match.profileId !== validatedData.senderProfileId &&
        match.matchedProfileId !== validatedData.senderProfileId
      ) {
        return res.status(400).json({ error: "Sender is not part of this match" });
      }
      const message = await storage.sendRoommateMessage(
        validatedData.matchId,
        validatedData.senderProfileId,
        validatedData.message,
      );
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error sending roommate message:", error);
      res.status(500).json({ error: "Failed to send roommate message" });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      res.json(await storage.getNotifications(actor.userId));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const notification = await storage.markNotificationRead(
        req.params.id,
        actor.userId,
      );
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error updating notification:", error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.get("/api/admin/verifications", async (req, res) => {
    try {
      if (await requireAdmin(req, res)) {
        return;
      }
      res.json(await storage.getVerificationTasks());
    } catch (error) {
      console.error("Error fetching verification queue:", error);
      res.status(500).json({ error: "Failed to fetch verification queue" });
    }
  });

  app.patch("/api/admin/verifications/:id", async (req, res) => {
    try {
      if (await requireAdmin(req, res)) {
        return;
      }
      const { status } = z
        .object({ status: verificationStatusSchema })
        .parse(req.body);
      const task = await storage.updateVerificationTask(req.params.id, status);
      if (!task) {
        return res.status(404).json({ error: "Verification task not found" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error updating verification task:", error);
      res.status(500).json({ error: "Failed to update verification task" });
    }
  });

  app.get("/api/admin/disputes", async (req, res) => {
    try {
      if (await requireAdmin(req, res)) {
        return;
      }
      res.json(await storage.getDisputes());
    } catch (error) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });

  app.patch("/api/admin/disputes/:id", async (req, res) => {
    try {
      if (await requireAdmin(req, res)) {
        return;
      }
      const { status } = z
        .object({ status: disputeStatusSchema })
        .parse(req.body);
      const dispute = await storage.updateDisputeStatus(req.params.id, status);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      res.json(dispute);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error updating dispute:", error);
      res.status(500).json({ error: "Failed to update dispute" });
    }
  });

  return httpServer;
}
