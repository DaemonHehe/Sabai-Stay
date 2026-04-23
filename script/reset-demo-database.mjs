import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEMO_OWNERS = [
  {
    email: "owner.alpha.demo@sabaistay.local",
    password: "DemoOwner#2026A",
    fullName: "Owner Alpha",
    businessName: "Alpha Student Residence",
  },
  {
    email: "owner.bravo.demo@sabaistay.local",
    password: "DemoOwner#2026B",
    fullName: "Owner Bravo",
    businessName: "Bravo Campus Housing",
  },
  {
    email: "owner.charlie.demo@sabaistay.local",
    password: "DemoOwner#2026C",
    fullName: "Owner Charlie",
    businessName: "Charlie University Rooms",
  },
];

const TABLES_TO_COUNT = [
  "universities",
  "campus_zones",
  "transport_routes",
  "app_users",
  "student_profiles",
  "owner_profiles",
  "roommate_profiles",
  "listings",
  "bookings",
  "booking_timeline_events",
  "contracts",
  "contract_documents",
  "reviews",
  "roommate_matches",
  "roommate_messages",
  "notifications",
  "verification_tasks",
  "disputes",
];

const TABLES_TO_WIPE = [
  "contract_documents",
  "contracts",
  "booking_timeline_events",
  "bookings",
  "reviews",
  "roommate_messages",
  "roommate_matches",
  "notifications",
  "verification_tasks",
  "disputes",
  "listings",
  "roommate_profiles",
  "owner_profiles",
  "student_profiles",
  "app_users",
  "transport_routes",
  "campus_zones",
  "universities",
];

const PRIMARY_KEY_COLUMN = {
  owner_profiles: "user_id",
  student_profiles: "user_id",
};

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
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const current = data?.users ?? [];
    users.push(...current);
    if (current.length < 1000) break;
    page += 1;
  }
  return users;
}

