import { describe, expect, it } from "vitest";
import { isValidTripInput } from "./trips";
import type { TripInput } from "./trips";

function baseInput(overrides: Partial<TripInput> = {}): TripInput {
  return {
    date_from: "2026-09-01",
    date_to: "2026-09-05",
    location_name: "Tokyo, Japan",
    confirmation_status: "tentative",
    visibility: "private",
    ...overrides
  };
}

describe("isValidTripInput", () => {
  it("accepts a valid trip", () => {
    expect(isValidTripInput(baseInput())).toBeNull();
  });

  it("rejects a blank location", () => {
    expect(isValidTripInput(baseInput({ location_name: "  " }))).toMatch(/location/i);
  });

  it("rejects missing dates", () => {
    expect(isValidTripInput(baseInput({ date_from: "" }))).toMatch(/date/i);
  });

  it("rejects an end date before the start date", () => {
    expect(
      isValidTripInput(baseInput({ date_from: "2026-09-05", date_to: "2026-09-01" }))
    ).toMatch(/before/i);
  });
});
