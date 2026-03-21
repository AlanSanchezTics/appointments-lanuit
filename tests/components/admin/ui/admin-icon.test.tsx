import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";

describe("AdminIcon", () => {
  it("renders with admin accent tone by default", () => {
    render(<AdminIcon icon={adminIcons.syncFailed} />);

    const icon = document.querySelector('svg[data-icon="triangle-exclamation"]');

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("text-[var(--admin-accent)]");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("supports tone and size overrides", () => {
    render(
      <AdminIcon
        icon={adminIcons.pending}
        tone="secondary"
        size="lg"
        className="custom-icon"
        title="Pendientes"
      />,
    );

    const icon = document.querySelector('svg[data-icon="clock"]');

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("text-[var(--admin-text-secondary)]");
    expect(icon).toHaveClass("fa-lg");
    expect(icon).toHaveClass("custom-icon");
    expect(icon).not.toHaveAttribute("aria-hidden", "true");
  });
});
