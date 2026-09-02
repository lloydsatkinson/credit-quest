import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as pilotRepository from "@/lib/server/sandbox-pilot-repository";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function adminClient(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = { app_metadata: {} }) {
  const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const updateUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ insert }));
  return { client: { auth: { admin: { getUserById, updateUserById } }, from }, getUserById, updateUserById, from, insert };
}

describe("sandbox pilot control", () => {
  it("reads only the server-controlled app_metadata pilot bit and fails closed", async () => {
    const allowed = adminClient({ app_metadata: { credit_quest_sandbox_pilot: true }, user_metadata: { credit_quest_sandbox_pilot: false } });
    await expect(pilotRepository.isSandboxPilot(allowed.client as never, "user-1")).resolves.toBe(true);

    const userEditableOnly = adminClient({ app_metadata: {}, user_metadata: { credit_quest_sandbox_pilot: true } });
    await expect(pilotRepository.isSandboxPilot(userEditableOnly.client as never, "user-2")).resolves.toBe(false);

    const broken = adminClient();
    broken.getUserById.mockRejectedValue(new Error("auth unavailable"));
    await expect(pilotRepository.isSandboxPilot(broken.client as never, "user-3")).resolves.toBe(false);
  });

  it("provides an audited server-side pilot mutation that preserves existing app_metadata", async () => {
    const setSandboxPilot = (pilotRepository as unknown as { setSandboxPilot?: Function }).setSandboxPilot;
    expect(typeof setSandboxPilot).toBe("function");
    if (!setSandboxPilot) return;

    const target = adminClient({ app_metadata: { provider: "email", existing: "keep" } });
    await setSandboxPilot(target.client, "admin-1", "00000000-0000-0000-0000-000000000002", true);

    expect(target.updateUserById).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000002",
      { app_metadata: { provider: "email", existing: "keep", credit_quest_sandbox_pilot: true } },
    );
    expect(target.from).toHaveBeenCalledWith("admin_audit_log");
    expect(target.insert).toHaveBeenCalledWith(expect.objectContaining({
      admin_user_id: "admin-1",
      action: "set_sandbox_pilot",
      entity_type: "auth_user",
      entity_id: "00000000-0000-0000-0000-000000000002",
      metadata: { enabled: true },
    }));
  });

  it("adds protected narrow admin tooling without broadening runtime flags", () => {
    const routePath = "app/api/admin/sandbox-pilots/route.ts";
    const formPath = "components/admin/sandbox-pilot-form.tsx";
    expect(existsSync(resolve(process.cwd(), routePath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), formPath))).toBe(true);

    if (!existsSync(resolve(process.cwd(), routePath)) || !existsSync(resolve(process.cwd(), formPath))) return;
    const route = read(routePath);
    const form = read(formPath);
    const flagsPage = read("app/admin/flags/page.tsx");

    expect(route).toContain("requireAdminUser");
    expect(route).toContain("sandboxPilotSchema");
    expect(route).toContain("userId: z.string().uuid()");
    expect(route).toContain("enabled: z.boolean()");
    expect(route).toContain(".strict()");
    expect(route).toContain("setSandboxPilot");
    expect(form).toContain('fetch("/api/admin/sandbox-pilots"');
    expect(flagsPage).toContain("SandboxPilotForm");
  });
});
