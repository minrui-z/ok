"use client";

import {
  AlarmClock,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LocateFixed,
  LockKeyhole,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAlternativeReplacement,
  rankNearbyAlternatives,
  type NearbyAlternativeSuggestion,
} from "../nearby-alternatives";
import type { Activity, DayAdaptation, DelayMinutes, TripDay } from "../trip-data";
import { officialPlaceForActivity } from "../place-directory";
import {
  bostonIsoDate,
  isProtectedActivity,
  resolveDayActivities,
  type Intensity,
} from "../trip-utils";

export type ResponsePanelMode = "delay" | "confirm" | "nearby";

export type ResponsePanelState = {
  dayId: string;
  mode: ResponsePanelMode;
  activityId?: string;
};

export type PlaceConfirmation = {
  id: string;
  activityId: string;
  placeName: string;
  officialUrl: string;
  authorId: string;
  authorName: string;
  confirmedAt: number;
  expiresAt: number;
  fresh: boolean;
};

type PatchResponse = {
  version: number;
  days: TripDay[];
};

type ApiError = Error & { status?: number };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(data.error ?? "目前無法完成，請稍後再試。") as ApiError;
    error.status = response.status;
    throw error;
  }
  return data;
}

function localTime(activity: Activity) {
  if (!activity.start) return activity.timeLabel;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: activity.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(activity.start));
}

function confirmationTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function baseActivityId(day: TripDay, activityId?: string) {
  if (!activityId) return undefined;
  return day.activities.find((activity) => activity.id === activityId || activity.rainAlternative?.id === activityId)?.id;
}

