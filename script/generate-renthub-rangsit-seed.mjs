import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.renthub.in.th/en/apartment/rangsit-university";
const BASE_LAT = 13.9649;
const BASE_LON = 100.5878;
const METERS_PER_LAT_DEG = 111_320;
const METERS_PER_LON_DEG = 111_320 * Math.cos((BASE_LAT * Math.PI) / 180);

function extractNextData(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error("Unable to locate __NEXT_DATA__ script in page HTML.");
  }
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd < 0) {
    throw new Error("Unable to find end tag for __NEXT_DATA__ script.");
  }
  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

function asNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sqlString(value) {
  const normalized = String(value ?? "");
  return `'${normalized.replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
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

function toStableUuid(sourceId) {
  const digits = String(sourceId ?? "").replace(/\D+/g, "");
  const tail = (digits || "0").slice(-12).padStart(12, "0");
  return `00000000-0000-0000-0000-${tail}`;
}

function distanceToLatLon(distanceMeters, sourceId) {
  const idNum = asNumber(sourceId, 0);
  const angleDeg = (idNum * 137.508) % 360;
  const angle = (angleDeg * Math.PI) / 180;
  const north = distanceMeters * Math.cos(angle);
  const east = distanceMeters * Math.sin(angle);
  const lat = BASE_LAT + north / METERS_PER_LAT_DEG;
  const lon = BASE_LON + east / METERS_PER_LON_DEG;
  return {
    lat: Number(lat.toFixed(7)),
    lon: Number(lon.toFixed(7)),
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

function makeLocation(item) {
  const parts = [item?.subdistrict, item?.district, item?.province]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Rangsit University Area";
}

function cleanTitle(item) {
  const name = String(item?.name ?? "").trim();
  const title = String(item?.title ?? "").trim();
  const base = name || title || `RentHub Listing ${item?.id ?? ""}`.trim();
  return base.slice(0, 120);
}

function makeDescription(item, walkingMinutes) {
  const parts = [];
  parts.push(`Imported from RentHub listing #${item.id} near Rangsit University.`);
  parts.push(`Approx. ${walkingMinutes} minutes to campus context.`);
  if (item?.hasVirtualTour) parts.push("Virtual tour available on source listing.");
  if (item?.addressDocument?.reviewStatus === "VERIFIED") {
    parts.push("Address document verified on source platform.");
  }
  return parts.join(" ");
}

function toRow(item) {
  const price = normalizePrice(item);
  const distanceMeters = Math.max(300, asNumber(item?.distance, 1800));
  const { lat, lon } = distanceToLatLon(distanceMeters, item.id);
  const walkingMinutes = Math.max(4, Math.min(60, Math.round(distanceMeters / 80)));
  const amenities = mapAmenities(item?.amenities);
  const hasInternet = Boolean(item?.amenities?.hasInternet);
  const imagePath = String(item?.coverPicture ?? "").trim();
  const image = imagePath
    ? `https://bcdn.renthub.in.th${imagePath}`
    : "https://bcdn.renthub.in.th/assets/renthub/meta-home-image-3ab336e92602fab3e010d8032a7b06ac.png";

  return {
    id: toStableUuid(item.id),
    title: cleanTitle(item),
    location: makeLocation(item),
    price,
    rating: mapRating(item),
    category: mapCategory(price),
    roomType: mapRoomType(item, price),
    image,
    gallery: [image],
    description: makeDescription(item, walkingMinutes),
    latitude: lat,
    longitude: lon,
    areaSqm: Math.max(20, Math.min(42, 18 + Math.round(price / 600))),
    capacity: price >= 9000 ? 2 : 1,
    bedrooms: 1,
    bathrooms: 1.0,
    featured: String(item?.sponsorPackage ?? "").toUpperCase() === "EXCLUSIVE",
    listingStatus: "active",
    moderationStatus: "approved",
    amenities,
    nearestCampusZoneId: mapZone(item.id),
    walkingMinutes,
    transportRouteIds: mapTransport(distanceMeters),
    utilityRates: mapUtilityRates(price, hasInternet),
    internetIncluded: hasInternet && price >= 9000,
    leaseOptions: [
      { months: 1, label: "Short Stay" },
      { months: 4, label: "Semester" },
      { months: 6, label: "Half-Year" },
      { months: 12, label: "Annual" },
    ],
  };
}

