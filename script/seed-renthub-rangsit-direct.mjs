import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = "https://www.renthub.in.th/en/apartment/rangsit-university";
const BASE_LAT = 13.9649;
const BASE_LON = 100.5878;
const METERS_PER_LAT_DEG = 111_320;
const METERS_PER_LON_DEG = 111_320 * Math.cos((BASE_LAT * Math.PI) / 180);

function loadDotEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, "..", ".env");
  let raw = "";
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value.replace(/^"(.*)"$/, "$1");
    }
  }
}

function extractNextData(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error("Unable to locate __NEXT_DATA__ script.");
  }
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd < 0) {
    throw new Error("Unable to locate __NEXT_DATA__ closing tag.");
  }
  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

function asNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStableUuid(sourceId) {
  const digits = String(sourceId ?? "").replace(/\D+/g, "");
  const tail = (digits || "0").slice(-12).padStart(12, "0");
  return `00000000-0000-0000-0000-${tail}`;
}

function normalizePrice(item) {
  const minPrice = asNumber(item?.price?.monthly?.minPrice, 0);
  const maxPrice = asNumber(item?.price?.monthly?.maxPrice, minPrice);
  if (minPrice > 0 && maxPrice > 0) {
    return Math.round((minPrice + maxPrice) / 2);
  }
  return Math.max(minPrice, maxPrice, 4500);
}

function mapRoomType(item, price) {
  const type = String(item?.propertyType ?? "").toUpperCase();
  if (item?.apartmentIsHotel) return "shared";
  if (type.includes("CONDO")) return "condo";
  if (price <= 4500) return "dorm";
  if (price >= 12000) return "condo";
  return "apartment";
}

function mapCategory(price) {
  if (price <= 4000) return "BUDGET";
  if (price <= 7000) return "DORM";
  if (price <= 10000) return "CONDO";
  return "LUXURY";
}

function mapRating(item) {
  const idNum = asNumber(item?.id, 0);
  const sponsor = String(item?.sponsorPackage ?? "").toUpperCase();
  let rating = 4.2 + (idNum % 7) * 0.1;
  if (sponsor === "EXCLUSIVE") rating += 0.2;
  rating = Math.max(4.2, Math.min(4.9, rating));
  return Number(rating.toFixed(2));
}

function distanceToLatLon(distanceMeters, sourceId) {
  const idNum = asNumber(sourceId, 0);
  const angleDeg = (idNum * 137.508) % 360;
  const angle = (angleDeg * Math.PI) / 180;
  const north = distanceMeters * Math.cos(angle);
  const east = distanceMeters * Math.sin(angle);
  return {
    latitude: Number((BASE_LAT + north / METERS_PER_LAT_DEG).toFixed(7)),
    longitude: Number((BASE_LON + east / METERS_PER_LON_DEG).toFixed(7)),
  };
}

function mapAmenities(amenities) {
  const out = [];
  if (amenities?.hasAir) out.push("Air Conditioning");
  if (amenities?.hasFurniture) out.push("Furniture");
  if (amenities?.hasInternet) out.push("Internet");
  if (amenities?.hasSecurity) out.push("Security");
  if (amenities?.hasCCTV) out.push("CCTV");
  if (amenities?.hasParking) out.push("Parking");
  if (amenities?.hasLaundry) out.push("Laundry");
  if (amenities?.hasLift) out.push("Lift");
  if (amenities?.hasPool) out.push("Pool");
  if (amenities?.hasFitness) out.push("Fitness");
  if (amenities?.hasShop) out.push("Convenience Shop");
  if (amenities?.hasWaterHeater) out.push("Water Heater");
  if (amenities?.hasRefrigerator) out.push("Refrigerator");
  if (amenities?.hasTV) out.push("TV");
  if (amenities?.hasKeyCardAccess) out.push("Keycard Access");
  if (amenities?.hasFingerPrintAccess) out.push("Fingerprint Access");
  if (amenities?.allowPet) out.push("Pet Friendly");
  return out.length > 0 ? out : ["Furniture", "Internet", "Laundry"];
}

function mapZone(sourceId) {
  const zones = [
    "rsu-main-gate",
    "rsu-library",
    "rsu-engineering",
    "rsu-design",
  ];
  return zones[asNumber(sourceId, 0) % zones.length];
}

function mapTransport(distanceMeters) {
  if (distanceMeters <= 1500) return ["songthaew-muang-ake"];
  if (distanceMeters <= 3500) return ["songthaew-muang-ake", "rsu-shuttle-green"];
  return ["rsu-shuttle-green"];
}

function mapUtilityRates(price, hasInternet) {
  if (price <= 4500) {
    return {
      electricityPerUnit: 6,
      waterPerUnit: 16,
      internetFee: hasInternet ? 0 : 250,
      serviceFee: 120,
    };
  }
  if (price <= 8000) {
    return {
      electricityPerUnit: 7,
      waterPerUnit: 18,
      internetFee: hasInternet ? 0 : 350,
      serviceFee: 180,
    };
  }
  if (price <= 12000) {
    return {
      electricityPerUnit: 7,
      waterPerUnit: 20,
      internetFee: hasInternet ? 0 : 500,
      serviceFee: 250,
    };
  }
  return {
    electricityPerUnit: 8,
    waterPerUnit: 22,
    internetFee: hasInternet ? 0 : 650,
    serviceFee: 420,
  };
}

