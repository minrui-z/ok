import { apiError, authenticated, json, requireSameOrigin, scopeValue, textValue } from "../_lib";

type VoteRow = { pollId: string; optionId: string; participantId: string; participantName: string };

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const [pollResult, optionResult, voteResult] = await Promise.all([
    auth.db.prepare("SELECT id, question, type, scope, day_id AS dayId, status, author_id AS authorId, author_name AS authorName, created_at AS createdAt, updated_at AS updatedAt FROM polls ORDER BY updated_at DESC").all(),
    auth.db.prepare("SELECT id, poll_id AS pollId, label, position FROM poll_options ORDER BY poll_id, position").all(),
    auth.db.prepare("SELECT poll_id AS pollId, option_id AS optionId, participant_id AS participantId, participant_name AS participantName FROM poll_votes").all<VoteRow>(),
  ]);
  const options = optionResult.results as Array<{ id: string; pollId: string; label: string; position: number }>;
  const votes = voteResult.results;
  const polls = (pollResult.results as Array<Record<string, unknown> & { id: string }>).map((poll) => ({
    ...poll,
    options: options.filter((option) => option.pollId === poll.id).map((option) => ({
      ...option,
      votes: votes.filter((vote) => vote.optionId === option.id).map((vote) => ({ nickname: vote.participantName })),
    })),
    myOptionIds: votes.filter((vote) => vote.pollId === poll.id && vote.participantId === auth.session.participantId).map((vote) => vote.optionId),
  }));
  return json({ polls, participantId: auth.session.participantId });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const question = textValue(body?.question, 160);
  const type = body?.type === "single" || body?.type === "multiple" ? body.type : null;
  const scope = scopeValue(body?.scope, body?.dayId);
  const optionLabels = Array.isArray(body?.options)
    ? body.options.map((value) => textValue(value, 80)).filter((value): value is string => Boolean(value))
    : [];
  if (!question || !type || !scope || optionLabels.length < 2 || optionLabels.length > 8) {
    return apiError("題目需有 2–8 個有效選項。", 400);
  }
  if (new Set(optionLabels.map((label) => label.toLocaleLowerCase())).size !== optionLabels.length) {
    return apiError("投票選項不可重複。", 400);
  }

  const pollId = crypto.randomUUID();
  const now = Date.now();
  // D1 batch keeps the poll and all options in one ordered operation:
  // https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
  await auth.db.batch([
    auth.db.prepare("INSERT INTO polls (id, question, type, scope, day_id, status, author_id, author_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)")
      .bind(pollId, question, type, scope.scope, scope.dayId, auth.session.participantId, auth.session.nickname, now, now),
    ...optionLabels.map((label, position) => auth.db.prepare("INSERT INTO poll_options (id, poll_id, label, position) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), pollId, label, position)),
  ]);
  return json({ id: pollId }, 201);
}
