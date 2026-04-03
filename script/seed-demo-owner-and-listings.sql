-- Demo seed script (separate from schema.sql)
-- Purpose:
-- 1) Assign one existing app user as Demo Owner (if available)
-- 2) Upsert demo owner profile
-- 3) Upsert realistic demo listings
--
-- Safe to run multiple times (idempotent).
-- Run this AFTER schema.sql.

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
    raise exception 'Rangsit University row not found. Run schema.sql first.';
  end if;

  -- Prefer an existing owner account.
  select id
  into demo_owner_id
  from public.app_users
  where role = 'owner'
  order by created_at
  limit 1;

  -- Fallback: promote the oldest app user to owner for demo purposes.
  if demo_owner_id is null then
    select id
    into demo_owner_id
    from public.app_users
    order by created_at
    limit 1;

    if demo_owner_id is not null then
      update public.app_users
      set
        role = 'owner',
        full_name = coalesce(nullif(full_name, ''), 'Demo Owner'),
        updated_at = now()
      where id = demo_owner_id;
    end if;
  end if;

  if demo_owner_id is not null then
    update public.app_users
    set
      full_name = coalesce(nullif(full_name, ''), 'Demo Owner'),
      updated_at = now()
    where id = demo_owner_id;

    insert into public.owner_profiles (
      user_id,
      business_name,
      verification_status,
      verified_at
    )
    values (
      demo_owner_id,
      'Demo Owner Residence',
      'verified',
      now()
    )
    on conflict (user_id) do update
      set
        business_name = excluded.business_name,
        verification_status = 'verified',
        verified_at = coalesce(owner_profiles.verified_at, excluded.verified_at),
        updated_at = now();
  else
    raise notice 'No app_users found. Demo listings will be inserted with null owner_user_id.';
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
    (
      '3408f696-fca2-47ed-89e6-63ce90bcb3ec',
      demo_owner_id,
      rsu_university_id,
      'Demo Owner - Plum Condo Park Rangsit',
      'Khlong Nueng, Pathum Thani',
      8500,
      4.80,
      'CONDO',
      'condo',
      '/images/condo-exterior.png',
      '["/images/condo-exterior.png","/images/condo-interior.png","/images/condo-pool.png"]'::jsonb,
      'Modern student condo near RSU main gate with transparent utility rates and semester lease options.',
      13.9612000,
      100.6015000,
      28,
      2,
      1,
      1.0,
      true,
      'active',
      'approved',
      '["Pool","Gym","24/7 Security","Study Lounge","Laundry","Air Conditioning"]'::jsonb,
      'rsu-main-gate',
      11,
      '["rsu-shuttle-green","songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":7,"waterPerUnit":20,"internetFee":0,"serviceFee":350}'::jsonb,
      true,
      '[{"months":1,"label":"Short Stay"},{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-05-01T00:00:00+07'::timestamptz,
      null
    ),
    (
      '19cdeafb-26e7-4846-919e-1aa67bc1f2b0',
      demo_owner_id,
      rsu_university_id,
      'Demo Owner - Be Condo Phaholyothin',
      'Near Rangsit University',
      7500,
      4.60,
      'BUDGET',
      'studio',
      '/images/condo-interior.png',
      '["/images/condo-interior.png"]'::jsonb,
      'Budget studio option with simple contract flow, practical amenities, and strong demand from first-year students.',
      13.9660000,
      100.5920000,
      24,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Laundry","Security","Mini Mart"]'::jsonb,
      'rsu-main-gate',
      9,
      '["songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":6,"waterPerUnit":16,"internetFee":300,"serviceFee":180}'::jsonb,
      false,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-04-15T00:00:00+07'::timestamptz,
      null
    ),
    (
      '3b1271c4-c818-484c-8f5e-4ac2f2f724c8',
      demo_owner_id,
      rsu_university_id,
      'Demo Owner - Kave Town Space',
      'Chiang Rak, Pathum Thani',
      12000,
      4.90,
      'LUXURY',
      'studio',
      '/images/condo-interior.png',
      '["/images/condo-interior.png","/images/co-working.png","/images/condo-pool.png"]'::jsonb,
      'Premium studio inventory with co-working zones, strong internet, and fast owner-side approvals.',
      13.9680000,
      100.6050000,
      32,
      2,
      1,
      1.0,
      true,
      'active',
      'approved',
      '["Co-working","Rooftop","Fiber Internet","Smart Lock","Fitness Center"]'::jsonb,
      'rsu-library',
      14,
      '["rsu-shuttle-green"]'::jsonb,
      '{"electricityPerUnit":8,"waterPerUnit":18,"internetFee":0,"serviceFee":500}'::jsonb,
      true,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-05-15T00:00:00+07'::timestamptz,
      null
    )
  on conflict (id) do update
    set
      owner_user_id = coalesce(excluded.owner_user_id, listings.owner_user_id),
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
