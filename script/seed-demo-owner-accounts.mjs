import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function listAllUsers(supabase) {
  const out = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    out.push(...users);
    if (users.length < 1000) break;
    page += 1;
  }
  return out;
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
    authUserId = data.user.id;
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

  const { error: profileError } = await supabase.from("owner_profiles").upsert(
    {
      user_id: authUserId,
      business_name: owner.businessName,
      verification_status: "verified",
      verified_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  return authUserId;
}

async function main() {
  loadDotEnv();

  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existingUsers = await listAllUsers(supabase);
  const existingUsersByEmail = new Map(
    existingUsers
      .filter((u) => u.email)
      .map((u) => [u.email.toLowerCase(), u]),
  );

  const ownerIds = [];
  for (const owner of DEMO_OWNERS) {
    const ownerId = await ensureOwnerAccount(supabase, owner, existingUsersByEmail);
    ownerIds.push(ownerId);
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, listing_status, created_at")
    .neq("listing_status", "archived")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (listingsError) throw listingsError;

  const listingRows = listings ?? [];
  const counts = [0, 0, 0];

  // Balanced round-robin assignment so each owner gets distinct inventory.
  for (let i = 0; i < listingRows.length; i += 1) {
    const listing = listingRows[i];
    const ownerIndex = i % ownerIds.length;
    const ownerId = ownerIds[ownerIndex];
    const { error } = await supabase
      .from("listings")
      .update({ owner_user_id: ownerId })
      .eq("id", listing.id);
    if (error) throw error;
    counts[ownerIndex] += 1;
  }

  console.log("Demo owner accounts ready and listings assigned.");
  console.log("Credentials:");
  for (const owner of DEMO_OWNERS) {
    console.log(`- ${owner.email} / ${owner.password}`);
  }
  console.log("Assignments:");
  console.log(`- Owner Alpha: ${counts[0]} listings`);
  console.log(`- Owner Bravo: ${counts[1]} listings`);
  console.log(`- Owner Charlie: ${counts[2]} listings`);

  if (listingRows.length === 48) {
    if (counts[0] === 16 && counts[1] === 16 && counts[2] === 16) {
      console.log("Balanced target reached: 16 / 16 / 16.");
    } else {
      throw new Error(
        `Expected 16/16/16 for 48 listings, got ${counts.join("/")}.`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
