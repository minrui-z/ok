"use client";

import {
  AlertTriangle,
  Bell,
  BookOpen,
  BusFront,
  CalendarDays,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudRain,
  Coffee,
  ExternalLink,
  Footprints,
  Hotel,
  Landmark,
  Luggage,
  Map as MapIcon,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  Navigation,
  PencilLine,
  Plane,
  Presentation,
  Route,
  Ship,
  ShoppingBag,
  Store,
  Sun,
  Ticket,
  TrainFront,
  Trophy,
  Utensils,
  Vote,
  Waves,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookingCenter } from "./components/BookingCenter";
import { CollaborationPanel, type PollSeed } from "./components/CollaborationPanel";
import { StatusCenter } from "./components/StatusCenter";
import { TripMap } from "./components/TripMap";
import { NotificationSettings } from "./components/NotificationSettings";
import { TripEditor } from "./components/TripEditor";
import {
  categoryLabels,
  restaurantGroups,
  tripDays,
  type Activity,
  type ActivityCategory,
  type IconKey,
  type TripDay,
  type TravelMode,
} from "./trip-data";
import { bostonIsoDate, checkSchedule, formatCountdown, getStopState, resolveDayActivities, type Intensity } from "./trip-utils";

type PrimaryWorkspace = "today" | "itinerary" | "map" | "more";
type Workspace = PrimaryWorkspace | "bookings" | "collaboration" | "editor";

const iconMap: Record<IconKey, LucideIcon> = {
  plane: Plane, bus: BusFront, train: TrainFront, hotel: Hotel, food: Utensils, walk: Footprints,
  landmark: Landmark, talk: Presentation, car: Car, shop: ShoppingBag, ship: Ship, ticket: Ticket,
  camera: Camera, coffee: Coffee, trophy: Trophy, store: Store, waves: Waves, luggage: Luggage,
};
const intensityLabels: Record<Intensity, string> = { relaxed: "輕鬆", standard: "標準", full: "完整" };
const travelModeLabels: Record<TravelMode, string> = { walk: "步行", transit: "大眾運輸", train: "火車", drive: "開車", flight: "飛行", indoor: "航廈內" };
const travelModeIcons: Record<TravelMode, LucideIcon> = { walk: Footprints, transit: BusFront, train: TrainFront, drive: Car, flight: Plane, indoor: Navigation };
const navItems: Array<{ id: PrimaryWorkspace; label: string; icon: LucideIcon }> = [
  { id: "today", label: "今天", icon: CalendarDays },
  { id: "itinerary", label: "行程", icon: Route },
  { id: "map", label: "地圖", icon: MapIcon },
  { id: "more", label: "更多", icon: MoreHorizontal },
];
const workspaceIds = new Set<Workspace>(["today", "itinerary", "map", "more", "bookings", "collaboration", "editor"]);
const legacyHashes: Record<string, Workspace> = { overview: "today", drive: "more", essentials: "more" };
const allCategories = Object.keys(categoryLabels) as ActivityCategory[];
const packingList = ["護照與 ESTA", "APSA 證件與投影片", "轉接器與充電線", "好走的鞋", "薄外套與雨具", "駕照與租車資料"];