export function TripResponsePanel({
  panel,
  days,
  version,
  intensity,
  rainyDays,
  now,
  confirmations,
  unlocked,
  onClose,
  onUpdated,
  onRefreshConfirmations,
  onUnlocked,
  onLocked,
}: {
  panel: ResponsePanelState;
  days: TripDay[];
  version: number;
  intensity: Intensity;
  rainyDays: Set<string>;
  now: Date | null;
  confirmations: Map<string, PlaceConfirmation>;
  unlocked: boolean;
  onClose: () => void;
  onUpdated: (days: TripDay[], version: number) => void;
  onRefreshConfirmations: () => Promise<void>;
  onUnlocked: () => void;
  onLocked: () => void;
}) {
  const day = days.find((item) => item.id === panel.dayId) ?? days[0];
  const rainy = rainyDays.has(day.id);
  const resolved = useMemo(() => resolveDayActivities(day, intensity, rainy), [day, intensity, rainy]);
  const sights = useMemo(
    () => resolved.all.filter((activity) => activity.category === "sight" && officialPlaceForActivity(activity)),
    [resolved.all],
  );
  const flexibleTargets = useMemo(
    () => day.activities.filter((activity) => activity.coordinates && !isProtectedActivity(activity) && ["sight", "food", "shopping"].includes(activity.category)),
    [day.activities],
  );
  const initialBaseId = baseActivityId(day, panel.activityId);
  const delayAnchors = useMemo(
    () => day.activities.filter((activity) => activity.start && !activity.vague && !isProtectedActivity(activity)),
    [day.activities],
  );
  const initialActivityIndex = initialBaseId ? day.activities.findIndex((activity) => activity.id === initialBaseId) : -1;
  const initialDelayAnchor = delayAnchors.find((activity) => day.activities.indexOf(activity) >= initialActivityIndex)
    ?? delayAnchors[0];

  const [tab, setTab] = useState<ResponsePanelMode>(panel.mode);
  const [draftVersion, setDraftVersion] = useState(version);
  const [anchorId, setAnchorId] = useState(
    day.adaptation && delayAnchors.some((activity) => activity.id === day.adaptation?.fromActivityId)
      ? day.adaptation.fromActivityId
      : initialDelayAnchor?.id ?? "",
  );
  const [delayMin, setDelayMin] = useState<DelayMinutes>(day.adaptation?.delayMin ?? 15);
  const [confirmationActivityId, setConfirmationActivityId] = useState(
    sights.find((activity) => activity.id === panel.activityId)?.id ?? sights[0]?.id ?? "",
  );
  const [replacementActivityId, setReplacementActivityId] = useState(
    initialBaseId && flexibleTargets.some((activity) => activity.id === initialBaseId) ? initialBaseId : flexibleTargets[0]?.id ?? "",
  );
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [unlockExpanded, setUnlockExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const unlockNameRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const background = document.querySelectorAll<HTMLElement>(".topbar, .workspace-main, .site-shell > footer, .bottom-nav");
    background.forEach((element) => element.setAttribute("inert", ""));
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      background.forEach((element) => element.removeAttribute("inert"));
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const adaptation = useMemo<DayAdaptation | null>(() => anchorId ? ({ fromActivityId: anchorId, delayMin, skippedActivityIds: [] }) : null, [anchorId, delayMin]);
  const previewDay = useMemo(() => adaptation ? { ...day, adaptation } : day, [adaptation, day]);
  const previewResolved = useMemo(() => resolveDayActivities(previewDay, intensity, rainy), [intensity, previewDay, rainy]);
  const originalResolved = useMemo(() => resolveDayActivities({ ...day, adaptation: undefined }, intensity, rainy), [day, intensity, rainy]);
  const originalTimes = useMemo(() => new Map(originalResolved.visible.map((activity) => [activity.id, activity.start])), [originalResolved.visible]);
  const shiftedActivities = previewResolved.visible.filter((activity) => activity.start && originalTimes.get(activity.id) !== activity.start);
  const confirmationActivity = sights.find((activity) => activity.id === confirmationActivityId) ?? sights[0];
  const confirmation = confirmationActivity ? confirmations.get(confirmationActivity.id) : undefined;
  const freshConfirmation = Boolean(confirmation && now && confirmation.expiresAt > now.getTime());
  const replacementTarget = flexibleTargets.find((activity) => activity.id === replacementActivityId) ?? flexibleTargets[0];
  const displayedReplacementTarget = replacementTarget
    ? resolved.all.find((activity) => activity.id === replacementTarget.id || activity.id === replacementTarget.rainAlternative?.id) ?? replacementTarget
    : undefined;
  const plannedAlternativeAt = displayedReplacementTarget?.start ? new Date(displayedReplacementTarget.start) : undefined;
  const alternativeAt = now && bostonIsoDate(now) === day.isoDate && (!plannedAlternativeAt || now.getTime() > plannedAlternativeAt.getTime())
    ? now
    : plannedAlternativeAt;
  const alternativeResult = useMemo(() => replacementTarget ? rankNearbyAlternatives({
    day,
    targetActivityId: replacementTarget.id,
    at: alternativeAt,
    origin: userLocation ?? displayedReplacementTarget?.coordinates ?? replacementTarget.coordinates,
    confirmations: [...confirmations.values()].map((item) => ({ officialUrl: item.officialUrl, expiresAt: item.expiresAt })),
    confirmationNow: now ?? new Date(0),
  }) : null, [alternativeAt, confirmations, day, displayedReplacementTarget, now, replacementTarget, userLocation]);

  async function itineraryOperation(operation: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson<PatchResponse>("/api/collab/itinerary", {
        method: "PATCH",
        body: JSON.stringify({ baseVersion: draftVersion || version, operation }),
      });
      setDraftVersion(result.version);
      onUpdated(result.days, result.version);
      return result;
    } catch (cause) {
      const current = cause as ApiError;
      if (current.status === 401) {
        onLocked();
        setError("先輸入旅行密碼，就能把這次調整同步給同行者。");
      } else if (current.status === 409) {
        try {
          const latest = await requestJson<PatchResponse>("/api/itinerary", { cache: "no-store" });
          setDraftVersion(latest.version);
          onUpdated(latest.days, latest.version);
          setError("同行者剛更新了行程。你的選擇已保留，請確認預覽後再按一次套用。");
        } catch {
          setError("同行者剛更新了行程。請關閉後重新打開，再套用這次調整。");
        }
      } else setError(current.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/collab/session", { method: "POST", body: JSON.stringify({ pin, nickname }) });
      setPin("");
      onUnlocked();
      await onRefreshConfirmations();
      setNotice("已解鎖，可以儲存調整。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法解鎖。");
    } finally {
      setBusy(false);
    }
  }

  async function applyDelay() {
    if (!adaptation) return;
    const result = await itineraryOperation({ type: "day.adapt", dayId: day.id, adaptation });
    if (result) setNotice(`已同步：從 ${day.activities.find((activity) => activity.id === anchorId)?.title ?? "所選站點"}起延後 ${delayMin} 分鐘。`);
  }

  async function clearDelay() {
    const result = await itineraryOperation({ type: "day.adapt", dayId: day.id, adaptation: null });
    if (result) {
      setNotice("已恢復這一天原本的時間。");
    }
  }

  async function confirmPlace() {
    if (!confirmationActivity) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/collab/place-confirmations", {
        method: "POST",
        body: JSON.stringify({ activityId: confirmationActivity.id }),
      });
      await onRefreshConfirmations();
      setNotice(`已記錄 ${confirmationActivity.title} 的確認時間，24 小時後會回到待確認。`);
    } catch (cause) {
      const current = cause as ApiError;
      if (current.status === 401) onLocked();
      setError(current.status === 401 ? "先輸入旅行密碼，才能留下確認者與時間。" : current.message);
    } finally {
      setBusy(false);
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setError("這個瀏覽器無法讀取位置，先以目前景點為起點。");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
        setNotice("已改用你現在的位置排列附近備案。");
      },
      () => {
        setLocating(false);
        setError("沒有取得位置，先以目前景點為起點；仍可查看備案。");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 },
    );
  }

  function requestUnlock(message: string) {
    setError(message);
    setUnlockExpanded(true);
    window.setTimeout(() => {
      unlockNameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      unlockNameRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  async function replaceWithAlternative(suggestion: NearbyAlternativeSuggestion) {
    if (!replacementTarget) return;
    const replacement = createAlternativeReplacement(replacementTarget, suggestion);
    if (!replacement.ok) {
      setError(replacement.reason);
      return;
    }
    const result = await itineraryOperation({
      type: "activity.update",
      activityId: replacementTarget.id,
      changes: replacement.patch,
    });
    if (result) setNotice(`已把「${displayedReplacementTarget?.title ?? replacementTarget.title}」換成「${suggestion.candidate.title}」，交通段落已更新。`);
  }

  return (
    <div className="response-dialog-backdrop">
      <section ref={dialogRef} className="response-dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="response-title">
        <header className="response-dialog-heading">
          <div><span>{day.date} · {day.location}</span><h2 id="response-title">行程應變</h2></div>
          <button ref={closeRef} type="button" aria-label="關閉行程應變" onClick={onClose}><X size={20} /></button>
        </header>

        <nav className="response-tabs" aria-label="行程應變功能">
          <button className={tab === "delay" ? "active" : ""} aria-current={tab === "delay" ? "page" : undefined} onClick={() => setTab("delay")}><AlarmClock size={18} /><span>延誤重排</span></button>
          <button className={tab === "confirm" ? "active" : ""} aria-current={tab === "confirm" ? "page" : undefined} onClick={() => setTab("confirm")}><BadgeCheck size={18} /><span>確認營業</span></button>
          <button className={tab === "nearby" ? "active" : ""} aria-current={tab === "nearby" ? "page" : undefined} onClick={() => setTab("nearby")}><MapPinned size={18} /><span>附近備案</span></button>
        </nav>

        <div className="response-dialog-body">
          {error && <p className="response-message is-error" role="alert">{error}</p>}
          {notice && <p className="response-message is-success" role="status"><CheckCircle2 size={17} />{notice}</p>}

          {!unlocked && (unlockExpanded ? <form className="response-unlock" onSubmit={unlock}>
            <div><LockKeyhole size={19} /><span><strong>儲存前先解鎖</strong><small>同行者使用同一組四位數旅行密碼。</small></span></div>
            <label>暱稱<input ref={unlockNameRef} value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={30} autoComplete="nickname" required /></label>
            <label>旅行密碼<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={4} required /></label>
            <button className="secondary-button" disabled={busy}>{busy ? "解鎖中…" : "解鎖"}</button>
          </form> : <div className="response-unlock-prompt"><LockKeyhole size={18} /><span><strong>先預覽，儲存時再解鎖</strong><small>查看重排與附近備案不需要密碼。</small></span><button type="button" onClick={() => setUnlockExpanded(true)}>輸入旅行密碼</button></div>)}

          {tab === "delay" && <div className="response-pane delay-pane">
            <div className="response-intro"><div><span className="response-icon"><AlarmClock size={21} /></span><div><h3>晚了多久？</h3><p>只移動可調整的站點；航班、APSA、住宿與已購票活動保持原時間。</p></div></div>{day.adaptation && <b>目前 +{day.adaptation.delayMin} 分</b>}</div>

            <div className="response-form-grid">
              <label>從哪一站開始<select value={anchorId} onChange={(event) => setAnchorId(event.target.value)}>{delayAnchors.map((activity) => <option key={activity.id} value={activity.id}>{activity.timeLabel} · {activity.title}</option>)}</select></label>
              <fieldset><legend>延誤時間</legend><div className="response-choice-row">{([15, 30, 60] as DelayMinutes[]).map((minutes) => <button type="button" key={minutes} className={delayMin === minutes ? "active" : ""} aria-pressed={delayMin === minutes} onClick={() => setDelayMin(minutes)}>+{minutes} 分</button>)}</div></fieldset>
            </div>

            <section className="delay-preview" aria-live="polite">
              <div><Clock3 size={18} /><span><strong>調整後時間</strong><small>固定活動維持原時間</small></span></div>
              {shiftedActivities.length > 0 && <ol>{shiftedActivities.map((activity) => <li key={activity.id}><span>{activity.title}</span><b>{localTime(activity)}</b></li>)}</ol>}
            </section>

            <div className="response-actions"><button className="primary-button" disabled={busy || !adaptation} onClick={() => unlocked ? void applyDelay() : requestUnlock("先解鎖，就能把重排同步給同行者。")}>
              {busy ? <><LoaderCircle className="spin" size={17} />同步中</> : unlocked ? "套用這個重排" : "解鎖後套用"}
            </button>{day.adaptation && <button className="secondary-button" disabled={busy} onClick={() => unlocked ? void clearDelay() : requestUnlock("先解鎖，才能恢復原本時間。")}><RefreshCw size={16} />恢復原時間</button>}</div>
          </div>}

          {tab === "confirm" && <div className="response-pane confirmation-pane">
            <div className="response-intro"><div><span className="response-icon"><BadgeCheck size={21} /></span><div><h3>景點確認戳記</h3><p>看過官方頁面後留下確認時間；超過 24 小時自動回到待確認。</p></div></div></div>
            {sights.length ? <>
              <label className="response-select">選擇景點<select value={confirmationActivity?.id ?? ""} onChange={(event) => setConfirmationActivityId(event.target.value)}>{sights.map((activity) => <option key={activity.id} value={activity.id}>{activity.timeLabel} · {activity.title}</option>)}</select></label>
              {confirmationActivity && (() => {
                const official = officialPlaceForActivity(confirmationActivity)!;
                return <article className={`confirmation-card ${freshConfirmation ? "is-fresh" : "is-pending"}`}><div><span>{freshConfirmation ? <ShieldCheck size={20} /> : <Clock3 size={20} />}</span><div><small>{freshConfirmation ? "24 小時內已確認" : confirmation ? "確認已超過 24 小時" : "尚未確認"}</small><h4>{confirmationActivity.title}</h4>{confirmation && <p>{confirmation.authorName} · {confirmationTime(confirmation.confirmedAt)}（Boston 時間）</p>}</div></div><a href={official.officialUrl} target="_blank" rel="noreferrer">打開官方頁面<ExternalLink size={15} /></a></article>;
              })()}
              <div className="response-actions"><button className="primary-button" disabled={busy} onClick={() => unlocked ? void confirmPlace() : requestUnlock("先解鎖，才能留下確認者與時間。")}>{busy ? <><LoaderCircle className="spin" size={17} />記錄中</> : unlocked ? "我已確認仍有營業" : "解鎖後留下確認"}</button></div>
            </> : <div className="response-empty">這一天沒有可確認的景點。</div>}
          </div>}

          {tab === "nearby" && <div className="response-pane nearby-pane">
            <div className="response-intro"><div><span className="response-icon"><MapPinned size={21} /></span><div><h3>附近替代方案</h3><p>用剩餘時間與距離先篩選；官網營業狀態仍要在替換前確認。</p></div></div></div>
            {replacementTarget ? <>
              <label className="response-select">要替換哪一站<select value={replacementTarget.id} onChange={(event) => { setReplacementActivityId(event.target.value); setUserLocation(null); }}>{flexibleTargets.map((activity) => {
                const displayed = resolved.all.find((item) => item.id === activity.id || item.id === activity.rainAlternative?.id) ?? activity;
                return <option key={activity.id} value={activity.id}>{displayed.timeLabel} · {displayed.title}</option>;
              })}</select></label>
              <button className="locate-button" type="button" disabled={locating} onClick={locateMe}><LocateFixed size={18} />{locating ? "讀取位置中…" : userLocation ? "已使用目前位置" : "用我現在的位置排序"}</button>
              {alternativeResult?.suggestions.length ? <div className="alternative-list">{alternativeResult.suggestions.map((suggestion) => <article className="alternative-card" key={suggestion.candidate.id}>
                <Image src={suggestion.candidate.photo.src} alt={suggestion.candidate.photo.alt} width={320} height={200} sizes="(max-width: 700px) 100vw, 180px" loading="lazy" />
                <div className="alternative-copy"><span className={suggestion.confirmedRecently ? "is-confirmed" : ""}>{suggestion.planningStatusText}</span><h4>{suggestion.candidate.title}</h4><p>{suggestion.candidate.detail}</p><div className="alternative-metrics"><b>{suggestion.outbound.modeLabel}約 {suggestion.outbound.minutes} 分</b><b>距離 {suggestion.distanceKm.toFixed(1)} km</b>{suggestion.slackMin !== null && <b>仍留 {suggestion.slackMin} 分</b>}</div>{suggestion.candidate.bookingNote && <small>{suggestion.candidate.bookingNote}</small>}<small>官方時段資料核對：{suggestion.candidate.sourceCheckedAt}</small></div>
                <div className="alternative-actions"><a href={suggestion.candidate.officialUrl} target="_blank" rel="noreferrer">官網確認<ExternalLink size={14} /></a><a href={suggestion.googleMapsUrl} target="_blank" rel="noreferrer">路線<MapPinned size={14} /></a><button className="primary-button" disabled={busy} onClick={() => unlocked ? void replaceWithAlternative(suggestion) : requestUnlock("先解鎖，才能把備案同步到共同的行程。")}>{unlocked ? "替換並重算" : "解鎖後替換"}</button></div>
              </article>)}</div> : <div className="response-empty"><MapPinned size={22} /><strong>目前沒有合適的附近備案</strong><p>{alternativeResult?.emptyReason ?? "缺少時間或位置，無法完成篩選。"}</p></div>}
              {alternativeResult && alternativeResult.excluded.length > 0 && <details className="alternative-excluded"><summary>為什麼其他選項沒有列入？</summary><ul>{alternativeResult.excluded.slice(0, 5).map((item) => <li key={item.candidate.id}><span>{item.candidate.title}</span><b>{item.statusText}</b></li>)}</ul></details>}
            </> : <div className="response-empty">這一天沒有適合一鍵替換的彈性站點。</div>}
          </div>}

        </div>
      </section>
    </div>
  );
}
