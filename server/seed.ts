import { storage } from "./storage";
import { seedListings } from "./seed-data";

async function seed() {
  console.log("Seeding database...");

  try {
    const existingListings = await storage.getAllListings();

    if (existingListings.length > 0) {
      console.log(
        "Database already seeded with",
        existingListings.length,
        "listings",
      );
      return;
    }

    for (const listing of seedListings) {
      await storage.createListing(listing);
    }

    console.log("Successfully seeded", seedListings.length, "listings");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed();