function mapUrl(activity: Pick<Activity, "coordinates" | "place">) {
  const query = activity.place ?? activity.coordinates?.join(",") ?? "Boston";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function directionsUrl(activity: Activity, previous?: Activity | null) {
  const destination = activity.place ?? activity.coordinates?.join(",") ?? activity.title;
  const origin = previous?.place ?? previous?.coordinates?.join(",");
  const mode = activity.travelFromPrevious?.mode;
  const travelmode = mode === "walk" ? "walking" : mode === "drive" ? "driving" : mode === "transit" || mode === "train" ? "transit" : undefined;
  const params = new URLSearchParams({ api: "1", destination });
  if (origin) params.set("origin", origin);
  if (travelmode) params.set("travelmode", travelmode);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function primaryWorkspace(workspace: Workspace): PrimaryWorkspace {
  return workspace === "bookings" || workspace === "collaboration" || workspace === "editor" ? "more" : workspace;
}

function formatActivityTime(activity: Activity, date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: activity.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function readStoredList(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function workspaceFromHash(hash: string): Workspace {
  const value = hash.replace(/^#/, "");
  if (workspaceIds.has(value as Workspace)) return value as Workspace;
  return legacyHashes[value] ?? "today";
}

export default function TripPlanner() {
  const [selectedDayId, setSelectedDayId] = useState("sep-01");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeView, setActiveView] = useState<Workspace>("today");
  const [intensity, setIntensity] = useState<Intensity>("standard");
  const [rainyDays, setRainyDays] = useState<Set<string>>(new Set());
  const [revealedDays, setRevealedDays] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [manualActivityId, setManualActivityId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [days, setDays] = useState<TripDay[]>(tripDays);
  const [itineraryVersion, setItineraryVersion] = useState(0);
  const [mapAllDays, setMapAllDays] = useState(true);
  const [mapIncludeFlights, setMapIncludeFlights] = useState(false);
  const [mapCategories, setMapCategories] = useState<Set<ActivityCategory>>(new Set(allCategories));
  const [packing, setPacking] = useState<Set<string>>(new Set());
  const [pollSeed, setPollSeed] = useState<PollSeed>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const initial = window.setTimeout(() => {
      const current = new Date();
      const currentBostonDate = bostonIsoDate(current);
      const relevantDay = tripDays.find((day) => day.isoDate === currentBostonDate)
        ?? tripDays.find((day) => day.isoDate >= currentBostonDate)
        ?? tripDays[tripDays.length - 1];
      setSelectedDayId(relevantDay.id);
      setActiveView(workspaceFromHash(window.location.hash));
      setTheme(localStorage.getItem("boston-theme") === "dark" ? "dark" : "light");
      const storedIntensity = localStorage.getItem("boston-intensity");
      if (storedIntensity === "relaxed" || storedIntensity === "standard" || storedIntensity === "full") setIntensity(storedIntensity);
      setRainyDays(new Set(readStoredList("boston-rainy-days")));
      setCompletedIds(new Set(readStoredList("boston-completed-stops")));
      setPacking(new Set(readStoredList("boston-packing")));
      setSettingsReady(true);
      update();
    }, 0);
    const interval = window.setInterval(update, 30_000);
    const hashChange = () => setActiveView(workspaceFromHash(window.location.hash));
    window.addEventListener("hashchange", hashChange);
    window.addEventListener("popstate", hashChange);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("hashchange", hashChange); window.removeEventListener("popstate", hashChange); };
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; if (settingsReady) localStorage.setItem("boston-theme", theme); }, [settingsReady, theme]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-intensity", intensity); }, [intensity, settingsReady]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-rainy-days", JSON.stringify([...rainyDays])); }, [rainyDays, settingsReady]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-completed-stops", JSON.stringify([...completedIds])); }, [completedIds, settingsReady]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-packing", JSON.stringify([...packing])); }, [packing, settingsReady]);

  const refreshSharedItinerary = useCallback(async () => {
    try {
      const response = await fetch("/api/itinerary", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { version?: number; days?: TripDay[] };
      if (Array.isArray(data.days) && typeof data.version === "number") {
        setDays(data.days);
        setItineraryVersion(data.version);
      }
    } catch {
      // The bundled itinerary remains available if shared data is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshSharedItinerary(), 0);
    const interval = window.setInterval(() => void refreshSharedItinerary(), 30_000);
    const onFocus = () => void refreshSharedItinerary();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshSharedItinerary]);

  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? tripDays[0];
  const resolved = useMemo(() => resolveDayActivities(selectedDay, intensity, rainyDays.has(selectedDay.id)), [intensity, rainyDays, selectedDay]);
  const activities = revealedDays.has(selectedDay.id) ? resolved.all : resolved.visible;
  const scheduleChecks = useMemo(() => checkSchedule(resolved.all), [resolved.all]);
  const checksByDestination = useMemo(() => new Map(scheduleChecks.map((check) => [check.to.id, check])), [scheduleChecks]);
  const problemChecks = scheduleChecks.filter((check) => check.state !== "clear");
  const selectedRestaurants = restaurantGroups.filter((group) => group.dayIds.includes(selectedDay.id));
  const effectiveDays = useMemo(() => days.map((day) => ({
    ...day,
    activities: resolveDayActivities(day, intensity, rainyDays.has(day.id)).visible,
  })), [days, intensity, rainyDays]);
  const stopState = useMemo(() => now ? getStopState(now, effectiveDays, completedIds, manualActivityId) : null, [completedIds, effectiveDays, manualActivityId, now]);
  const flatActivities = useMemo(() => effectiveDays.flatMap((day) => day.activities), [effectiveDays]);
  const currentBostonDate = now ? bostonIsoDate(now) : days[0]?.isoDate ?? tripDays[0].isoDate;
  const todayDay = days.find((day) => day.isoDate === currentBostonDate)
    ?? days.find((day) => day.isoDate >= currentBostonDate)
    ?? days[days.length - 1]
    ?? tripDays[tripDays.length - 1];
  const todayResolved = useMemo(() => resolveDayActivities(todayDay, intensity, rainyDays.has(todayDay.id)), [intensity, rainyDays, todayDay]);
  const mapDays = useMemo(() => effectiveDays.map((day) => ({
    ...day,
    activities: day.activities.filter((activity) => {
      if (mapIncludeFlights) return true;
      const [latitude, longitude] = activity.coordinates ?? [];
      return typeof latitude === "number" && typeof longitude === "number" && latitude >= 39 && latitude <= 45 && longitude >= -74 && longitude <= -68;
    }),
  })), [effectiveDays, mapIncludeFlights]);

  const chooseDay = useCallback((dayId: string) => setSelectedDayId(dayId), []);
  const selectMapDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
    setMapAllDays(false);
  }, []);
  const activateView = useCallback((target: Workspace, replace = false) => {
    setActiveView(target);
    const url = `${window.location.pathname}${window.location.search}#${target}`;
    if (replace) window.history.replaceState(null, "", url); else window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => contentRef.current?.focus({ preventScroll: true }), 220);
  }, []);

  function openDay(dayId: string) { chooseDay(dayId); activateView("itinerary"); }
  function toggleRain() {
    setRainyDays((current) => { const next = new Set(current); if (next.has(selectedDay.id)) next.delete(selectedDay.id); else next.add(selectedDay.id); return next; });
  }
  function moveManual(direction: -1 | 1) {
    const currentId = stopState?.phase === "active" ? stopState.current?.id ?? stopState.next?.id : stopState?.phase === "before" ? stopState.next.id : null;
    const index = Math.max(0, flatActivities.findIndex((activity) => activity.id === currentId));
    const target = flatActivities[Math.min(flatActivities.length - 1, Math.max(0, index + direction))];
    if (target) setManualActivityId(target.id);
  }
  function completeCurrent() {
    const current = stopState?.phase === "active" ? stopState.current ?? stopState.next : stopState?.phase === "before" ? stopState.next : null;
    if (!current) return;
    setCompletedIds((ids) => new Set(ids).add(current.id));
    const index = flatActivities.findIndex((activity) => activity.id === current.id);
    setManualActivityId(flatActivities[index + 1]?.id ?? null);
  }
  function startRestaurantPoll(groupId: string) {
    const group = restaurantGroups.find((item) => item.id === groupId);
    if (!group) return;
    setPollSeed((current) => ({ key: (current?.key ?? 0) + 1, question: `${group.title} 要吃哪一間？`, options: group.restaurants.map((restaurant) => restaurant.name), dayId: selectedDay.id }));
    activateView("collaboration");
  }

  const bostonTime = now ? new Intl.DateTimeFormat("zh-TW", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "讀取中";
  const currentStop = stopState?.phase === "active" ? stopState.current ?? stopState.next : stopState?.phase === "before" ? stopState.next : null;
  const routeTarget = stopState?.phase === "active" && stopState.current ? stopState.next ?? stopState.current : currentStop;
  const routeTargetIndex = routeTarget ? flatActivities.findIndex((activity) => activity.id === routeTarget.id) : -1;
  const routeOrigin = routeTargetIndex > 0 ? flatActivities[routeTargetIndex - 1] : null;
  const routeLeg = routeTarget?.travelFromPrevious;
  const departAt = routeTarget?.start && routeLeg
    ? new Date(new Date(routeTarget.start).getTime() - (routeLeg.minutes + routeLeg.bufferMin) * 60_000)
    : null;
  const departAtMs = departAt?.getTime() ?? null;
  const primaryView = primaryWorkspace(activeView);

  useEffect(() => {
    if (!now || !routeTarget || !routeLeg || departAtMs === null) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || Notification.permission !== "granted") return;

    let enabled = false;
    try {
      const stored = JSON.parse(localStorage.getItem("boston-notification-preferences") ?? "[]") as unknown;
      enabled = Array.isArray(stored) && stored.includes("departure");
    } catch {
      enabled = false;
    }
    if (!enabled) return;

    const untilDeparture = departAtMs - now.getTime();
    if (untilDeparture > 5 * 60_000 || untilDeparture < -30 * 60_000) return;

    const fingerprint = `${routeTarget.id}:${departAtMs}`;
    let history: Record<string, number> = {};
    try {
      const stored = JSON.parse(localStorage.getItem("boston-departure-notification-history-v1") ?? "{}") as unknown;
      if (stored && typeof stored === "object" && !Array.isArray(stored)) history = stored as Record<string, number>;
    } catch {
      history = {};
    }
    if (history[fingerprint]) return;

    let cancelled = false;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (registration) => {
      if (cancelled) return;
      await registration.showNotification(`準備前往：${routeTarget.title}`, {
        body: `建議 ${formatActivityTime(routeTarget, new Date(departAtMs))} 前出發；${travelModeLabels[routeLeg.mode]}約 ${routeLeg.minutes} 分，另留 ${routeLeg.bufferMin} 分緩衝。`,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `boston-departure-${routeTarget.id}`,
        data: { url: "/#today" },
      });
      history[fingerprint] = Date.now();
      localStorage.setItem(
        "boston-departure-notification-history-v1",
        JSON.stringify(Object.fromEntries(Object.entries(history).sort((left, right) => right[1] - left[1]).slice(0, 60))),
      );
    }).catch(() => {
      // A later 30-second refresh can retry if the browser temporarily rejects the notification.
    });
    return () => { cancelled = true; };
  }, [departAtMs, now, routeLeg, routeTarget]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#workspace-content">跳到主要內容</a>
      <header className="topbar glass-bar">
        <button className="brand brand-button" onClick={() => activateView("today")}><span className="brand-mark">B</span><span><strong>Boston Field Notes</strong><small>SEP 01—12 · 2026</small></span></button>
        <nav className="desktop-nav workspace-nav" aria-label="主要導覽">{navItems.map(({ id, label, icon: NavIcon }) => <button key={id} className={primaryView === id ? "active" : ""} aria-current={primaryView === id ? "page" : undefined} onClick={() => activateView(id)}><NavIcon size={16} />{label}</button>)}</nav>
        <button className="icon-button" aria-label={theme === "light" ? "切換深色模式" : "切換淺色模式"} aria-pressed={theme === "dark"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</button>
      </header>

      <main id="workspace-content" className="workspace-main" ref={contentRef} tabIndex={-1}>
        {activeView === "today" && <section id="today" className="workspace-panel section today-view">
          <div className="trip-masthead">
            <div><span className="section-kicker">TPE · SEA · BOS</span><h1><span>Boston</span><span>9 月 1—12 日</span></h1><p>Boston Marriott Copley Place · APSA 兩場發表 · 兩天租車</p></div>
            <div className="masthead-route" aria-label="去程航班"><span><b>TPE</b>9/1 20:00</span><Plane size={17} /><span><b>SEA</b>轉機 7 小時</span><Plane size={17} /><span><b>BOS</b>9/2 07:40</span></div>
          </div>

          <section className="next-stop glass-card" aria-label="下一站">
            <div className="next-stop-time"><span>Boston 當地</span><strong>{bostonTime}</strong></div>
            {stopState?.phase === "complete" ? <div className="next-stop-main"><CheckCircle2 size={26} /><div><small>旅程狀態</small><h2>行程已完成</h2></div></div> : <>
              <div className="next-stop-main"><Navigation size={25} /><div><small>{stopState?.phase === "before" || !stopState?.current ? "下一站" : "目前"}</small><h2>{currentStop?.title ?? "等待行程"}</h2><p>{stopState?.phase === "before" ? `還有 ${formatCountdown(stopState.countdownMs)}` : stopState?.current ? stopState.current.timeLabel : `還有 ${formatCountdown(stopState?.countdownMs ?? null)}`}</p></div></div>
              <div className="next-stop-upcoming"><span>{routeLeg ? "前往下一站" : "接著"}</span><strong>{routeTarget?.title ?? "今天沒有下一站"}</strong>{routeLeg && <small>{travelModeLabels[routeLeg.mode]}約 {routeLeg.minutes} 分 · 緩衝 {routeLeg.bufferMin} 分{departAt ? ` · ${formatActivityTime(routeTarget!, departAt)} 前出發` : ""}</small>}</div>
              <div className="next-stop-actions"><button aria-label="上一站" onClick={() => moveManual(-1)}><ChevronLeft size={18} /></button><button onClick={completeCurrent}><Check size={17} />完成</button><button aria-label="下一站" onClick={() => moveManual(1)}><ChevronRight size={18} /></button>{routeTarget?.coordinates && <a aria-label={`開啟到 ${routeTarget.title} 的 Google Maps 路線`} href={directionsUrl(routeTarget, routeOrigin)} target="_blank" rel="noreferrer"><Navigation size={17} /><span>路線</span></a>}{manualActivityId && <button className="follow-now" onClick={() => setManualActivityId(null)}>跟隨現在</button>}</div>
            </>}
          </section>

          <div className="today-layout">
            <section className="today-plan glass-card">
              <div className="today-plan-heading"><div><span>{todayDay.weekday} · {todayDay.date}</span><h2>{currentBostonDate < (days[0]?.isoDate ?? tripDays[0].isoDate) ? "旅程第一天" : currentBostonDate > (days[days.length - 1]?.isoDate ?? tripDays[tripDays.length - 1].isoDate) ? "返程已完成" : "今天的安排"}</h2></div><button className="secondary-button compact" onClick={() => openDay(todayDay.id)}>完整行程<ChevronRight size={16} /></button></div>
              <div className="today-stops">{todayResolved.visible.slice(0, 5).map((activity) => { const Icon = iconMap[activity.icon]; return <div key={activity.id}><time>{activity.timeLabel}</time><span><Icon size={16} /></span><p><strong>{activity.title}</strong><small>{activity.detail}</small></p>{activity.coordinates && <a href={mapUrl(activity)} target="_blank" rel="noreferrer" aria-label={`導航到 ${activity.title}`}><Navigation size={16} /></a>}</div>; })}</div>
            </section>
            <aside className="today-shortcuts glass-card"><h2>快速入口</h2><button onClick={() => activateView("map")}><MapIcon size={18} /><span><strong>全行程地圖</strong><small>查看今天與東岸全部地點</small></span><ChevronRight size={16} /></button><button onClick={() => activateView("bookings")}><Ticket size={18} /><span><strong>預約與票券</strong><small>集中查看建議完成日</small></span><ChevronRight size={16} /></button><button onClick={() => { chooseDay(todayDay.id); setRainyDays((current) => new Set(current).add(todayDay.id)); activateView("itinerary"); }}><CloudRain size={18} /><span><strong>打開雨天版本</strong><small>查看當天室內替代</small></span><ChevronRight size={16} /></button></aside>
          </div>
          <StatusCenter selectedDate={todayDay.isoDate} />
        </section>}

        {activeView === "itinerary" && <section id="itinerary" className="workspace-panel section">
          <div className="section-heading"><div><span className="section-kicker">SEP 01—12</span><h1>每日行程</h1></div><p>選一天，再切換強度、雨天版本或地圖。</p></div>
          <div className="itinerary-controls glass-card">
            <div className="control-group"><span>行程強度</span><div className="segmented">{(["relaxed", "standard", "full"] as Intensity[]).map((value) => <button key={value} className={intensity === value ? "active" : ""} aria-pressed={intensity === value} onClick={() => setIntensity(value)}>{intensityLabels[value]}</button>)}</div></div>
            <button className={`weather-toggle ${rainyDays.has(selectedDay.id) ? "active" : ""}`} aria-pressed={rainyDays.has(selectedDay.id)} onClick={toggleRain}><CloudRain size={18} />{selectedDay.date} 雨天</button>
            <button className="secondary-button compact" onClick={() => activateView("map")}><MapIcon size={17} />打開地圖</button>
          </div>
          <div className="day-picker" aria-label="選擇日期">{days.map((day) => <button key={day.id} className={`day-chip ${day.id === selectedDay.id ? "active" : ""}`} aria-pressed={day.id === selectedDay.id} aria-current={day.id === selectedDay.id ? "date" : undefined} onClick={() => chooseDay(day.id)} style={{ "--day-color": day.color } as React.CSSProperties}><span>{day.weekday}</span><strong>{day.date}</strong></button>)}</div>

          <div className={`day-detail kind-${selectedDay.kind}`}>
            <aside className="day-summary glass-card"><div className="day-summary-top"><span className="kind-badge">{selectedDay.kind === "apsa" ? "APSA" : selectedDay.kind === "drive" ? "DRIVE" : selectedDay.kind === "flight" || selectedDay.kind === "return" ? "FLIGHT" : "EXPLORE"}</span><span>{selectedDay.location}</span></div><h2>{selectedDay.title}</h2><p>{selectedDay.note}</p>{rainyDays.has(selectedDay.id) && <div className="rain-note"><CloudRain size={16} />戶外項目已換成室內安排</div>}
              <div className={`conflict-summary ${problemChecks.some((check) => check.state === "conflict") ? "has-conflict" : problemChecks.length ? "has-tight" : "is-clear"}`}>{problemChecks.some((check) => check.state === "conflict") ? <AlertTriangle size={17} /> : <Clock3 size={17} />}<div><strong>{problemChecks.filter((check) => check.state === "conflict").length ? `${problemChecks.filter((check) => check.state === "conflict").length} 段會撞到` : problemChecks.length ? `${problemChecks.length} 段偏緊` : "時間安排可行"}</strong><small>{selectedDay.activities.some((activity) => activity.vague) ? "時間未定的 APSA 項目未納入" : "已計入停留、交通與緩衝"}</small></div></div>
              {problemChecks.length > 0 && <ul className="conflict-list">{problemChecks.map((check) => <li key={check.id}><span>{check.from.title} → {check.to.title}</span><b>{check.slackMin < 0 ? `少 ${Math.abs(check.slackMin)} 分` : `只剩 ${check.slackMin} 分`}</b></li>)}</ul>}
            </aside>
            <div><ol className="timeline">{activities.map((activity, index) => {
              const Icon = iconMap[activity.icon]; const leg = activity.travelFromPrevious; const TravelIcon = leg ? travelModeIcons[leg.mode] : null; const check = checksByDestination.get(activity.id);
              return <li className="timeline-item" key={activity.id}><time className="timeline-time">{activity.timeLabel}</time><span className="timeline-node"><Icon size={16} /></span>{index < activities.length - 1 && <span className="timeline-rail" />}<div className="timeline-entry">
                {leg && TravelIcon && <div className={`travel-leg ${check?.state ? `schedule-${check.state}` : ""}`} aria-label={`前往 ${activity.title} 的交通`}><span className="travel-leg-icon"><TravelIcon size={16} /></span><div className="travel-leg-copy"><span>{travelModeLabels[leg.mode]} · 約 {leg.minutes} 分</span><strong>{leg.summary}</strong>{leg.note && <small>{leg.note}</small>}</div><b>{check?.state === "conflict" ? `少 ${Math.abs(check.slackMin)} 分` : check?.state === "tight" ? `只剩 ${check.slackMin} 分` : `緩衝 ${leg.bufferMin} 分`}</b></div>}
                <article className={`activity-card glass-card ${activity.photo ? "has-photo" : ""}`}><div className="activity-content">{activity.photo && <a className="activity-photo" href={activity.photo.source} target="_blank" rel="noreferrer"><Image src={activity.photo.src} alt={activity.photo.alt} width={288} height={176} sizes="(max-width: 640px) 100vw, 144px" loading="lazy" /><small>{activity.photo.credit}</small></a>}<div><span className="activity-category">{categoryLabels[activity.category]} · 約 {activity.durationMin || "—"} 分</span><h3>{activity.title}</h3><p>{activity.detail}</p></div></div><div className="activity-links">{activity.coordinates && <a href={mapUrl(activity)} target="_blank" rel="noreferrer" aria-label={`導航到 ${activity.title}`}><Navigation size={17} /></a>}{activity.officialUrl && <a href={activity.officialUrl} target="_blank" rel="noreferrer">{activity.officialLabel}<ExternalLink size={14} /></a>}</div></article>
              </div></li>;
            })}</ol>{resolved.hidden.length > 0 && !revealedDays.has(selectedDay.id) && <button className="reveal-button" onClick={() => setRevealedDays((current) => new Set(current).add(selectedDay.id))}>顯示另外 {resolved.hidden.length} 項</button>}</div>
          </div>

          {selectedRestaurants.length > 0 && <div className="restaurant-groups">{selectedRestaurants.map((group) => <section key={group.id} className="restaurant-group"><div className="restaurant-heading"><div><span className="section-kicker">餐廳候補</span><h2>{group.title}</h2></div><button className="secondary-button compact" onClick={() => startRestaurantPoll(group.id)}><Vote size={16} />建立投票</button></div><div className="restaurant-grid">{group.restaurants.map((restaurant) => <article className="restaurant-card glass-card" key={restaurant.id}><div><span>{restaurant.area} · {restaurant.cuisine}</span><strong>{restaurant.name}</strong><p>{restaurant.reason}</p></div><div className="restaurant-meta"><b>{restaurant.price}</b><span>{restaurant.address}</span></div><div className="restaurant-actions"><a href={restaurant.officialUrl} target="_blank" rel="noreferrer">官方網站</a>{restaurant.reservationUrl && <a href={restaurant.reservationUrl} target="_blank" rel="noreferrer">{restaurant.reservationLabel}</a>}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noreferrer"><Navigation size={15} />導航</a></div></article>)}</div></section>)}</div>}
        </section>}

        {activeView === "map" && <section id="map" className="workspace-panel section map-workspace">
          <div className="section-heading"><div><span className="section-kicker">ALL STOPS</span><h1>全行程地圖</h1></div><p>預設聚焦 Boston 與兩天租車範圍；轉機與台北節點可另外顯示。</p></div>
          <div className="map-panel glass-card">
            <div className="map-toolbar">
              <div className="segmented"><button className={!mapAllDays ? "active" : ""} aria-pressed={!mapAllDays} onClick={() => setMapAllDays(false)}>目前日期</button><button className={mapAllDays ? "active" : ""} aria-pressed={mapAllDays} onClick={() => setMapAllDays(true)}>全部日期</button></div>
              <button className={`weather-toggle ${mapIncludeFlights ? "active" : ""}`} aria-pressed={mapIncludeFlights} onClick={() => setMapIncludeFlights((current) => !current)}><Plane size={17} />{mapIncludeFlights ? "含台北與轉機" : "只看東岸"}</button>
              <div className="category-filters" aria-label="地圖分類">{allCategories.map((category) => <label key={category} className={mapCategories.has(category) ? "active" : ""}><input type="checkbox" checked={mapCategories.has(category)} onChange={() => setMapCategories((current) => { const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next; })} />{categoryLabels[category]}</label>)}</div>
            </div>
            {!mapAllDays && <div className="day-picker map-day-picker" aria-label="地圖日期">{days.map((day) => <button key={day.id} className={`day-chip ${day.id === selectedDay.id ? "active" : ""}`} aria-pressed={day.id === selectedDay.id} onClick={() => chooseDay(day.id)} style={{ "--day-color": day.color } as React.CSSProperties}><span>{day.weekday}</span><strong>{day.date}</strong></button>)}</div>}
            <TripMap days={mapDays} selectedDayId={selectedDay.id} allDays={mapAllDays} categories={mapCategories} onSelectDay={selectMapDay} />
            <div className="map-legend">{(mapAllDays ? mapDays : mapDays.filter((day) => day.id === selectedDay.id)).filter((day) => day.activities.length).map((day) => <span key={day.id}><i style={{ background: day.color }} />{day.date}</span>)}</div>
          </div>
          <section className="accessible-stop-list glass-card" aria-labelledby="map-list-title"><div className="compact-heading"><div><span className="section-kicker">MAP LIST</span><h2 id="map-list-title">地點清單</h2></div></div><div>{(mapAllDays ? mapDays : mapDays.filter((day) => day.id === selectedDay.id)).flatMap((day) => day.activities.filter((activity) => activity.coordinates && mapCategories.has(activity.category)).map((activity) => <a key={`${day.id}-${activity.id}`} href={mapUrl(activity)} target="_blank" rel="noreferrer"><span>{day.date} · {activity.timeLabel}</span><strong>{activity.title}</strong><Navigation size={16} /></a>))}</div></section>
        </section>}

        {activeView === "bookings" && <section id="bookings" className="workspace-panel section"><button className="back-to-more text-button" onClick={() => activateView("more")}><ChevronLeft size={16} />更多</button><div className="section-heading"><div><span className="section-kicker">TO RESERVE</span><h1>預約與票券</h1></div><p>門票、餐廳、租車與航班確認集中在這裡。</p></div><BookingCenter now={now} onOpenDay={openDay} /></section>}

        {activeView === "collaboration" && <section id="collaboration" className="workspace-panel section"><button className="back-to-more text-button" onClick={() => activateView("more")}><ChevronLeft size={16} />更多</button><div className="section-heading"><div><span className="section-kicker">TRIP SPACE</span><h1>共同區</h1></div><p>同行者用四位數旅行密碼進入；筆記、投票與費用都在這裡。</p></div><CollaborationPanel key={pollSeed?.key ?? 0} days={days} selectedDayId={selectedDay.id} pollSeed={pollSeed} /></section>}

        {activeView === "editor" && <section id="editor" className="workspace-panel section"><button className="back-to-more text-button" onClick={() => activateView("more")}><ChevronLeft size={16} />更多</button><div className="section-heading"><div><span className="section-kicker">SHARED EDITOR</span><h1>共同編輯行程</h1></div><p>知道旅行密碼的人都能修改；每次變更都會留下版本，可隨時復原。</p></div><TripEditor days={days} version={itineraryVersion} onUpdated={(nextDays, nextVersion) => { setDays(nextDays); setItineraryVersion(nextVersion); }} /></section>}

        {activeView === "more" && <section id="more" className="workspace-panel section more-view">
          <div className="section-heading"><div><span className="section-kicker">TOOLS & SETTINGS</span><h1>更多</h1></div><p>預約、共同功能、設定與出發資料集中在這裡。</p></div>
          <div className="more-tool-grid">
            <button className="more-tool glass-card" onClick={() => activateView("bookings")}><span><Ticket size={21} /></span><div><strong>預約與票券</strong><small>門票、餐廳、租車與建議完成日</small></div><ChevronRight size={17} /></button>
            <button className="more-tool glass-card" onClick={() => activateView("editor")}><span><PencilLine size={21} /></span><div><strong>共同編輯</strong><small>修改行程、查看版本與復原</small></div><ChevronRight size={17} /></button>
            <button className="more-tool glass-card" onClick={() => activateView("collaboration")}><span><MessageSquareText size={21} /></span><div><strong>共同區</strong><small>筆記、投票與分帳</small></div><ChevronRight size={17} /></button>
            <button className="more-tool glass-card" onClick={() => document.getElementById("notification-settings")?.scrollIntoView({ behavior: "smooth" })}><span><Bell size={21} /></span><div><strong>提醒設定</strong><small>天氣、交通與重大異常</small></div><ChevronRight size={17} /></button>
          </div>
          <NotificationSettings />
          <div className="compact-heading more-section-heading"><div><span className="section-kicker">DRIVE & PACK</span><h2>租車與出發前</h2></div></div>
          <div className="drive-grid"><article className="drive-card glass-card"><Image src="/places/cliff-walk.jpg" alt="Newport Cliff Walk" width={720} height={420} loading="lazy" /><small className="drive-credit">OldPine／Wikimedia Commons</small><div><span>9/8 · 約 250 公里</span><h2>Newport</h2><p>The Breakers、Cliff Walk、Bowen’s Wharf、Ocean Drive。</p><button onClick={() => openDay("sep-08")}>查看當天<ChevronRight size={17} /></button></div></article><article className="drive-card glass-card"><Image src="/places/new-balance-hq.jpg" alt="New Balance 世界總部" width={720} height={420} loading="lazy" /><small className="drive-credit">NB Development Group</small><div><span>9/9 · 約 110 公里</span><h2>Boston Landing、Lexington、Concord</h2><p>New Balance 世界總部外觀與旗艦店，再開往 Battle Green、Old North Bridge 與 Walden Pond。</p><button onClick={() => openDay("sep-09")}>查看當天<ChevronRight size={17} /></button></div></article></div>
          <div className="nb-visit glass-card"><Store size={23} /><div><h2>New Balance Boston Landing</h2><p>世界總部位於 100 Guest Street。公共區域與附近門市可到訪；辦公區沒有一般訪客導覽。</p></div><a href="https://www.newbalance.com/stores/" target="_blank" rel="noreferrer">官方門市<ExternalLink size={15} /></a></div>
          <div className="essentials-grid more-essentials"><div className="checklist glass-card"><h2>隨身與文件</h2>{packingList.map((item) => <label key={item}><input type="checkbox" checked={packing.has(item)} onChange={() => setPacking((current) => { const next = new Set(current); if (next.has(item)) next.delete(item); else next.add(item); return next; })} /><span><Check size={15} /></span>{item}</label>)}</div><div className="trip-facts glass-card"><h2>固定資料</h2><dl><div><dt>住宿</dt><dd>Boston Marriott Copley Place</dd></div><div><dt>APSA</dt><dd>9/4 上午、9/5 下午</dd></div><div><dt>租車</dt><dd>9/8—9/9，Back Bay 取還</dd></div><div><dt>返程</dt><dd>9/10 20:00 BOS → SEA</dd></div></dl><button className="secondary-button" onClick={() => activateView("bookings")}><Ticket size={17} />查看預約清單</button></div></div>
        </section>}
      </main>

      <footer><BookOpen size={17} /><span>Boston Field Notes · 2026</span><span>即時資訊更新失敗時，請以各單位官網為準</span></footer>
      <nav className="bottom-nav glass-bar" aria-label="行動版主要導覽">{navItems.map(({ id, label, icon: NavIcon }) => <button key={id} className={primaryView === id ? "active" : ""} aria-current={primaryView === id ? "page" : undefined} onClick={() => activateView(id)}><NavIcon size={18} /><span>{label}</span></button>)}</nav>
    </div>
  );
}
