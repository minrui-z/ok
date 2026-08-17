import type { TripDestination } from "./status-utils";
import type { Activity, TripDay } from "./trip-data";

export type PlaceStatusState = "planned-open" | "official-exception" | "unconfirmed";
export type PlaceStatusImpact = "none" | "partial" | "blocking";

export type PlaceStatus = {
  id: string;
  dayId: string;
  activityId: string;
  name: string;
  date: string;
  visitTime: string;
  destination: TripDestination;
  state: PlaceStatusState;
  impact: PlaceStatusImpact;
  summary: string;
  detail: string;
  source: string;
  sourceLabel: string;
  checkedAt: string;
  curatedAt: string;
};

type CuratedPlaceStatus = Omit<PlaceStatus, "checkedAt" | "curatedAt">;

// These are date-specific trip checks compiled from the linked official visitor pages.
// "planned-open" means the planned arrival fits the published hours, not a live door sensor.
// Sources were last reviewed on 2026-08-17 and are intentionally explicit when the date is not confirmed.
const curatedAt = "2026-08-17";

const curatedPlaces: CuratedPlaceStatus[] = [
  {
    id: "bpl-sep02",
    dayId: "sep-02",
    activityId: "sep02-copley",
    name: "Boston Public Library",
    date: "2026-09-02",
    visitTime: "11:00",
    destination: "boston",
    state: "planned-open",
    impact: "none",
    summary: "週三公布時段為 09:00–20:00，11:00 行程落在時段內。",
    detail: "這是依官方 2026 年營業時段核對；出發當天仍要查看臨時公告。",
    source: "https://www.bpl.org/locations/central/",
    sourceLabel: "BPL 官方館舍頁",
  },
  {
    id: "mit-sep03",
    dayId: "sep-03",
    activityId: "sep03-common",
    name: "MIT Welcome Center",
    date: "2026-09-03",
    visitTime: "09:15",
    destination: "boston",
    state: "planned-open",
    impact: "none",
    summary: "週四 Welcome Center 公布時段為 09:00–16:00，09:15 行程落在時段內。",
    detail: "MIT 校園可自行步行；Welcome Center 若臨時關閉，仍可從 Kendall Square 開始自助參觀。",
    source: "https://www.mit.edu/visitmit/",
    sourceLabel: "MIT 官方參觀頁",
  },
  {
    id: "harvard-sep03",
    dayId: "sep-03",
    activityId: "sep03-old-north",
    name: "Harvard Visitor Center",
    date: "2026-09-03",
    visitTime: "13:30",
    destination: "boston",
    state: "planned-open",
    impact: "none",
    summary: "週四 Visitor Center 公布時段為 09:00–17:00，13:30 行程落在時段內。",
    detail: "官方導覽要事先登記；沒有名額時，使用官方自助導覽即可。",
    source: "https://www.harvard.edu/visit/tours/",
    sourceLabel: "Harvard 官方導覽頁",
  },
  {
    id: "gardner-sep04",
    dayId: "sep-04",
    activityId: "sep04-gardner",
    name: "Isabella Stewart Gardner Museum",
    date: "2026-09-04",
    visitTime: "14:30",
    destination: "boston",
    state: "planned-open",
    impact: "none",
    summary: "週五公布時段為 11:00–17:00，14:30 定時票落在時段內。",
    detail: "官方建議預先購票；有票仍應在前一天檢查臨時公告。",
    source: "https://www.gardnermuseum.org/visit",
    sourceLabel: "Gardner 官方參觀頁",
  },
  {
    id: "bpl-sep05",
    dayId: "sep-05",
    activityId: "sep05-bpl",
    name: "Boston Public Library",
    date: "2026-09-05",
    visitTime: "09:15",
    destination: "boston",
    state: "planned-open",
    impact: "none",
    summary: "週六公布時段為 09:00–17:00，09:15 行程落在時段內。",
    detail: "官方已列出 9/6、9/7 休館；本行程安排在 9/5。",
    source: "https://www.bpl.org/locations/central/",
    sourceLabel: "BPL 官方館舍頁",
  },
  {
    id: "pem-sep06",
    dayId: "sep-06",
    activityId: "sep06-pem",
    name: "Peabody Essex Museum",
    date: "2026-09-06",
    visitTime: "10:00",
    destination: "salem",
    state: "planned-open",
    impact: "none",
    summary: "週日公布時段為 10:00–17:00，10:00 行程落在時段內。",
    detail: "官方目前列為週四至週一開館；接近日期仍要確認特展與臨時公告。",
    source: "https://www.pem.org/visit",
    sourceLabel: "PEM 官方參觀頁",
  },
  {
    id: "fenway-sep02",
    dayId: "sep-02",
    activityId: "sep07-game",
    name: "Fenway Park／Red Sox",
    date: "2026-09-02",
    visitTime: "16:10",
    destination: "boston",
    state: "unconfirmed",
    impact: "none",
    summary: "球場狀態以 MLB 當日賽程為準，目前不把排定賽程當作已開門。",
    detail: "延期、取消或延後開賽會由 MLB 狀態卡與警告列另外顯示。",
    source: "https://www.mlb.com/gameday/824717",
    sourceLabel: "MLB 官方場次",
  },
  {
    id: "uss-sep07",
    dayId: "sep-07",
    activityId: "sep07-dinner",
    name: "USS Constitution",
    date: "2026-09-07",
    visitTime: "15:00",
    destination: "boston",
    state: "unconfirmed",
    impact: "none",
    summary: "9/7 的登艦與 Labor Day 臨時管制尚未由本站確認。",
    detail: "NPS 有官方參觀頁，但安全、軍方活動與假日安排都可能影響登艦。",
    source: "https://www.nps.gov/bost/learn/historyculture/ussconst.htm",
    sourceLabel: "NPS 官方頁",
  },
  {
    id: "breakers-sep08",
    dayId: "sep-08",
    activityId: "sep08-breakers",
    name: "The Breakers",
    date: "2026-09-08",
    visitTime: "10:00",
    destination: "newport",
    state: "official-exception",
    impact: "partial",
    summary: "主館公布時段為 09:00–17:00；後露台因整修於 2026 年 1–11 月關閉。",
    detail: "主館、花園與後草坪仍開放，這項異常不影響已排定的室內參觀。",
    source: "https://www.newportmansions.org/plan-a-visit/",
    sourceLabel: "Newport Mansions 官方頁",
  },
  {
    id: "new-balance-sep09",
    dayId: "sep-09",
    activityId: "sep09-nb",
    name: "New Balance Boston Landing",
    date: "2026-09-09",
    visitTime: "09:00",
    destination: "concord",
    state: "unconfirmed",
    impact: "none",
    summary: "總部辦公區不是觀光設施；旗艦店 9/9 營業時段尚未確認。",
    detail: "行程只安排總部外觀與公開門市，出發前一天請從官方門市頁再查一次。",
    source: "https://www.newbalance.com/stores/",
    sourceLabel: "New Balance 官方門市頁",
  },
  {
    id: "concord-rain-sep09",
    dayId: "sep-09",
    activityId: "sep09-concord-museum-rain",
    name: "Concord Museum（雨天備案）",
    date: "2026-09-09",
    visitTime: "10:45",
    destination: "concord",
    state: "unconfirmed",
    impact: "none",
    summary: "雨天備案的 9/9 入館時段尚未確認。",
    detail: "只有開啟雨天版本時才需要；請在前一天查看官方參觀頁與定時票。",
    source: "https://concordmuseum.org/visit/",
    sourceLabel: "Concord Museum 官方頁",
  },
  {
    id: "bpl-sep10-rain",
    dayId: "sep-10",
    activityId: "sep10-rain",
    name: "Boston Public Library（雨天備案）",
    date: "2026-09-10",
    visitTime: "10:45",
    destination: "boston",
    state: "planned-open",
    impact: "none",
    summary: "週四公布時段為 09:00–20:00，10:45 雨天備案落在時段內。",
    detail: "只有開啟雨天版本時才需要；出發當天仍要查看臨時公告。",
    source: "https://www.bpl.org/locations/central/",
    sourceLabel: "BPL 官方館舍頁",
  },
];

