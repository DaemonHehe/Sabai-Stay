import "../env";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type Listing,
  type InsertListing,
  type Booking,
  type InsertBooking,
  listingSchema,
  bookingSchema,
} from "@shared/schema";
import { seedListings } from "./seed-data";

type ListingRow = {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: string | number;
  category: string;
  image: string;
  description: string;
  latitude: string | number;
  longitude: string | number;
  created_at: string;
};

type BookingRow = {
  id: string;
  listing_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: string;
  created_at: string;
};

function isTruthy(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

function shouldAllowMemoryFallback() {
  if (process.env.ALLOW_MEMORY_FALLBACK !== undefined) {
    return isTruthy(process.env.ALLOW_MEMORY_FALLBACK);
  }

  return process.env.NODE_ENV !== "production";
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey ?? anonKey;

  if (!url || !key) {
    return null;
  }

  return {
    url,
    key,
    usingServiceRole: Boolean(serviceRoleKey),
  };
}

function normalizeListingRow(row: ListingRow): Listing {
  return listingSchema.parse({
    id: row.id,
    title: row.title,
    location: row.location,
    price: row.price,
    rating: String(row.rating),
    category: row.category,
    image: row.image,
    description: row.description,
    latitude: String(row.latitude),
    longitude: String(row.longitude),
    createdAt: row.created_at,
  });
}

function normalizeBookingRow(row: BookingRow): Booking {
  return bookingSchema.parse({
    id: row.id,
    listingId: row.listing_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests,
    totalPrice: row.total_price,
    status: row.status,
    createdAt: row.created_at,
  });
}

function serializeListingInsert(listing: InsertListing) {
  return {
    title: listing.title,
    location: listing.location,
    price: listing.price,
    rating: listing.rating ?? "0.00",
    category: listing.category,
    image: listing.image,
    description: listing.description,
    latitude: listing.latitude,
    longitude: listing.longitude,
  };
}

function serializeBookingInsert(booking: InsertBooking) {
  return {
    listing_id: booking.listingId,
    guest_name: booking.guestName,
    guest_email: booking.guestEmail,
    guest_phone: booking.guestPhone,
    check_in: booking.checkIn.toISOString(),
    check_out: booking.checkOut.toISOString(),
    guests: booking.guests ?? 1,
    total_price: booking.totalPrice,
  };
}

function createListingRecord(listing: InsertListing): Listing {
  return {
    id: randomUUID(),
    title: listing.title,
    location: listing.location,
    price: listing.price,
    rating: listing.rating ?? "0.00",
    category: listing.category,
    image: listing.image,
    description: listing.description,
    latitude: listing.latitude,
    longitude: listing.longitude,
    createdAt: new Date(),
  };
}

function createBookingRecord(booking: InsertBooking): Booking {
  return {
    id: randomUUID(),
    listingId: booking.listingId,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guests: booking.guests ?? 1,
    totalPrice: booking.totalPrice,
    status: "pending",
    createdAt: new Date(),
  };
}

function hasOverlap(booking: Booking, checkIn: Date, checkOut: Date) {
  return booking.checkOut > checkIn && booking.checkIn < checkOut;
}

function throwSupabaseError(error: { message: string; code?: string } | null) {
  if (error) {
    throw new Error(error.code ? `${error.code}: ${error.message}` : error.message);
  }
}

export interface IStorage {
  getAllListings(): Promise<Listing[]>;
  getListingById(id: string): Promise<Listing | undefined>;
  createListing(listing: InsertListing): Promise<Listing>;

  getAllBookings(): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingsByListing(listingId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  checkAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<boolean>;
}

class MemoryStorage implements IStorage {
  private listings: Listing[];
  private bookings: Booking[];

  constructor(seed: InsertListing[]) {
    this.listings = seed.map(createListingRecord);
    this.bookings = [];
  }

  async getAllListings(): Promise<Listing[]> {
    return [...this.listings];
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    return this.listings.find((listing) => listing.id === id);
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const created = createListingRecord(listing);
    this.listings = [...this.listings, created];
    return created;
  }

  async getAllBookings(): Promise<Booking[]> {
    return [...this.bookings];
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    return this.bookings.find((booking) => booking.id === id);
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    return this.bookings.filter((booking) => booking.listingId === listingId);
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const created = createBookingRecord(booking);
    this.bookings = [...this.bookings, created];
    return created;
  }

  async checkAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<boolean> {
    return !this.bookings.some(
      (booking) =>
        booking.listingId === listingId && hasOverlap(booking, checkIn, checkOut),
    );
  }
}

export class SupabaseStorage implements IStorage {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly usingServiceRole: boolean,
  ) {}

  async seedListingsIfEmpty() {
    const { data, error } = await this.supabase
      .from("listings")
      .select("id")
      .limit(1);

    throwSupabaseError(error);

    if ((data?.length ?? 0) === 0) {
      const { error: insertError } = await this.supabase
        .from("listings")
        .insert(seedListings.map(serializeListingInsert));

      throwSupabaseError(insertError);
    }
  }

  async getAllListings(): Promise<Listing[]> {
    const { data, error } = await this.supabase.from("listings").select("*");
    throwSupabaseError(error);
    return (data ?? []).map((row) => normalizeListingRow(row as ListingRow));
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    const { data, error } = await this.supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    throwSupabaseError(error);
    return data ? normalizeListingRow(data as ListingRow) : undefined;
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const { data, error } = await this.supabase
      .from("listings")
      .insert(serializeListingInsert(listing))
      .select("*")
      .single();

    throwSupabaseError(error);
    return normalizeListingRow(data as ListingRow);
  }

  async getAllBookings(): Promise<Booking[]> {
    const { data, error } = await this.supabase.from("bookings").select("*");
    throwSupabaseError(error);
    return (data ?? []).map((row) => normalizeBookingRow(row as BookingRow));
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    throwSupabaseError(error);
    return data ? normalizeBookingRow(data as BookingRow) : undefined;
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select("*")
      .eq("listing_id", listingId);

    throwSupabaseError(error);
    return (data ?? []).map((row) => normalizeBookingRow(row as BookingRow));
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const { data, error } = await this.supabase
      .from("bookings")
      .insert(serializeBookingInsert(booking))
      .select("*")
      .single();

    throwSupabaseError(error);
    return normalizeBookingRow(data as BookingRow);
  }

  async checkAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select("id")
      .eq("listing_id", listingId)
      .gt("check_out", checkIn.toISOString())
      .lt("check_in", checkOut.toISOString())
      .limit(1);

    throwSupabaseError(error);
    return (data?.length ?? 0) === 0;
  }

  getAuthModeLabel() {
    return this.usingServiceRole ? "service_role" : "anon";
  }
}

