import "../env";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type AppUser,
  type Booking,
  type BookingStatus,
  type CampusZone,
  type Contract,
  type ContractStatus,
  type DashboardData,
  type DiscoveryData,
  type DisputeCase,
  type InsertBooking,
  type InsertListing,
  type InsertReview,
  type Listing,
  type ListingFilters,
  type Notification,
  type OwnerAnalytics,
  type PublicRoommateProfile,
  type Review,
  type RoommateMatch,
  type RoommateMessage,
  type RoommateProfile,
  type TransportRoute,
  type University,
  type UtilityEstimate,
  type VerificationStatus,
  type VerificationTask,
  appUserSchema,
  bookingSchema,
  contractSchema,
  dashboardDataSchema,
  discoveryDataSchema,
  listingSchema,
  notificationSchema,
  reviewSchema,
  roommateMessageSchema,
  roommateProfileSchema,
  universitySchema,
  verificationTaskSchema,
} from "@shared/schema";
import { seedListings } from "./seed-data";
import {
  getSupabaseAnonKey,
  getSupabaseServerKey,
  getSupabaseUrl,
} from "./supabase-config";
import {
  asAppUserRole,
  calculateOwnerAnalyticsFrom,
  paginateArray,
  toPublicRoommateProfile,
} from "./storage/storage-helpers";

function hasOverlap(booking: Booking, checkIn: Date, checkOut: Date) {
  return booking.checkOut > checkIn && booking.checkIn < checkOut;
}

function createTimelineEvent(status: BookingStatus, label: string) {
  return {
    id: randomUUID(),
    status,
    label,
    createdAt: new Date(),
  };
}

const validBookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["deposit_pending", "rejected"],
  deposit_pending: ["confirmed", "rejected"],
  confirmed: ["cancelled"],
  rejected: [],
  cancelled: [],
};

function assertValidBookingTransition(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!validBookingTransitions[currentStatus].includes(nextStatus)) {
    throw new StorageError(
      `Invalid booking status transition from ${currentStatus} to ${nextStatus}`,
      "INVALID_BOOKING_TRANSITION",
    );
  }
}

function monthDiff(start: Date, end: Date) {
  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return Math.max(1, Math.round(days / 30));
}

function calculateUtilityEstimate(
  listing: Listing,
  electricityUsageUnits = 120,
  waterUsageUnits = 12,
): UtilityEstimate {
  const electricityCost =
    electricityUsageUnits * listing.utilityRates.electricityPerUnit;
  const waterCost = waterUsageUnits * listing.utilityRates.waterPerUnit;
  const internetCost = listing.internetIncluded
    ? 0
    : listing.utilityRates.internetFee;
  const serviceCost = listing.utilityRates.serviceFee;

  return {
    electricityUsageUnits,
    waterUsageUnits,
    electricityCost,
    waterCost,
    internetCost,
    serviceCost,
    total: electricityCost + waterCost + internetCost + serviceCost,
  };
}

function buildListing(input: InsertListing): Listing {
  return listingSchema.parse({
    id: randomUUID(),
    createdAt: new Date(),
    ...input,
  });
}

function buildBooking(input: InsertBooking): Booking {
  return bookingSchema.parse({
    id: randomUUID(),
    createdAt: new Date(),
    timeline: [
      createTimelineEvent("requested", "Booking request submitted"),
      ...(input.status !== "requested"
        ? [createTimelineEvent(input.status, `Booking moved to ${input.status}`)]
        : []),
    ],
    ...input,
  });
}

function buildContract(
  booking: Booking,
  status: ContractStatus,
  documents: Contract["documents"] = [],
): Contract {
  return contractSchema.parse({
    id: randomUUID(),
    bookingId: booking.id,
    listingId: booking.listingId,
    studentUserId: booking.studentUserId,
    ownerUserId: booking.ownerUserId,
    leaseTermMonths: monthDiff(booking.checkIn, booking.checkOut),
    startDate: booking.checkIn,
    endDate: booking.checkOut,
    status,
    documents,
    signedByStudent: status === "active",
    signedByOwner: status === "active",
    createdAt: new Date(),
  });
}

