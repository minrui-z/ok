import { apiError, authenticated, expenseValue, json, requireSameOrigin } from "../../_lib";

type Context = { params: Promise<{ id: string }> | { id: string } };
async function expenseId(context: Context) { return (await context.params).id; }

export async function PATCH(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const values = expenseValue(await request.json().catch(() => null) as Record<string, unknown> | null);
  if (!values) return apiError("請檢查品項、金額、付款人與分攤者。", 400);
  const result = await auth.db.prepare(
    "UPDATE expenses SET day_id = ?, description = ?, category = ?, amount_cents = ?, currency = ?, paid_by = ?, participants_json = ?, updated_at = ? WHERE id = ? AND author_id = ?",
  ).bind(values.dayId, values.description, values.category, values.amountCents, values.currency, values.paidBy, JSON.stringify(values.participants), Date.now(), await expenseId(context), auth.session.participantId).run();
  if (!result.meta.changes) return apiError("找不到支出，或你不是記錄者。", 403);
  return json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const result = await auth.db.prepare("DELETE FROM expenses WHERE id = ? AND author_id = ?")
    .bind(await expenseId(context), auth.session.participantId).run();
  if (!result.meta.changes) return apiError("找不到支出，或你不是記錄者。", 403);
  return json({ ok: true });
}
