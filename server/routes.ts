import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import {
  bookingStatusSchema,
  contractStatusSchema,
  insertListingSchema,
  insertReviewSchema,
  listingFiltersSchema,
} from "@shared/schema";
import { StorageError, storage } from "./storage";
import {
  bookingRequestSchema,
  calculateBookingTotal,
  formatZodError,
  paginationQuerySchema,
  requireAuth,
  requireRole,
  reviewResponseSchema,
  roommateMessageRequestSchema,
  roommateProfileRequestSchema,
  utilityEstimateQuerySchema,
} from "./routes/route-helpers";
import { registerUploadRoutes } from "./routes/upload-routes";

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

      res.json(await storage.getDashboardData(actor.userId, actor.role));
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
      const shouldPaginate =
        req.query.page !== undefined || req.query.pageSize !== undefined;
      if (shouldPaginate) {
        const pagination = paginationQuerySchema.parse({
          page: req.query.page,
          pageSize: req.query.pageSize,
        });
        return res.json(await storage.getListingsPage(filters, pagination));
      }
      return res.json(await storage.getAllListings(filters));
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
      const actor = await requireRole(req, res, ["owner"]);
      if (!actor) return;

      const validatedData = insertListingSchema.parse(req.body);
      const listing = await storage.createListing({
        ...validatedData,
        ownerUserId: actor.userId,
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
      const actor = await requireRole(req, res, ["owner"]);
      if (!actor) return;

      const existingListing = await storage.getListingById(req.params.id);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (existingListing.ownerUserId !== actor.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const partialListingSchema = insertListingSchema.partial();
      const validatedData = partialListingSchema.parse(req.body);
      const listing = await storage.updateListing(req.params.id, {
        ...validatedData,
        ownerUserId: actor.userId,
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
      const actor = await requireRole(req, res, ["student"]);
      if (!actor) return;

      const validatedData = bookingRequestSchema.parse(req.body);
      const listing = await storage.getListingById(validatedData.listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (!listing.ownerUserId) {
        return res.status(409).json({
          error:
            "This listing is missing an owner account. Please contact support before requesting a booking.",
        });
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
      const shouldPaginate =
        _req.query.page !== undefined || _req.query.pageSize !== undefined;
      if (shouldPaginate) {
        const pagination = paginationQuerySchema.parse({
          page: _req.query.page,
          pageSize: _req.query.pageSize,
        });
        return res.json(await storage.getBookingsPage(actor.userId, pagination));
      }
      return res.json(await storage.getBookings(actor.userId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.patch("/api/bookings/:id/status", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner"]);
      if (!actor) return;

      const validatedData = z
        .object({ status: bookingStatusSchema })
        .parse(req.body);
      const existing = await storage.getBookingById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (existing.ownerUserId !== actor.userId) {
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
      const shouldPaginate =
        req.query.page !== undefined || req.query.pageSize !== undefined;
      if (shouldPaginate) {
        const pagination = paginationQuerySchema.parse({
          page: req.query.page,
          pageSize: req.query.pageSize,
        });
        return res.json(await storage.getContractsPage(actor.userId, pagination));
      }
      return res.json(await storage.getContracts(actor.userId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.patch("/api/contracts/:id/status", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner"]);
      if (!actor) return;

      const validatedData = z
        .object({ status: contractStatusSchema })
        .parse(req.body);
      const existing = await storage.getContractById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Contract not found" });
      }
      if (existing.ownerUserId !== actor.userId) {
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
      const actor = await requireRole(req, res, ["student"]);
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
      const actor = await requireRole(req, res, ["owner"]);
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
      if (reviewListing.ownerUserId !== actor.userId) {
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
      res.json(await storage.getPublicRoommateProfiles(actor.userId));
    } catch (error) {
      console.error("Error fetching roommate profiles:", error);
      res.status(500).json({ error: "Failed to fetch roommate profiles" });
    }
  });

  app.get("/api/roommates/profiles/me", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const profiles = await storage.getRoommateProfiles(actor.userId);
      const profile =
        profiles.find((item) => item.userId === actor.userId) ?? null;
      res.json(profile);
    } catch (error) {
      console.error("Error fetching own roommate profile:", error);
      res.status(500).json({ error: "Failed to fetch roommate profile" });
    }
  });

  app.post("/api/roommates/profiles", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["student"]);
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
      if (profileId) {
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
      res.json(await storage.getRoommateMessages(req.params.matchId));
    } catch (error) {
      console.error("Error fetching roommate messages:", error);
      res.status(500).json({ error: "Failed to fetch roommate messages" });
    }
  });

  app.post("/api/roommates/messages", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["student"]);
      if (!actor) return;
      const validatedData = roommateMessageRequestSchema.parse(req.body);
      const senderProfile = await storage.getRoommateProfileById(
        validatedData.senderProfileId,
      );
      if (!senderProfile) {
        return res.status(404).json({ error: "Roommate profile not found" });
      }
      if (senderProfile.userId !== actor.userId) {
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

  registerUploadRoutes(app);

  return httpServer;
}
