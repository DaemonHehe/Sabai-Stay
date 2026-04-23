import { z } from "zod";
import {
  Booking,
  BookingStatus,
  Contract,
  ContractStatus,
  DashboardData,
  DiscoveryData,
  InsertListing,
  InsertReview,
  Listing,
  ListingFilters,
  Notification,
  PaginatedBookings,
  PaginatedContracts,
  PaginatedListings,
  PublicRoommateProfile,
  Review,
  RoommateMatch,
  RoommateMessage,
  RoommateProfile,
  UtilityEstimate,
  bookingSchema,
  contractSchema,
  dashboardDataSchema,
  discoveryDataSchema,
  listingSchema,
  notificationSchema,
  paginatedBookingsSchema,
  paginatedContractsSchema,
  paginatedListingsSchema,
  publicRoommateProfileSchema,
  reviewSchema,
  roommateMatchSchema,
  roommateMessageSchema,
  roommateProfileSchema,
  utilityEstimateSchema,
} from "@shared/schema";
import { getSupabaseAccessToken } from "@/lib/supabase";

const API_BASE = "/api";
const SESSION_EXPIRED_EVENT_COOLDOWN_MS = 5000;
let lastSessionExpiredEventAt = 0;

function dispatchSessionExpiredEvent() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastSessionExpiredEventAt < SESSION_EXPIRED_EVENT_COOLDOWN_MS) {
    return;
  }

  lastSessionExpiredEventAt = now;
  window.dispatchEvent(new CustomEvent("sabai:session-expired"));
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: fallbackMessage }));
    const errorMessage =
      typeof errorData.error === "string" ? errorData.error : fallbackMessage;

    if (response.status === 401) {
      dispatchSessionExpiredEvent();
    }

    if (response.status === 403 && errorMessage === fallbackMessage) {
      throw new Error("You do not have permission to perform this action.");
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

async function createHeaders(contentType = false) {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }

  const accessToken = await getSupabaseAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const api = {
  async getDiscovery(): Promise<DiscoveryData> {
    const response = await fetch(`${API_BASE}/discovery`);
    return discoveryDataSchema.parse(
      await parseResponse(response, "Failed to fetch discovery data"),
    );
  },

  async getDashboard(): Promise<DashboardData> {
    const response = await fetch(`${API_BASE}/dashboard`, {
      headers: await createHeaders(),
    });
    return dashboardDataSchema.parse(
      await parseResponse(response, "Failed to fetch dashboard"),
    );
  },

  async getListings(filters: ListingFilters = {}): Promise<Listing[]> {
    const response = await fetch(
      `${API_BASE}/listings${buildQuery({
        q: filters.q,
        category: filters.category,
        universityId: filters.universityId,
        campusZoneId: filters.campusZoneId,
        roomType: filters.roomType,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minCapacity: filters.minCapacity,
        maxWalkingMinutes: filters.maxWalkingMinutes,
      })}`,
    );
    return z.array(listingSchema).parse(
      await parseResponse(response, "Failed to fetch listings"),
    );
  },

  async getListingsPage(input: {
    filters?: ListingFilters;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedListings> {
    const filters = input.filters ?? {};
    const response = await fetch(
      `${API_BASE}/listings${buildQuery({
        q: filters.q,
        category: filters.category,
        universityId: filters.universityId,
        campusZoneId: filters.campusZoneId,
        roomType: filters.roomType,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minCapacity: filters.minCapacity,
        maxWalkingMinutes: filters.maxWalkingMinutes,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 24,
      })}`,
    );
    return paginatedListingsSchema.parse(
      await parseResponse(response, "Failed to fetch listings"),
    );
  },

  async getListing(id: string): Promise<Listing> {
    const response = await fetch(`${API_BASE}/listings/${id}`);
    return listingSchema.parse(
      await parseResponse(response, "Failed to fetch listing"),
    );
  },

  async createListing(listing: InsertListing): Promise<Listing> {
    const response = await fetch(`${API_BASE}/listings`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(listing),
    });
    return listingSchema.parse(
      await parseResponse(response, "Failed to create listing"),
    );
  },

  async updateListing(id: string, updates: Partial<InsertListing>): Promise<Listing> {
    const response = await fetch(`${API_BASE}/listings/${id}`, {
      method: "PATCH",
      headers: await createHeaders(true),
      body: JSON.stringify(updates),
    });
    return listingSchema.parse(
      await parseResponse(response, "Failed to update listing"),
    );
  },

  async estimateUtilities(
    listingId: string,
    electricityUsageUnits: number,
    waterUsageUnits: number,
  ): Promise<UtilityEstimate> {
    const response = await fetch(
      `${API_BASE}/listings/${listingId}/utilities${buildQuery({
        electricityUsageUnits,
        waterUsageUnits,
      })}`,
    );
    return utilityEstimateSchema.parse(
      await parseResponse(response, "Failed to estimate utilities"),
    );
  },

  async createBooking(booking: {
    listingId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: Date;
    checkOut: Date;
    guests: number;
    requestNote?: string;
  }): Promise<Booking> {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(booking),
    });
    return bookingSchema.parse(
      await parseResponse(response, "Failed to create booking"),
    );
  },

  async getBookings(): Promise<Booking[]> {
    const response = await fetch(`${API_BASE}/bookings`, {
      headers: await createHeaders(),
    });
    return z.array(bookingSchema).parse(
      await parseResponse(response, "Failed to fetch bookings"),
    );
  },

  async getBookingsPage(page = 1, pageSize = 20): Promise<PaginatedBookings> {
    const response = await fetch(
      `${API_BASE}/bookings${buildQuery({ page, pageSize })}`,
      {
        headers: await createHeaders(),
      },
    );
    return paginatedBookingsSchema.parse(
      await parseResponse(response, "Failed to fetch bookings"),
    );
  },

  async updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
    const response = await fetch(`${API_BASE}/bookings/${id}/status`, {
      method: "PATCH",
      headers: await createHeaders(true),
      body: JSON.stringify({ status }),
    });
    return bookingSchema.parse(
      await parseResponse(response, "Failed to update booking status"),
    );
  },

  async getContracts(): Promise<Contract[]> {
    const response = await fetch(`${API_BASE}/contracts`, {
      headers: await createHeaders(),
    });
    return z.array(contractSchema).parse(
      await parseResponse(response, "Failed to fetch contracts"),
    );
  },

  async getContractsPage(
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedContracts> {
    const response = await fetch(
      `${API_BASE}/contracts${buildQuery({ page, pageSize })}`,
      {
        headers: await createHeaders(),
      },
    );
    return paginatedContractsSchema.parse(
      await parseResponse(response, "Failed to fetch contracts"),
    );
  },

  async updateContractStatus(
    id: string,
    status: ContractStatus,
  ): Promise<Contract> {
    const response = await fetch(`${API_BASE}/contracts/${id}/status`, {
      method: "PATCH",
      headers: await createHeaders(true),
      body: JSON.stringify({ status }),
    });
    return contractSchema.parse(
      await parseResponse(response, "Failed to update contract status"),
    );
  },

  async getReviews(listingId: string): Promise<Review[]> {
    const response = await fetch(
      `${API_BASE}/reviews${buildQuery({ listingId })}`,
    );
    return z.array(reviewSchema).parse(
      await parseResponse(response, "Failed to fetch reviews"),
    );
  },

  async createReview(review: InsertReview): Promise<Review> {
    const response = await fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(review),
    });
    return reviewSchema.parse(
      await parseResponse(response, "Failed to create review"),
    );
  },

  async respondToReview(id: string, responseText: string): Promise<Review> {
    const response = await fetch(`${API_BASE}/reviews/${id}/response`, {
      method: "PATCH",
      headers: await createHeaders(true),
      body: JSON.stringify({ response: responseText }),
    });
    return reviewSchema.parse(
      await parseResponse(response, "Failed to respond to review"),
    );
  },

  async getRoommateProfiles(): Promise<PublicRoommateProfile[]> {
    const response = await fetch(`${API_BASE}/roommates/profiles`, {
      headers: await createHeaders(),
    });
    return z.array(publicRoommateProfileSchema).parse(
      await parseResponse(response, "Failed to fetch roommate profiles"),
    );
  },

  async getMyRoommateProfile(): Promise<RoommateProfile | null> {
    const response = await fetch(`${API_BASE}/roommates/profiles/me`, {
      headers: await createHeaders(),
    });
    const data = await parseResponse<unknown>(
      response,
      "Failed to fetch roommate profile",
    );
    return data ? roommateProfileSchema.parse(data) : null;
  },

  async saveRoommateProfile(
    profile: Omit<RoommateProfile, "id" | "createdAt" | "updatedAt">,
  ): Promise<RoommateProfile> {
    const response = await fetch(`${API_BASE}/roommates/profiles`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(profile),
    });
    return roommateProfileSchema.parse(
      await parseResponse(response, "Failed to save roommate profile"),
    );
  },

  async getRoommateMatches(profileId?: string): Promise<RoommateMatch[]> {
    const response = await fetch(
      `${API_BASE}/roommates/matches${buildQuery({ profileId })}`,
      {
        headers: await createHeaders(),
      },
    );
    return z.array(roommateMatchSchema).parse(
      await parseResponse(response, "Failed to fetch roommate matches"),
    );
  },

  async getRoommateMessages(matchId: string): Promise<RoommateMessage[]> {
    const response = await fetch(`${API_BASE}/roommates/messages/${matchId}`, {
      headers: await createHeaders(),
    });
    return z.array(roommateMessageSchema).parse(
      await parseResponse(response, "Failed to fetch roommate messages"),
    );
  },

  async sendRoommateMessage(input: {
    matchId: string;
    senderProfileId: string;
    message: string;
  }): Promise<RoommateMessage> {
    const response = await fetch(`${API_BASE}/roommates/messages`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(input),
    });
    return roommateMessageSchema.parse(
      await parseResponse(response, "Failed to send roommate message"),
    );
  },

  async getNotifications(): Promise<Notification[]> {
    const response = await fetch(`${API_BASE}/notifications`, {
      headers: await createHeaders(),
    });
    return z.array(notificationSchema).parse(
      await parseResponse(response, "Failed to fetch notifications"),
    );
  },

  async markNotificationRead(id: string): Promise<Notification> {
    const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: await createHeaders(),
    });
    return notificationSchema.parse(
      await parseResponse(response, "Failed to mark notification read"),
    );
  },

  async createListingImageUploadUrl(input: {
    fileName: string;
    contentType: string;
    fileSize: number;
    listingId?: string;
  }): Promise<{
    bucket: string;
    path: string;
    token: string;
    signedUploadUrl: string;
    assetUrl: string;
  }> {
    const response = await fetch(`${API_BASE}/uploads/listing-images/signed-url`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(input),
    });
    return z
      .object({
        bucket: z.string(),
        path: z.string(),
        token: z.string(),
        signedUploadUrl: z.string().url(),
        assetUrl: z.string().url(),
      })
      .parse(
        await parseResponse(response, "Failed to prepare listing image upload"),
      );
  },

  async createContractDocumentUploadUrl(input: {
    contractId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }): Promise<{
    bucket: string;
    path: string;
    token: string;
    signedUploadUrl: string;
    signedReadUrl: string;
    expiresInSeconds: number;
  }> {
    const response = await fetch(
      `${API_BASE}/uploads/contract-documents/signed-url`,
      {
        method: "POST",
        headers: await createHeaders(true),
        body: JSON.stringify(input),
      },
    );
    return z
      .object({
        bucket: z.string(),
        path: z.string(),
        token: z.string(),
        signedUploadUrl: z.string().url(),
        signedReadUrl: z.string().url(),
        expiresInSeconds: z.number().int().positive(),
      })
      .parse(
        await parseResponse(
          response,
          "Failed to prepare contract document upload",
        ),
      );
  },

  async uploadFileToSignedUrl(input: { signedUploadUrl: string; file: File }) {
    const response = await fetch(input.signedUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": input.file.type,
      },
      body: input.file,
    });

    if (!response.ok) {
      throw new Error("Failed to upload file to storage");
    }
  },

  async registerContractDocument(
    contractId: string,
    input: {
      name: string;
      type: string;
      path: string;
    },
  ) {
    const response = await fetch(`${API_BASE}/contracts/${contractId}/documents`, {
      method: "POST",
      headers: await createHeaders(true),
      body: JSON.stringify(input),
    });

    return z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        uploadedAt: z.coerce.date(),
        fileUrl: z.string().url().optional(),
      })
      .parse(
        await parseResponse(response, "Failed to register contract document"),
      );
  },
};
