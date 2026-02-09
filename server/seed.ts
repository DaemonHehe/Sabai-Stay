import { storage } from "./storage";
import type { InsertListing } from "@shared/schema";

const seedListings: InsertListing[] = [
  {
    title: "Plum Condo Park Rangsit",
    location: "Klong Nueng, Pathum Thani",
    price: 8500,
    rating: "4.80",
    category: "CONDO",
    image: "/images/condo-exterior.png",
    description: "Modern student living just 500m from Rangsit University. Features a resort-style pool, fitness center, and 24/7 security. Perfect for medical and engineering students seeking peace and quiet.",
    latitude: "13.9612000",
    longitude: "100.6015000"
  },
  {
    title: "Kave Town Space",
    location: "Chiang Rak, Near TU/RSU",
    price: 12000,
    rating: "4.90",
    category: "LUXURY",
    image: "/images/condo-interior.png",
    description: "High-end student lifestyle. Walk to class. Fully furnished with smart home automation, high-speed fiber internet included, and access to the sky lounge.",
    latitude: "13.9680000",
    longitude: "100.6050000"
  },
  {
    title: "Dcondo Campus Resort",
    location: "Rangsit-Pathum Thani",
    price: 9500,
    rating: "4.70",
    category: "RESORT",
    image: "/images/condo-pool.png",
    description: "Resort-style living for students. Large central pool, study pods, and lush gardens. Shuttle bus service to Rangsit University every 15 minutes.",
    latitude: "13.9720000",
    longitude: "100.5980000"
  },
  {
    title: "The Sky Loft RSU",
    location: "Lak Hok, Rangsit",
    price: 15000,
    rating: "4.95",
    category: "LOFT",
    image: "/images/co-working.png",
    description: "Exclusive duplex lofts for design and art students. Double-height ceilings, industrial aesthetic, and private creative studio space in the common area.",
    latitude: "13.9630000",
    longitude: "100.5890000"
  },
  {
    title: "Attitude Bu Condo",
    location: "Phahonyothin Rd",
    price: 11000,
    rating: "4.85",
    category: "CREATIVE",
    image: "/images/condo-exterior.png",
    description: "Vibrant community for creative minds. Colorful interiors, rooftop garden, and close proximity to Future Park Rangsit for weekends.",
    latitude: "13.9800000",
    longitude: "100.6100000"
  },
  {
    title: "Common TU",
    location: "Klong Luang",
    price: 13500,
    rating: "4.88",
    category: "LUXURY",
    image: "/images/condo-interior.png",
    description: "Premium high-rise living with skyline views. Infinity pool, 24-hour reading room, and direct access to lifestyle malls.",
    latitude: "13.9900000",
    longitude: "100.6000000"
  },
  {
    title: "Be Condo Phaholyothin",
    location: "Near Rangsit University",
    price: 7500,
    rating: "4.60",
    category: "BUDGET",
    image: "/images/condo-interior.png",
    description: "Affordable comfort without compromising style. Clean modern design, fitness center, and very close to the university entrance.",
    latitude: "13.9660000",
    longitude: "100.5920000"
  },
  {
    title: "Urban Cube Dorm",
    location: "Muang Ake",
    price: 6000,
    rating: "4.50",
    category: "DORM",
    image: "/images/co-working.png",
    description: "Stylish boutique dormitory in the heart of Muang Ake. Surrounded by cafes and street food. Social atmosphere with shared kitchen and gaming room.",
    latitude: "13.9640000",
    longitude: "100.5860000"
  }
];

async function seed() {
  console.log("🌱 Seeding database...");
  
  try {
    // Check if listings already exist
    const existingListings = await storage.getAllListings();
    
    if (existingListings.length > 0) {
      console.log("✅ Database already seeded with", existingListings.length, "listings");
      return;
    }

    // Seed listings
    for (const listing of seedListings) {
      await storage.createListing(listing);
    }

    console.log("✅ Successfully seeded", seedListings.length, "listings");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

seed();