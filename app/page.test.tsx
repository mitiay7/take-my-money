import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("communicates the value proposition and deterministic AI boundary", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Switch plans without paying twice." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI reads and explains. Code controls every cent."),
    ).toBeInTheDocument();
    expect(screen.getByText("€213.68")).toBeInTheDocument();
  });
});
