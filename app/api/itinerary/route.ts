import { getD1 } from "../../../db/index";
import { apiError, json } from "../collab/_lib";
import { ItineraryInputError } from "./_model";
import { documentFromVersion, latestItineraryVersion } from "./_store";

export async function GET() {
  try {
    const row = await latestItineraryVersion(getD1());
    const document = documentFromVersion(row);
    return json({
      version: row.version,
      schemaVersion: document.schemaVersion,
      days: document.days,
      updatedAt: row.createdAt,
    });
  } catch (cause) {
    if (cause instanceof ItineraryInputError) return apiError(cause.message, cause.status);
    throw cause;
  }
}