function cleanTitle(item) {
  const name = String(item?.name ?? "").trim();
  const title = String(item?.title ?? "").trim();
  const base = name || title || `RentHub Listing ${item?.id ?? ""}`.trim();
  return base.slice(0, 120);
}

function makeLocation(item) {
  const parts = [item?.subdistrict, item?.district, item?.province]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Rangsit University Area";
}

function makeDescription(item, walkingMinutes) {
  const parts = [];
  parts.push(`Imported from RentHub listing #${item.id} near Rangsit University.`);
  parts.push(`Approx. ${walkingMinutes} minutes to campus context.`);
  if (item?.hasVirtualTour) parts.push("Virtual tour available on source listing.");
  if (item?.addressDocument?.reviewStatus === "VERIFIED") {
    parts.push("Address verified on source platform.");
  }
  return parts.join(" ");
}

function toListingRow(item, rsuUniversityId, demoOwnerId) {
  const price = normalizePrice(item);
  const distanceMeters = Math.max(300, asNumber(item?.distance, 1800));
  const { latitude, longitude } = distanceToLatLon(distanceMeters, item.id);
  const walkingMinutes = Math.max(4, Math.min(60, Math.round(distanceMeters / 80)));
  const hasInternet = Boolean(item?.amenities?.hasInternet);
  const imagePath = String(item?.coverPicture ?? "").trim();
  const image = imagePath
    ? `https://bcdn.renthub.in.th${imagePath}`
    : "https://bcdn.renthub.in.th/assets/renthub/meta-home-image-3ab336e92602fab3e010d8032a7b06ac.png";

  return {
    id: toStableUuid(item.id),
    owner_user_id: demoOwnerId ?? null,
    university_id: rsuUniversityId,
    title: cleanTitle(item),
    location: makeLocation(item),
    price,
    rating: mapRating(item),
    category: mapCategory(price),
    room_type: mapRoomType(item, price),
    image,
    gallery: [image],
    description: makeDescription(item, walkingMinutes),
    latitude,
    longitude,
    area_sqm: Math.max(20, Math.min(42, 18 + Math.round(price / 600))),
    capacity: price >= 9000 ? 2 : 1,
    bedrooms: 1,
    bathrooms: 1.0,
    featured: String(item?.sponsorPackage ?? "").toUpperCase() === "EXCLUSIVE",
    listing_status: "active",
    moderation_status: "approved",
    amenities: mapAmenities(item?.amenities),
    nearest_campus_zone_id: mapZone(item.id),
    walking_minutes: walkingMinutes,
    transport_route_ids: mapTransport(distanceMeters),
    utility_rates: mapUtilityRates(price, hasInternet),
    internet_included: hasInternet && price >= 9000,
    lease_options: [
      { months: 1, label: "Short Stay" },
      { months: 4, label: "Semester" },
      { months: 6, label: "Half-Year" },
      { months: 12, label: "Annual" },
    ],
    available_from: new Date().toISOString(),
    available_to: null,
  };
}

async function main() {
  loadDotEnv();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: uni, error: uniError }, { data: owners, error: ownerError }] =
    await Promise.all([
      supabase
        .from("universities")
        .select("id,email_domain")
        .ilike("email_domain", "rsu.ac.th")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("app_users")
        .select("id,role,full_name,created_at")
        .order("created_at", { ascending: true }),
    ]);

  if (uniError) throw uniError;
  if (!uni?.id) {
    throw new Error("Rangsit University not found. Run schema.sql first.");
  }
  if (ownerError) throw ownerError;

  let demoOwnerId =
    owners?.find((user) => user.role === "owner")?.id ??
    owners?.[0]?.id ??
    null;

  if (demoOwnerId) {
    const { error: promoteError } = await supabase
      .from("app_users")
      .update({
        role: "owner",
        full_name:
          owners?.find((user) => user.id === demoOwnerId)?.full_name ||
          "RentHub Demo Owner",
      })
      .eq("id", demoOwnerId);
    if (promoteError) throw promoteError;

    const { error: ownerProfileError } = await supabase
      .from("owner_profiles")
      .upsert({
        user_id: demoOwnerId,
        business_name: "RentHub Demo Owner",
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      });
    if (ownerProfileError) throw ownerProfileError;
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch source page: ${response.status}`);
  }
  const html = await response.text();
  const nextData = extractNextData(html);
  const listings = nextData?.props?.pageProps?.listings ?? [];
  if (!Array.isArray(listings) || listings.length === 0) {
    throw new Error("No listings found from source page.");
  }

  const rows = listings.map((item) => toListingRow(item, uni.id, demoOwnerId));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("listings")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
    if (error) throw error;
  }

  const { count, error: countError } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;

  console.log(
    `Seeded ${rows.length} RentHub listings. Total listings in DB: ${count ?? "unknown"}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