function rowSql(row) {
  return `(
      ${sqlString(row.id)}::uuid,
      demo_owner_id,
      rsu_university_id,
      ${sqlString(row.title)},
      ${sqlString(row.location)},
      ${row.price},
      ${row.rating},
      ${sqlString(row.category)},
      ${sqlString(row.roomType)},
      ${sqlString(row.image)},
      ${sqlJson(row.gallery)},
      ${sqlString(row.description)},
      ${row.latitude},
      ${row.longitude},
      ${row.areaSqm},
      ${row.capacity},
      ${row.bedrooms},
      ${row.bathrooms},
      ${row.featured ? "true" : "false"},
      'active',
      'approved',
      ${sqlJson(row.amenities)},
      ${sqlString(row.nearestCampusZoneId)},
      ${row.walkingMinutes},
      ${sqlJson(row.transportRouteIds)},
      ${sqlJson(row.utilityRates)},
      ${row.internetIncluded ? "true" : "false"},
      ${sqlJson(row.leaseOptions)},
      now(),
      null
    )`;
}

function buildSql(rows) {
  const generatedAt = new Date().toISOString();
  const values = rows.map((row) => rowSql(row)).join(",\n");

  return `-- Generated from ${SOURCE_URL}
-- Generated at ${generatedAt}
-- This script does NOT modify schema.sql and is safe to re-run.

do $$
declare
  rsu_university_id uuid;
  demo_owner_id uuid;
begin
  select id
  into rsu_university_id
  from public.universities
  where lower(email_domain) = 'rsu.ac.th'
  limit 1;

  if rsu_university_id is null then
    raise exception 'Rangsit University (rsu.ac.th) not found. Run schema.sql first.';
  end if;

  select id
  into demo_owner_id
  from public.app_users
  where role = 'owner'
  order by created_at
  limit 1;

  if demo_owner_id is null then
    select id
    into demo_owner_id
    from public.app_users
    order by created_at
    limit 1;

    if demo_owner_id is not null then
      update public.app_users
      set role = 'owner',
          full_name = coalesce(nullif(full_name, ''), 'RentHub Demo Owner'),
          updated_at = now()
      where id = demo_owner_id;
    end if;
  end if;

  if demo_owner_id is not null then
    insert into public.owner_profiles (user_id, business_name, verification_status, verified_at)
    values (demo_owner_id, 'RentHub Demo Owner', 'verified', now())
    on conflict (user_id) do update
      set business_name = excluded.business_name,
          verification_status = 'verified',
          verified_at = coalesce(owner_profiles.verified_at, excluded.verified_at),
          updated_at = now();
  else
    raise notice 'No app_users found; listings will be inserted with null owner_user_id.';
  end if;

  insert into public.listings (
    id,
    owner_user_id,
    university_id,
    title,
    location,
    price,
    rating,
    category,
    room_type,
    image,
    gallery,
    description,
    latitude,
    longitude,
    area_sqm,
    capacity,
    bedrooms,
    bathrooms,
    featured,
    listing_status,
    moderation_status,
    amenities,
    nearest_campus_zone_id,
    walking_minutes,
    transport_route_ids,
    utility_rates,
    internet_included,
    lease_options,
    available_from,
    available_to
  )
  values
${values}
  on conflict (id) do update
    set owner_user_id = coalesce(excluded.owner_user_id, listings.owner_user_id),
        university_id = excluded.university_id,
        title = excluded.title,
        location = excluded.location,
        price = excluded.price,
        rating = excluded.rating,
        category = excluded.category,
        room_type = excluded.room_type,
        image = excluded.image,
        gallery = excluded.gallery,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        area_sqm = excluded.area_sqm,
        capacity = excluded.capacity,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        featured = excluded.featured,
        listing_status = excluded.listing_status,
        moderation_status = excluded.moderation_status,
        amenities = excluded.amenities,
        nearest_campus_zone_id = excluded.nearest_campus_zone_id,
        walking_minutes = excluded.walking_minutes,
        transport_route_ids = excluded.transport_route_ids,
        utility_rates = excluded.utility_rates,
        internet_included = excluded.internet_included,
        lease_options = excluded.lease_options,
        available_from = excluded.available_from,
        available_to = excluded.available_to;
end
$$;
`;
}

async function main() {
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
    throw new Error("No listings found in source page payload.");
  }

  const rows = listings.map(toRow);
  const sql = buildSql(rows);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.join(__dirname, "seed-renthub-rangsit.sql");
  writeFileSync(outputPath, sql, "utf8");

  console.log(`Generated ${rows.length} listings at: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
