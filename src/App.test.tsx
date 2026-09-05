import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./pages/AuthedApp", () => ({ AuthedApp: () => <div>authed-app-marker</div> }));
vi.mock("./pages/PublicDirectory", () => ({ PublicDirectory: () => <div>public-directory-marker</div> }));
vi.mock("./pages/PublicProfile", () => ({ PublicProfile: () => <div>public-profile-marker</div> }));

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("App routing", () => {
  it("renders AuthedApp at the root path", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByText("authed-app-marker")).toBeInTheDocument();
  });

  it("renders PublicDirectory at /going", () => {
    window.history.pushState({}, "", "/going");
    render(<App />);
    expect(screen.getByText("public-directory-marker")).toBeInTheDocument();
  });

  it("renders PublicProfile at /going/:slug", () => {
    window.history.pushState({}, "", "/going/rishi-mohnot");
    render(<App />);
    expect(screen.getByText("public-profile-marker")).toBeInTheDocument();
  });

  it("falls back to AuthedApp for any other path", () => {
    window.history.pushState({}, "", "/some/random/path");
    render(<App />);
    expect(screen.getByText("authed-app-marker")).toBeInTheDocument();
  });
});
