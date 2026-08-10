"use client";

import { Check, LockKeyhole, LogOut, MessageSquareText, Plus, RefreshCw, Trash2, Vote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TripDay } from "../trip-data";

type Note = {
  id: string;
  scope: "trip" | "day";
  dayId: string | null;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type PollOption = { id: string; label: string; votes: Array<{ nickname: string }> };
type Poll = {
  id: string;
  question: string;
  type: "single" | "multiple";
  scope: "trip" | "day";
  dayId: string | null;
  status: "open" | "closed";
  authorId: string;
  authorName: string;
  options: PollOption[];
  myOptionIds: string[];
};

export type PollSeed = { key: number; question: string; options: string[]; dayId: string } | null;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "目前無法完成，請稍後再試。" );
  return data;
}

export function CollaborationPanel({ days, selectedDayId, pollSeed }: { days: TripDay[]; selectedDayId: string; pollSeed: PollSeed }) {
  const [unlocked, setUnlocked] = useState(false);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [tab, setTab] = useState<"notes" | "polls">(pollSeed ? "polls" : "notes");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteScope, setNoteScope] = useState<"trip" | "day">("day");
  const [noteDayId, setNoteDayId] = useState(selectedDayId);
  const [noteText, setNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pollQuestion, setPollQuestion] = useState(pollSeed?.question ?? "");
  const [pollType, setPollType] = useState<"single" | "multiple">("single");
  const [pollScope, setPollScope] = useState<"trip" | "day">("day");
  const [pollDayId, setPollDayId] = useState(pollSeed?.dayId ?? selectedDayId);
  const [pollOptions, setPollOptions] = useState(pollSeed?.options.slice(0, 8) ?? ["", ""]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [noteData, pollData] = await Promise.all([
        api<{ notes: Note[]; participantId: string }>("/api/collab/notes"),
        api<{ polls: Poll[]; participantId: string }>("/api/collab/polls"),
      ]);
      setNotes(noteData.notes);
      setPolls(pollData.polls);
      setParticipantId(noteData.participantId);
      setUnlocked(true);
      setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "共同區暫時無法讀取。";
      if (message.includes("旅行密碼")) setUnlocked(false);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api<{ unlocked: boolean; nickname?: string }>("/api/collab/session")
      .then((session) => {
        if (session.unlocked) {
          setNickname(session.nickname ?? "");
          return refresh();
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!unlocked) return;
    const interval = window.setInterval(() => void refresh(true), 30_000);
    const focus = () => void refresh(true);
    window.addEventListener("focus", focus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [refresh, unlocked]);

  const visibleNotes = useMemo(
    () => notes.filter((note) => note.scope === "trip" || note.dayId === selectedDayId),
    [notes, selectedDayId],
  );
  const visiblePolls = useMemo(
    () => polls.filter((poll) => poll.scope === "trip" || poll.dayId === selectedDayId),
    [polls, selectedDayId],
  );

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/collab/session", { method: "POST", body: JSON.stringify({ pin, nickname }) });
      setPin("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法解鎖。" );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/collab/session", { method: "DELETE" });
    setUnlocked(false);
    setNotes([]);
    setPolls([]);
    setParticipantId("");
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/collab/notes", { method: "POST", body: JSON.stringify({ content: noteText, scope: noteScope, dayId: noteScope === "day" ? noteDayId : null }) });
      setNoteText("");
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "筆記沒有送出。" );
    } finally { setBusy(false); }
  }

  async function saveNote(id: string) {
    setBusy(true);
    try {
      await api(`/api/collab/notes/${id}`, { method: "PATCH", body: JSON.stringify({ content: editText }) });
      setEditingNote(null);
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "筆記沒有更新。" ); }
    finally { setBusy(false); }
  }

  async function deleteNote(id: string) {
    if (!window.confirm("要刪除這則筆記嗎？")) return;
    try {
      await api(`/api/collab/notes/${id}`, { method: "DELETE" });
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "筆記沒有刪除。" ); }
  }

  async function createPoll(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/collab/polls", { method: "POST", body: JSON.stringify({ question: pollQuestion, type: pollType, scope: pollScope, dayId: pollScope === "day" ? pollDayId : null, options: pollOptions }) });
      setPollQuestion("");
      setPollOptions(["", ""]);
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "投票沒有建立。" ); }
    finally { setBusy(false); }
  }

  async function vote(poll: Poll, optionId: string) {
    const selected = new Set(poll.myOptionIds);
    if (poll.type === "single") {
      selected.clear();
      selected.add(optionId);
    } else if (selected.has(optionId)) selected.delete(optionId);
    else selected.add(optionId);
    try {
      await api(`/api/collab/polls/${poll.id}/votes`, { method: "PUT", body: JSON.stringify({ optionIds: [...selected] }) });
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "答案沒有更新。" ); }
  }

  async function closePoll(id: string) {
    if (!window.confirm("關閉後就不能再投票，確定關閉嗎？")) return;
    await api(`/api/collab/polls/${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
    await refresh(true);
  }

  async function deletePoll(id: string) {
    if (!window.confirm("要刪除這個投票與全部答案嗎？")) return;
    await api(`/api/collab/polls/${id}`, { method: "DELETE" });
    await refresh(true);
  }

  if (loading && !unlocked) {
    return <div className="collab-loading" role="status"><RefreshCw size={18} className="spin" /> 讀取共同區</div>;
  }

  if (!unlocked) {
    return (
      <div className="collab-lock glass-card">
        <LockKeyhole size={28} />
        <div>
          <h3>輸入旅行密碼</h3>
          <p>共同筆記和投票只有同行者看得到。第一次請一併填暱稱。</p>
        </div>
        <form onSubmit={unlock} className="unlock-form">
          <label>暱稱<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={30} autoComplete="nickname" required /></label>
          <label>四位數密碼<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={4} required /></label>
          <button className="primary-button" disabled={busy}>{busy ? "解鎖中…" : "進入共同區"}</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="collab-shell">
      <div className="collab-toolbar glass-card">
        <div className="segmented" aria-label="共同區內容">
          <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}><MessageSquareText size={17} />筆記</button>
          <button className={tab === "polls" ? "active" : ""} onClick={() => setTab("polls")}><Vote size={17} />投票</button>
        </div>
        <span>{nickname}</span>
        <button className="text-button" onClick={() => void logout()}><LogOut size={16} />離開</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      {tab === "notes" ? (
        <div className="collab-grid">
          <form className="collab-compose glass-card" onSubmit={addNote}>
            <h3>新增筆記</h3>
            <div className="scope-row">
              <label><input type="radio" checked={noteScope === "day"} onChange={() => setNoteScope("day")} /> 指定日期</label>
              <label><input type="radio" checked={noteScope === "trip"} onChange={() => setNoteScope("trip")} /> 全旅程</label>
            </div>
            {noteScope === "day" && <label className="field-label">日期<select value={noteDayId} onChange={(event) => setNoteDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.date} {day.title}</option>)}</select></label>}
            <label className="field-label">內容<textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={1_000} rows={5} required /></label>
            <div className="compose-footer"><span>{noteText.length}/1,000</span><button className="primary-button" disabled={busy}>加入</button></div>
          </form>
          <div className="collab-feed">
            {visibleNotes.length === 0 && <div className="empty-card glass-card">這一天還沒有筆記。</div>}
            {visibleNotes.map((note) => (
              <article className="note-card glass-card" key={note.id}>
                <div className="note-meta"><strong>{note.authorName}</strong><span>{note.scope === "trip" ? "全旅程" : days.find((day) => day.id === note.dayId)?.date}</span></div>
                {editingNote === note.id ? (
                  <>
                    <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={1_000} rows={4} />
                    <div className="inline-actions"><button onClick={() => void saveNote(note.id)} disabled={busy}><Check size={16} />儲存</button><button onClick={() => setEditingNote(null)}><X size={16} />取消</button></div>
                  </>
                ) : <p>{note.content}</p>}
                {note.authorId === participantId && editingNote !== note.id && <div className="inline-actions"><button onClick={() => { setEditingNote(note.id); setEditText(note.content); }}>修改</button><button className="danger" onClick={() => void deleteNote(note.id)}><Trash2 size={15} />刪除</button></div>}
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="collab-grid">
          <form className="collab-compose glass-card" onSubmit={createPoll}>
            <h3>建立投票</h3>
            <label className="field-label">題目<input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} maxLength={160} required /></label>
            <div className="scope-row">
              <label><input type="radio" checked={pollType === "single"} onChange={() => setPollType("single")} /> 單選</label>
              <label><input type="radio" checked={pollType === "multiple"} onChange={() => setPollType("multiple")} /> 複選</label>
            </div>
            <div className="scope-row">
              <label><input type="radio" checked={pollScope === "day"} onChange={() => setPollScope("day")} /> 指定日期</label>
              <label><input type="radio" checked={pollScope === "trip"} onChange={() => setPollScope("trip")} /> 全旅程</label>
            </div>
            {pollScope === "day" && <label className="field-label">日期<select value={pollDayId} onChange={(event) => setPollDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.date} {day.title}</option>)}</select></label>}
            <fieldset className="option-fields"><legend>選項</legend>{pollOptions.map((option, index) => <div key={index}><input aria-label={`選項 ${index + 1}`} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={80} required /><button type="button" aria-label={`刪除選項 ${index + 1}`} disabled={pollOptions.length <= 2} onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button></div>)}</fieldset>
            <div className="compose-footer"><button type="button" className="text-button" disabled={pollOptions.length >= 8} onClick={() => setPollOptions((current) => [...current, ""])}><Plus size={16} />增加選項</button><button className="primary-button" disabled={busy}>建立</button></div>
          </form>
          <div className="collab-feed">
            {visiblePolls.length === 0 && <div className="empty-card glass-card">這一天還沒有投票。</div>}
            {visiblePolls.map((poll) => {
              const total = new Set(poll.options.flatMap((option) => option.votes.map((vote) => vote.nickname))).size;
              return <article className="poll-card glass-card" key={poll.id}>
                <div className="poll-heading"><div><span>{poll.scope === "trip" ? "全旅程" : days.find((day) => day.id === poll.dayId)?.date} · {poll.type === "single" ? "單選" : "複選"}</span><h3>{poll.question}</h3></div>{poll.status === "closed" && <b>已關閉</b>}</div>
                <div className="poll-options">{poll.options.map((option) => {
                  const selected = poll.myOptionIds.includes(option.id);
                  const percent = total ? Math.round(option.votes.length / total * 100) : 0;
                  return <button key={option.id} disabled={poll.status === "closed"} className={selected ? "selected" : ""} onClick={() => void vote(poll, option.id)}><span>{option.label}</span><small>{option.votes.length} 票</small><i style={{ width: `${percent}%` }} /></button>;
                })}</div>
                <div className="poll-footer"><span>{poll.authorName} 建立 · {total} 人投票</span>{poll.authorId === participantId && <div className="inline-actions">{poll.status === "open" && <button onClick={() => void closePoll(poll.id)}>關閉</button>}<button className="danger" onClick={() => void deletePoll(poll.id)}><Trash2 size={15} />刪除</button></div>}</div>
              </article>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
