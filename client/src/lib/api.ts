import { z } from "zod";
import {
  Booking,
  BookingStatus,
  Contract,
  ContractStatus,
  DashboardData,
  DiscoveryData,
  DisputeCase,
  InsertListing,
  InsertReview,
  Listing,
  ListingFilters,
  Notification,
  Review,
  RoommateMatch,
  RoommateMessage,
  RoommateProfile,
  UtilityEstimate,
  VerificationStatus,
  VerificationTask,
  bookingSchema,
  contractSchema,
  dashboardDataSchema,
  discoveryDataSchema,
  disputeCaseSchema,
  listingSchema,
  notificationSchema,
  reviewSchema,
  roommateMatchSchema,
  roommateMessageSchema,
  roommateProfileSchema,
  utilityEstimateSchema,
  verificationTaskSchema,
} from "@shared/schema";
import { getSupabaseAccessToken } from "@/lib/supabase";

const API_BASE = "/api";

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: fallbackMessage }));
    const errorMessage =
      typeof errorData.error === "string" ? errorData.error : fallbackMessage;
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

  async getRoommateProfiles(): Promise<RoommateProfile[]> {
    const response = await fetch(`${API_BASE}/roommates/profiles`, {
      headers: await createHeaders(),
    });
    return z.array(roommateProfileSchema).parse(
      await parseResponse(response, "Failed to fetch roommate profiles"),
    );
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

  async getVerificationTasks(): Promise<VerificationTask[]> {
    const response = await fetch(`${API_BASE}/admin/verifications`, {
      headers: await createHeaders(),
    });
    return z.array(verificationTaskSchema).parse(
      await parseResponse(response, "Failed to fetch verification queue"),
    );
  },

  async updateVerificationTask(
    id: string,
    status: VerificationStatus,
  ): Promise<VerificationTask> {
    const response = await fetch(`${API_BASE}/admin/verifications/${id}`, {
      method: "PATCH",
      headers: await createHeaders(true),
      body: JSON.stringify({ status }),
    });
    return verificationTaskSchema.parse(
      await parseResponse(response, "Failed to update verification task"),
    );
  },

  async getDisputes(): Promise<DisputeCase[]> {
    const response = await fetch(`${API_BASE}/admin/disputes`, {
      headers: await createHeaders(),
    });
    return z.array(disputeCaseSchema).parse(
      await parseResponse(response, "Failed to fetch disputes"),
    );
  },

  async updateDisputeStatus(
    id: string,
    status: DisputeCase["status"],
  ): Promise<DisputeCase> {
    const response = await fetch(`${API_BASE}/admin/disputes/${id}`, {
      method: "PATCH",
      headers: await createHeaders(true),
      body: JSON.stringify({ status }),
    });
    return disputeCaseSchema.parse(
      await parseResponse(response, "Failed to update dispute"),
    );
  },
};
