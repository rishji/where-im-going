import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";
import { fetchTrips } from "../lib/trips";
import type { Trip, UserProfile } from "../lib/types";

vi.mock("../lib/trips", async () => {
  const actual = await vi.importActual<typeof import("../lib/trips")>("../lib/trips");
  return { ...actual, fetchTrips: vi.fn() };
});
vi.mock("../lib/auth", () => ({ signOut: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

const profile: UserProfile = {
  user_id: "owner-1",
  display_name: "Test Owner",
  public_slug: "test-owner",
  public_page_enabled: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

function trip(overrides: Partial<Trip>): Trip {
  return {
    id: "trip-1",
    user_id: "owner-1",
    date_from: "2099-01-01",
    date_to: "2099-01-05",
    location_name: "Somewhere",
    location_label: null,
    city: null,
    region: null,
    country: null,
    lat: null,
    lng: null,
    event_name: null,
    flights: null,
    confirmation_status: "booked",
    source: "manual",
    visibility: "private",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides
  };
}

describe("Dashboard trip grouping", () => {
  it("shows upcoming trips expanded and past trips collapsed behind a toggle", async () => {
    vi.mocked(fetchTrips).mockResolvedValue([
      trip({ id: "future", location_name: "Future Trip", date_from: "2099-01-01", date_to: "2099-01-05" }),
      trip({ id: "past", location_name: "Past Trip", date_from: "2020-01-01", date_to: "2020-01-05" })
    ]);

    render(
      <MemoryRouter>
        <Dashboard profile={profile} onProfileChange={vi.fn()} />
      </MemoryRouter>
    );

    expect(await screen.findByText("Future Trip")).toBeInTheDocument();
    expect(screen.queryByText("Past Trip")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Show past trips (1)" });
    await userEvent.click(toggle);

    expect(await screen.findByText("Past Trip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide past trips (1)" })).toBeInTheDocument();
  });
});

describe("Dashboard inline editing", () => {
  it("renders the edit form inline at the trip being edited, not at the top of the list", async () => {
    vi.mocked(fetchTrips).mockResolvedValue([trip({ id: "trip-1", location_name: "Edit Me" })]);

    render(
      <MemoryRouter>
        <Dashboard profile={profile} onProfileChange={vi.fn()} />
      </MemoryRouter>
    );

    expect(await screen.findByText("Edit Me")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    // The trip's own summary is replaced by the form, not duplicated above the list.
    expect(screen.queryByText("Edit Me")).not.toBeInTheDocument();
  });
});
