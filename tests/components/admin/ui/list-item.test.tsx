import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListItem } from "@/components/admin/ui/ListItem";

describe("admin ListItem", () => {
  it("renders as link when href is provided", () => {
    render(
      <ListItem
        icon={<span aria-hidden>i</span>}
        title="Meses"
        href="/admin/months"
      />,
    );

    const link = screen.getByRole("link", { name: /meses/i });
    expect(link).toHaveAttribute("href", "/admin/months");
  });

  it("renders optional subtitle when provided", () => {
    render(
      <ListItem
        icon={<span aria-hidden>i</span>}
        title="Ana Pérez"
        subtitle="(55) 1234 5678"
      />,
    );

    expect(screen.getByText("(55) 1234 5678")).toBeInTheDocument();
  });
});
