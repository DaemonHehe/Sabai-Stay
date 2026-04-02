import { z } from "zod";

export const userRoleSchema = z.enum(["student", "owner", "admin"]);
export const verificationStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
]);

export const listingSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  location: z.string().min(1),
  price: z.number().int().nonnegative(),
  rating: z.string().default("0.00"),
  category: z.string().min(1),
  image: z.string().min(1),
  description: z.string().min(1),
  latitude: z.string().min(1),
  longitude: z.string().min(1),
  createdAt: z.coerce.date(),
});

export const bookingSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(1),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  guests: z.number().int().min(1).default(1),
  totalPrice: z.number().int().nonnegative(),
  status: z.string().default("pending"),
  createdAt: z.coerce.date(),
});

export const insertListingSchema = listingSchema.omit({
  id: true,
  createdAt: true,
});

export const insertBookingSchema = bookingSchema.omit({
  id: true,
  createdAt: true,
  status: true,
});

export const universitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  emailDomain: z.string().min(1),
  campus: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const appUserSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
  fullName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const studentProfileSchema = z.object({
  userId: z.string().uuid(),
  universityId: z.string().uuid().nullable().optional(),
  studentNumber: z.string().nullable().optional(),
  universityEmail: z.string().email().nullable().optional(),
  verificationStatus: verificationStatusSchema.default("pending"),
  verifiedAt: z.coerce.date().nullable().optional(),
  roommateOptIn: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ownerProfileSchema = z.object({
  userId: z.string().uuid(),
  businessName: z.string().nullable().optional(),
  businessRegistrationNumber: z.string().nullable().optional(),
  verificationStatus: verificationStatusSchema.default("pending"),
  verificationDocuments: z.array(z.unknown()).default([]),
  verifiedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const authProfileSchema = z.object({
  appUser: appUserSchema,
  studentProfile: studentProfileSchema.nullable().default(null),
  ownerProfile: ownerProfileSchema.nullable().default(null),
});

export type Listing = z.infer<typeof listingSchema>;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type University = z.infer<typeof universitySchema>;
export type AppUser = z.infer<typeof appUserSchema>;
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
export type AuthProfile = z.infer<typeof authProfileSchema>;
