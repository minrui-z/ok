import { apiError, authenticated, expenseValue, json, requireSameOrigin } from "../_lib";

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const result = await auth.db.prepare(
    "SELECT id, day_id AS dayId, description, category, amount_cents AS amountCents, currency, paid_by AS paidBy, participants_json AS participantsJson, author_id AS authorId, author_name AS authorName, created_at AS createdAt, updated_at AS updatedAt FROM expenses ORDER BY updated_at DESC",
  ).all();
  const expenses = result.results.map((row) => {
    const item = row as Record<string, unknown>;
    try { return { ...item, participants: JSON.parse(String(item.participantsJson)) }; }
    catch { return { ...item, participants: [] }; }
  });
  return json({ expenses, participantId: auth.session.participantId });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const values = expenseValue(await request.json().catch(() => null) as Record<string, unknown> | null);
  if (!values) return apiError("請檢查品項、金額、付款人與分攤者。", 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  await auth.db.prepare(
    "INSERT INTO expenses (id, day_id, description, category, amount_cents, currency, paid_by, participants_json, author_id, author_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, values.dayId, values.description, values.category, values.amountCents, values.currency, values.paidBy, JSON.stringify(values.participants), auth.session.participantId, auth.session.nickname, now, now).run();
  return json({ id }, 201);
}
