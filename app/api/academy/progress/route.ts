import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublishedAcademyArticleById, recordAcademyProgress } from "@/lib/server/academy-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv, getSupabaseServiceEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const academyProgressSchema = z.object({
  action: z.enum(["shown", "opened", "completed", "still_confused"]),
  contentKey: z.string().min(1).max(100),
  articleId: z.string().uuid(),
  sourceContext: z.enum(["quest_feed", "learn_home", "article", "related_article", "mission"]),
}).strict();

export async function POST(request: Request) {
  const parsed = academyProgressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Academy progress" }, { status: 400 });
  }

  if (!getSupabasePublicEnv() || !getSupabaseServiceEnv()) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const article = await getPublishedAcademyArticleById(supabase, parsed.data.articleId);
    if (!article || article.contentKey !== parsed.data.contentKey) {
      return NextResponse.json({ error: "Academy article not found" }, { status: 404 });
    }

    const admin = createAdminSupabaseClient();
    await recordAcademyProgress(
      admin,
      user.id,
      article,
      parsed.data.action,
      parsed.data.sourceContext,
    );

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Could not record Academy progress" }, { status: 500 });
  }
}
