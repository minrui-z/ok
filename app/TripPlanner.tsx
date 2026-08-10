"use client";

import {
  BookOpen,
  BusFront,
  CalendarDays,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Coffee,
  ExternalLink,
  Footprints,
  Globe2,
  Hotel,
  Landmark,
  List,
  Luggage,
  Map as MapIcon,
  MessageSquareText,
  Moon,
  Navigation,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollaborationPanel, type PollSeed } from "./components/CollaborationPanel";
import { TripMap } from "./components/TripMap";
import {
  categoryLabels,
  restaurantGroups,
  tripDays,
  type Activity,
  type ActivityCategory,
  type IconKey,
  type TravelMode,
} from "./trip-data";
import { formatCountdown, getStopState, resolveDayActivities, type Intensity } from "./trip-utils";

const iconMap: Record<IconKey, LucideIcon> = {
  plane: Plane,
  bus: BusFront,
  train: TrainFront,
  hotel: Hotel,
  food: Utensils,
  walk: Footprints,
  landmark: Landmark,
  talk: Presentation,
  car: Car,
  shop: ShoppingBag,
  ship: Ship,
  ticket: Ticket,
  camera: Camera,
  coffee: Coffee,
  trophy: Trophy,
  store: Store,
  waves: Waves,
  luggage: Luggage,
};

const intensityLabels: Record<Intensity, string> = { relaxed: "輕鬆", standard: "標準", full: "完整" };
const travelModeLabels: Record<TravelMode, string> = { walk: "步行", transit: "大眾運輸", train: "火車", drive: "開車", flight: "飛行", indoor: "航廈內" };
const travelModeIcons: Record<TravelMode, LucideIcon> = { walk: Footprints, transit: BusFront, train: TrainFront, drive: Car, flight: Plane, indoor: Navigation };
const navItems = [
  { id: "overview", label: "首頁", icon: Globe2 },
  { id: "itinerary", label: "行程", icon: CalendarDays },
  { id: "drive", label: "租車", icon: Car },
  { id: "collaboration", label: "共同區", icon: MessageSquareText },
  { id: "essentials", label: "出發前", icon: Luggage },
] as const;
const allCategories = Object.keys(categoryLabels) as ActivityCategory[];
const packingList = ["護照與 ESTA", "APSA 證件與投影片", "轉接器與充電線", "好走的鞋", "薄外套與雨具", "駕照與租車資料"];

