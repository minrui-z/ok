import { env } from "cloudflare:workers";
import { getD1 } from "../../../db/index";

const COOKIE_NAME = "boston_collab";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;

type RuntimeEnv = {
  COLLAB_PIN_HASH?: string;
  COLLAB_SIGNING_SECRET?: string;
};

export type Session = {
  participantId: string;
  nickname: string;
  exp: number;
};

export function runtimeSecrets() {
  const values = env as unknown as RuntimeEnv;
  if (!values.COLLAB_PIN_HASH || !values.COLLAB_SIGNING_SECRET) {
    throw new Error("Collaboration secrets are not configured.");
  }
  return { pinHash: values.COLLAB_PIN_HASH, signingSecret: values.COLLAB_SIGNING_SECRET };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a[index] ^ b[index];
  return result === 0;
}

export async function verifyPin(pin: string, encodedHash: string) {
  const [algorithm, iterationsText, saltText, expected] = encodedHash.split("$");
  const iterations = Number(iterationsText);
  // Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations.
  if (algorithm !== "pbkdf2" || iterations !== 100_000 || !saltText || !expected) return false;
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(saltText), iterations },
    material,
    256,
  );
  return safeEqual(bytesToBase64Url(new Uint8Array(bits)), expected);
}

export async function signSession(session: Session, secret: string) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function readSession(request: Request): Promise<Session | null> {
  let secret: string;
  try {
    secret = runtimeSecrets().signingSecret;
  } catch {
    return null;
  }
  const cookies = request.headers.get("cookie") ?? "";
  const value = cookies.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, await hmac(payload, secret))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as Session;
    if (!session.participantId || !session.nickname || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function sessionExpiry() {
  return Date.now() + SESSION_AGE_SECONDS * 1000;
}

export async function sourceHash(request: Request, secret: string) {
  const source = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return hmac(source, secret);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function textValue(value: unknown, max: number, min = 1) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (clean.length < min || clean.length > max) return null;
  return clean;
}

export function scopeValue(scope: unknown, dayId: unknown) {
  if (scope === "trip") return { scope: "trip" as const, dayId: null };
  const cleanDay = textValue(dayId, 24);
  if (scope === "day" && cleanDay) return { scope: "day" as const, dayId: cleanDay };
  return null;
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function apiError(message: string, status: number) {
  return json({ error: message }, status);
}

let schemaReady: Promise<void> | null = null;

export function ensureCollabSchema(db: D1Database) {
  if (!schemaReady) {
    const statements = [
      "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY NOT NULL, scope TEXT NOT NULL, day_id TEXT, author_id TEXT NOT NULL, author_name TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
      "CREATE INDEX IF NOT EXISTS idx_notes_scope_day_updated ON notes (scope, day_id, updated_at)",
      "CREATE INDEX IF NOT EXISTS idx_notes_author ON notes (author_id)",
      "CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY NOT NULL, question TEXT NOT NULL, type TEXT NOT NULL, scope TEXT NOT NULL, day_id TEXT, status TEXT DEFAULT 'open' NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
      "CREATE INDEX IF NOT EXISTS idx_polls_scope_day_updated ON polls (scope, day_id, updated_at)",
      "CREATE INDEX IF NOT EXISTS idx_polls_author ON polls (author_id)",
      "CREATE TABLE IF NOT EXISTS poll_options (id TEXT PRIMARY KEY NOT NULL, poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE, label TEXT NOT NULL, position INTEGER NOT NULL)",
      "CREATE UNIQUE INDEX IF NOT EXISTS uidx_poll_options_position ON poll_options (poll_id, position)",
      "CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options (poll_id)",
      "CREATE TABLE IF NOT EXISTS poll_votes (poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE, option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE, participant_id TEXT NOT NULL, participant_name TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (poll_id, participant_id, option_id))",
      "CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option ON poll_votes (poll_id, option_id)",
      "CREATE INDEX IF NOT EXISTS idx_poll_votes_participant ON poll_votes (participant_id)",
      "CREATE TABLE IF NOT EXISTS unlock_attempts (source_hash TEXT PRIMARY KEY NOT NULL, window_started_at INTEGER NOT NULL, failures INTEGER NOT NULL, locked_until INTEGER DEFAULT 0 NOT NULL)",
    ];
    // Each prepared statement contains exactly one SQL operation; batch applies
    // the runtime bootstrap in order without multiline exec parsing.
    schemaReady = db.batch(statements.map((statement) => db.prepare(statement))).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function authenticated(request: Request) {
  const session = await readSession(request);
  if (!session) return null;
  const db = getD1();
  await ensureCollabSchema(db);
  return { session, db };
}
