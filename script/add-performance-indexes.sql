-- Additional indexes for paginated list/search queries.
-- Safe to run multiple times.

create index if not exists listings_live_created_at_idx
  on public.listings (created_at desc)
  where listing_status <> 'archived';

create index if not exists listings_university_created_at_idx
  on public.listings (university_id, created_at desc)
  where listing_status <> 'archived';

create index if not exists listings_campus_created_at_idx
  on public.listings (nearest_campus_zone_id, created_at desc)
  where listing_status <> 'archived';

create index if not exists listings_room_type_created_at_idx
  on public.listings (room_type, created_at desc)
  where listing_status <> 'archived';

create index if not exists listings_price_idx
  on public.listings (price);

create index if not exists bookings_owner_created_at_idx
  on public.bookings (owner_user_id, created_at desc);

create index if not exists bookings_student_created_at_idx
  on public.bookings (student_user_id, created_at desc);

create index if not exists contracts_owner_created_at_idx
  on public.contracts (owner_user_id, created_at desc);

create index if not exists contracts_student_created_at_idx
  on public.contracts (student_user_id, created_at desc);