async function countTable(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function snapshotCounts(supabase, label) {
  const tableCounts = {};
  for (const table of TABLES_TO_COUNT) {
    tableCounts[table] = await countTable(supabase, table);
  }
  const authUsers = (await listAllUsers(supabase)).length;

  console.log(`\n[${label}]`);
  console.log(JSON.stringify({ auth_users: authUsers, ...tableCounts }, null, 2));
}

async function wipeTable(supabase, table) {
  const pk = PRIMARY_KEY_COLUMN[table] ?? "id";
  const { error } = await supabase.from(table).delete().not(pk, "is", null);
  if (error) throw error;
}

async function wipeRelationalData(supabase) {
  for (const table of TABLES_TO_WIPE) {
    await wipeTable(supabase, table);
  }
}

async function wipeAuthUsers(supabase) {
  const users = await listAllUsers(supabase);
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
}

async function ensureDiscoveryData(supabase) {
  const universityPayload = {
    id: randomUUID(),
    name: "Rangsit University",
    email_domain: "rsu.ac.th",
    campus: "Rangsit Main Campus",
    city: "Pathum Thani",
  };

  const { error: upsertUniversityError } = await supabase
    .from("universities")
    .upsert(universityPayload, { onConflict: "email_domain" });
  if (upsertUniversityError) throw upsertUniversityError;

  const { data: university, error: universityError } = await supabase
    .from("universities")
    .select("id")
    .ilike("email_domain", "rsu.ac.th")
    .limit(1)
    .maybeSingle();
  if (universityError) throw universityError;
  if (!university?.id) {
    throw new Error("Failed to resolve Rangsit University id.");
  }

  const universityId = university.id;
  const campusZones = [
    {
      id: "rsu-main-gate",
      university_id: universityId,
      name: "Main Gate",
      description:
        "Primary arrival point with strongest food and transport access.",
      latitude: 13.9649,
      longitude: 100.5878,
      walking_radius_meters: 300,
    },
    {
      id: "rsu-library",
      university_id: universityId,
      name: "Central Library",
      description: "Library area with quieter surroundings.",
      latitude: 13.9666,
      longitude: 100.5904,
      walking_radius_meters: 220,
    },
    {
      id: "rsu-engineering",
      university_id: universityId,
      name: "Engineering Faculty",
      description: "Engineering side of campus with regular shuttle traffic.",
      latitude: 13.9692,
      longitude: 100.5926,
      walking_radius_meters: 240,
    },
    {
      id: "rsu-design",
      university_id: universityId,
      name: "Design And Media",
      description: "Creative cluster used by loft and studio residents.",
      latitude: 13.9624,
      longitude: 100.5861,
      walking_radius_meters: 200,
    },
  ];

  const { error: upsertZonesError } = await supabase
    .from("campus_zones")
    .upsert(campusZones, { onConflict: "id" });
  if (upsertZonesError) throw upsertZonesError;

  const transportRoutes = [
    {
      id: "rsu-shuttle-green",
      university_id: universityId,
      name: "RSU Shuttle Green",
      mode: "shuttle",
      description:
        "University shuttle loop covering library, main gate, and dorm clusters.",
      stops: [
        { latitude: 13.9649, longitude: 100.5878 },
        { latitude: 13.9666, longitude: 100.5904 },
        { latitude: 13.9692, longitude: 100.5926 },
        { latitude: 13.972, longitude: 100.598 },
      ],
    },
    {
      id: "songthaew-muang-ake",
      university_id: universityId,
      name: "Muang Ake Songthaew",
      mode: "songthaew",
      description:
        "Low-cost local route connecting Muang Ake and the campus gate.",
      stops: [
        { latitude: 13.964, longitude: 100.586 },
        { latitude: 13.963, longitude: 100.589 },
        { latitude: 13.9649, longitude: 100.5878 },
        { latitude: 13.966, longitude: 100.592 },
      ],
    },
  ];

  const { error: upsertRoutesError } = await supabase
    .from("transport_routes")
    .upsert(transportRoutes, { onConflict: "id" });
  if (upsertRoutesError) throw upsertRoutesError;

  return universityId;
}

function parseSqlStringToken(token) {
  if (!token.startsWith("'")) {
    throw new Error(`Token is not a SQL string literal: ${token}`);
  }

  let i = 1;
  let value = "";
  while (i < token.length) {
    const ch = token[i];
    if (ch === "'") {
      if (token[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      i += 1;
      break;
    }
    value += ch;
    i += 1;
  }

  return {
    value,
    rest: token.slice(i).trim(),
  };
}

function splitTopLevel(input, delimiter) {
  const parts = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === "'") {
      if (inString && input[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      current += ch;
      continue;
    }

    if (!inString && ch === delimiter) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim() !== "") {
    parts.push(current);
  }

  return parts;
}

function extractValueTuples(valuesSql) {
  const tuples = [];
  let start = -1;
  let depth = 0;
  let inString = false;

  for (let i = 0; i < valuesSql.length; i += 1) {
    const ch = valuesSql[i];

    if (ch === "'") {
      if (inString && valuesSql[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "(") {
      if (depth === 0) {
        start = i + 1;
      }
      depth += 1;
      continue;
    }

    if (ch === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        tuples.push(valuesSql.slice(start, i));
        start = -1;
      }
    }
  }

  return tuples;
}

function parseSqlValue(token, context) {
  const trimmed = token.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "demo_owner_id") return context.demoOwnerId;
  if (lower === "rsu_university_id") return context.universityId;
  if (lower === "null") return null;
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (lower === "now()") return context.nowIso;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed.startsWith("'")) {
    const { value, rest } = parseSqlStringToken(trimmed);
    const cast = rest.toLowerCase();

    if (!cast) return value;
    if (cast.startsWith("::jsonb")) return JSON.parse(value);
    if (
      cast.startsWith("::uuid") ||
      cast.startsWith("::text") ||
      cast.startsWith("::timestamptz")
    ) {
      return value;
    }
    throw new Error(`Unsupported cast token: ${trimmed}`);
  }

  throw new Error(`Unsupported SQL value token: ${trimmed}`);
}

function parseListingRowsFromSql(sql, context) {
  const match = sql.match(
    /insert\s+into\s+public\.listings\s*\(([\s\S]*?)\)\s*values\s*([\s\S]*?)\s*on\s+conflict\s*\(id\)\s*do\s+update/mi,
  );
  if (!match) {
    throw new Error("Could not find listings insert block in seed SQL.");
  }

  const columnsRaw = match[1];
  const valuesRaw = match[2];
  const columns = splitTopLevel(columnsRaw, ",")
    .map((part) => part.trim())
    .filter(Boolean);

  const tuples = extractValueTuples(valuesRaw);
  if (tuples.length === 0) {
    throw new Error("No listing tuples found in seed SQL.");
  }

  return tuples.map((tupleSql) => {
    const fields = splitTopLevel(tupleSql, ",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (fields.length !== columns.length) {
      throw new Error(
        `Field/column mismatch: expected ${columns.length}, got ${fields.length}`,
      );
    }

    const row = {};
    for (let i = 0; i < columns.length; i += 1) {
      row[columns[i]] = parseSqlValue(fields[i], context);
    }
    return row;
  });
}

async function ensureOwnerAccount(supabase, owner, existingUsersByEmail) {
  const emailKey = owner.email.toLowerCase();
  const existing = existingUsersByEmail.get(emailKey);

  let authUserId;
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: owner.password,
      user_metadata: {
        role: "owner",
        full_name: owner.fullName,
        business_name: owner.businessName,
      },
    });
    if (error) throw error;
    authUserId = data.user?.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: owner.email,
      password: owner.password,
      email_confirm: true,
      user_metadata: {
        role: "owner",
        full_name: owner.fullName,
        business_name: owner.businessName,
      },
    });
    if (error) throw error;
    authUserId = data.user?.id;
  }

  if (!authUserId) {
    throw new Error(`Failed to resolve auth user id for ${owner.email}`);
  }

  const nowIso = new Date().toISOString();
  const { error: appUserError } = await supabase.from("app_users").upsert(
    {
      id: authUserId,
      role: "owner",
      full_name: owner.fullName,
      updated_at: nowIso,
    },
    { onConflict: "id" },
  );
  if (appUserError) throw appUserError;

  const { error: ownerProfileError } = await supabase.from("owner_profiles").upsert(
    {
      user_id: authUserId,
      business_name: owner.businessName,
      verification_status: "verified",
      verified_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (ownerProfileError) throw ownerProfileError;

  return authUserId;
}

async function ensureDemoOwners(supabase) {
  const existingUsers = await listAllUsers(supabase);
  const existingUsersByEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user]),
  );

  const ownerIds = [];
  for (const owner of DEMO_OWNERS) {
    ownerIds.push(await ensureOwnerAccount(supabase, owner, existingUsersByEmail));
  }
  return ownerIds;
}

