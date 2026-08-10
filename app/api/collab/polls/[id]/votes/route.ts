import { apiError, authenticated, json, requireSameOrigin } from "../../../_lib";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PUT(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const id = (await context.params).id;
  const body = await request.json().catch(() => null) as { optionIds?: unknown } | null;
  const optionIds = Array.isArray(body?.optionIds)
    ? [...new Set(body.optionIds.filter((value): value is string => typeof value === "string"))]
    : [];
  const poll = await auth.db.prepare("SELECT type, status FROM polls WHERE id = ?").bind(id).first<{ type: "single" | "multiple"; status: "open" | "closed" }>();
  if (!poll) return apiError("找不到投票。", 404);
  if (poll.status !== "open") return apiError("這個投票已關閉。", 409);
  if (poll.type === "single" && optionIds.length > 1) return apiError("這是單選投票。", 400);
  if (optionIds.length > 8) return apiError("選項數量不正確。", 400);
  if (optionIds.length) {
    const placeholders = optionIds.map(() => "?").join(",");
    const valid = await auth.db.prepare(`SELECT id FROM poll_options WHERE poll_id = ? AND id IN (${placeholders})`)
      .bind(id, ...optionIds).all<{ id: string }>();
    if (valid.results.length !== optionIds.length) return apiError("選項不屬於這個投票。", 400);
  }
  const now = Date.now();
  // Delete + inserts are sent as one D1 batch so changing an answer never leaves
  // a half-updated ballot: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
  await auth.db.batch([
    auth.db.prepare("DELETE FROM poll_votes WHERE poll_id = ? AND participant_id = ?").bind(id, auth.session.participantId),
    ...optionIds.map((optionId) => auth.db.prepare("INSERT INTO poll_votes (poll_id, option_id, participant_id, participant_name, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, optionId, auth.session.participantId, auth.session.nickname, now)),
    auth.db.prepare("UPDATE polls SET updated_at = ? WHERE id = ?").bind(now, id),
  ]);
  return json({ ok: true });
}
