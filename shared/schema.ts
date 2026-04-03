import { z } from "zod";

export const userRoleSchema = z.enum(["student", "owner", "admin"]);
export const verificationStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
]);
export const roomTypeSchema = z.enum([
  "studio",
  "dorm",
  "condo",
  "apartment",
  "loft",
  "shared",
]);
export const listingStatusSchema = z.enum(["draft", "active", "archived"]);
export const moderationStatusSchema = z.enum([
  "pending",
  "approved",
  "flagged",
]);
export const bookingStatusSchema = z.enum([
  "requested",
  "approved",
  "deposit_pending",
  "confirmed",
  "rejected",
  "cancelled",
]);
export const contractStatusSchema = z.enum([
  "draft",
  "pending_signature",
  "active",
  "completed",
  "cancelled",
]);
export const transportModeSchema = z.enum(["walk", "shuttle", "songthaew"]);
export const studyHabitSchema = z.enum(["silent", "balanced", "social"]);
export const sleepScheduleSchema = z.enum(["early_bird", "flexible", "night_owl"]);
export const cleanlinessSchema = z.enum(["relaxed", "tidy", "meticulous"]);
export const genderPreferenceSchema = z.enum([
  "no_preference",
  "female_only",
  "male_only",
  "same_gender",
]);
export const disputeStatusSchema = z.enum([
  "open",
  "investigating",
  "resolved",
]);
export const notificationTypeSchema = z.enum([
  "booking",
  "review",
  "contract",
  "verification",
  "match",
  "system",
]);

export const utilityRatesSchema = z.object({
  electricityPerUnit: z.number().nonnegative(),
  waterPerUnit: z.number().nonnegative(),
  internetFee: z.number().nonnegative(),
  serviceFee: z.number().nonnegative(),
});

export const utilityEstimateSchema = z.object({
  electricityUsageUnits: z.number().nonnegative(),
  waterUsageUnits: z.number().nonnegative(),
  electricityCost: z.number().nonnegative(),
  waterCost: z.number().nonnegative(),
  internetCost: z.number().nonnegative(),
  serviceCost: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const leaseOptionSchema = z.object({
  months: z.number().int().positive(),
  label: z.string().min(1),
});

export const mapPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const campusZoneSchema = z.object({
  id: z.string(),
  universityId: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  walkingRadiusMeters: z.number().positive(),
});

export const transportRouteSchema = z.object({
  id: z.string(),
  universityId: z.string(),
  name: z.string().min(1),
  mode: transportModeSchema,
  description: z.string().min(1),
  stops: z.array(mapPointSchema).min(2),
});

export const listingSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  universityId: z.string(),
  title: z.string().min(1),
  location: z.string().min(1),
  price: z.number().int().nonnegative(),
  rating: z.string().default("0.00"),
  category: z.string().min(1),
  roomType: roomTypeSchema,
  image: z.string().min(1),
  gallery: z.array(z.string()).default([]),
  description: z.string().min(1),
  latitude: z.string().min(1),
  longitude: z.string().min(1),
  areaSqm: z.number().positive(),
  capacity: z.number().int().positive(),
  bedrooms: z.number().int().positive(),
  bathrooms: z.number().positive(),
  featured: z.boolean().default(false),
  listingStatus: listingStatusSchema.default("active"),
  moderationStatus: moderationStatusSchema.default("approved"),
  amenities: z.array(z.string()).default([]),
  nearestCampusZoneId: z.string(),
  walkingMinutes: z.number().int().nonnegative(),
  transportRouteIds: z.array(z.string()).default([]),
  utilityRates: utilityRatesSchema,
  internetIncluded: z.boolean().default(false),
  leaseOptions: z.array(leaseOptionSchema).default([]),
  availableFrom: z.coerce.date().nullable().optional(),
  availableTo: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const bookingTimelineEventSchema = z.object({
  id: z.string(),
  status: bookingStatusSchema,
  label: z.string().min(1),
  createdAt: z.coerce.date(),
});

export const bookingSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  studentUserId: z.string(),
  ownerUserId: z.string(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(1),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  guests: z.number().int().min(1).default(1),
  totalPrice: z.number().int().nonnegative(),
  depositAmount: z.number().int().nonnegative(),
  depositPaid: z.boolean().default(false),
  requestNote: z.string().default(""),
  status: bookingStatusSchema.default("requested"),
  timeline: z.array(bookingTimelineEventSchema).default([]),
  createdAt: z.coerce.date(),
});

export const contractDocumentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.string().min(1),
  uploadedAt: z.coerce.date(),
});

export const contractSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  listingId: z.string(),
  studentUserId: z.string(),
  ownerUserId: z.string(),
  leaseTermMonths: z.number().int().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: contractStatusSchema,
  documents: z.array(contractDocumentSchema).default([]),
  signedByStudent: z.boolean().default(false),
  signedByOwner: z.boolean().default(false),
  createdAt: z.coerce.date(),
});

export const reviewSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  studentUserId: z.string(),
  studentName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1),
  ownerResponse: z.string().nullable().default(null),
  createdAt: z.coerce.date(),
});

