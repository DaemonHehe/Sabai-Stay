import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStorage, StorageError } from "../server/storage";

test("bookings and contracts are scoped by user id", async () => {
  const storage = new MemoryStorage();
  const scopedUserId = "owner-sabai-living";

  const scopedBookings = await storage.getBookings(scopedUserId);
  assert.ok(scopedBookings.length > 0);
  assert.ok(
    scopedBookings.every(
      (booking) =>
        booking.ownerUserId === scopedUserId ||
        booking.studentUserId === scopedUserId,
    ),
  );

  const scopedContracts = await storage.getContracts(scopedUserId);
  assert.ok(
    scopedContracts.every(
      (contract) =>
        contract.ownerUserId === scopedUserId ||
        contract.studentUserId === scopedUserId,
    ),
  );
});

test("public roommate profiles hide inactive profiles and private fields", async () => {
  const storage = new MemoryStorage();
  const viewerUserId = "student-001";

  const allProfiles = await storage.getRoommateProfiles();
  const profileToDeactivate = allProfiles.find(
    (profile) => profile.userId !== viewerUserId,
  );
  assert.ok(profileToDeactivate);

  await storage.saveRoommateProfile({
    userId: profileToDeactivate.userId,
    universityId: profileToDeactivate.universityId,
    displayName: profileToDeactivate.displayName,
    bio: profileToDeactivate.bio,
    studyHabit: profileToDeactivate.studyHabit,
    sleepSchedule: profileToDeactivate.sleepSchedule,
    cleanliness: profileToDeactivate.cleanliness,
    genderPreference: profileToDeactivate.genderPreference,
    budgetMin: profileToDeactivate.budgetMin,
    budgetMax: profileToDeactivate.budgetMax,
    preferredMoveIn: profileToDeactivate.preferredMoveIn,
    preferredLeaseMonths: profileToDeactivate.preferredLeaseMonths,
    openToVisitors: profileToDeactivate.openToVisitors,
    isActive: false,
  });

  const visibleProfiles = await storage.getPublicRoommateProfiles(viewerUserId);
  assert.ok(visibleProfiles.some((profile) => profile.displayName));
  assert.ok(
    !visibleProfiles.some(
      (profile) =>
        profile.displayName === profileToDeactivate.displayName && !profile.isActive,
    ),
  );
  assert.ok(visibleProfiles.every((profile) => !("userId" in profile)));
  assert.ok(visibleProfiles.every((profile) => !("bio" in profile)));
});

test("dashboard payload is user-scoped and contains no admin-only queues", async () => {
  const storage = new MemoryStorage();

  const ownerDashboard = await storage.getDashboardData(
    "owner-sabai-living",
    "owner",
  );
  assert.ok(
    ownerDashboard.ownerListings.every(
      (listing) => listing.ownerUserId === "owner-sabai-living",
    ),
  );
  assert.ok(
    ownerDashboard.ownerBookings.every(
      (booking) =>
        booking.ownerUserId === "owner-sabai-living" ||
        booking.studentUserId === "owner-sabai-living",
    ),
  );
  assert.equal(ownerDashboard.verificationTasks.length, 0);
  assert.equal(ownerDashboard.disputes.length, 0);

  const studentDashboard = await storage.getDashboardData(
    "student-001",
    "student",
  );
  assert.equal(studentDashboard.ownerListings.length, 0);
  assert.equal(studentDashboard.verificationTasks.length, 0);
  assert.equal(studentDashboard.disputes.length, 0);
});

test("booking status updates enforce the defined workflow", async () => {
  const storage = new MemoryStorage();
  const [booking] = await storage.getBookings("owner-sabai-living");
  assert.ok(booking);
  assert.equal(booking.status, "requested");

  await assert.rejects(
    () => storage.updateBookingStatus(booking.id, "confirmed"),
    (error) =>
      error instanceof StorageError &&
      error.code === "INVALID_BOOKING_TRANSITION",
  );

  const approved = await storage.updateBookingStatus(booking.id, "approved");
  assert.equal(approved?.status, "approved");

  const depositPending = await storage.updateBookingStatus(
    booking.id,
    "deposit_pending",
  );
  assert.equal(depositPending?.status, "deposit_pending");

  const confirmed = await storage.updateBookingStatus(booking.id, "confirmed");
  assert.equal(confirmed?.status, "confirmed");
  assert.equal(confirmed?.depositPaid, true);
});
