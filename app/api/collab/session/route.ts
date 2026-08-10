import {
  apiError,
  authenticated,
  clearSessionCookie,
  ensureCollabSchema,
  json,
  requireSameOrigin,
  runtimeSecrets,
  sessionCookie,
  sessionExpiry,
  signSession,
  sourceHash,
  textValue,
  verifyPin,
} from "../_lib";
import { getD1 } from "../../../../db/index";

export async function GET(request: Request) {
  const auth = await authenticated(request);
  return json(auth ? { unlocked: true, nickname: auth.session.nickname } : { unlocked: false });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  let secrets: ReturnType<typeof runtimeSecrets>;
  try {
    secrets = runtimeSecrets();
  } catch {
    return apiError("共同區尚未完成設定。", 503);
  }

  const body = await request.json().catch(() => null) as { pin?: unknown; nickname?: unknown } | null;
  const pin = textValue(body?.pin, 4, 4);
  const nickname = textValue(body?.nickname, 30);
  if (!pin || !/^\d{4}$/.test(pin) || !nickname) return apiError("請輸入四位數密碼與暱稱。", 400);

  const db = getD1();
  await ensureCollabSchema(db);
  const key = await sourceHash(request, secrets.signingSecret);
  const now = Date.now();
  const attempt = await db.prepare(
    "SELECT window_started_at AS windowStartedAt, failures, locked_until AS lockedUntil FROM unlock_attempts WHERE source_hash = ?",
  ).bind(key).first<{ windowStartedAt: number; failures: number; lockedUntil: number }>();
  if (attempt && attempt.lockedUntil > now) {
    return apiError("嘗試次數過多，請十分鐘後再試。", 429);
  }

  if (!(await verifyPin(pin, secrets.pinHash))) {
    const inWindow = Boolean(attempt && now - attempt.windowStartedAt < 10 * 60_000);
    const failures = inWindow ? (attempt?.failures ?? 0) + 1 : 1;
    const windowStartedAt = inWindow ? attempt!.windowStartedAt : now;
    const lockedUntil = failures >= 5 ? now + 10 * 60_000 : 0;
    await db.prepare(
      "INSERT INTO unlock_attempts (source_hash, window_started_at, failures, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(source_hash) DO UPDATE SET window_started_at = excluded.window_started_at, failures = excluded.failures, locked_until = excluded.locked_until",
    ).bind(key, windowStartedAt, failures, lockedUntil).run();
    return apiError(lockedUntil ? "嘗試次數過多，請十分鐘後再試。" : "旅行密碼不正確。", lockedUntil ? 429 : 401);
  }

  await db.prepare("DELETE FROM unlock_attempts WHERE source_hash = ?").bind(key).run();
  const session = { participantId: crypto.randomUUID(), nickname, exp: sessionExpiry() };
  const token = await signSession(session, secrets.signingSecret);
  return json(
    { unlocked: true, nickname },
    200,
    { "set-cookie": sessionCookie(token) },
  );
}

export async function DELETE(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  return json({ unlocked: false }, 200, { "set-cookie": clearSessionCookie() });
}
