import type { Listing } from "@shared/schema";

export function normalizeListingSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function filterListingsByQuery(listings: Listing[], query: string) {
  const normalizedQuery = normalizeListingSearchQuery(query);

  if (!normalizedQuery) {
    return listings;
  }

  return listings.filter((listing) =>
    [
      listing.title,
      listing.location,
      listing.category,
      listing.description,
    ].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}