function mapUrl(activity: Pick<Activity, "coordinates" | "place">) {
  const query = activity.place ?? activity.coordinates?.join(",") ?? "Boston";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function readStoredList(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export default function TripPlanner() {
  const [selectedDayId, setSelectedDayId] = useState("sep-02");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeSection, setActiveSection] = useState("overview");
  const [intensity, setIntensity] = useState<Intensity>("standard");
  const [rainyDays, setRainyDays] = useState<Set<string>>(new Set());
  const [revealedDays, setRevealedDays] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [manualActivityId, setManualActivityId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [mapAllDays, setMapAllDays] = useState(false);
  const [mapCategories, setMapCategories] = useState<Set<ActivityCategory>>(new Set(allCategories));
  const [packing, setPacking] = useState<Set<string>>(new Set());
  const [pollSeed, setPollSeed] = useState<PollSeed>(null);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const update = () => setNow(new Date());
    const initial = window.setTimeout(() => {
      const storedTheme = localStorage.getItem("boston-theme") === "dark" ? "dark" : "light";
      const storedIntensity = localStorage.getItem("boston-intensity");
      setTheme(storedTheme);
      if (storedIntensity === "relaxed" || storedIntensity === "standard" || storedIntensity === "full") setIntensity(storedIntensity);
      setRainyDays(new Set(readStoredList("boston-rainy-days")));
      setCompletedIds(new Set(readStoredList("boston-completed-stops")));
      setPacking(new Set(readStoredList("boston-packing")));
      setSettingsReady(true);
      update();
    }, 0);
    const interval = window.setInterval(update, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (settingsReady) localStorage.setItem("boston-theme", theme);
  }, [settingsReady, theme]);

  useEffect(() => { if (settingsReady) localStorage.setItem("boston-intensity", intensity); }, [intensity, settingsReady]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-rainy-days", JSON.stringify([...rainyDays])); }, [rainyDays, settingsReady]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-completed-stops", JSON.stringify([...completedIds])); }, [completedIds, settingsReady]);
  useEffect(() => { if (settingsReady) localStorage.setItem("boston-packing", JSON.stringify([...packing])); }, [packing, settingsReady]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-24% 0px -62%", threshold: [0, 0.15, 0.4] },
    );
    navItems.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  const selectedDay = tripDays.find((day) => day.id === selectedDayId) ?? tripDays[0];
  const resolved = useMemo(
    () => resolveDayActivities(selectedDay, intensity, rainyDays.has(selectedDay.id)),
    [intensity, rainyDays, selectedDay],
  );
  const activities = revealedDays.has(selectedDay.id) ? [...resolved.visible, ...resolved.hidden] : resolved.visible;
  const selectedRestaurants = restaurantGroups.filter((group) => group.dayIds.includes(selectedDay.id));
  const stopState = useMemo(
    () => now ? getStopState(now, tripDays, completedIds, manualActivityId) : null,
    [completedIds, manualActivityId, now],
  );
  const flatActivities = useMemo(() => tripDays.flatMap((day) => day.activities), []);

  const chooseDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
  }, []);

  function toggleRain() {
    setRainyDays((current) => {
      const next = new Set(current);
      if (next.has(selectedDay.id)) next.delete(selectedDay.id);
      else next.add(selectedDay.id);
      return next;
    });
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
    document.getElementById("collaboration")?.scrollIntoView({ behavior: "smooth" });
  }

  const bostonTime = now ? new Intl.DateTimeFormat("zh-TW", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "讀取中";

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">跳到主要內容</a>
      <header className="topbar glass-bar">
        <a className="brand" href="#overview"><span className="brand-mark">B</span><span><strong>Boston Field Notes</strong><small>SEP 01—12 · 2026</small></span></a>
        <nav className="desktop-nav" aria-label="主要導覽">
          {navItems.slice(1).map(({ id, label }) => <a key={id} className={activeSection === id ? "active" : ""} aria-current={activeSection === id ? "location" : undefined} href={`#${id}`}>{label}</a>)}
        </nav>
        <div className="topbar-actions">
          <button className="icon-button" aria-label={theme === "light" ? "切換深色模式" : "切換淺色模式"} aria-pressed={theme === "dark"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</button>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="overview">
          <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
          <div className="hero-copy">
            <span className="eyebrow"><Globe2 size={15} /> 10 DAYS · BOSTON</span>
            <h1><span>Boston</span><em>field notes</em></h1>
            <p>住在 Boston Marriott Copley Place。9 月 4 日上午、9 月 5 日下午參加 APSA 發表，其餘時間走 Boston、Salem、Newport 與 Concord。</p>
            <div className="hero-actions"><a className="primary-button" href="#itinerary"><CalendarDays size={17} />打開行程</a><a className="secondary-button" href="#collaboration"><MessageSquareText size={17} />共同筆記</a></div>
          </div>
          <div className="route-lens glass-card">
            <span className="route-kicker"><Route size={15} /> TPE · SEA · BOS</span>
            <div className="airport-row"><div><strong>TPE</strong><span>9/1 20:00</span></div><div className="flight-line"><span /><Plane size={16} /></div><div><strong>SEA</strong><span>轉機 7 小時</span></div><div className="flight-line"><span /><Plane size={16} /></div><div><strong>BOS</strong><span>9/2 07:40</span></div></div>
            <div className="flight-meta"><span><Hotel size={15} />Copley Place</span><span><Presentation size={15} />APSA × 2</span><span><Car size={15} />租車 2 天</span></div>
          </div>
          <div className="hero-stats"><div><strong>10</strong><span>晚</span></div><div><strong>3</strong><span>城市／小鎮</span></div><div><strong>2</strong><span>發表</span></div><div><strong>2</strong><span>租車日</span></div></div>
        </section>

        <section className="section" id="itinerary">
          <div className="section-heading"><div><span className="section-kicker">SEP 01—12</span><h2>每日行程</h2></div><p>切換日期後，地圖、雨天內容、餐廳與共同區會跟著更新。</p></div>

          <section className="next-stop glass-card" aria-label="下一站">
            <div className="next-stop-time"><span>Boston 當地</span><strong>{bostonTime}</strong></div>
            {stopState?.phase === "complete" ? <div className="next-stop-main"><CheckCircle2 size={26} /><div><small>旅程狀態</small><h3>行程已完成</h3></div></div> : (
              <>
                <div className="next-stop-main"><Navigation size={25} /><div><small>{stopState?.phase === "before" || !stopState?.current ? "下一站" : "目前"}</small><h3>{stopState?.phase === "before" ? stopState.next.title : stopState?.current?.title ?? stopState?.next?.title ?? "等待行程"}</h3><p>{stopState?.phase === "before" ? `還有 ${formatCountdown(stopState.countdownMs)}` : stopState?.current ? stopState.current.timeLabel : `還有 ${formatCountdown(stopState?.countdownMs ?? null)}`}</p></div></div>
                <div className="next-stop-upcoming"><span>接著</span><strong>{stopState?.phase === "active" ? stopState.next?.title ?? "今天沒有下一站" : stopState?.phase === "before" ? stopState.next.timeLabel : "—"}</strong></div>
                <div className="next-stop-actions"><button aria-label="上一站" onClick={() => moveManual(-1)}><ChevronLeft size={18} /></button><button onClick={completeCurrent}><Check size={17} />完成</button><button aria-label="下一站" onClick={() => moveManual(1)}><ChevronRight size={18} /></button>{(stopState?.phase === "active" ? stopState.current ?? stopState.next : stopState?.phase === "before" ? stopState.next : null)?.coordinates && <a aria-label="導航到目前行程" href={mapUrl(stopState!.phase === "before" ? stopState!.next : (stopState as Extract<typeof stopState, { phase: "active" }>).current ?? (stopState as Extract<typeof stopState, { phase: "active" }>).next!)} target="_blank" rel="noreferrer"><Navigation size={17} /></a>}</div>
              </>
            )}
          </section>

          <div className="itinerary-controls glass-card">
            <div className="control-group"><span>行程強度</span><div className="segmented">{(["relaxed", "standard", "full"] as Intensity[]).map((value) => <button key={value} className={intensity === value ? "active" : ""} aria-pressed={intensity === value} onClick={() => setIntensity(value)}>{intensityLabels[value]}</button>)}</div></div>
            <button className={`weather-toggle ${rainyDays.has(selectedDay.id) ? "active" : ""}`} aria-pressed={rainyDays.has(selectedDay.id)} onClick={toggleRain}><CloudRain size={18} />{selectedDay.date} 雨天</button>
            <div className="segmented view-toggle"><button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} />列表</button><button className={view === "map" ? "active" : ""} aria-pressed={view === "map"} onClick={() => setView("map")}><MapIcon size={17} />地圖</button></div>
          </div>

          <div className="day-picker" aria-label="選擇日期">{tripDays.map((day) => <button key={day.id} className={`day-chip ${day.id === selectedDay.id ? "active" : ""}`} aria-pressed={day.id === selectedDay.id} aria-current={day.id === selectedDay.id ? "date" : undefined} onClick={() => chooseDay(day.id)} style={{ "--day-color": day.color } as React.CSSProperties}><span>{day.weekday}</span><strong>{day.date}</strong></button>)}</div>

          {view === "map" ? (
            <div className="map-panel glass-card">
              <div className="map-toolbar"><div className="segmented"><button className={!mapAllDays ? "active" : ""} aria-pressed={!mapAllDays} onClick={() => setMapAllDays(false)}>目前日期</button><button className={mapAllDays ? "active" : ""} aria-pressed={mapAllDays} onClick={() => setMapAllDays(true)}>全部日期</button></div><div className="category-filters" aria-label="地圖分類">{allCategories.map((category) => <label key={category} className={mapCategories.has(category) ? "active" : ""}><input type="checkbox" checked={mapCategories.has(category)} onChange={() => setMapCategories((current) => { const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next; })} />{categoryLabels[category]}</label>)}</div></div>
              <TripMap days={tripDays} selectedDayId={selectedDay.id} allDays={mapAllDays} categories={mapCategories} onSelectDay={chooseDay} />
              <div className="map-legend">{(mapAllDays ? tripDays : [selectedDay]).map((day) => <span key={day.id}><i style={{ background: day.color }} />{day.date}</span>)}</div>
            </div>
          ) : (
            <div className={`day-detail kind-${selectedDay.kind}`}>
              <aside className="day-summary glass-card"><div className="day-summary-top"><span className="kind-badge">{selectedDay.kind === "apsa" ? "APSA" : selectedDay.kind === "drive" ? "DRIVE" : selectedDay.kind === "flight" || selectedDay.kind === "return" ? "FLIGHT" : "EXPLORE"}</span><span>{selectedDay.location}</span></div><h3>{selectedDay.title}</h3><p>{selectedDay.note}</p>{rainyDays.has(selectedDay.id) && <div className="rain-note"><CloudRain size={16} />戶外項目已換成室內安排</div>}</aside>
              <div>
                <ol className="timeline">{activities.map((activity, index) => {
                  const Icon = iconMap[activity.icon];
                  const leg = activity.travelFromPrevious;
                  const TravelIcon = leg ? travelModeIcons[leg.mode] : null;
                  return <li className="timeline-item" key={activity.id}>
                    <time className="timeline-time">{activity.timeLabel}</time>
                    <span className="timeline-node"><Icon size={16} /></span>
                    {index < activities.length - 1 && <span className="timeline-rail" />}
                    <div className="timeline-entry">
                      {leg && TravelIcon && <div className="travel-leg" aria-label={`前往 ${activity.title} 的交通`}>
                        <span className="travel-leg-icon"><TravelIcon size={16} /></span>
                        <div className="travel-leg-copy"><span>{travelModeLabels[leg.mode]} · 約 {leg.minutes} 分</span><strong>{leg.summary}</strong>{leg.note && <small>{leg.note}</small>}</div>
                        <b>緩衝 {leg.bufferMin} 分</b>
                      </div>}
                      <article className={`activity-card glass-card ${activity.photo ? "has-photo" : ""}`}>
                        <div className="activity-content">{activity.photo && <a className="activity-photo" href={activity.photo.source} target="_blank" rel="noreferrer"><Image src={activity.photo.src} alt={activity.photo.alt} width={288} height={176} sizes="(max-width: 640px) 100vw, 144px" loading="lazy" /><small>{activity.photo.credit}</small></a>}<div><span className="activity-category">{categoryLabels[activity.category]} · 約 {activity.durationMin || "—"} 分</span><h4>{activity.title}</h4><p>{activity.detail}</p></div></div>
                        <div className="activity-links">{activity.coordinates && <a href={mapUrl(activity)} target="_blank" rel="noreferrer" aria-label={`導航到 ${activity.title}`}><Navigation size={17} /></a>}{activity.officialUrl && <a href={activity.officialUrl} target="_blank" rel="noreferrer">{activity.officialLabel}<ExternalLink size={14} /></a>}</div>
                      </article>
                    </div>
                  </li>;
                })}</ol>
                {resolved.hidden.length > 0 && !revealedDays.has(selectedDay.id) && <button className="reveal-button" onClick={() => setRevealedDays((current) => new Set(current).add(selectedDay.id))}>顯示另外 {resolved.hidden.length} 項</button>}
              </div>
            </div>
          )}

          {selectedRestaurants.length > 0 && <div className="restaurant-groups">{selectedRestaurants.map((group) => <section key={group.id} className="restaurant-group"><div className="restaurant-heading"><div><span className="section-kicker">餐廳候補</span><h3>{group.title}</h3></div><button className="secondary-button compact" onClick={() => startRestaurantPoll(group.id)}><Vote size={16} />建立投票</button></div><div className="restaurant-grid">{group.restaurants.map((restaurant) => <article className="restaurant-card glass-card" key={restaurant.id}><div><span>{restaurant.area} · {restaurant.cuisine}</span><strong>{restaurant.name}</strong><p>{restaurant.reason}</p></div><div className="restaurant-meta"><b>{restaurant.price}</b><span>{restaurant.address}</span></div><div className="restaurant-actions"><a href={restaurant.officialUrl} target="_blank" rel="noreferrer">官方網站</a>{restaurant.reservationUrl && <a href={restaurant.reservationUrl} target="_blank" rel="noreferrer">{restaurant.reservationLabel}</a>}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noreferrer"><Navigation size={15} />導航</a></div></article>)}</div></section>)}</div>}
        </section>

        <section className="section drive-section" id="drive">
          <div className="section-heading"><div><span className="section-kicker">SEP 08—09</span><h2>租車兩天</h2></div><p>兩天都從 Back Bay 取還車，避免在 Boston 市中心留車過夜。</p></div>
          <div className="drive-grid"><article className="drive-card glass-card"><Image src="/places/cliff-walk.jpg" alt="Newport Cliff Walk" width={720} height={420} loading="lazy" /><small className="drive-credit">OldPine／Wikimedia Commons</small><div><span>9/8 · 約 250 公里</span><h3>Newport</h3><p>The Breakers、Cliff Walk、Bowen’s Wharf、Ocean Drive。</p><button onClick={() => { chooseDay("sep-08"); document.getElementById("itinerary")?.scrollIntoView({ behavior: "smooth" }); }}>查看當天<ChevronRight size={17} /></button></div></article><article className="drive-card glass-card"><Image src="/places/new-balance-hq.jpg" alt="New Balance 世界總部" width={720} height={420} loading="lazy" /><small className="drive-credit">NB Development Group</small><div><span>9/9 · 約 110 公里</span><h3>Boston Landing、Lexington、Concord</h3><p>New Balance 世界總部外觀與旗艦店，再開往 Battle Green、Old North Bridge 與 Walden Pond。</p><button onClick={() => { chooseDay("sep-09"); document.getElementById("itinerary")?.scrollIntoView({ behavior: "smooth" }); }}>查看當天<ChevronRight size={17} /></button></div></article></div>
          <div className="nb-visit glass-card"><Store size={23} /><div><h3>New Balance Boston Landing</h3><p>世界總部位於 100 Guest Street。可看建築外觀、公共空間與附近旗艦店；一般訪客沒有辦公區導覽。門市時間接近出發日再從官方店舖頁確認。</p></div><a href="https://www.newbalance.com/stores/" target="_blank" rel="noreferrer">官方門市<ExternalLink size={15} /></a></div>
        </section>

        <section className="section" id="collaboration">
          <div className="section-heading"><div><span className="section-kicker">TRIP SPACE</span><h2>共同筆記與投票</h2></div><p>行程保持公開；這裡用同行者共用的四位數密碼進入。</p></div>
          <CollaborationPanel key={pollSeed?.key ?? 0} days={tripDays} selectedDayId={selectedDay.id} pollSeed={pollSeed} />
        </section>

        <section className="section" id="essentials">
          <div className="section-heading"><div><span className="section-kicker">BEFORE LEAVING</span><h2>出發前</h2></div><p>勾選內容只存在這台裝置，不會出現在共同區。</p></div>
          <div className="essentials-grid"><div className="checklist glass-card"><h3>隨身與文件</h3>{packingList.map((item) => <label key={item}><input type="checkbox" checked={packing.has(item)} onChange={() => setPacking((current) => { const next = new Set(current); if (next.has(item)) next.delete(item); else next.add(item); return next; })} /><span><Check size={15} /></span>{item}</label>)}</div><div className="reservation-list glass-card"><h3>先處理的預約</h3><a href="https://www.gardnermuseum.org/visit" target="_blank" rel="noreferrer"><Ticket size={19} /><span><strong>Gardner Museum</strong><small>9/4 14:30 定時票</small></span><ExternalLink size={15} /></a><a href="https://www.mlb.com/redsox/tickets/single-game-tickets" target="_blank" rel="noreferrer"><Trophy size={19} /><span><strong>Red Sox</strong><small>9/7 開賽時間與門票</small></span><ExternalLink size={15} /></a><a href="https://www.newportmansions.org/plan-a-visit/" target="_blank" rel="noreferrer"><Landmark size={19} /><span><strong>The Breakers</strong><small>9/8 定時票</small></span><ExternalLink size={15} /></a><div><Car size={19} /><span><strong>租車</strong><small>9/8 取車、9/9 晚上還車</small></span></div></div></div>
        </section>
      </main>

      <footer><BookOpen size={17} /><span>Boston Field Notes · 2026</span><span>景點、球賽與交通時間請在出發前再次確認</span></footer>
      <nav className="bottom-nav glass-bar" aria-label="行動版主要導覽">{navItems.map(({ id, label, icon: NavIcon }) => <a key={id} className={activeSection === id ? "active" : ""} aria-current={activeSection === id ? "location" : undefined} href={`#${id}`}><NavIcon size={18} /><span>{label}</span></a>)}</nav>
    </div>
  );
}
