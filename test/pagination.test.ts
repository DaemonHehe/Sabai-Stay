import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStorage } from "../server/storage";

test("listings pagination returns page metadata and bounded items", async () => {
  const storage = new MemoryStorage();
  const page = await storage.getListingsPage(undefined, {
    page: 1,
    pageSize: 5,
  });

  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 5);
  assert.ok(page.total >= page.items.length);
  assert.ok(page.totalPages >= 1);
  assert.ok(page.items.length <= 5);
});

test("bookings and contracts pagination scopes to user id", async () => {
  const storage = new MemoryStorage();
  const userId = "owner-sabai-living";

  const bookingsPage = await storage.getBookingsPage(userId, {
    page: 1,
    pageSize: 2,
  });
  assert.ok(bookingsPage.items.length <= 2);
  assert.ok(
    bookingsPage.items.every(
      (booking) =>
        booking.ownerUserId === userId || booking.studentUserId === userId,
    ),
  );

  const contractsPage = await storage.getContractsPage(userId, {
    page: 1,
    pageSize: 2,
  });
  assert.ok(contractsPage.items.length <= 2);
  assert.ok(
    contractsPage.items.every(
      (contract) =>
        contract.ownerUserId === userId || contract.studentUserId === userId,
    ),
  );
});

