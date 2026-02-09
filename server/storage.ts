import "../env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { 
  listings, 
  bookings,
  type Listing, 
  type InsertListing,
  type Booking,
  type InsertBooking
} from "@shared/schema";
import { eq, and, gt, lt } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // Listings
  getAllListings(): Promise<Listing[]>;
  getListingById(id: string): Promise<Listing | undefined>;
  createListing(listing: InsertListing): Promise<Listing>;
  
  // Bookings
  getAllBookings(): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingsByListing(listingId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  checkAvailability(listingId: string, checkIn: Date, checkOut: Date): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Listings
  async getAllListings(): Promise<Listing[]> {
    return await db.select().from(listings);
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    const result = await db.select().from(listings).where(eq(listings.id, id));
    return result[0];
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const result = await db.insert(listings).values(listing).returning();
    return result[0];
  }

  // Bookings
  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings);
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id));
    return result[0];
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.listingId, listingId));
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const result = await db.insert(bookings).values(booking).returning();
    return result[0];
  }

  async checkAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<boolean> {
    // Check for any overlapping bookings
    const overlapping = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.listingId, listingId),
          // Booking overlaps if: new check-in < existing check-out AND new check-out > existing check-in
          gt(bookings.checkOut, checkIn),
          lt(bookings.checkIn, checkOut),
        ),
      );
    
    return overlapping.length === 0;
  }
}

export const storage = new DatabaseStorage();
