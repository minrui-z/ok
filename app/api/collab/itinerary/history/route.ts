import { apiError, authenticated, json, requireSameOrigin } from "../../_lib";
import { itineraryHistory } from "../../../itinerary/_store";

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const url = new URL(request.url);
  const limit = positiveInteger(url.searchParams.get("limit"), 30, 100);
  const before = positiveInteger(url.searchParams.get("beforeVersion"), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  if (limit === null || before === null) return apiError("歷史查詢參數不正確。", 400);
  const result = await itineraryHistory(auth.db, before === Number.MAX_SAFE_INTEGER ? null : before, limit);
  return json({ history: result.results });
}
