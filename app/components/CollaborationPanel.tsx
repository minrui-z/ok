"use client";

import { Check, CircleDollarSign, LockKeyhole, LogOut, MessageSquareText, Pencil, Plus, RefreshCw, Trash2, Vote, X } from "lucide-react";
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

type Expense = {
  id: string;
  dayId: string | null;
  description: string;
  category: "transport" | "rental" | "parking" | "food" | "ticket" | "other";
  amountCents: number;
  currency: "USD" | "TWD";
  paidBy: string;
  participants: string[];
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
};

const expenseCategoryLabels: Record<Expense["category"], string> = {
  transport: "交通", rental: "租車", parking: "停車", food: "餐飲", ticket: "門票", other: "其他",
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [tab, setTab] = useState<"notes" | "polls" | "expenses">(pollSeed ? "polls" : "notes");
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
  const [expenseDayId, setExpenseDayId] = useState(selectedDayId);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<Expense["category"]>("food");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState<Expense["currency"]>("USD");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expenseParticipants, setExpenseParticipants] = useState("");
  const [editingExpense, setEditingExpense] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [noteData, pollData, expenseData] = await Promise.all([
        api<{ notes: Note[]; participantId: string }>("/api/collab/notes"),
        api<{ polls: Poll[]; participantId: string }>("/api/collab/polls"),
        api<{ expenses: Expense[]; participantId: string }>("/api/collab/expenses"),
      ]);
      setNotes(noteData.notes);
      setPolls(pollData.polls);
      setExpenses(expenseData.expenses);
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
  const balances = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const expense of expenses) {
      const names = [...new Set(expense.participants)];
      if (!names.length) continue;
      const ledger = result[expense.currency] ??= {};
      const base = Math.floor(expense.amountCents / names.length);
      const remainder = expense.amountCents - base * names.length;
      names.forEach((name, index) => { ledger[name] = (ledger[name] ?? 0) - base - (index < remainder ? 1 : 0); });
      ledger[expense.paidBy] = (ledger[expense.paidBy] ?? 0) + expense.amountCents;
    }
    return result;
  }, [expenses]);

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
    setExpenses([]);
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

  function resetExpenseForm() {
    setEditingExpense(null);
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseParticipants("");
    setExpensePaidBy(nickname);
  }

  async function saveExpense(event: React.FormEvent) {
    event.preventDefault();
    const participants = expenseParticipants.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({ dayId: expenseDayId || null, description: expenseDescription, category: expenseCategory, amount: Number(expenseAmount), currency: expenseCurrency, paidBy: expensePaidBy, participants });
      await api(editingExpense ? `/api/collab/expenses/${editingExpense}` : "/api/collab/expenses", { method: editingExpense ? "PATCH" : "POST", body });
      resetExpenseForm();
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "費用沒有儲存。" ); }
    finally { setBusy(false); }
  }

  function beginExpenseEdit(expense: Expense) {
    setEditingExpense(expense.id);
    setExpenseDayId(expense.dayId ?? "");
    setExpenseDescription(expense.description);
    setExpenseCategory(expense.category);
    setExpenseAmount((expense.amountCents / 100).toFixed(2));
    setExpenseCurrency(expense.currency);
    setExpensePaidBy(expense.paidBy);
    setExpenseParticipants(expense.participants.join("、"));
    document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function deleteExpense(id: string) {
    if (!window.confirm("要刪除這筆費用嗎？")) return;
    try {
      await api(`/api/collab/expenses/${id}`, { method: "DELETE" });
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "費用沒有刪除。" ); }
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
          <button className={tab === "expenses" ? "active" : ""} onClick={() => setTab("expenses")}><CircleDollarSign size={17} />費用</button>
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
      ) : tab === "polls" ? (
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
      ) : (
        <div className="expense-layout">
          <div className="balance-strip glass-card" aria-label="共同費用結算">
            {Object.keys(balances).length === 0 ? <p>還沒有共同費用。新增後會依幣別計算應收與應付。</p> : Object.entries(balances).map(([currency, ledger]) => <section key={currency}><strong>{currency}</strong><div>{Object.entries(ledger).sort((a, b) => b[1] - a[1]).map(([name, cents]) => <span key={name}><b>{name}</b>{cents === 0 ? "已平衡" : cents > 0 ? `應收 ${(cents / 100).toLocaleString("zh-TW", { minimumFractionDigits: 2 })}` : `應付 ${(-cents / 100).toLocaleString("zh-TW", { minimumFractionDigits: 2 })}`}</span>)}</div></section>)}
          </div>
          <div className="collab-grid">
            <form id="expense-form" className="collab-compose glass-card" onSubmit={saveExpense}>
              <h3>{editingExpense ? "修改費用" : "新增費用"}</h3>
              <label className="field-label">品項<input value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} maxLength={120} required /></label>
              <div className="expense-field-row">
                <label className="field-label">分類<select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value as Expense["category"])}>{Object.entries(expenseCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="field-label">日期<select value={expenseDayId} onChange={(event) => setExpenseDayId(event.target.value)}><option value="">全旅程</option>{days.map((day) => <option key={day.id} value={day.id}>{day.date} {day.title}</option>)}</select></label>
              </div>
              <div className="expense-field-row amount-row">
                <label className="field-label">幣別<select value={expenseCurrency} onChange={(event) => setExpenseCurrency(event.target.value as Expense["currency"])}><option value="USD">USD</option><option value="TWD">TWD</option></select></label>
                <label className="field-label">金額<input type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} required /></label>
              </div>
              <label className="field-label">付款人<input value={expensePaidBy} onChange={(event) => setExpensePaidBy(event.target.value)} maxLength={30} required /></label>
              <label className="field-label">分攤者<input value={expenseParticipants} onChange={(event) => setExpenseParticipants(event.target.value)} maxLength={620} placeholder="用逗號分隔暱稱" required /><small>每筆均分；請把付款人也填進去。</small></label>
              <div className="compose-footer">{editingExpense && <button type="button" className="text-button" onClick={resetExpenseForm}>取消</button>}<button className="primary-button" disabled={busy}>{busy ? "儲存中…" : editingExpense ? "更新" : "加入"}</button></div>
            </form>
            <div className="collab-feed">
              {expenses.length === 0 && <div className="empty-card glass-card">新增第一筆共同費用後，這裡會顯示分帳明細。</div>}
              {expenses.map((expense) => <article className="expense-card glass-card" key={expense.id}>
                <div className="expense-card-heading"><div><span>{expense.dayId ? days.find((day) => day.id === expense.dayId)?.date : "全旅程"} · {expenseCategoryLabels[expense.category]}</span><h3>{expense.description}</h3></div><strong>{expense.currency} {(expense.amountCents / 100).toLocaleString("zh-TW", { minimumFractionDigits: 2 })}</strong></div>
                <p><b>{expense.paidBy}</b> 付款 · {expense.participants.join("、")} 均分</p>
                <div className="poll-footer"><span>{expense.authorName} 記錄</span>{expense.authorId === participantId && <div className="inline-actions"><button onClick={() => beginExpenseEdit(expense)}><Pencil size={14} />修改</button><button className="danger" onClick={() => void deleteExpense(expense.id)}><Trash2 size={15} />刪除</button></div>}</div>
              </article>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
