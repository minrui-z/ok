import { apiError, authenticated, json, requireSameOrigin } from "../../_lib";

type Context = { params: Promise<{ id: string }> | { id: string } };
async function pollId(context: Context) { return (await context.params).id; }

export async function PATCH(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (body?.status !== "closed") return apiError("目前只支援關閉投票。", 400);
  const result = await auth.db.prepare("UPDATE polls SET status = 'closed', updated_at = ? WHERE id = ? AND author_id = ?")
    .bind(Date.now(), await pollId(context), auth.session.participantId).run();
  if (!result.meta.changes) return apiError("找不到投票，或你不是建立者。", 403);
  return json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const result = await auth.db.prepare("DELETE FROM polls WHERE id = ? AND author_id = ?")
    .bind(await pollId(context), auth.session.participantId).run();
  if (!result.meta.changes) return apiError("找不到投票，或你不是建立者。", 403);
  return json({ ok: true });
}