function itineraryActivity(days: TripDay[], activityId: string) {
  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.id === activityId) return { day, activity };
      if (activity.rainAlternative?.id === activityId) {
        return { day, activity: activity.rainAlternative as Activity };
      }
    }
  }
  return null;
}

export function getPlaceStatuses(checkedAt = new Date().toISOString(), days?: TripDay[]): PlaceStatus[] {
  const evaluatedAt = Date.parse(checkedAt);
  const reviewedAt = Date.parse(`${curatedAt}T00:00:00-04:00`);
  const reviewExpired = Number.isFinite(evaluatedAt) && evaluatedAt - reviewedAt > 7 * 24 * 60 * 60 * 1000;

  return curatedPlaces.flatMap((place) => {
    const match = days ? itineraryActivity(days, place.activityId) : null;
    if (days && !match) return [];
    const synchronized = match ? {
      ...place,
      dayId: match.day.id,
      date: match.day.isoDate,
      visitTime: match.activity.timeLabel,
    } : place;
    const itineraryChanged = Boolean(match && (match.day.isoDate !== place.date || match.activity.timeLabel !== place.visitTime));
    if ((reviewExpired || itineraryChanged) && synchronized.state === "planned-open") {
      return [{
        ...synchronized,
        state: "unconfirmed" as const,
        impact: "none" as const,
        summary: itineraryChanged
          ? `行程已改到 ${synchronized.date} ${synchronized.visitTime}，這個時段尚未重新核對。`
          : `營業時段資料最後整理於 ${curatedAt}，出發前請再查看官方頁。`,
        detail: `${synchronized.detail} 本站不會把超過 7 天未重新核對的資料標成已確認。`,
        checkedAt,
        curatedAt,
      }];
    }
    return [{ ...synchronized, checkedAt, curatedAt }];
  });
}
