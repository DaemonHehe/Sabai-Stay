import type { BookingStatus, ContractStatus, Listing } from "@shared/schema";

export const listingStatusValues: Listing["listingStatus"][] = [
  "draft",
  "active",
  "archived",
];

export const bookingStatusTransitionMap: Record<BookingStatus, BookingStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["deposit_pending", "rejected"],
  deposit_pending: ["confirmed", "rejected"],
  confirmed: ["cancelled"],
  rejected: [],
  cancelled: [],
};

export const contractStatusTransitionMap: Record<ContractStatus, ContractStatus[]> =
  {
    draft: ["pending_signature", "cancelled"],
    pending_signature: ["active", "cancelled"],
    active: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

export function toLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatCurrency(value: number) {
  return `THB ${value.toLocaleString()}`;
}