function isTruthy(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

function shouldAllowMemoryFallback() {
  if (process.env.ALLOW_MEMORY_FALLBACK !== undefined) {
    return isTruthy(process.env.ALLOW_MEMORY_FALLBACK);
  }

  if (process.env.VERCEL === "1") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

function getSupabaseConfig() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServerKey();
  const key = serviceRoleKey ?? getSupabaseAnonKey();

  if (!url || !key) {
    return null;
  }

  return {
    url,
    key,
    usingServiceRole: Boolean(serviceRoleKey),
  };
}

function throwSupabaseError(error: { message: string; code?: string } | null) {
  if (error) {
    throw new StorageError(error.message, error.code);
  }
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function humanizeSeedHandle(value: string) {
  return value
    .replace(/^owner-/, "")
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeAppUserRow(row: {
  id: string;
  role: AppUser["role"];
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}) {
  return appUserSchema.parse({
    id: row.id,
    role: asAppUserRole(row.role),
    fullName: row.full_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

type PaginationOptions = {
  page: number;
  pageSize: number;
};

type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export interface IStorage {
  getAppUserById(id: string): Promise<AppUser | null>;
  getAllListings(filters?: ListingFilters): Promise<Listing[]>;
  getListingsPage(
    filters: ListingFilters | undefined,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Listing>>;
  getListingsByOwner(ownerUserId: string): Promise<Listing[]>;
  getListingById(id: string): Promise<Listing | undefined>;
  createListing(listing: InsertListing): Promise<Listing>;
  updateListing(
    id: string,
    updates: Partial<InsertListing>,
  ): Promise<Listing | undefined>;
  getDiscoveryData(): Promise<DiscoveryData>;
  estimateUtilities(
    listingId: string,
    electricityUsageUnits?: number,
    waterUsageUnits?: number,
  ): Promise<UtilityEstimate>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(userId?: string): Promise<Booking[]>;
  getBookingsPage(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Booking>>;
  getBookingById(id: string): Promise<Booking | undefined>;
  updateBookingStatus(
    id: string,
    status: BookingStatus,
  ): Promise<Booking | undefined>;
  getContracts(userId?: string): Promise<Contract[]>;
  getContractsPage(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Contract>>;
  getContractById(id: string): Promise<Contract | undefined>;
  updateContractStatus(
    id: string,
    status: ContractStatus,
  ): Promise<Contract | undefined>;
  getReviewById(id: string): Promise<Review | undefined>;
  getReviewsByListing(listingId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  respondToReview(id: string, response: string): Promise<Review | undefined>;
  getPublicRoommateProfiles(userId: string): Promise<PublicRoommateProfile[]>;
  getRoommateProfileById(id: string): Promise<RoommateProfile | undefined>;
  getRoommateProfiles(userId?: string): Promise<RoommateProfile[]>;
  saveRoommateProfile(
    profile: Omit<RoommateProfile, "id" | "createdAt" | "updatedAt">,
  ): Promise<RoommateProfile>;
  getRoommateMatchById(id: string): Promise<RoommateMatch | undefined>;
  getRoommateMatches(profileId?: string): Promise<RoommateMatch[]>;
  getRoommateMessages(matchId: string): Promise<RoommateMessage[]>;
  sendRoommateMessage(
    matchId: string,
    senderProfileId: string,
    message: string,
  ): Promise<RoommateMessage>;
  getNotifications(userId?: string): Promise<Notification[]>;
  markNotificationRead(
    id: string,
    userId?: string,
  ): Promise<Notification | undefined>;
  getDashboardData(
    userId: string,
    role: AppUser["role"],
  ): Promise<DashboardData>;
  getVerificationTasks(): Promise<VerificationTask[]>;
  updateVerificationTask(
    id: string,
    status: VerificationStatus,
  ): Promise<VerificationTask | undefined>;
  getDisputes(): Promise<DisputeCase[]>;
  updateDisputeStatus(
    id: string,
    status: DisputeCase["status"],
  ): Promise<DisputeCase | undefined>;
}

export class MemoryStorage implements IStorage {
  private readonly universities: University[];
  private readonly campusZones: CampusZone[];
  private readonly transportRoutes: TransportRoute[];
  private listings: Listing[];
  private bookings: Booking[];
  private contracts: Contract[];
  private reviews: Review[];
  private roommateProfiles: RoommateProfile[];
  private roommateMessages: RoommateMessage[];
  private notifications: Notification[];
  private verificationTasks: VerificationTask[];
  private disputes: DisputeCase[];

  constructor() {
    this.universities = [
      universitySchema.parse({
        id: "rsu",
        name: "Rangsit University",
        emailDomain: "rsu.ac.th",
        campus: "Rangsit Main Campus",
        city: "Pathum Thani",
        createdAt: new Date("2026-01-01"),
      }),
    ];

    this.campusZones = [
      {
        id: "rsu-main-gate",
        universityId: "rsu",
        name: "Main Gate",
        description: "Primary arrival point with strongest food and transport access.",
        latitude: 13.9649,
        longitude: 100.5878,
        walkingRadiusMeters: 300,
      },
      {
        id: "rsu-library",
        universityId: "rsu",
        name: "Central Library",
        description: "Library area with quieter surroundings.",
        latitude: 13.9666,
        longitude: 100.5904,
        walkingRadiusMeters: 220,
      },
      {
        id: "rsu-engineering",
        universityId: "rsu",
        name: "Engineering Faculty",
        description: "Engineering side of campus with regular shuttle traffic.",
        latitude: 13.9692,
        longitude: 100.5926,
        walkingRadiusMeters: 240,
      },
      {
        id: "rsu-design",
        universityId: "rsu",
        name: "Design And Media",
        description: "Creative cluster used by loft and studio residents.",
        latitude: 13.9624,
        longitude: 100.5861,
        walkingRadiusMeters: 200,
      },
    ];

    this.transportRoutes = [
      {
        id: "rsu-shuttle-green",
        universityId: "rsu",
        name: "RSU Shuttle Green",
        mode: "shuttle",
        description: "University shuttle loop covering library, main gate, and dorm clusters.",
        stops: [
          { latitude: 13.9649, longitude: 100.5878 },
          { latitude: 13.9666, longitude: 100.5904 },
          { latitude: 13.9692, longitude: 100.5926 },
          { latitude: 13.972, longitude: 100.598 },
        ],
      },
      {
        id: "songthaew-muang-ake",
        universityId: "rsu",
        name: "Muang Ake Songthaew",
        mode: "songthaew",
        description: "Low-cost local route connecting Muang Ake and the campus gate.",
        stops: [
          { latitude: 13.964, longitude: 100.586 },
          { latitude: 13.963, longitude: 100.589 },
          { latitude: 13.9649, longitude: 100.5878 },
          { latitude: 13.966, longitude: 100.592 },
        ],
      },
    ];

    this.listings = seedListings.map(buildListing);
    const listingByTitle = new Map(this.listings.map((listing) => [listing.title, listing]));

    this.bookings = [
      buildBooking({
        listingId: listingByTitle.get("Plum Condo Park Rangsit")!.id,
        studentUserId: "student-001",
        ownerUserId: "owner-sabai-living",
        guestName: "Mali S.",
        guestEmail: "mali@student.test",
        guestPhone: "+66 89 111 0001",
        checkIn: new Date("2026-05-20"),
        checkOut: new Date("2026-09-20"),
        guests: 1,
        totalPrice: 34000,
        depositAmount: 8500,
        depositPaid: false,
        requestNote: "Need quiet study environment before midterms.",
        status: "requested",
      }),
      buildBooking({
        listingId: listingByTitle.get("Urban Cube Dorm")!.id,
        studentUserId: "student-002",
        ownerUserId: "owner-urban-cube",
        guestName: "Nok P.",
        guestEmail: "nok@student.test",
        guestPhone: "+66 89 111 0002",
        checkIn: new Date("2026-04-15"),
        checkOut: new Date("2026-08-15"),
        guests: 1,
        totalPrice: 24000,
        depositAmount: 6000,
        depositPaid: false,
        requestNote: "Looking for shared social environment near Muang Ake.",
        status: "deposit_pending",
      }),
      buildBooking({
        listingId: listingByTitle.get("Kave Town Space")!.id,
        studentUserId: "student-003",
        ownerUserId: "owner-kave",
        guestName: "Pat T.",
        guestEmail: "pat@student.test",
        guestPhone: "+66 89 111 0003",
        checkIn: new Date("2026-04-01"),
        checkOut: new Date("2026-10-01"),
        guests: 1,
        totalPrice: 72000,
        depositAmount: 12000,
        depositPaid: true,
        requestNote: "International program semester stay.",
        status: "confirmed",
      }),
    ];

    this.contracts = [
      buildContract(this.bookings[1], "pending_signature", [
        {
          id: randomUUID(),
          name: "Deposit Schedule.pdf",
          type: "payment_schedule",
          uploadedAt: new Date("2026-04-02"),
        },
      ]),
      buildContract(this.bookings[2], "active", [
        {
          id: randomUUID(),
          name: "Semester Lease.pdf",
          type: "lease",
          uploadedAt: new Date("2026-03-28"),
        },
      ]),
    ];

    this.reviews = [
      reviewSchema.parse({
        id: randomUUID(),
        listingId: listingByTitle.get("Plum Condo Park Rangsit")!.id,
        studentUserId: "student-010",
        studentName: "Fah K.",
        rating: 5,
        comment:
          "Accurate walking time, stable internet, and the utility estimate was very close to the real bill.",
        ownerResponse:
          "Thanks. We now include the latest utility sheet in every contract request.",
        createdAt: new Date("2026-03-10"),
      }),
      reviewSchema.parse({
        id: randomUUID(),
        listingId: listingByTitle.get("Urban Cube Dorm")!.id,
        studentUserId: "student-011",
        studentName: "Beam R.",
        rating: 4,
        comment:
          "Good location for Muang Ake food spots. Shared kitchen gets busy at night.",
        ownerResponse: null,
        createdAt: new Date("2026-03-22"),
      }),
    ];

    this.roommateProfiles = [
      roommateProfileSchema.parse({
        id: "roommate-001",
        userId: "student-001",
        universityId: "rsu",
        displayName: "Mali S.",
        bio: "Medical student looking for a quiet, tidy roommate for semester stays.",
        studyHabit: "silent",
        sleepSchedule: "early_bird",
        cleanliness: "meticulous",
        genderPreference: "same_gender",
        budgetMin: 7000,
        budgetMax: 11000,
        preferredMoveIn: new Date("2026-05-15"),
        preferredLeaseMonths: 4,
        openToVisitors: false,
        isActive: true,
        createdAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-20"),
      }),
      roommateProfileSchema.parse({
        id: "roommate-002",
        userId: "student-020",
        universityId: "rsu",
        displayName: "Pim N.",
        bio: "Design student with a flexible sleep schedule and interest in studio-style spaces.",
        studyHabit: "balanced",
        sleepSchedule: "flexible",
        cleanliness: "tidy",
        genderPreference: "no_preference",
        budgetMin: 8000,
        budgetMax: 13000,
        preferredMoveIn: new Date("2026-05-20"),
        preferredLeaseMonths: 6,
        openToVisitors: true,
        isActive: true,
        createdAt: new Date("2026-03-02"),
        updatedAt: new Date("2026-03-20"),
      }),
      roommateProfileSchema.parse({
        id: "roommate-003",
        userId: "student-030",
        universityId: "rsu",
        displayName: "Ton A.",
        bio: "Engineering student who wants a structured roommate and budget-friendly condo.",
        studyHabit: "silent",
        sleepSchedule: "night_owl",
        cleanliness: "tidy",
        genderPreference: "same_gender",
        budgetMin: 6000,
        budgetMax: 9500,
        preferredMoveIn: new Date("2026-04-25"),
        preferredLeaseMonths: 4,
        openToVisitors: false,
        isActive: true,
        createdAt: new Date("2026-03-04"),
        updatedAt: new Date("2026-03-25"),
      }),
    ];

    this.roommateMessages = [
      roommateMessageSchema.parse({
        id: randomUUID(),
        matchId: "match-roommate-001-roommate-002",
        senderProfileId: "roommate-001",
        message: "Hi, your move-in timing overlaps well with mine. Are you open to a condo near the main gate?",
        createdAt: new Date("2026-03-27T10:00:00"),
      }),
      roommateMessageSchema.parse({
        id: randomUUID(),
        matchId: "match-roommate-001-roommate-002",
        senderProfileId: "roommate-002",
        message: "Yes. I prefer a quiet unit with good study space and at least one shuttle option.",
        createdAt: new Date("2026-03-27T10:12:00"),
      }),
    ];

    this.notifications = [
      notificationSchema.parse({
        id: randomUUID(),
        type: "booking",
        title: "New booking request",
        body: "Plum Condo Park Rangsit received a new semester booking request.",
        userRole: "owner",
        read: false,
        createdAt: new Date("2026-04-01T09:00:00"),
      }),
      notificationSchema.parse({
        id: randomUUID(),
        type: "contract",
        title: "Contract awaiting signature",
        body: "Urban Cube Dorm contract is ready for landlord signature.",
        userRole: "owner",
        read: false,
        createdAt: new Date("2026-04-01T12:30:00"),
      }),
      notificationSchema.parse({
        id: randomUUID(),
        type: "match",
        title: "New roommate match",
        body: "A high-compatibility roommate match is available for Mali S.",
        userRole: "student",
        read: true,
        createdAt: new Date("2026-03-30T18:00:00"),
      }),
      notificationSchema.parse({
        id: randomUUID(),
        type: "verification",
        title: "Owner verification pending",
        body: "One owner business registration document needs review.",
        userRole: "owner",
        read: false,
        createdAt: new Date("2026-04-02T08:15:00"),
      }),
    ];

    this.verificationTasks = [
      verificationTaskSchema.parse({
        id: "verify-owner-kave",
        userId: "owner-kave",
        role: "owner",
        name: "Kave Residence Group",
        status: "pending",
        submittedAt: new Date("2026-04-01"),
      }),
      verificationTaskSchema.parse({
        id: "verify-student-090",
        userId: "student-090",
        role: "student",
        name: "New RSU Student",
        status: "pending",
        submittedAt: new Date("2026-04-02"),
      }),
    ];

    this.disputes = [
      {
        id: "dispute-001",
        title: "Utility charge discrepancy",
        description:
          "Student reported that the March electricity bill exceeded the estimated calculator output by 18%.",
        status: "investigating",
        createdAt: new Date("2026-03-29"),
      },
      {
        id: "dispute-002",
        title: "Listing gallery accuracy",
        description:
          "Admin flagged a listing because one gallery image appears to be from a common area not included in the unit.",
        status: "open",
        createdAt: new Date("2026-04-01"),
      },
    ];
  }

  async getAppUserById(id: string): Promise<AppUser | null> {
    return normalizeAppUserRow({
      id,
      role: id.startsWith("owner")
        ? "owner"
        : "student",
      full_name: null,
      phone: null,
      avatar_url: null,
      bio: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  private activeBookingsForListing(listingId: string) {
    return this.bookings.filter(
      (booking) =>
        booking.listingId === listingId &&
        booking.status !== "rejected" &&
        booking.status !== "cancelled",
    );
  }

  private addNotification(
    type: Notification["type"],
    userRole: Notification["userRole"],
    title: string,
    body: string,
    userId?: string,
  ) {
    this.notifications = [
      notificationSchema.parse({
        id: randomUUID(),
        userId,
        type,
        title,
        body,
        userRole,
        read: false,
        createdAt: new Date(),
      }),
      ...this.notifications,
    ];
  }

  private calculateOwnerAnalytics(
    ownerListings: Listing[] = this.listings,
    ownerBookings: Booking[] = this.bookings,
  ): OwnerAnalytics {
    return calculateOwnerAnalyticsFrom(ownerListings, ownerBookings);
  }

  private createOrUpdateContractForBooking(booking: Booking) {
    const existingIndex = this.contracts.findIndex(
      (contract) => contract.bookingId === booking.id,
    );

    let nextStatus: ContractStatus = "draft";
    if (booking.status === "deposit_pending") {
      nextStatus = "pending_signature";
    } else if (booking.status === "confirmed") {
      nextStatus = "active";
    } else if (booking.status === "cancelled" || booking.status === "rejected") {
      nextStatus = "cancelled";
    }

    const documents =
      existingIndex >= 0 ? this.contracts[existingIndex].documents : [];
    const contract = buildContract(booking, nextStatus, documents);

    if (existingIndex >= 0) {
      this.contracts[existingIndex] = {
        ...contract,
        id: this.contracts[existingIndex].id,
        createdAt: this.contracts[existingIndex].createdAt,
        documents,
      };
    } else if (booking.status !== "requested") {
      this.contracts = [contract, ...this.contracts];
    }
  }

  private compatibilityScore(
    a: RoommateProfile,
    b: RoommateProfile,
  ): RoommateMatch["compatibilityScore"] {
    let score = 45;

    if (a.studyHabit === b.studyHabit) {
      score += 20;
    }
    if (a.sleepSchedule === b.sleepSchedule) {
      score += 15;
    }
    if (a.cleanliness === b.cleanliness) {
      score += 10;
    }
    if (
      Math.abs(a.budgetMin - b.budgetMin) <= 2000 &&
      Math.abs(a.budgetMax - b.budgetMax) <= 2000
    ) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private matchHighlights(a: RoommateProfile, b: RoommateProfile) {
    const highlights: string[] = [];

    if (a.studyHabit === b.studyHabit) {
      highlights.push(`Both prefer a ${a.studyHabit} study environment`);
    }
    if (a.cleanliness === b.cleanliness) {
      highlights.push(`Shared cleanliness style: ${a.cleanliness}`);
    }
    if (a.sleepSchedule === b.sleepSchedule) {
      highlights.push(`Matching sleep schedule: ${a.sleepSchedule}`);
    }
    if (Math.abs(a.preferredLeaseMonths - b.preferredLeaseMonths) <= 2) {
      highlights.push("Lease duration expectations are closely aligned");
    }

    return highlights.slice(0, 3);
  }

  async getAllListings(filters?: ListingFilters): Promise<Listing[]> {
    const query = filters?.q?.trim().toLowerCase();

    return this.listings.filter((listing) => {
      if (listing.listingStatus === "archived") {
        return false;
      }
      if (filters?.category && filters.category !== "ALL" && listing.category !== filters.category) {
        return false;
      }
      if (filters?.universityId && listing.universityId !== filters.universityId) {
        return false;
      }
      if (filters?.campusZoneId && listing.nearestCampusZoneId !== filters.campusZoneId) {
        return false;
      }
      if (filters?.roomType && listing.roomType !== filters.roomType) {
        return false;
      }
      if (filters?.minPrice !== undefined && listing.price < filters.minPrice) {
        return false;
      }
      if (filters?.maxPrice !== undefined && listing.price > filters.maxPrice) {
        return false;
      }
      if (filters?.minCapacity !== undefined && listing.capacity < filters.minCapacity) {
        return false;
      }
      if (
        filters?.maxWalkingMinutes !== undefined &&
        listing.walkingMinutes > filters.maxWalkingMinutes
      ) {
        return false;
      }
      if (!query) {
        return true;
      }

      return [
        listing.title,
        listing.location,
        listing.category,
        listing.description,
        listing.roomType,
        ...listing.amenities,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }

  async getListingsPage(
    filters: ListingFilters | undefined,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Listing>> {
    return paginateArray(await this.getAllListings(filters), options);
  }

  async getListingsByOwner(ownerUserId: string): Promise<Listing[]> {
    return this.listings.filter((listing) => listing.ownerUserId === ownerUserId);
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    return this.listings.find((listing) => listing.id === id);
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const created = buildListing(listing);
    this.listings = [created, ...this.listings];
    this.addNotification(
      "system",
      "owner",
      "New listing submitted",
      `${created.title} was submitted and is awaiting moderation.`,
      created.ownerUserId,
    );
    return created;
  }

  async updateListing(
    id: string,
    updates: Partial<InsertListing>,
  ): Promise<Listing | undefined> {
    const index = this.listings.findIndex((listing) => listing.id === id);
    if (index < 0) {
      return undefined;
    }

    const updated = listingSchema.parse({
      ...this.listings[index],
      ...updates,
    });
    this.listings[index] = updated;
    return updated;
  }

  async getDiscoveryData(): Promise<DiscoveryData> {
    return discoveryDataSchema.parse({
      universities: this.universities,
      campusZones: this.campusZones,
      transportRoutes: this.transportRoutes,
    });
  }

  async estimateUtilities(
    listingId: string,
    electricityUsageUnits = 120,
    waterUsageUnits = 12,
  ): Promise<UtilityEstimate> {
    const listing = await this.getListingById(listingId);
    if (!listing) {
      throw new StorageError("Listing not found", "LISTING_NOT_FOUND");
    }

    return calculateUtilityEstimate(
      listing,
      electricityUsageUnits,
      waterUsageUnits,
    );
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const listing = await this.getListingById(booking.listingId);
    if (!listing) {
      throw new StorageError("Listing not found", "LISTING_NOT_FOUND");
    }

    const overlapping = this.activeBookingsForListing(booking.listingId).some(
      (existingBooking) =>
        hasOverlap(existingBooking, booking.checkIn, booking.checkOut),
    );

    if (overlapping) {
      throw new StorageError(
        "Room is not available for selected dates",
        "BOOKING_OVERLAP",
      );
    }

    const created = buildBooking(booking);
    this.bookings = [created, ...this.bookings];
    this.addNotification(
      "booking",
      "owner",
      "New booking request",
      `${created.guestName} requested ${listing.title}.`,
      created.ownerUserId,
    );
    return created;
  }

  async getBookings(userId?: string): Promise<Booking[]> {
    if (!userId) {
      return [...this.bookings];
    }

    return this.bookings.filter(
      (booking) =>
        booking.ownerUserId === userId || booking.studentUserId === userId,
    );
  }

  async getBookingsPage(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Booking>> {
    return paginateArray(await this.getBookings(userId), options);
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    return this.bookings.find((booking) => booking.id === id);
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
  ): Promise<Booking | undefined> {
    const index = this.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return undefined;
    }

    const current = this.bookings[index];
    assertValidBookingTransition(current.status, status);
    const nextBooking = bookingSchema.parse({
      ...current,
      status,
      depositPaid: status === "confirmed" ? true : current.depositPaid,
      timeline: [
        ...current.timeline,
        createTimelineEvent(status, `Booking marked as ${status}`),
      ],
    });

    this.bookings[index] = nextBooking;
    this.createOrUpdateContractForBooking(nextBooking);
    this.addNotification(
      "booking",
      "student",
      "Booking updated",
      `${nextBooking.guestName}'s request is now ${status.replaceAll("_", " ")}.`,
      nextBooking.studentUserId,
    );

    if (status === "deposit_pending" || status === "confirmed") {
        this.addNotification(
          "contract",
          "owner",
          "Contract status updated",
          `Contract package for ${nextBooking.guestName} is now ${status}.`,
          nextBooking.ownerUserId,
        );
    }

    return nextBooking;
  }

  async getContracts(userId?: string): Promise<Contract[]> {
    if (!userId) {
      return [...this.contracts];
    }

    return this.contracts.filter(
      (contract) =>
        contract.ownerUserId === userId || contract.studentUserId === userId,
    );
  }

  async getContractsPage(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Contract>> {
    return paginateArray(await this.getContracts(userId), options);
  }

  async getContractById(id: string): Promise<Contract | undefined> {
    return this.contracts.find((contract) => contract.id === id);
  }

  async updateContractStatus(
    id: string,
    status: ContractStatus,
  ): Promise<Contract | undefined> {
    const index = this.contracts.findIndex((contract) => contract.id === id);
    if (index < 0) {
      return undefined;
    }

    const updated = contractSchema.parse({
      ...this.contracts[index],
      status,
      signedByStudent:
        status === "active" ? true : this.contracts[index].signedByStudent,
      signedByOwner:
        status === "active" ? true : this.contracts[index].signedByOwner,
    });
    this.contracts[index] = updated;
    this.addNotification(
      "contract",
      "student",
      "Contract updated",
      `Contract ${updated.id.slice(0, 8)} is now ${status.replaceAll("_", " ")}.`,
      updated.studentUserId,
    );
    return updated;
  }

  async getReviewsByListing(listingId: string): Promise<Review[]> {
    return this.reviews.filter((review) => review.listingId === listingId);
  }

  async getReviewById(id: string): Promise<Review | undefined> {
    return this.reviews.find((review) => review.id === id);
  }

  async createReview(review: InsertReview): Promise<Review> {
    const created = reviewSchema.parse({
      id: randomUUID(),
      ownerResponse: null,
      createdAt: new Date(),
      ...review,
    });
    this.reviews = [created, ...this.reviews];
    const listing = await this.getListingById(created.listingId);
    this.addNotification(
      "review",
      "owner",
      "New review submitted",
      `${created.studentName} left a ${created.rating}-star review.`,
      listing?.ownerUserId,
    );
    return created;
  }

  async respondToReview(id: string, response: string): Promise<Review | undefined> {
    const index = this.reviews.findIndex((review) => review.id === id);
    if (index < 0) {
      return undefined;
    }

    const updated = reviewSchema.parse({
      ...this.reviews[index],
      ownerResponse: response,
    });
    this.reviews[index] = updated;
    return updated;
  }

  async getRoommateProfiles(userId?: string): Promise<RoommateProfile[]> {
    if (!userId) {
      return [...this.roommateProfiles];
    }

    return this.roommateProfiles.filter(
      (profile) => profile.userId === userId || profile.isActive,
    );
  }

  async getPublicRoommateProfiles(
    userId: string,
  ): Promise<PublicRoommateProfile[]> {
    return this.roommateProfiles
      .filter((profile) => profile.userId === userId || profile.isActive)
      .map(toPublicRoommateProfile);
  }

  async getRoommateProfileById(id: string): Promise<RoommateProfile | undefined> {
    return this.roommateProfiles.find((profile) => profile.id === id);
  }

  async saveRoommateProfile(
    profile: Omit<RoommateProfile, "id" | "createdAt" | "updatedAt">,
  ): Promise<RoommateProfile> {
    const index = this.roommateProfiles.findIndex(
      (current) => current.userId === profile.userId,
    );

    const nextProfile = roommateProfileSchema.parse({
      ...profile,
      id: index >= 0 ? this.roommateProfiles[index].id : randomUUID(),
      createdAt: index >= 0 ? this.roommateProfiles[index].createdAt : new Date(),
      updatedAt: new Date(),
    });

    if (index >= 0) {
      this.roommateProfiles[index] = nextProfile;
    } else {
      this.roommateProfiles = [nextProfile, ...this.roommateProfiles];
    }

    return nextProfile;
  }

  async getRoommateMatches(profileId?: string): Promise<RoommateMatch[]> {
    const sourceProfile =
      (profileId
        ? this.roommateProfiles.find((profile) => profile.id === profileId)
        : this.roommateProfiles[0]) ?? null;

    if (!sourceProfile) {
      return [];
    }

    return this.roommateProfiles
      .filter((profile) => profile.id !== sourceProfile.id && profile.isActive)
      .map((profile) => ({
        id: `match-${sourceProfile.id}-${profile.id}`,
        profileId: sourceProfile.id,
        matchedProfileId: profile.id,
        compatibilityScore: this.compatibilityScore(sourceProfile, profile),
        sharedHighlights: this.matchHighlights(sourceProfile, profile),
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  async getRoommateMatchById(id: string): Promise<RoommateMatch | undefined> {
    const allMatches = await Promise.all(
      this.roommateProfiles.map((profile) => this.getRoommateMatches(profile.id)),
    );

    return allMatches.flat().find((match) => match.id === id);
  }

  async getRoommateMessages(matchId: string): Promise<RoommateMessage[]> {
    return this.roommateMessages.filter((message) => message.matchId === matchId);
  }

  async sendRoommateMessage(
    matchId: string,
    senderProfileId: string,
    message: string,
  ): Promise<RoommateMessage> {
    const created = roommateMessageSchema.parse({
      id: randomUUID(),
      matchId,
      senderProfileId,
      message,
      createdAt: new Date(),
    });
    this.roommateMessages = [...this.roommateMessages, created];
    const match = await this.getRoommateMatchById(matchId);
    const recipientProfileId =
      match?.profileId === senderProfileId
        ? match.matchedProfileId
        : match?.profileId;
    const recipientProfile = recipientProfileId
      ? await this.getRoommateProfileById(recipientProfileId)
      : undefined;
    this.addNotification(
      "match",
      "student",
      "New roommate message",
      "A new roommate message was sent in your active match thread.",
      recipientProfile?.userId,
    );
    return created;
  }

  async getNotifications(userId?: string): Promise<Notification[]> {
    if (!userId) {
      return [...this.notifications];
    }

    const appUser = await this.getAppUserById(userId);
    if (!appUser) {
      return [];
    }

    return this.notifications.filter(
      (notification) =>
        notification.userId === userId ||
        (!notification.userId && notification.userRole === appUser.role),
    );
  }

  async markNotificationRead(
    id: string,
    userId?: string,
  ): Promise<Notification | undefined> {
    const appUser = userId ? await this.getAppUserById(userId) : null;
    const index = this.notifications.findIndex(
      (notification) =>
        notification.id === id &&
        (!userId ||
          notification.userId === userId ||
          (!notification.userId && notification.userRole === appUser?.role)),
    );
    if (index < 0) {
      return undefined;
    }

    const updated = notificationSchema.parse({
      ...this.notifications[index],
      read: true,
    });
    this.notifications[index] = updated;
    return updated;
  }

  async getDashboardData(
    userId: string,
    role: AppUser["role"],
  ): Promise<DashboardData> {
    const ownerListings =
      role === "owner" ? await this.getListingsByOwner(userId) : [];
    const ownerBookings = await this.getBookings(userId);
    const contracts = await this.getContracts(userId);
    const roommateProfiles = await this.getRoommateProfiles(userId);
    const viewerProfile =
      roommateProfiles.find((profile) => profile.userId === userId) ?? null;
    const roommateMatches = viewerProfile
      ? await this.getRoommateMatches(viewerProfile.id)
      : [];
    const matchIds = new Set(roommateMatches.map((match) => match.id));
    const roommateMessages = this.roommateMessages.filter((message) =>
      matchIds.has(message.matchId),
    );
    const notifications = await this.getNotifications(userId);

    return dashboardDataSchema.parse({
      ownerAnalytics: this.calculateOwnerAnalytics(ownerListings, ownerBookings),
      ownerListings,
      ownerBookings,
      contracts,
      roommateProfiles,
      roommateMatches,
      roommateMessages,
      verificationTasks: [],
      disputes: [],
      notifications,
    });
  }

  async getVerificationTasks(): Promise<VerificationTask[]> {
    return [...this.verificationTasks];
  }

  async updateVerificationTask(
    id: string,
    status: VerificationStatus,
  ): Promise<VerificationTask | undefined> {
    const index = this.verificationTasks.findIndex((task) => task.id === id);
    if (index < 0) {
      return undefined;
    }

    const updated = verificationTaskSchema.parse({
      ...this.verificationTasks[index],
      status,
    });
    this.verificationTasks[index] = updated;
    this.addNotification(
      "verification",
      "owner",
      "Verification updated",
      `${updated.name} is now ${status}.`,
    );
    return updated;
  }

  async getDisputes(): Promise<DisputeCase[]> {
    return [...this.disputes];
  }

  async updateDisputeStatus(
    id: string,
    status: DisputeCase["status"],
  ): Promise<DisputeCase | undefined> {
    const index = this.disputes.findIndex((dispute) => dispute.id === id);
    if (index < 0) {
      return undefined;
    }

    const updated = {
      ...this.disputes[index],
      status,
    };
    this.disputes[index] = updated;
    return updated;
  }
}

class SupabaseStorage implements IStorage {
  private discoveryCache: { value: DiscoveryData; expiresAt: number } | null =
    null;
  private static readonly DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly usingServiceRole: boolean,
  ) {}

  private async ensureSeedListingOwners() {
    const seedListingsByTitle = new Map(
      seedListings.map((listing) => [listing.title, listing.ownerUserId]),
    );
    const seedTitles = Array.from(seedListingsByTitle.keys());
    if (seedTitles.length === 0) {
      return;
    }

    const { data, error } = await this.supabase
      .from("listings")
      .select("id, title, owner_user_id")
      .in("title", seedTitles);
    throwSupabaseError(error);

    for (const row of data ?? []) {
      if (row.owner_user_id) {
        continue;
      }

      const ownerHandle = seedListingsByTitle.get(row.title);
      if (!ownerHandle) {
        continue;
      }

      try {
        const ownerId = await this.getOrCreateSeedOwnerId(ownerHandle);
        const { error: updateError } = await this.supabase
          .from("listings")
          .update({ owner_user_id: ownerId })
          .eq("id", row.id);
        throwSupabaseError(updateError);
      } catch (error) {
        console.warn(
          `Seed owner repair failed for listing ${row.title}. Booking requests for this listing will remain unavailable.`,
          error,
        );
      }
    }
  }

  async ensureSeedData() {
    const { count, error } = await this.supabase
      .from("listings")
      .select("id", { count: "exact", head: true });
    throwSupabaseError(error);

    if ((count ?? 0) > 0) {
      if (!this.usingServiceRole) {
        return;
      }

      await this.ensureSeedListingOwners();
      return;
    }

    if (!this.usingServiceRole) {
      throw new StorageError(
        "Supabase has no listings and SUPABASE_SERVICE_ROLE_KEY is not configured, so seed data cannot be created.",
        "SUPABASE_READONLY_EMPTY",
      );
    }

    const discovery = await this.getDiscoveryData();
    const primaryUniversity =
      discovery.universities.find(
        (university) => university.emailDomain.toLowerCase() === "rsu.ac.th",
      ) ?? discovery.universities[0];

    if (!primaryUniversity) {
      return;
    }

    const fallbackCampusZoneId =
      discovery.campusZones.find(
        (zone) => zone.universityId === primaryUniversity.id,
      )?.id ??
      discovery.campusZones[0]?.id ??
      "";

    const validRouteIds = new Set(discovery.transportRoutes.map((route) => route.id));
    const ownerIdByHandle = new Map<string, string>();
    for (const handle of Array.from(
      new Set(seedListings.map((listing) => listing.ownerUserId)),
    )) {
      try {
        ownerIdByHandle.set(handle, await this.getOrCreateSeedOwnerId(handle));
      } catch (error) {
        console.warn(
          `Seed owner creation failed for ${handle}. Inserting listing with null owner_user_id instead.`,
          error,
        );
      }
    }

    const payload = seedListings.map((listing) => ({
      owner_user_id: ownerIdByHandle.get(listing.ownerUserId) ?? null,
      university_id: primaryUniversity.id,
      title: listing.title,
      location: listing.location,
      price: listing.price,
      rating: listing.rating,
      category: listing.category,
      room_type: listing.roomType,
      image: listing.image,
      gallery: listing.gallery,
      description: listing.description,
      latitude: Number(listing.latitude),
      longitude: Number(listing.longitude),
      area_sqm: listing.areaSqm,
      capacity: listing.capacity,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      featured: listing.featured,
      listing_status: listing.listingStatus,
      moderation_status: listing.moderationStatus,
      amenities: listing.amenities,
      nearest_campus_zone_id: listing.nearestCampusZoneId || fallbackCampusZoneId,
      walking_minutes: listing.walkingMinutes,
      transport_route_ids: listing.transportRouteIds.filter((id) =>
        validRouteIds.has(id),
      ),
      utility_rates: listing.utilityRates,
      internet_included: listing.internetIncluded,
      lease_options: listing.leaseOptions,
      available_from: listing.availableFrom?.toISOString() ?? null,
      available_to: listing.availableTo?.toISOString() ?? null,
    }));

    const { error: insertError } = await this.supabase
      .from("listings")
      .insert(payload);
    throwSupabaseError(insertError);
  }

  private async getOrCreateSeedOwnerId(handle: string) {
    const email = `${handle}@seed.sabaistay.example`;
    const businessName = humanizeSeedHandle(handle) || "Seed Owner";
    const { data: users, error: listError } = await this.supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    throwSupabaseError(listError);

    const existing = users.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
      return existing.id;
    }

    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password: `${randomUUID()}!Seed1`,
      email_confirm: true,
      user_metadata: {
        role: "owner",
        full_name: businessName,
        business_name: businessName,
      },
    });
    throwSupabaseError(error);

    if (!data.user) {
      throw new StorageError("Failed to create seed owner", "SEED_OWNER_FAILED");
    }

    return data.user.id;
  }

  private normalizeListingRow(row: any): Listing {
    return listingSchema.parse({
      id: row.id,
      ownerUserId: row.owner_user_id ?? "",
      universityId: row.university_id ?? "",
      title: row.title,
      location: row.location,
      price: row.price,
      rating: String(row.rating ?? "0.00"),
      category: row.category,
      roomType: row.room_type ?? "studio",
      image: row.image,
      gallery: asStringArray(row.gallery),
      description: row.description,
      latitude: String(row.latitude),
      longitude: String(row.longitude),
      areaSqm: Number(row.area_sqm ?? 0),
      capacity: row.capacity ?? 1,
      bedrooms: row.bedrooms ?? 1,
      bathrooms: Number(row.bathrooms ?? 1),
      featured: Boolean(row.featured),
      listingStatus: row.listing_status ?? "active",
      moderationStatus: row.moderation_status ?? "approved",
      amenities: asStringArray(row.amenities),
      nearestCampusZoneId: row.nearest_campus_zone_id ?? "",
      walkingMinutes: row.walking_minutes ?? 0,
      transportRouteIds: asStringArray(row.transport_route_ids),
      utilityRates:
        row.utility_rates && typeof row.utility_rates === "object"
          ? row.utility_rates
          : {
              electricityPerUnit: 0,
              waterPerUnit: 0,
              internetFee: 0,
              serviceFee: 0,
            },
      internetIncluded: Boolean(row.internet_included),
      leaseOptions: asObjectArray(row.lease_options),
      availableFrom: row.available_from,
      availableTo: row.available_to,
      createdAt: row.created_at,
    });
  }

  private async loadTimelineRows(bookingIds?: string[]) {
    let query = this.supabase.from("booking_timeline_events").select("*");
    if (bookingIds && bookingIds.length > 0) {
      query = query.in("booking_id", bookingIds);
    }

    const { data, error } = await query.order("created_at", { ascending: true });
    throwSupabaseError(error);
    return data ?? [];
  }

  private normalizeBookingRow(row: any, timelineRows: any[]): Booking {
    return bookingSchema.parse({
      id: row.id,
      listingId: row.listing_id,
      studentUserId: row.student_user_id,
      ownerUserId: row.owner_user_id,
      guestName: row.guest_name,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone,
      checkIn: row.check_in,
      checkOut: row.check_out,
      guests: row.guests,
      totalPrice: row.total_price,
      depositAmount: row.deposit_amount,
      depositPaid: row.deposit_paid,
      requestNote: row.request_note ?? "",
      status: row.status,
      timeline: timelineRows
        .filter((timeline) => timeline.booking_id === row.id)
        .map((timeline) => ({
          id: timeline.id,
          status: timeline.status,
          label: timeline.label,
          createdAt: timeline.created_at,
        })),
      createdAt: row.created_at,
    });
  }

  private normalizeContractRow(row: any, documentRows: any[]): Contract {
    return contractSchema.parse({
      id: row.id,
      bookingId: row.booking_id,
      listingId: row.listing_id,
      studentUserId: row.student_user_id,
      ownerUserId: row.owner_user_id,
      leaseTermMonths: row.lease_term_months,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      documents: documentRows
        .filter((document) => document.contract_id === row.id)
        .map((document) => ({
          id: document.id,
          name: document.name,
          type: document.type,
          fileUrl: document.file_url ?? null,
          uploadedAt: document.uploaded_at,
        })),
      signedByStudent: row.signed_by_student,
      signedByOwner: row.signed_by_owner,
      createdAt: row.created_at,
    });
  }

  private normalizeReviewRow(row: any): Review {
    return reviewSchema.parse({
      id: row.id,
      listingId: row.listing_id,
      studentUserId: row.student_user_id,
      studentName: row.student_name,
      rating: row.rating,
      comment: row.comment,
      ownerResponse: row.owner_response,
      createdAt: row.created_at,
    });
  }

  private normalizeRoommateProfileRow(row: any): RoommateProfile {
    return roommateProfileSchema.parse({
      id: row.id,
      userId: row.user_id,
      universityId: row.university_id,
      displayName: row.display_name,
      bio: row.bio,
      studyHabit: row.study_habit,
      sleepSchedule: row.sleep_schedule,
      cleanliness: row.cleanliness,
      genderPreference: row.gender_preference,
      budgetMin: row.budget_min,
      budgetMax: row.budget_max,
      preferredMoveIn: row.preferred_move_in,
      preferredLeaseMonths: row.preferred_lease_months,
      openToVisitors: row.open_to_visitors,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private normalizeNotificationRow(row: any): Notification {
    return notificationSchema.parse({
      id: row.id,
      userId: row.user_id ?? undefined,
      userRole: asAppUserRole(row.user_role),
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.created_at,
    });
  }

  private async createNotification(input: {
    type: Notification["type"];
    userRole: Notification["userRole"];
    title: string;
    body: string;
    userId?: string;
  }) {
    const { error } = await this.supabase.from("notifications").insert({
      user_id: input.userId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      user_role: input.userRole,
      read: false,
    });
    throwSupabaseError(error);
  }

  async getAppUserById(id: string): Promise<AppUser | null> {
    const { data, error } = await this.supabase
      .from("app_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    return data ? normalizeAppUserRow(data) : null;
  }

  async getAllListings(filters?: ListingFilters): Promise<Listing[]> {
    let query = this.supabase
      .from("listings")
      .select("*")
      .neq("listing_status", "archived");

    if (filters?.category && filters.category !== "ALL") query = query.eq("category", filters.category);
    if (filters?.universityId) query = query.eq("university_id", filters.universityId);
    if (filters?.campusZoneId) query = query.eq("nearest_campus_zone_id", filters.campusZoneId);
    if (filters?.roomType) query = query.eq("room_type", filters.roomType);
    if (filters?.minPrice !== undefined) query = query.gte("price", filters.minPrice);
    if (filters?.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);
    if (filters?.minCapacity !== undefined) query = query.gte("capacity", filters.minCapacity);
    if (filters?.maxWalkingMinutes !== undefined) query = query.lte("walking_minutes", filters.maxWalkingMinutes);

    const { data, error } = await query.order("created_at", { ascending: false });
    throwSupabaseError(error);
    const listings = (data ?? []).map((row) => this.normalizeListingRow(row));

    if (!filters?.q?.trim()) return listings;
    const normalized = filters.q.trim().toLowerCase();
    return listings.filter((listing) =>
      [listing.title, listing.location, listing.category, listing.description, listing.roomType, ...listing.amenities].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }

  async getListingsPage(
    filters: ListingFilters | undefined,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Listing>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("listings")
      .select("*", { count: "exact" })
      .neq("listing_status", "archived");

    if (filters?.category && filters.category !== "ALL") {
      query = query.eq("category", filters.category);
    }
    if (filters?.universityId) {
      query = query.eq("university_id", filters.universityId);
    }
    if (filters?.campusZoneId) {
      query = query.eq("nearest_campus_zone_id", filters.campusZoneId);
    }
    if (filters?.roomType) {
      query = query.eq("room_type", filters.roomType);
    }
    if (filters?.minPrice !== undefined) {
      query = query.gte("price", filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte("price", filters.maxPrice);
    }
    if (filters?.minCapacity !== undefined) {
      query = query.gte("capacity", filters.minCapacity);
    }
    if (filters?.maxWalkingMinutes !== undefined) {
      query = query.lte("walking_minutes", filters.maxWalkingMinutes);
    }
    if (filters?.q?.trim()) {
      const queryText = filters.q.trim().replaceAll(",", " ");
      const searchPattern = `%${queryText}%`;
      query = query.or(
        [
          `title.ilike.${searchPattern}`,
          `location.ilike.${searchPattern}`,
          `description.ilike.${searchPattern}`,
          `category.ilike.${searchPattern}`,
          `room_type.ilike.${searchPattern}`,
        ].join(","),
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    throwSupabaseError(error);

    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.normalizeListingRow(row)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getListingsByOwner(ownerUserId: string): Promise<Listing[]> {
    const { data, error } = await this.supabase
      .from("listings")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false });
    throwSupabaseError(error);
    return (data ?? []).map((row) => this.normalizeListingRow(row));
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    const { data, error } = await this.supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    return data ? this.normalizeListingRow(data) : undefined;
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const { data, error } = await this.supabase
      .from("listings")
      .insert({
        owner_user_id: listing.ownerUserId,
        university_id: listing.universityId,
        title: listing.title,
        location: listing.location,
        price: listing.price,
        rating: listing.rating,
        category: listing.category,
        room_type: listing.roomType,
        image: listing.image,
        gallery: listing.gallery,
        description: listing.description,
        latitude: Number(listing.latitude),
        longitude: Number(listing.longitude),
        area_sqm: listing.areaSqm,
        capacity: listing.capacity,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        featured: listing.featured,
        listing_status: listing.listingStatus,
        moderation_status: listing.moderationStatus,
        amenities: listing.amenities,
        nearest_campus_zone_id: listing.nearestCampusZoneId,
        walking_minutes: listing.walkingMinutes,
        transport_route_ids: listing.transportRouteIds,
        utility_rates: listing.utilityRates,
        internet_included: listing.internetIncluded,
        lease_options: listing.leaseOptions,
        available_from: listing.availableFrom?.toISOString() ?? null,
        available_to: listing.availableTo?.toISOString() ?? null,
      })
      .select("*")
      .single();
    throwSupabaseError(error);
    return this.normalizeListingRow(data);
  }

  async updateListing(id: string, updates: Partial<InsertListing>): Promise<Listing | undefined> {
    const payload: Record<string, unknown> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) payload[key] = value;
    });
    if ("ownerUserId" in payload) payload.owner_user_id = payload.ownerUserId;
    if ("universityId" in payload) payload.university_id = payload.universityId;
    if ("roomType" in payload) payload.room_type = payload.roomType;
    if ("areaSqm" in payload) payload.area_sqm = payload.areaSqm;
    if ("nearestCampusZoneId" in payload) payload.nearest_campus_zone_id = payload.nearestCampusZoneId;
    if ("walkingMinutes" in payload) payload.walking_minutes = payload.walkingMinutes;
    if ("transportRouteIds" in payload) payload.transport_route_ids = payload.transportRouteIds;
    if ("utilityRates" in payload) payload.utility_rates = payload.utilityRates;
    if ("internetIncluded" in payload) payload.internet_included = payload.internetIncluded;
    if ("leaseOptions" in payload) payload.lease_options = payload.leaseOptions;
    if ("availableFrom" in payload) payload.available_from = updates.availableFrom?.toISOString() ?? null;
    if ("availableTo" in payload) payload.available_to = updates.availableTo?.toISOString() ?? null;
    delete payload.ownerUserId; delete payload.universityId; delete payload.roomType; delete payload.areaSqm; delete payload.nearestCampusZoneId; delete payload.walkingMinutes; delete payload.transportRouteIds; delete payload.utilityRates; delete payload.internetIncluded; delete payload.leaseOptions; delete payload.availableFrom; delete payload.availableTo;

    const { data, error } = await this.supabase.from("listings").update(payload).eq("id", id).select("*").maybeSingle();
    throwSupabaseError(error);
    return data ? this.normalizeListingRow(data) : undefined;
  }

  async getDiscoveryData(): Promise<DiscoveryData> {
    const now = Date.now();
    if (this.discoveryCache && this.discoveryCache.expiresAt > now) {
      return this.discoveryCache.value;
    }

    const [universitiesResult, zonesResult, routesResult] = await Promise.all([
      this.supabase
        .from("universities")
        .select("id, name, email_domain, campus, city, created_at")
        .order("name"),
      this.supabase
        .from("campus_zones")
        .select(
          "id, university_id, name, description, latitude, longitude, walking_radius_meters",
        )
        .order("name"),
      this.supabase
        .from("transport_routes")
        .select("id, university_id, name, mode, description, stops")
        .order("name"),
    ]);
    throwSupabaseError(universitiesResult.error);
    throwSupabaseError(zonesResult.error);
    throwSupabaseError(routesResult.error);

    const discovery = discoveryDataSchema.parse({
      universities: (universitiesResult.data ?? []).map((row) => universitySchema.parse({ id: row.id, name: row.name, emailDomain: row.email_domain, campus: row.campus, city: row.city, createdAt: row.created_at })),
      campusZones: (zonesResult.data ?? []).map((row) => ({ id: row.id, universityId: row.university_id, name: row.name, description: row.description, latitude: Number(row.latitude), longitude: Number(row.longitude), walkingRadiusMeters: row.walking_radius_meters })),
      transportRoutes: (routesResult.data ?? []).map((row) => ({ id: row.id, universityId: row.university_id, name: row.name, mode: row.mode, description: row.description, stops: asObjectArray(row.stops) })),
    });

    this.discoveryCache = {
      value: discovery,
      expiresAt: now + SupabaseStorage.DISCOVERY_CACHE_TTL_MS,
    };

    return discovery;
  }

  async estimateUtilities(listingId: string, electricityUsageUnits = 120, waterUsageUnits = 12): Promise<UtilityEstimate> {
    const listing = await this.getListingById(listingId);
    if (!listing) throw new StorageError("Listing not found", "LISTING_NOT_FOUND");
    return calculateUtilityEstimate(listing, electricityUsageUnits, waterUsageUnits);
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const { data, error } = await this.supabase
      .from("bookings")
      .insert({
        listing_id: booking.listingId,
        student_user_id: booking.studentUserId,
        owner_user_id: booking.ownerUserId,
        guest_name: booking.guestName,
        guest_email: booking.guestEmail,
        guest_phone: booking.guestPhone,
        check_in: booking.checkIn.toISOString(),
        check_out: booking.checkOut.toISOString(),
        guests: booking.guests,
        total_price: booking.totalPrice,
        deposit_amount: booking.depositAmount,
        deposit_paid: booking.depositPaid,
        request_note: booking.requestNote,
        status: booking.status,
      })
      .select("*")
      .single();
    throwSupabaseError(error);

    await this.supabase.from("booking_timeline_events").insert({
      booking_id: data.id,
      status: booking.status,
      label: "Booking request submitted",
    });

    const timelineRows = await this.loadTimelineRows([data.id]);
    await this.createNotification({
      type: "booking",
      userRole: "owner",
      title: "New booking request",
      body: `${booking.guestName} submitted a booking request.`,
      userId: booking.ownerUserId,
    });
    return this.normalizeBookingRow(data, timelineRows);
  }

  async getBookings(userId?: string): Promise<Booking[]> {
    let query = this.supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    if (userId) {
      query = query.or(`owner_user_id.eq.${userId},student_user_id.eq.${userId}`);
    }
    const { data, error } = await query;
    throwSupabaseError(error);
    const bookingRows = data ?? [];
    const timelineRows = await this.loadTimelineRows(bookingRows.map((row) => row.id));
    return bookingRows.map((row) => this.normalizeBookingRow(row, timelineRows));
  }

  async getBookingsPage(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Booking>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await this.supabase
      .from("bookings")
      .select("*", { count: "exact" })
      .or(`owner_user_id.eq.${userId},student_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .range(from, to);
    throwSupabaseError(error);

    const bookingRows = data ?? [];
    const timelineRows = await this.loadTimelineRows(
      bookingRows.map((row) => row.id),
    );
    const total = count ?? 0;

    return {
      items: bookingRows.map((row) => this.normalizeBookingRow(row, timelineRows)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const { data, error } = await this.supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    if (!data) {
      return undefined;
    }

    const timelineRows = await this.loadTimelineRows([id]);
    return this.normalizeBookingRow(data, timelineRows);
  }

  async updateBookingStatus(id: string, status: BookingStatus): Promise<Booking | undefined> {
    const current = await this.getBookingById(id);
    if (!current) return undefined;
    assertValidBookingTransition(current.status, status);

    const { data, error } = await this.supabase
      .from("bookings")
      .update({ status, deposit_paid: status === "confirmed" ? true : undefined })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwSupabaseError(error);
    if (!data) return undefined;

    await this.supabase.from("booking_timeline_events").insert({
      booking_id: id,
      status,
      label: `Booking marked as ${status}`,
    });

    if (status === "deposit_pending" || status === "confirmed") {
      await this.supabase.from("contracts").upsert(
        {
          booking_id: data.id,
          listing_id: data.listing_id,
          student_user_id: data.student_user_id,
          owner_user_id: data.owner_user_id,
          lease_term_months: monthDiff(new Date(data.check_in), new Date(data.check_out)),
          start_date: data.check_in,
          end_date: data.check_out,
          status: status === "confirmed" ? "active" : "pending_signature",
          signed_by_student: status === "confirmed",
          signed_by_owner: status === "confirmed",
        },
        { onConflict: "booking_id" },
      );
      await this.createNotification({
        type: "contract",
        userRole: "owner",
        title: "Contract status updated",
        body: `Contract package for ${data.guest_name} is now ${status}.`,
        userId: data.owner_user_id,
      });
    }

    const timelineRows = await this.loadTimelineRows([id]);
    await this.createNotification({
      type: "booking",
      userRole: "student",
      title: "Booking updated",
      body: `${data.guest_name}'s request is now ${status.replaceAll("_", " ")}.`,
      userId: data.student_user_id,
    });
    return this.normalizeBookingRow(data, timelineRows);
  }

  async getContracts(userId?: string): Promise<Contract[]> {
    let contractsQuery = this.supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });
    if (userId) {
      contractsQuery = contractsQuery.or(`owner_user_id.eq.${userId},student_user_id.eq.${userId}`);
    }
    const [contractsResult, docsResult] = await Promise.all([
      contractsQuery,
      this.supabase.from("contract_documents").select("*"),
    ]);
    throwSupabaseError(contractsResult.error);
    throwSupabaseError(docsResult.error);
    return (contractsResult.data ?? []).map((row) =>
      this.normalizeContractRow(row, docsResult.data ?? []),
    );
  }

  async getContractsPage(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Contract>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const contractsResult = await this.supabase
      .from("contracts")
      .select("*", { count: "exact" })
      .or(`owner_user_id.eq.${userId},student_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .range(from, to);
    throwSupabaseError(contractsResult.error);

    const contractRows = contractsResult.data ?? [];
    const contractIds = contractRows.map((row) => row.id);
    let documentRows: any[] = [];

    if (contractIds.length > 0) {
      const docsResult = await this.supabase
        .from("contract_documents")
        .select("*")
        .in("contract_id", contractIds);
      throwSupabaseError(docsResult.error);
      documentRows = docsResult.data ?? [];
    }

    const total = contractsResult.count ?? 0;
    return {
      items: contractRows.map((row) =>
        this.normalizeContractRow(row, documentRows),
      ),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getContractById(id: string): Promise<Contract | undefined> {
    const { data, error } = await this.supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    if (!data) {
      return undefined;
    }

    const { data: docs, error: docsError } = await this.supabase
      .from("contract_documents")
      .select("*")
      .eq("contract_id", id);
    throwSupabaseError(docsError);
    return this.normalizeContractRow(data, docs ?? []);
  }

  async updateContractStatus(id: string, status: ContractStatus): Promise<Contract | undefined> {
    const { data, error } = await this.supabase
      .from("contracts")
      .update({
        status,
        signed_by_student: status === "active" ? true : undefined,
        signed_by_owner: status === "active" ? true : undefined,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwSupabaseError(error);
    if (!data) return undefined;
    const { data: docs, error: docsError } = await this.supabase
      .from("contract_documents")
      .select("*")
      .eq("contract_id", id);
    throwSupabaseError(docsError);
    await this.createNotification({
      type: "contract",
      userRole: "student",
      title: "Contract updated",
      body: `Contract ${id.slice(0, 8)} is now ${status.replaceAll("_", " ")}.`,
      userId: data.student_user_id,
    });
    return this.normalizeContractRow(data, docs ?? []);
  }

  async getReviewsByListing(listingId: string): Promise<Review[]> {
    const { data, error } = await this.supabase
      .from("reviews")
      .select("*")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false });
    throwSupabaseError(error);
    return (data ?? []).map((row) => this.normalizeReviewRow(row));
  }

  async getReviewById(id: string): Promise<Review | undefined> {
    const { data, error } = await this.supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    return data ? this.normalizeReviewRow(data) : undefined;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const { data, error } = await this.supabase
      .from("reviews")
      .insert({
        listing_id: review.listingId,
        student_user_id: review.studentUserId,
        student_name: review.studentName,
        rating: review.rating,
        comment: review.comment,
      })
      .select("*")
      .single();
    throwSupabaseError(error);
    const listing = await this.getListingById(review.listingId);
    if (listing?.ownerUserId) {
      await this.createNotification({
        type: "review",
        userRole: "owner",
        title: "New review submitted",
        body: `${review.studentName} left a ${review.rating}-star review.`,
        userId: listing.ownerUserId,
      });
    }
    return this.normalizeReviewRow(data);
  }

  async respondToReview(id: string, response: string): Promise<Review | undefined> {
    const { data, error } = await this.supabase
      .from("reviews")
      .update({ owner_response: response })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwSupabaseError(error);
    return data ? this.normalizeReviewRow(data) : undefined;
  }

  async getRoommateProfiles(userId?: string): Promise<RoommateProfile[]> {
    let query = this.supabase
      .from("roommate_profiles")
      .select("*")
      .order("updated_at", { ascending: false });
    if (userId) {
      query = query.or(`user_id.eq.${userId},is_active.eq.true`);
    }
    const { data, error } = await query;
    throwSupabaseError(error);
    return (data ?? []).map((row) => this.normalizeRoommateProfileRow(row));
  }

  async getPublicRoommateProfiles(
    userId: string,
  ): Promise<PublicRoommateProfile[]> {
    const profiles = await this.getRoommateProfiles(userId);
    return profiles.map(toPublicRoommateProfile);
  }

  async getRoommateProfileById(id: string): Promise<RoommateProfile | undefined> {
    const { data, error } = await this.supabase
      .from("roommate_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    return data ? this.normalizeRoommateProfileRow(data) : undefined;
  }

  async saveRoommateProfile(profile: Omit<RoommateProfile, "id" | "createdAt" | "updatedAt">): Promise<RoommateProfile> {
    const { data, error } = await this.supabase
      .from("roommate_profiles")
      .upsert(
        {
          user_id: profile.userId,
          university_id: profile.universityId,
          display_name: profile.displayName,
          bio: profile.bio,
          study_habit: profile.studyHabit,
          sleep_schedule: profile.sleepSchedule,
          cleanliness: profile.cleanliness,
          gender_preference: profile.genderPreference,
          budget_min: profile.budgetMin,
          budget_max: profile.budgetMax,
          preferred_move_in: profile.preferredMoveIn.toISOString(),
          preferred_lease_months: profile.preferredLeaseMonths,
          open_to_visitors: profile.openToVisitors,
          is_active: profile.isActive,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    throwSupabaseError(error);
    return this.normalizeRoommateProfileRow(data);
  }

  async getRoommateMatches(profileId?: string): Promise<RoommateMatch[]> {
    const profiles = await this.getRoommateProfiles();
    const sourceProfile =
      (profileId
        ? profiles.find((profile) => profile.id === profileId)
        : profiles[0]) ?? null;

    if (!sourceProfile) {
      return [];
    }

    const matches = profiles
      .filter((profile) => profile.id !== sourceProfile.id && profile.isActive)
      .map((profile) => ({
        id: `match-${sourceProfile.id}-${profile.id}`,
        profileId: sourceProfile.id,
        matchedProfileId: profile.id,
        compatibilityScore: Math.max(
          0,
          Math.min(
            100,
            45 +
              (sourceProfile.studyHabit === profile.studyHabit ? 20 : 0) +
              (sourceProfile.sleepSchedule === profile.sleepSchedule ? 15 : 0) +
              (sourceProfile.cleanliness === profile.cleanliness ? 10 : 0) +
              (Math.abs(sourceProfile.budgetMin - profile.budgetMin) <= 2000 &&
              Math.abs(sourceProfile.budgetMax - profile.budgetMax) <= 2000
                ? 10
                : 0),
          ),
        ),
        sharedHighlights: [
          ...(sourceProfile.studyHabit === profile.studyHabit
            ? [`Both prefer a ${sourceProfile.studyHabit} study environment`]
            : []),
          ...(sourceProfile.cleanliness === profile.cleanliness
            ? [`Shared cleanliness style: ${sourceProfile.cleanliness}`]
            : []),
          ...(sourceProfile.sleepSchedule === profile.sleepSchedule
            ? [`Matching sleep schedule: ${sourceProfile.sleepSchedule}`]
            : []),
        ].slice(0, 3),
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    await this.supabase.from("roommate_matches").upsert(
      matches.map((match) => ({
        id: match.id,
        profile_id: match.profileId,
        matched_profile_id: match.matchedProfileId,
        compatibility_score: match.compatibilityScore,
        shared_highlights: match.sharedHighlights,
      })),
      { onConflict: "id" },
    );

    return matches;
  }

  async getRoommateMatchById(id: string): Promise<RoommateMatch | undefined> {
    const { data, error } = await this.supabase
      .from("roommate_matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(error);
    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      profileId: data.profile_id,
      matchedProfileId: data.matched_profile_id,
      compatibilityScore: data.compatibility_score,
      sharedHighlights: asStringArray(data.shared_highlights),
    };
  }

  async getRoommateMessages(matchId: string): Promise<RoommateMessage[]> {
    const { data, error } = await this.supabase
      .from("roommate_messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });
    throwSupabaseError(error);
    return (data ?? []).map((row) => roommateMessageSchema.parse({ id: row.id, matchId: row.match_id, senderProfileId: row.sender_profile_id, message: row.message, createdAt: row.created_at }));
  }

  async sendRoommateMessage(matchId: string, senderProfileId: string, message: string): Promise<RoommateMessage> {
    const { data, error } = await this.supabase
      .from("roommate_messages")
      .insert({ match_id: matchId, sender_profile_id: senderProfileId, message })
      .select("*")
      .single();
    throwSupabaseError(error);
    const match = await this.getRoommateMatchById(matchId);
    const recipientProfileId =
      match?.profileId === senderProfileId
        ? match.matchedProfileId
        : match?.profileId;
    const recipientProfile = recipientProfileId
      ? await this.getRoommateProfileById(recipientProfileId)
      : undefined;
    if (recipientProfile?.userId) {
      await this.createNotification({
        type: "match",
        userRole: "student",
        title: "New roommate message",
        body: "A new roommate message was sent in your active match thread.",
        userId: recipientProfile.userId,
      });
    }
    return roommateMessageSchema.parse({ id: data.id, matchId: data.match_id, senderProfileId: data.sender_profile_id, message: data.message, createdAt: data.created_at });
  }

  async getNotifications(userId?: string): Promise<Notification[]> {
    const viewerRole = userId ? (await this.getAppUserById(userId))?.role : null;
    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    throwSupabaseError(error);
    return (data ?? [])
      .map((row) => this.normalizeNotificationRow(row))
      .filter(
        (notification) =>
          !userId ||
          notification.userId === userId ||
          (!notification.userId && notification.userRole === viewerRole),
      );
  }

  async markNotificationRead(id: string, userId?: string): Promise<Notification | undefined> {
    const viewerRole = userId ? (await this.getAppUserById(userId))?.role : null;
    const { data: existing, error: existingError } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwSupabaseError(existingError);
    if (!existing) {
      return undefined;
    }

    const allowed =
      !userId ||
      existing.user_id === userId ||
      (!existing.user_id && existing.user_role === viewerRole);
    if (!allowed) {
      return undefined;
    }

    const { data, error } = await this.supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwSupabaseError(error);
    return data ? this.normalizeNotificationRow(data) : undefined;
  }

  async getDashboardData(
    userId: string,
    role: AppUser["role"],
  ): Promise<DashboardData> {
    const [ownerListings, ownerBookings, contracts, roommateProfiles, notifications] =
      await Promise.all([
        role === "owner" ? this.getListingsByOwner(userId) : Promise.resolve([]),
        this.getBookings(userId),
        this.getContracts(userId),
        this.getRoommateProfiles(userId),
        this.getNotifications(userId),
      ]);

    const viewerProfile =
      roommateProfiles.find((profile) => profile.userId === userId) ?? null;
    const roommateMatches = viewerProfile
      ? await this.getRoommateMatches(viewerProfile.id)
      : [];
    const matchIds = roommateMatches.map((match) => match.id);
    let roommateMessages: RoommateMessage[] = [];

    if (matchIds.length > 0) {
      const { data: roommateMessagesRaw, error: roommateMessagesError } =
        await this.supabase
          .from("roommate_messages")
          .select("*")
          .in("match_id", matchIds)
          .order("created_at", { ascending: true });
      throwSupabaseError(roommateMessagesError);
      roommateMessages = (roommateMessagesRaw ?? []).map((row) =>
        roommateMessageSchema.parse({
          id: row.id,
          matchId: row.match_id,
          senderProfileId: row.sender_profile_id,
          message: row.message,
          createdAt: row.created_at,
        }),
      );
    }

    return dashboardDataSchema.parse({
      ownerAnalytics: calculateOwnerAnalyticsFrom(ownerListings, ownerBookings),
      ownerListings,
      ownerBookings,
      contracts,
      roommateProfiles,
      roommateMatches,
      roommateMessages,
      verificationTasks: [],
      disputes: [],
      notifications,
    });
  }

  async getVerificationTasks(): Promise<VerificationTask[]> {
    const { data, error } = await this.supabase.from("verification_tasks").select("*").order("submitted_at", { ascending: false });
    throwSupabaseError(error);
    return (data ?? []).map((row) => verificationTaskSchema.parse({ id: row.id, userId: row.user_id, role: asAppUserRole(row.role), name: row.name, status: row.status, submittedAt: row.submitted_at }));
  }

  async updateVerificationTask(id: string, status: VerificationStatus): Promise<VerificationTask | undefined> {
    const { data, error } = await this.supabase.from("verification_tasks").update({ status }).eq("id", id).select("*").maybeSingle();
    throwSupabaseError(error);
    if (!data) {
      return undefined;
    }

    await this.createNotification({
      type: "verification",
      userRole: asAppUserRole(data.role),
      title: "Verification updated",
      body: `${data.name} is now ${status}.`,
      userId: data.user_id,
    });

    return verificationTaskSchema.parse({ id: data.id, userId: data.user_id, role: asAppUserRole(data.role), name: data.name, status: data.status, submittedAt: data.submitted_at });
  }

  async getDisputes(): Promise<DisputeCase[]> {
    const { data, error } = await this.supabase.from("disputes").select("*").order("created_at", { ascending: false });
    throwSupabaseError(error);
    return (data ?? []).map((row) => ({ id: row.id, title: row.title, description: row.description, status: row.status, createdAt: new Date(row.created_at) }));
  }

  async updateDisputeStatus(id: string, status: DisputeCase["status"]): Promise<DisputeCase | undefined> {
    const { data, error } = await this.supabase.from("disputes").update({ status }).eq("id", id).select("*").maybeSingle();
    throwSupabaseError(error);
    return data ? { id: data.id, title: data.title, description: data.description, status: data.status, createdAt: new Date(data.created_at) } : undefined;
  }

  getAuthModeLabel() {
    return this.usingServiceRole ? "service_role" : "readonly";
  }
}

async function createSupabaseStorage(): Promise<IStorage | null> {
  const allowMemoryFallback = shouldAllowMemoryFallback();
  const config = getSupabaseConfig();

  if (!config) {
    const missingConfigMessage =
      "Supabase URL plus SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required for server storage.";
    if (!allowMemoryFallback) {
      throw new Error(missingConfigMessage);
    }
    console.log(`${missingConfigMessage} Falling back to seeded in-memory storage.`);
    return null;
  }

  try {
    const supabase = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const storage = new SupabaseStorage(supabase, config.usingServiceRole);
    const { error } = await supabase.from("app_users").select("id").limit(1);
    throwSupabaseError(error);
    await storage.ensureSeedData();
    console.log(`Connected to Supabase using ${storage.getAuthModeLabel()} credentials.`);
    return storage;
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (!allowMemoryFallback) {
      throw new Error(`Supabase unavailable (${detail}). Check configuration, tables, and RLS policies.`);
    }
    console.log(`Supabase unavailable or not ready (${detail}). Falling back to seeded in-memory storage.`);
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
    return new MemoryStorage();
  }

  async getAppUserById(id: string) { return (await this.getBackend()).getAppUserById(id); }
  async getAllListings(filters?: ListingFilters) { return (await this.getBackend()).getAllListings(filters); }
  async getListingsPage(filters: ListingFilters | undefined, options: PaginationOptions) { return (await this.getBackend()).getListingsPage(filters, options); }
  async getListingsByOwner(ownerUserId: string) { return (await this.getBackend()).getListingsByOwner(ownerUserId); }
  async getListingById(id: string) { return (await this.getBackend()).getListingById(id); }
  async createListing(listing: InsertListing) { return (await this.getBackend()).createListing(listing); }
  async updateListing(id: string, updates: Partial<InsertListing>) { return (await this.getBackend()).updateListing(id, updates); }
  async getDiscoveryData() { return (await this.getBackend()).getDiscoveryData(); }
  async estimateUtilities(listingId: string, electricityUsageUnits?: number, waterUsageUnits?: number) { return (await this.getBackend()).estimateUtilities(listingId, electricityUsageUnits, waterUsageUnits); }
  async createBooking(booking: InsertBooking) { return (await this.getBackend()).createBooking(booking); }
  async getBookings(userId?: string) { return (await this.getBackend()).getBookings(userId); }
  async getBookingsPage(userId: string, options: PaginationOptions) { return (await this.getBackend()).getBookingsPage(userId, options); }
  async getBookingById(id: string) { return (await this.getBackend()).getBookingById(id); }
  async updateBookingStatus(id: string, status: BookingStatus) { return (await this.getBackend()).updateBookingStatus(id, status); }
  async getContracts(userId?: string) { return (await this.getBackend()).getContracts(userId); }
  async getContractsPage(userId: string, options: PaginationOptions) { return (await this.getBackend()).getContractsPage(userId, options); }
  async getContractById(id: string) { return (await this.getBackend()).getContractById(id); }
  async updateContractStatus(id: string, status: ContractStatus) { return (await this.getBackend()).updateContractStatus(id, status); }
  async getReviewById(id: string) { return (await this.getBackend()).getReviewById(id); }
  async getReviewsByListing(listingId: string) { return (await this.getBackend()).getReviewsByListing(listingId); }
  async createReview(review: InsertReview) { return (await this.getBackend()).createReview(review); }
  async respondToReview(id: string, response: string) { return (await this.getBackend()).respondToReview(id, response); }
  async getPublicRoommateProfiles(userId: string) { return (await this.getBackend()).getPublicRoommateProfiles(userId); }
  async getRoommateProfileById(id: string) { return (await this.getBackend()).getRoommateProfileById(id); }
  async getRoommateProfiles(userId?: string) { return (await this.getBackend()).getRoommateProfiles(userId); }
  async saveRoommateProfile(profile: Omit<RoommateProfile, "id" | "createdAt" | "updatedAt">) { return (await this.getBackend()).saveRoommateProfile(profile); }
  async getRoommateMatchById(id: string) { return (await this.getBackend()).getRoommateMatchById(id); }
  async getRoommateMatches(profileId?: string) { return (await this.getBackend()).getRoommateMatches(profileId); }
  async getRoommateMessages(matchId: string) { return (await this.getBackend()).getRoommateMessages(matchId); }
  async sendRoommateMessage(matchId: string, senderProfileId: string, message: string) { return (await this.getBackend()).sendRoommateMessage(matchId, senderProfileId, message); }
  async getNotifications(userId?: string) { return (await this.getBackend()).getNotifications(userId); }
  async markNotificationRead(id: string, userId?: string) { return (await this.getBackend()).markNotificationRead(id, userId); }
  async getDashboardData(userId: string, role: AppUser["role"]) { return (await this.getBackend()).getDashboardData(userId, role); }
  async getVerificationTasks() { return (await this.getBackend()).getVerificationTasks(); }
  async updateVerificationTask(id: string, status: VerificationStatus) { return (await this.getBackend()).updateVerificationTask(id, status); }
  async getDisputes() { return (await this.getBackend()).getDisputes(); }
  async updateDisputeStatus(id: string, status: DisputeCase["status"]) { return (await this.getBackend()).updateDisputeStatus(id, status); }
}

export const storage = new ResilientStorage();

export async function initializeStorage() {
  await storage.ready();
}