async function createSupabaseStorage(): Promise<IStorage | null> {
  const allowMemoryFallback = shouldAllowMemoryFallback();
  const config = getSupabaseConfig();

  if (!config) {
    const legacyDatabaseUrl = process.env.DATABASE_URL;
    const missingConfigMessage = legacyDatabaseUrl
      ? "SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required. This project no longer uses DATABASE_URL."
      : "SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required.";

    if (!allowMemoryFallback) {
      throw new Error(missingConfigMessage);
    }

    console.log(`${missingConfigMessage} Falling back to seeded in-memory storage.`);
    return null;
  }

  const supabase = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const storage = new SupabaseStorage(supabase, config.usingServiceRole);
    await storage.seedListingsIfEmpty();
    console.log(
      `Connected to Supabase using ${storage.getAuthModeLabel()} credentials.`,
    );
    return storage;
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.name}${error.message ? `: ${error.message}` : ""}`
        : String(error);

    if (!allowMemoryFallback) {
      throw new Error(
        `Supabase unavailable (${detail}). Check SUPABASE_URL, key configuration, table names, and RLS policies.`,
      );
    }

    console.log(
      `Supabase unavailable or not ready (${detail}). Falling back to seeded in-memory storage.`,
    );
    return null;
  }
}

class ResilientStorage implements IStorage {
  private backendPromise?: Promise<IStorage>;

  async ready() {
    await this.getBackend();
  }

  private async getBackend(): Promise<IStorage> {
    if (!this.backendPromise) {
      this.backendPromise = this.initializeBackend();
    }

    return this.backendPromise;
  }

  private async initializeBackend(): Promise<IStorage> {
    const supabaseStorage = await createSupabaseStorage();
    if (supabaseStorage) {
      return supabaseStorage;
    }

    return new MemoryStorage(seedListings);
  }

  async getAllListings(): Promise<Listing[]> {
    return (await this.getBackend()).getAllListings();
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    return (await this.getBackend()).getListingById(id);
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    return (await this.getBackend()).createListing(listing);
  }

  async getAllBookings(): Promise<Booking[]> {
    return (await this.getBackend()).getAllBookings();
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    return (await this.getBackend()).getBookingById(id);
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    return (await this.getBackend()).getBookingsByListing(listingId);
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    return (await this.getBackend()).createBooking(booking);
  }

  async checkAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<boolean> {
    return (await this.getBackend()).checkAvailability(
      listingId,
      checkIn,
      checkOut,
    );
  }
}

export const storage = new ResilientStorage();

export async function initializeStorage() {
  await storage.ready();
}