async function seedListingsFromSql(supabase, universityId) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const seedSqlPath = path.resolve(__dirname, "seed-renthub-rangsit.sql");
  const sql = readFileSync(seedSqlPath, "utf8");
  const nowIso = new Date().toISOString();

  const rows = parseListingRowsFromSql(sql, {
    universityId,
    demoOwnerId: null,
    nowIso,
  }).map((row) => ({
    ...row,
    owner_user_id: null,
    university_id: universityId,
  }));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("listings")
      .upsert(chunk, { onConflict: "id" });
    if (error) throw error;
  }

  return rows.length;
}

async function assignListingsBalanced(supabase, ownerIds) {
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, listing_status, created_at")
    .neq("listing_status", "archived")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (listingsError) throw listingsError;

  const listingRows = listings ?? [];
  const groupedIds = ownerIds.map(() => []);

  for (let i = 0; i < listingRows.length; i += 1) {
    const ownerIndex = i % ownerIds.length;
    groupedIds[ownerIndex].push(listingRows[i].id);
  }

  for (let i = 0; i < ownerIds.length; i += 1) {
    const ids = groupedIds[i];
    if (ids.length === 0) continue;
    const { error } = await supabase
      .from("listings")
      .update({ owner_user_id: ownerIds[i] })
      .in("id", ids);
    if (error) throw error;
  }

  return groupedIds.map((ids) => ids.length);
}

async function main() {
  loadDotEnv();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await snapshotCounts(supabase, "before-reset");
  await wipeRelationalData(supabase);
  await wipeAuthUsers(supabase);
  const universityId = await ensureDiscoveryData(supabase);
  const seededListings = await seedListingsFromSql(supabase, universityId);
  const ownerIds = await ensureDemoOwners(supabase);
  const ownerCounts = await assignListingsBalanced(supabase, ownerIds);
  await snapshotCounts(supabase, "after-reset");

  console.log("\nReset complete.");
  console.log(`University id: ${universityId}`);
  console.log(`Seeded listings: ${seededListings}`);
  console.log("Demo owner credentials:");
  for (const owner of DEMO_OWNERS) {
    console.log(`- ${owner.email} / ${owner.password}`);
  }
  console.log(
    `Listing assignment counts: ${ownerCounts[0]} / ${ownerCounts[1]} / ${ownerCounts[2]}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
