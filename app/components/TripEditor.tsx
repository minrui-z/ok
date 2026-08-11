"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  History,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  categoryLabels,
  photos,
  type Activity,
  type ActivityCategory,
  type ActivityPriority,
  type IconKey,
  type PlacePhoto,
  type TravelMode,
  type TripDay,
} from "../trip-data";

type HistoryItem = {
  version: number;
  action: string;
  targetId: string | null;
  sourceVersion: number | null;
  summary: string;
  authorId: string | null;
  authorName: string;
  createdAt: number;
};

type Operation =
  | { type: "activity.create"; dayId: string; index?: number; activity: Omit<Activity, "id"> }
  | { type: "activity.update"; activityId: string; changes: Record<string, unknown> }
  | { type: "activity.move"; activityId: string; toDayId: string; toIndex: number }
  | { type: "activity.delete"; activityId: string; confirmImportant: boolean }
  | { type: "day.update"; dayId: string; changes: Partial<Pick<TripDay, "date" | "isoDate" | "weekday" | "location" | "title" | "note" | "color" | "kind">> }
  | { type: "version.restore"; version: number };

type PatchResponse = {
  version: number;
  schemaVersion: 1;
  days: TripDay[];
  updatedAt: number;
};

const categories = Object.keys(categoryLabels) as ActivityCategory[];
const priorities: Array<{ value: ActivityPriority; label: string }> = [
  { value: "essential", label: "主要／固定" },
  { value: "recommended", label: "推薦" },
  { value: "optional", label: "有時間再去" },
];
const travelModes: Array<{ value: TravelMode; label: string }> = [
  { value: "walk", label: "步行" }, { value: "transit", label: "大眾運輸" },
  { value: "train", label: "火車" }, { value: "drive", label: "開車" },
  { value: "flight", label: "飛行" }, { value: "indoor", label: "航廈／室內" },
];
const photoOptions = Object.values(photos) as PlacePhoto[];

const categoryIcon: Record<ActivityCategory, IconKey> = {
  flight: "plane", transit: "train", stay: "hotel", conference: "talk",
  sight: "landmark", food: "food", shopping: "shop",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string; currentVersion?: number };
  if (!response.ok) {
    const error = new Error(data.error ?? "目前無法完成，請稍後再試。") as Error & { status?: number; currentVersion?: number };
    error.status = response.status;
    error.currentVersion = data.currentVersion;
    throw error;
  }
  return data;
}

function emptyActivity(day: TripDay): Activity {
  return {
    id: "draft",
    timeLabel: "09:00",
    start: `${day.isoDate}T09:00:00-04:00`,
    timezone: "America/New_York",
    title: "",
    detail: "",
    icon: "landmark",
    category: "sight",
    priority: "recommended",
    durationMin: 60,
  };
}

