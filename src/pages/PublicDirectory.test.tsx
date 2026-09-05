import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicDirectory } from "./PublicDirectory";
import { fetchPublicGallery } from "../lib/publicPages";

vi.mock("../lib/publicPages");

afterEach(() => {
  vi.resetAllMocks();
});

describe("PublicDirectory", () => {
  it("renders each public profile with a link to their page", async () => {
    vi.mocked(fetchPublicGallery).mockResolvedValue([
      {
        public_slug: "rishi-mohnot",
        display_name: "Rishi Mohnot",
        current_location: "Tokyo",
        next_trip_date: "2027-01-01"
      }
    ]);

    render(
      <MemoryRouter>
        <PublicDirectory />
      </MemoryRouter>
    );

    expect(await screen.findByRole("link", { name: "Rishi Mohnot" })).toHaveAttribute(
      "href",
      "/going/rishi-mohnot"
    );
    expect(screen.getByText("Tokyo")).toBeInTheDocument();
  });

  it("shows an empty state when no one has published a page", async () => {
    vi.mocked(fetchPublicGallery).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <PublicDirectory />
      </MemoryRouter>
    );

    expect(await screen.findByText("No one has published a public page yet.")).toBeInTheDocument();
  });
});
