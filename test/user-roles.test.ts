import assert from "node:assert/strict";
import test from "node:test";
import { userRoleSchema } from "@shared/schema";

test("userRoleSchema accepts only student and owner", () => {
  assert.equal(userRoleSchema.parse("student"), "student");
  assert.equal(userRoleSchema.parse("owner"), "owner");
  assert.throws(() => userRoleSchema.parse("admin"));
});
