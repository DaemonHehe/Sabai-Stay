import type { Listing, Booking, InsertBooking } from "@shared/schema";

const API_BASE = "/api";

export const api = {
  // Listings
  async getListings(): Promise<Listing[]> {
    const response = await fetch(`${API_BASE}/listings`);
    if (!response.ok) throw new Error("Failed to fetch listings");
    return response.json();
  },

  async getListing(id: string): Promise<Listing> {
    const response = await fetch(`${API_BASE}/listings/${id}`);
    if (!response.ok) throw new Error("Failed to fetch listing");
    return response.json();
  },

  // Bookings
  async createBooking(
    booking: Omit<InsertBooking, "totalPrice">,
  ): Promise<Booking> {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = typeof errorData.error === 'string' 
        ? errorData.error 
        : Array.isArray(errorData.error)
          ? errorData.error.map((e: any) => e.message || String(e)).join(', ')
          : "Failed to create booking";
      throw new Error(errorMessage);
    }
    return response.json();
  },

  async checkAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    const response = await fetch(`${API_BASE}/listings/${listingId}/check-availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkIn, checkOut }),
    });
    if (!response.ok) throw new Error("Failed to check availability");
    const data = await response.json();
    return data.available;
  },
};
