import { apiError, authenticated, json, requireSameOrigin, scopeValue, textValue } from "../_lib";

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const result = await auth.db.prepare(
    "SELECT id, scope, day_id AS dayId, author_id AS authorId, author_name AS authorName, content, created_at AS createdAt, updated_at AS updatedAt FROM notes ORDER BY updated_at DESC",
  ).all();
  return json({ notes: result.results, participantId: auth.session.participantId });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const content = textValue(body?.content, 1_000);
  const scope = scopeValue(body?.scope, body?.dayId);
  if (!content || !scope) return apiError("筆記內容或日期不正確。", 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  await auth.db.prepare(
    "INSERT INTO notes (id, scope, day_id, author_id, author_name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, scope.scope, scope.dayId, auth.session.participantId, auth.session.nickname, content, now, now).run();
  return json({ id }, 201);
}
