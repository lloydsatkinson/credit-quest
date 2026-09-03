import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminNav } from "@/components/admin/admin-nav";

afterEach(cleanup);

describe("V2.0d recovery admin navigation", () => {
  it("links the control plane to aggregate recovery reporting", () => {
    render(<AdminNav />);

    const recovery = screen.getByRole("link", { name: "Recovery" });
    expect(recovery.getAttribute("href")).toBe("/admin/recovery");
  });
});
