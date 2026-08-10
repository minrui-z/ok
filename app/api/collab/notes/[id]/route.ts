import { apiError, authenticated, json, requireSameOrigin, textValue } from "../../_lib";

type Context = { params: Promise<{ id: string }> | { id: string } };

async function noteId(context: Context) {
  return (await context.params).id;
}

export async function PATCH(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const content = textValue((await request.json().catch(() => null) as { content?: unknown } | null)?.content, 1_000);
  if (!content) return apiError("筆記需介於 1–1,000 字。", 400);
  const result = await auth.db.prepare(
    "UPDATE notes SET content = ?, updated_at = ? WHERE id = ? AND author_id = ?",
  ).bind(content, Date.now(), await noteId(context), auth.session.participantId).run();
  if (!result.meta.changes) return apiError("找不到筆記，或你不是作者。", 403);
  return json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const result = await auth.db.prepare("DELETE FROM notes WHERE id = ? AND author_id = ?")
    .bind(await noteId(context), auth.session.participantId).run();
  if (!result.meta.changes) return apiError("找不到筆記，或你不是作者。", 403);
  return json({ ok: true });
}
