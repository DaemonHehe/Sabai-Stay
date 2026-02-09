import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertListingSchema, insertBookingSchema } from "@shared/schema";
import { z } from "zod";

const availabilitySchema = z
  .object({
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
  })
  .refine((data) => data.checkIn < data.checkOut, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

const bookingRequestSchema = insertBookingSchema
  .omit({ totalPrice: true })
  .extend({
    guests: z.coerce.number().int().min(1).default(1),
  })
  .refine((data) => data.checkIn < data.checkOut, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

function formatZodError(error: z.ZodError) {
  return error.errors
    .map((detail) => {
      const path = detail.path.join(".") || "input";
      return `${path}: ${detail.message}`;
    })
    .join(", ");
}

function requireAdmin(req: Request, res: Response): boolean {
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
  app: Express
): Promise<Server> {
  
  // Get all listings
  app.get("/api/listings", async (req, res) => {
    try {
      const listings = await storage.getAllListings();
      res.json(listings);
    } catch (error) {
      console.error("Error fetching listings:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  // Get single listing
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

  // Create listing (admin only - no auth for now)
  app.post("/api/listings", async (req, res) => {
    try {
      if (requireAdmin(req, res)) {
        return;
      }

      const validatedData = insertListingSchema.parse(req.body);
      const listing = await storage.createListing(validatedData);
      res.status(201).json(listing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error creating listing:", error);
      res.status(500).json({ error: "Failed to create listing" });
    }
  });

  // Check availability
  app.post("/api/listings/:id/check-availability", async (req, res) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const { checkIn, checkOut } = availabilitySchema.parse(req.body);

      const available = await storage.checkAvailability(
        req.params.id,
        checkIn,
        checkOut,
      );

      res.json({ available });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error checking availability:", error);
      res.status(500).json({ error: "Failed to check availability" });
    }
  });

  // Create booking
  app.post("/api/bookings", async (req, res) => {
    try {
      const validatedData = bookingRequestSchema.parse(req.body);

      const listing = await storage.getListingById(validatedData.listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Check availability first
      const available = await storage.checkAvailability(
        validatedData.listingId,
        validatedData.checkIn,
        validatedData.checkOut
      );

      if (!available) {
        return res.status(409).json({ error: "Room is not available for selected dates" });
      }

      const booking = await storage.createBooking({
        ...validatedData,
        totalPrice: listing.price,
      });
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // Get all bookings (for a listing)
  app.get("/api/listings/:id/bookings", async (req, res) => {
    try {
      const bookings = await storage.getBookingsByListing(req.params.id);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  return httpServer;
}
