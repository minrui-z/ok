import { apiError, authenticated, json, requireSameOrigin } from "../_lib";
import { applyOperation, ItineraryInputError, parseOperation } from "../../itinerary/_model";
import {
  appendItineraryVersion,
  documentFromVersion,
  itineraryVersion,
  latestItineraryVersion,
} from "../../itinerary/_store";

type RequestBody = { baseVersion?: unknown; operation?: unknown };

function requestVersion(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > Number.MAX_SAFE_INTEGER) {
    throw new ItineraryInputError("行程版本不正確。");
  }
  return Number(value);
}

function isUniqueVersionConflict(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /(?:unique|primary key|constraint)/i.test(message);
}

export async function PATCH(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 100_000) return apiError("修改內容太大。", 413);

  try {
    const body = await request.json().catch(() => null) as RequestBody | null;
    const baseVersion = requestVersion(body?.baseVersion);
    const operation = parseOperation(body?.operation);
    const latest = await latestItineraryVersion(auth.db);
    if (latest.version !== baseVersion) {
      return json({ error: "行程剛被其他人更新，請重新載入後再試。", currentVersion: latest.version }, 409);
    }

    const currentDocument = documentFromVersion(latest);
    const restoreRow = operation.type === "version.restore"
      ? await itineraryVersion(auth.db, operation.version)
      : null;
    if (operation.type === "version.restore" && !restoreRow) {
      return apiError("找不到要還原的版本。", 404);
    }
    const applied = applyOperation(
      currentDocument,
      operation,
      restoreRow ? documentFromVersion(restoreRow) : undefined,
    );

    let saved: { version: number; createdAt: number };
    try {
      saved = await appendItineraryVersion(auth.db, baseVersion, {
        ...applied,
        authorId: auth.session.participantId,
        authorName: auth.session.nickname,
      });
    } catch (cause) {
      if (!isUniqueVersionConflict(cause)) throw cause;
      const current = await latestItineraryVersion(auth.db);
      return json({ error: "行程剛被其他人更新，請重新載入後再試。", currentVersion: current.version }, 409);
    }

    return json({
      version: saved.version,
      schemaVersion: applied.document.schemaVersion,
      days: applied.document.days,
      updatedAt: saved.createdAt,
      change: {
        action: applied.action,
        targetId: applied.targetId,
        sourceVersion: applied.sourceVersion,
        summary: applied.summary,
      },
    });
  } catch (cause) {
    if (cause instanceof ItineraryInputError) return apiError(cause.message, cause.status);
    throw cause;
  }
}
