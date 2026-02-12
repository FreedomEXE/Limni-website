import { afterEach, describe, expect, test } from "vitest";
import { isReconstructionEnabledForAccount } from "@/lib/config/eaFeatures";

const OLD_ENABLED = process.env.EA_RECONSTRUCTION_ENABLED;
const OLD_ACCOUNTS = process.env.EA_RECONSTRUCTION_ENABLED_ACCOUNTS;

describe("eaFeatures", () => {
  afterEach(() => {
    process.env.EA_RECONSTRUCTION_ENABLED = OLD_ENABLED;
    process.env.EA_RECONSTRUCTION_ENABLED_ACCOUNTS = OLD_ACCOUNTS;
  });

  test("disabled globally blocks all accounts", () => {
    process.env.EA_RECONSTRUCTION_ENABLED = "false";
    process.env.EA_RECONSTRUCTION_ENABLED_ACCOUNTS = "acc1";
    expect(isReconstructionEnabledForAccount("acc1")).toBe(false);
  });

  test("allowlist enables only listed accounts", () => {
    process.env.EA_RECONSTRUCTION_ENABLED = "true";
    process.env.EA_RECONSTRUCTION_ENABLED_ACCOUNTS = "acc1,acc2";
    expect(isReconstructionEnabledForAccount("acc1")).toBe(true);
    expect(isReconstructionEnabledForAccount("acc9")).toBe(false);
  });
});

