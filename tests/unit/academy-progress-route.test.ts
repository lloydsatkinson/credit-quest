import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";

const mocks = vi.hoisted(() => ({
  getSupabasePublicEnv: vi.fn(),
  getSupabaseServiceEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createAdminSupabaseClient: vi.fn(),
  getPublishedAcademyArticleById: vi.fn(),
  recordAcademyProgress: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: mocks.getSupabasePublicEnv,
  getSupabaseServiceEnv: mocks.getSupabaseServiceEnv,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));

vi.mock("@/lib/server/academy-repository", () => ({
  getPublishedAcademyArticleById: mocks.getPublishedAcademyArticleById,
  recordAcademyProgress: mocks.recordAcademyProgress,
}));

import { academyProgressSchema, POST } from "@/app/api/academy/progress/route";

const article = DEMO_ACADEMY_ARTICLES[0];
const body = {
  action: "shown" as const,
  contentKey: article.contentKey,
  articleId: article.id,
  sourceContext: "quest_feed" as const,
};

function request(payload: unknown) {
  return new Request("https://credit-quest-app.vercel.app/api/academy/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/academy/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabasePublicEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon" });
    mocks.getSupabaseServiceEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon", serviceRoleKey: "service" });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getPublishedAcademyArticleById.mockResolvedValue(article);
    mocks.recordAcademyProgress.mockResolvedValue(undefined);
  });

  it("uses a strict payload schema and rejects client ownership fields", () => {
    expect(academyProgressSchema.safeParse(body).success).toBe(true);
    expect(academyProgressSchema.safeParse({ ...body, userId: "someone-else" }).success).toBe(false);
  });

  it("returns 400 for an invalid body", async () => {
    const response = await POST(request({ ...body, userId: "someone-else" }));
    expect(response.status).toBe(400);
    expect(mocks.recordAcademyProgress).not.toHaveBeenCalled();
  });

  it("returns 204 without writes when the backend is intentionally unconfigured", async () => {
    mocks.getSupabaseServiceEnv.mockReturnValue(null);
    const response = await POST(request(body));
    expect(response.status).toBe(204);
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 401 for an unauthenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request(body));
    expect(response.status).toBe(401);
    expect(mocks.recordAcademyProgress).not.toHaveBeenCalled();
  });

  it("returns 404 when the article id is missing or unpublished", async () => {
    mocks.getPublishedAcademyArticleById.mockResolvedValue(null);
    const response = await POST(request(body));
    expect(response.status).toBe(404);
    expect(mocks.recordAcademyProgress).not.toHaveBeenCalled();
  });

  it("returns 404 when the content key does not match the published article id", async () => {
    const response = await POST(request({ ...body, contentKey: "different-content-key" }));
    expect(response.status).toBe(404);
    expect(mocks.recordAcademyProgress).not.toHaveBeenCalled();
  });

  it("records progress for the authenticated user only", async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(204);
    expect(mocks.getPublishedAcademyArticleById).toHaveBeenCalledWith(expect.anything(), article.id);
    expect(mocks.recordAcademyProgress).toHaveBeenCalledWith(
      { kind: "admin" },
      "user-1",
      article,
      "shown",
      "quest_feed",
    );
  });

  it("returns 500 when the progress write fails", async () => {
    mocks.recordAcademyProgress.mockRejectedValue(new Error("database failure"));
    const response = await POST(request(body));
    expect(response.status).toBe(500);
  });
});