function localInputValue(start?: string, timezone = "America/New_York") {
  if (!start) return "";
  const date = new Date(start);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function offsetFor(localValue: string, timezone: Activity["timezone"]) {
  const probe = new Date(`${localValue}:00Z`);
  const label = new Intl.DateTimeFormat("en", { timeZone: timezone, timeZoneName: "longOffset" })
    .formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "+00:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
}

function isoFromLocal(localValue: string, timezone: Activity["timezone"]) {
  return localValue ? `${localValue}:00${offsetFor(localValue, timezone)}` : undefined;
}

function nullableActivityChanges(activity: Activity) {
  const required = { ...activity };
  Reflect.deleteProperty(required, "id");
  return {
    ...required,
    start: activity.start ?? null,
    coordinates: activity.coordinates ?? null,
    place: activity.place ?? null,
    photo: activity.photo ?? null,
    officialUrl: activity.officialUrl ?? null,
    officialLabel: activity.officialLabel ?? null,
    outdoors: activity.outdoors ?? null,
    fixed: activity.fixed ?? null,
    ticketed: activity.ticketed ?? null,
    vague: activity.vague ?? null,
    travelFromPrevious: activity.travelFromPrevious ?? null,
    rainAlternative: activity.rainAlternative ?? null,
  };
}

export function TripEditor({ days, version, onUpdated }: { days: TripDay[]; version: number; onUpdated: (days: TripDay[], version: number) => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? "");
  const [editing, setEditing] = useState<Activity | null>(null);
  const [editingBaseVersion, setEditingBaseVersion] = useState<number | null>(null);
  const [coordinateDraft, setCoordinateDraft] = useState<[string, string]>(["", ""]);
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dayDraft, setDayDraft] = useState<TripDay | null>(null);
  const [dayDraftBaseVersion, setDayDraftBaseVersion] = useState<number | null>(null);

  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0];

  const loadHistory = useCallback(async (beforeVersion?: number) => {
    const suffix = beforeVersion ? `&beforeVersion=${beforeVersion}` : "";
    const data = await requestJson<{ history: HistoryItem[] }>(`/api/collab/itinerary/history?limit=30${suffix}`);
    setHistory((current) => beforeVersion ? [...current, ...data.history] : data.history);
    setHistoryHasMore(data.history.length === 30 && (data.history.at(-1)?.version ?? 1) > 1);
  }, []);

  useEffect(() => {
    requestJson<{ unlocked: boolean; nickname?: string }>("/api/collab/session")
      .then((session) => {
        setUnlocked(session.unlocked);
        setNickname(session.nickname ?? "");
        if (session.unlocked) return loadHistory();
      })
      .catch(() => setUnlocked(false))
      .finally(() => setLoading(false));
  }, [loadHistory]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/collab/session", { method: "POST", body: JSON.stringify({ pin, nickname }) });
      setPin("");
      setUnlocked(true);
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法解鎖。");
    } finally { setBusy(false); }
  }

  async function apply(operation: Operation, expectedVersion = version) {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<PatchResponse>("/api/collab/itinerary", {
        method: "PATCH",
        body: JSON.stringify({ baseVersion: expectedVersion, operation }),
      });
      onUpdated(result.days, result.version);
      await loadHistory();
      return result;
    } catch (cause) {
      const current = cause as Error & { status?: number };
      setError(current.status === 409 ? "有人剛剛更新了行程。請重新載入後再修改，避免蓋掉對方的內容。" : current.message);
      throw cause;
    } finally { setBusy(false); }
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !selectedDay) return;
    const latitudeText = coordinateDraft[0].trim();
    const longitudeText = coordinateDraft[1].trim();
    if (Boolean(latitudeText) !== Boolean(longitudeText)) {
      setError("經緯度需要一起填寫；若不需要地圖定位，請將兩欄都留空。");
      return;
    }
    let coordinates: [number, number] | undefined;
    if (latitudeText && longitudeText) {
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setError("經緯度超出有效範圍。");
        return;
      }
      coordinates = [latitude, longitude];
    }
    const activityToSave = { ...editing, coordinates };
    try {
      if (creating) {
        const activity = { ...activityToSave };
        Reflect.deleteProperty(activity, "id");
        await apply({ type: "activity.create", dayId: selectedDay.id, activity: activity as Omit<Activity, "id"> }, editingBaseVersion ?? version);
      } else {
        await apply({ type: "activity.update", activityId: editing.id, changes: nullableActivityChanges(activityToSave) }, editingBaseVersion ?? version);
      }
      setEditing(null);
      setEditingBaseVersion(null);
      setCreating(false);
    } catch { /* The inline error keeps the editor open. */ }
  }

  async function moveActivity(activity: Activity, dayId: string, index: number) {
    try { await apply({ type: "activity.move", activityId: activity.id, toDayId: dayId, toIndex: index }); } catch { /* inline */ }
  }

  async function deleteActivity(activity: Activity) {
    const important = activity.fixed || ["flight", "stay", "conference"].includes(activity.category);
    const message = important
      ? `「${activity.title}」是航班、住宿或固定行程。刪除後仍可從版本紀錄復原，確定刪除嗎？`
      : `要刪除「${activity.title}」嗎？之後仍可從版本紀錄復原。`;
    if (!window.confirm(message)) return;
    try { await apply({ type: "activity.delete", activityId: activity.id, confirmImportant: important }); } catch { /* inline */ }
  }

  async function saveDay(event: React.FormEvent) {
    event.preventDefault();
    if (!dayDraft) return;
    const changes = {
      date: dayDraft.date,
      isoDate: dayDraft.isoDate,
      weekday: dayDraft.weekday,
      location: dayDraft.location,
      title: dayDraft.title,
      note: dayDraft.note,
      color: dayDraft.color,
      kind: dayDraft.kind,
    };
    try {
      await apply({ type: "day.update", dayId: dayDraft.id, changes }, dayDraftBaseVersion ?? version);
      setDayDraft(null);
      setDayDraftBaseVersion(null);
    } catch { /* inline */ }
  }

  async function restoreVersion(targetVersion: number) {
    if (!window.confirm(`要把整份行程恢復成第 ${targetVersion} 版嗎？目前版本仍會保留在紀錄中。`)) return;
    try { await apply({ type: "version.restore", version: targetVersion }); } catch { /* inline */ }
  }

  const currentActivityIndex = useMemo(() => editing && selectedDay ? selectedDay.activities.findIndex((activity) => activity.id === editing.id) : -1, [editing, selectedDay]);

  function beginActivityEdit(activity: Activity, isCreating: boolean) {
    setEditing(structuredClone(activity));
    setEditingBaseVersion(version);
    setCoordinateDraft([
      activity.coordinates ? String(activity.coordinates[0]) : "",
      activity.coordinates ? String(activity.coordinates[1]) : "",
    ]);
    setCreating(isCreating);
    setError("");
  }

  if (loading) return <div className="collab-loading" role="status"><RefreshCw size={18} className="spin" />讀取共同編輯權限</div>;

  if (!unlocked) return <div className="editor-lock collab-lock glass-card"><LockKeyhole size={28} /><div><h3>共同編輯</h3><p>請輸入與共同區相同的四位數旅行密碼。修改紀錄會顯示你的暱稱。</p></div><form className="unlock-form" onSubmit={unlock}><label>暱稱<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={30} autoComplete="nickname" required /></label><label>四位數密碼<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" minLength={4} maxLength={4} required /></label><button className="primary-button" disabled={busy}>{busy ? "解鎖中…" : "進入編輯器"}</button></form>{error && <p className="form-error" role="alert">{error}</p>}</div>;

  return (
    <div className="trip-editor">
      <div className="editor-toolbar glass-card">
        <div><span>目前版本</span><strong>v{version}</strong></div>
        <label>編輯日期<select value={selectedDay?.id ?? ""} onChange={(event) => setSelectedDayId(event.target.value)}>{days.map((day) => <option key={day.id} value={day.id}>{day.date} {day.title}</option>)}</select></label>
        <button className="secondary-button compact" onClick={() => { setHistoryOpen((current) => !current); if (!historyOpen) void loadHistory(); }}><History size={16} />修改紀錄</button>
        <button className="primary-button" disabled={version < 1} onClick={() => { if (!selectedDay) return; beginActivityEdit(emptyActivity(selectedDay), true); }}><Plus size={17} />新增活動</button>
      </div>
      {error && <p className="form-error editor-error" role="alert">{error}<button onClick={() => window.location.reload()}>重新載入</button></p>}

      {historyOpen && <section className="version-history glass-card" aria-labelledby="history-title"><div className="editor-section-heading"><div><span className="section-kicker">CHANGE LOG</span><h2 id="history-title">修改紀錄</h2></div><button aria-label="關閉修改紀錄" onClick={() => setHistoryOpen(false)}><X size={18} /></button></div><div className="history-list">{history.map((item) => <article key={item.version}><span>v{item.version}</span><div><strong>{item.summary}</strong><small>{item.authorName} · {new Intl.DateTimeFormat("zh-TW", { dateStyle: "short", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(item.createdAt))}</small></div>{item.version !== version && <button onClick={() => void restoreVersion(item.version)} disabled={busy}><RotateCcw size={15} />恢復</button>}</article>)}</div>{historyHasMore && <button className="secondary-button history-load-more" onClick={() => void loadHistory(history.at(-1)?.version)} disabled={busy}>載入更早紀錄</button>}</section>}

      {selectedDay && <>
        <section className="editor-day-card glass-card"><div><span>{selectedDay.weekday} · {selectedDay.date}</span><h2>{selectedDay.title}</h2><p>{selectedDay.note}</p></div><button className="secondary-button compact" onClick={() => { setDayDraft(structuredClone(selectedDay)); setDayDraftBaseVersion(version); setError(""); }}><Pencil size={15} />修改日期資料</button></section>
        <ol className="editor-activity-list">{selectedDay.activities.map((activity, index) => <li className="editor-activity-card glass-card" key={activity.id}><div className="editor-order"><button aria-label={`上移 ${activity.title}`} disabled={busy || index === 0} onClick={() => void moveActivity(activity, selectedDay.id, index - 1)}><ArrowUp size={17} /></button><span>{index + 1}</span><button aria-label={`下移 ${activity.title}`} disabled={busy || index === selectedDay.activities.length - 1} onClick={() => void moveActivity(activity, selectedDay.id, index + 1)}><ArrowDown size={17} /></button></div><div className="editor-activity-copy"><span>{activity.timeLabel} · {categoryLabels[activity.category]}</span><strong>{activity.title}</strong><small>{activity.place ?? activity.detail}</small></div><label className="move-day-label">移至<select aria-label={`將 ${activity.title} 移到其他日期`} value={selectedDay.id} onChange={(event) => { const target = days.find((day) => day.id === event.target.value); if (target) void moveActivity(activity, target.id, target.activities.length); }}>{days.map((day) => <option key={day.id} value={day.id}>{day.date}</option>)}</select></label><div className="editor-row-actions"><button onClick={() => beginActivityEdit(activity, false)}><Pencil size={16} />修改</button><button className="danger" onClick={() => void deleteActivity(activity)}><Trash2 size={16} />刪除</button></div></li>)}</ol>
      </>}

      {dayDraft && (
        <div className="editor-dialog-backdrop">
          <section className="editor-dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="day-dialog-title">
            <div className="editor-dialog-heading">
              <div><span className="section-kicker">DAY</span><h2 id="day-dialog-title">修改日期資料</h2></div>
              <button aria-label="關閉" onClick={() => { setDayDraft(null); setDayDraftBaseVersion(null); }}><X size={19} /></button>
            </div>
            <form className="editor-form" onSubmit={saveDay}>
              <div className="editor-form-grid">
                <label>顯示日期<input value={dayDraft.date} onChange={(event) => setDayDraft({ ...dayDraft, date: event.target.value })} maxLength={16} required /></label>
                <label>ISO 日期<input type="date" value={dayDraft.isoDate} onChange={(event) => setDayDraft({ ...dayDraft, isoDate: event.target.value })} required /></label>
                <label>星期<input value={dayDraft.weekday} onChange={(event) => setDayDraft({ ...dayDraft, weekday: event.target.value })} maxLength={16} required /></label>
                <label>區域<input value={dayDraft.location} onChange={(event) => setDayDraft({ ...dayDraft, location: event.target.value })} maxLength={120} required /></label>
                <label className="wide">標題<input value={dayDraft.title} onChange={(event) => setDayDraft({ ...dayDraft, title: event.target.value })} maxLength={160} required /></label>
                <label className="wide">說明<textarea value={dayDraft.note} onChange={(event) => setDayDraft({ ...dayDraft, note: event.target.value })} maxLength={1000} rows={3} required /></label>
                <label>顏色<input type="color" value={dayDraft.color} onChange={(event) => setDayDraft({ ...dayDraft, color: event.target.value })} /></label>
                <label>類型<select value={dayDraft.kind} onChange={(event) => setDayDraft({ ...dayDraft, kind: event.target.value as TripDay["kind"] })}><option value="flight">航班</option><option value="city">市區</option><option value="apsa">APSA</option><option value="daytrip">近郊</option><option value="drive">自駕</option><option value="return">返程</option></select></label>
              </div>
              {error && <p className="form-error editor-dialog-error" role="alert">{error}</p>}
              <div className="editor-dialog-actions">
                <button type="button" className="secondary-button" onClick={() => { setDayDraft(null); setDayDraftBaseVersion(null); }}>取消</button>
                <button className="primary-button" disabled={busy}><Save size={16} />儲存</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editing && <div className="editor-dialog-backdrop"><section className="editor-dialog activity-editor-dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="activity-dialog-title"><div className="editor-dialog-heading"><div><span className="section-kicker">{creating ? "NEW STOP" : `STOP ${currentActivityIndex + 1}`}</span><h2 id="activity-dialog-title">{creating ? "新增活動" : `修改 ${editing.title}`}</h2></div><button aria-label="關閉" onClick={() => { setEditing(null); setEditingBaseVersion(null); setCreating(false); }}><X size={19} /></button></div><form className="editor-form" onSubmit={saveActivity}><div className="editor-form-grid"><label className="wide">活動名稱<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} maxLength={160} required /></label><label>顯示時間<input value={editing.timeLabel} onChange={(event) => setEditing({ ...editing, timeLabel: event.target.value })} maxLength={32} required /></label><label>明確時間<input type="datetime-local" value={localInputValue(editing.start, editing.timezone)} onChange={(event) => setEditing({ ...editing, start: isoFromLocal(event.target.value, editing.timezone) })} /></label><label>時區<select value={editing.timezone} onChange={(event) => { const timezone = event.target.value as Activity["timezone"]; const local = localInputValue(editing.start, editing.timezone); setEditing({ ...editing, timezone, start: isoFromLocal(local, timezone) }); }}><option value="America/New_York">Boston</option><option value="America/Los_Angeles">Seattle</option><option value="Asia/Taipei">台北</option></select></label><label>停留時間（分）<input type="number" inputMode="numeric" min="0" max="10080" value={editing.durationMin} onChange={(event) => setEditing({ ...editing, durationMin: Number(event.target.value) })} required /></label><label>分類<select value={editing.category} onChange={(event) => { const category = event.target.value as ActivityCategory; setEditing({ ...editing, category, icon: categoryIcon[category] }); }}>{categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label><label>重要度<select value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: event.target.value as ActivityPriority })}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="wide">活動說明<textarea value={editing.detail} onChange={(event) => setEditing({ ...editing, detail: event.target.value })} maxLength={1000} rows={4} required /></label><label className="wide">地點<input value={editing.place ?? ""} onChange={(event) => setEditing({ ...editing, place: event.target.value || undefined })} maxLength={240} /></label><label>緯度<input type="number" inputMode="decimal" step="any" value={coordinateDraft[0]} onChange={(event) => setCoordinateDraft([event.target.value, coordinateDraft[1]])} /></label><label>經度<input type="number" inputMode="decimal" step="any" value={coordinateDraft[1]} onChange={(event) => setCoordinateDraft([coordinateDraft[0], event.target.value])} /></label><label className="wide">官方網址<input type="url" value={editing.officialUrl ?? ""} onChange={(event) => setEditing({ ...editing, officialUrl: event.target.value || undefined })} placeholder="https://" /></label><label>連結名稱<input value={editing.officialLabel ?? ""} onChange={(event) => setEditing({ ...editing, officialLabel: event.target.value || undefined })} maxLength={80} /></label><label>照片<select value={editing.photo?.src ?? ""} onChange={(event) => setEditing({ ...editing, photo: photoOptions.find((photo) => photo.src === event.target.value) })}><option value="">不放照片</option>{photoOptions.map((photo) => <option key={photo.src} value={photo.src}>{photo.alt}</option>)}</select></label></div>
        {error && <p className="form-error editor-dialog-error" role="alert">{error}</p>}
        <fieldset className="editor-flags"><legend>活動設定</legend>{([[
          "outdoors", "戶外活動"], ["fixed", "固定行程"], ["ticketed", "已購票"], ["vague", "時間尚未確定"]] as const).map(([field, label]) => <label key={field}><input type="checkbox" checked={Boolean(editing[field])} onChange={(event) => setEditing({ ...editing, [field]: event.target.checked || undefined })} />{label}</label>)}</fieldset>
        <details className="editor-advanced"><summary>交通與緩衝<ChevronRight size={16} /></summary><div className="editor-form-grid">{editing.travelFromPrevious ? <><label>交通方式<select value={editing.travelFromPrevious.mode} onChange={(event) => setEditing({ ...editing, travelFromPrevious: { ...editing.travelFromPrevious!, mode: event.target.value as TravelMode } })}>{travelModes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>交通時間（分）<input type="number" min="1" value={editing.travelFromPrevious.minutes} onChange={(event) => setEditing({ ...editing, travelFromPrevious: { ...editing.travelFromPrevious!, minutes: Number(event.target.value) } })} /></label><label>緩衝（分）<input type="number" min="0" value={editing.travelFromPrevious.bufferMin} onChange={(event) => setEditing({ ...editing, travelFromPrevious: { ...editing.travelFromPrevious!, bufferMin: Number(event.target.value) } })} /></label><label className="wide">交通摘要<input value={editing.travelFromPrevious.summary} onChange={(event) => setEditing({ ...editing, travelFromPrevious: { ...editing.travelFromPrevious!, summary: event.target.value } })} maxLength={240} /></label><label className="wide">交通備註<input value={editing.travelFromPrevious.note ?? ""} onChange={(event) => setEditing({ ...editing, travelFromPrevious: { ...editing.travelFromPrevious!, note: event.target.value || undefined } })} maxLength={500} /></label><button type="button" className="text-button danger" onClick={() => setEditing({ ...editing, travelFromPrevious: undefined })}>移除交通段落</button></> : <button type="button" className="secondary-button" onClick={() => setEditing({ ...editing, travelFromPrevious: { mode: "walk", summary: "前往下一站", minutes: 15, bufferMin: 10 } })}><Plus size={16} />加入交通段落</button>}</div></details>
        <details className="editor-advanced"><summary>雨天備案<ChevronRight size={16} /></summary><div className="editor-form-grid">{editing.rainAlternative ? <><label className="wide">備案名稱<input value={editing.rainAlternative.title} onChange={(event) => setEditing({ ...editing, rainAlternative: { ...editing.rainAlternative!, title: event.target.value } })} maxLength={160} /></label><label className="wide">備案說明<textarea value={editing.rainAlternative.detail} onChange={(event) => setEditing({ ...editing, rainAlternative: { ...editing.rainAlternative!, detail: event.target.value } })} maxLength={1000} rows={3} /></label><label className="wide">備案地點<input value={editing.rainAlternative.place ?? ""} onChange={(event) => setEditing({ ...editing, rainAlternative: { ...editing.rainAlternative!, place: event.target.value || undefined } })} /></label><label>照片<select value={editing.rainAlternative.photo?.src ?? ""} onChange={(event) => setEditing({ ...editing, rainAlternative: { ...editing.rainAlternative!, photo: photoOptions.find((photo) => photo.src === event.target.value) } })}><option value="">不放照片</option>{photoOptions.map((photo) => <option key={photo.src} value={photo.src}>{photo.alt}</option>)}</select></label><button type="button" className="text-button danger" onClick={() => setEditing({ ...editing, rainAlternative: undefined })}>移除雨天備案</button></> : <button type="button" className="secondary-button" onClick={() => setEditing({ ...editing, outdoors: true, rainAlternative: { id: `rain-${crypto.randomUUID()}`, timeLabel: "雨天", timezone: editing.timezone, title: "", detail: "", icon: "landmark", category: "sight", priority: editing.priority, durationMin: editing.durationMin } })}><Plus size={16} />加入雨天備案</button>}</div></details>
        <div className="editor-dialog-actions"><button type="button" className="secondary-button" onClick={() => { setEditing(null); setEditingBaseVersion(null); setCreating(false); }}>取消</button><button className="primary-button" disabled={busy}><Save size={16} />{busy ? "儲存中…" : "儲存變更"}</button></div></form></section></div>}
    </div>
  );
}
