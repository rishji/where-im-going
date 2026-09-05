import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicProfile } from "./PublicProfile";
import { fetchPublicTrips } from "../lib/publicPages";

vi.mock("../lib/publicPages");

afterEach(() => {
  vi.resetAllMocks();
});

function renderAtSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/going/${slug}`]}>
      <Routes>
        <Route path="/going/:slug" element={<PublicProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicProfile", () => {
  it("renders trips and notes for the profile's slug", async () => {
    vi.mocked(fetchPublicTrips).mockResolvedValue([
      {
        trip_id: "11111111-1111-1111-1111-111111111111",
        date_from: "2027-01-01",
        date_to: "2027-01-05",
        location_name: "Tokyo, Japan",
        location_label: null,
        city: null,
        region: null,
        country: null,
        lat: null,
        lng: null,
        event_name: null,
        flights: null,
        confirmation_status: "booked",
        notes: [{ id: "n1", body: "Great trip!", created_at: "2027-01-01T00:00:00Z" }]
      }
    ]);

    renderAtSlug("rishi-mohnot");

    expect(await screen.findByText("Tokyo, Japan")).toBeInTheDocument();
    expect(screen.getByText("Great trip!")).toBeInTheDocument();
    expect(fetchPublicTrips).toHaveBeenCalledWith("rishi-mohnot");
  });

  it("shows a generic not-available state for an unknown or private slug", async () => {
    vi.mocked(fetchPublicTrips).mockResolvedValue([]);

    renderAtSlug("no-such-slug");

    expect(await screen.findByText("This page isn't available.")).toBeInTheDocument();
  });

  it("shows a generic error message if fetching trips fails", async () => {
    vi.mocked(fetchPublicTrips).mockRejectedValue(new Error("Database connection failed"));

    renderAtSlug("rishi-mohnot");

    expect(await screen.findByText("Something went wrong. Try again later.")).toBeInTheDocument();
    expect(screen.queryByText("Database connection failed")).not.toBeInTheDocument();
  });
});
