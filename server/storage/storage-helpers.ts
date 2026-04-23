import {
  type AppUser,
  type Booking,
  type Listing,
  type OwnerAnalytics,
  type PublicRoommateProfile,
  type RoommateProfile,
  publicRoommateProfileSchema,
} from "@shared/schema";

type PaginateInput = {
  page: number;
  pageSize: number;
};

export function paginateArray<T>(items: T[], input: PaginateInput) {
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, input.pageSize);
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export function asAppUserRole(value: unknown): AppUser["role"] {
  if (value === "owner" || value === "admin") {
    return "owner";
  }

  return "student";
}

export function calculateOwnerAnalyticsFrom(
  ownerListings: Listing[],
  ownerBookings: Booking[],
): OwnerAnalytics {
  const activeListings = ownerListings.filter(
    (listing) => listing.listingStatus === "active",
  );
  const pendingRequests = ownerBookings.filter(
    (booking) => booking.status === "requested" || booking.status === "deposit_pending",
  ).length;
  const confirmedBookings = ownerBookings.filter(
    (booking) => booking.status === "confirmed",
  );

  return {
    listingCount: ownerListings.length,
    activeListings: activeListings.length,
    pendingRequests,
    occupancyRate:
      ownerListings.length === 0
        ? 0
        : Math.round((confirmedBookings.length / ownerListings.length) * 100),
    responseRate: 92,
    confirmedRevenue: confirmedBookings.reduce(
      (total, booking) => total + booking.totalPrice,
      0,
    ),
  };
}

export function toPublicRoommateProfile(
  profile: RoommateProfile,
): PublicRoommateProfile {
  return publicRoommateProfileSchema.parse({
    id: profile.id,
    universityId: profile.universityId,
    displayName: profile.displayName,
    studyHabit: profile.studyHabit,
    sleepSchedule: profile.sleepSchedule,
    cleanliness: profile.cleanliness,
    genderPreference: profile.genderPreference,
    budgetMin: profile.budgetMin,
    budgetMax: profile.budgetMax,
    preferredMoveIn: profile.preferredMoveIn,
    preferredLeaseMonths: profile.preferredLeaseMonths,
    openToVisitors: profile.openToVisitors,
    isActive: profile.isActive,
    updatedAt: profile.updatedAt,
  });
}