export const roommateProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  universityId: z.string(),
  displayName: z.string().min(1),
  bio: z.string().min(1),
  studyHabit: studyHabitSchema,
  sleepSchedule: sleepScheduleSchema,
  cleanliness: cleanlinessSchema,
  genderPreference: genderPreferenceSchema,
  budgetMin: z.number().int().nonnegative(),
  budgetMax: z.number().int().nonnegative(),
  preferredMoveIn: z.coerce.date(),
  preferredLeaseMonths: z.number().int().positive(),
  openToVisitors: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const roommateMatchSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  matchedProfileId: z.string(),
  compatibilityScore: z.number().int().min(0).max(100),
  sharedHighlights: z.array(z.string()).default([]),
});

export const roommateMessageSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  senderProfileId: z.string(),
  message: z.string().min(1),
  createdAt: z.coerce.date(),
});

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  userRole: userRoleSchema,
  read: z.boolean().default(false),
  createdAt: z.coerce.date(),
});

export const verificationTaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  role: userRoleSchema,
  name: z.string().min(1),
  status: verificationStatusSchema,
  submittedAt: z.coerce.date(),
});

export const disputeCaseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  status: disputeStatusSchema,
  createdAt: z.coerce.date(),
});

export const ownerAnalyticsSchema = z.object({
  listingCount: z.number().int().nonnegative(),
  activeListings: z.number().int().nonnegative(),
  pendingRequests: z.number().int().nonnegative(),
  occupancyRate: z.number().min(0).max(100),
  responseRate: z.number().min(0).max(100),
  confirmedRevenue: z.number().nonnegative(),
});

export const universitySchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1),
  emailDomain: z.string().min(1),
  campus: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const appUserSchema = z.object({
  id: z.string().uuid().or(z.string()),
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
  userId: z.string().uuid().or(z.string()),
  universityId: z.string().uuid().or(z.string()).nullable().optional(),
  studentNumber: z.string().nullable().optional(),
  universityEmail: z.string().email().nullable().optional(),
  verificationStatus: verificationStatusSchema.default("pending"),
  verifiedAt: z.coerce.date().nullable().optional(),
  roommateOptIn: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ownerProfileSchema = z.object({
  userId: z.string().uuid().or(z.string()),
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

export const listingFiltersSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  universityId: z.string().optional(),
  campusZoneId: z.string().optional(),
  roomType: roomTypeSchema.optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minCapacity: z.coerce.number().optional(),
  maxWalkingMinutes: z.coerce.number().optional(),
});

export const insertListingSchema = listingSchema.omit({
  id: true,
  createdAt: true,
});

export const insertBookingSchema = bookingSchema.omit({
  id: true,
  createdAt: true,
  timeline: true,
});

export const insertReviewSchema = reviewSchema.omit({
  id: true,
  ownerResponse: true,
  createdAt: true,
});

export const insertRoommateProfileSchema = roommateProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const discoveryDataSchema = z.object({
  universities: z.array(universitySchema),
  campusZones: z.array(campusZoneSchema),
  transportRoutes: z.array(transportRouteSchema),
});

export const dashboardDataSchema = z.object({
  ownerAnalytics: ownerAnalyticsSchema,
  ownerListings: z.array(listingSchema),
  ownerBookings: z.array(bookingSchema),
  contracts: z.array(contractSchema),
  roommateProfiles: z.array(roommateProfileSchema),
  roommateMatches: z.array(roommateMatchSchema),
  roommateMessages: z.array(roommateMessageSchema),
  verificationTasks: z.array(verificationTaskSchema),
  disputes: z.array(disputeCaseSchema),
  notifications: z.array(notificationSchema),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type ListingStatus = z.infer<typeof listingStatusSchema>;
export type ModerationStatus = z.infer<typeof moderationStatusSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type ContractStatus = z.infer<typeof contractStatusSchema>;
export type UtilityRates = z.infer<typeof utilityRatesSchema>;
export type UtilityEstimate = z.infer<typeof utilityEstimateSchema>;
export type LeaseOption = z.infer<typeof leaseOptionSchema>;
export type CampusZone = z.infer<typeof campusZoneSchema>;
export type TransportRoute = z.infer<typeof transportRouteSchema>;
export type Listing = z.infer<typeof listingSchema>;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Contract = z.infer<typeof contractSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type RoommateProfile = z.infer<typeof roommateProfileSchema>;
export type InsertRoommateProfile = z.infer<typeof insertRoommateProfileSchema>;
export type RoommateMatch = z.infer<typeof roommateMatchSchema>;
export type RoommateMessage = z.infer<typeof roommateMessageSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type VerificationTask = z.infer<typeof verificationTaskSchema>;
export type DisputeCase = z.infer<typeof disputeCaseSchema>;
export type OwnerAnalytics = z.infer<typeof ownerAnalyticsSchema>;
export type ListingFilters = z.infer<typeof listingFiltersSchema>;
export type University = z.infer<typeof universitySchema>;
export type AppUser = z.infer<typeof appUserSchema>;
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
export type AuthProfile = z.infer<typeof authProfileSchema>;
export type DiscoveryData = z.infer<typeof discoveryDataSchema>;
export type DashboardData = z.infer<typeof dashboardDataSchema>;
