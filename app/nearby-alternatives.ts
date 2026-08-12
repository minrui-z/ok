import { photos, type Activity, type PlacePhoto, type TravelLeg, type TripDay } from "./trip-data";

export type NearbyAlternativeRegion = "boston" | "salem" | "newport" | "concord";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AlternativeScheduleWindow = {
  weekdays: readonly Weekday[];
  open: `${number}:${number}`;
  close: `${number}:${number}`;
};

export type AlternativeSchedule = {
  /**
   * `published-hours` is copied from a place's official visit page. `daylight`
   * keeps an outdoor place inside a conservative planning window when its
   * official rule is sunrise-to-sunset. Neither value represents live status.
   */
  kind: "published-hours" | "daylight";
  timezone: "America/New_York";
  validFrom: string;
  validThrough: string;
  windows: readonly AlternativeScheduleWindow[];
  closedDates?: readonly string[];
  lastEntryMinBeforeClose?: number;
  note: string;
  sourceUrl: string;
};

export type NearbyAlternative = {
  id: string;
  region: NearbyAlternativeRegion;
  title: string;
  detail: string;
  coordinates: [number, number];
  place: string;
  durationMin: number;
  photo: PlacePhoto;
  officialUrl: string;
  officialLabel: string;
  sourceCheckedAt: string;
  outdoors?: boolean;
  bookingNote?: string;
  schedule: AlternativeSchedule;
};

export type AlternativeConfirmation = {
  candidateId?: string;
  officialUrl?: string;
  expiresAt: string | number | Date;
};

export type AlternativePlanningStatus =
  | "fresh-confirmation"
  | "published-window"
  | "daylight-window"
  | "officially-closed"
  | "outside-hours"
  | "date-not-covered"
  | "insufficient-time";

export type AlternativeTravelEstimate = {
  mode: "walk" | "transit" | "drive";
  modeLabel: string;
  minutes: number;
  distanceKm: number;
};

export type NearbyAlternativeSuggestion = {
  candidate: NearbyAlternative;
  confirmedRecently: boolean;
  planningStatus: "fresh-confirmation" | "published-window" | "daylight-window";
  planningStatusText: string;
  distanceKm: number;
  outbound: AlternativeTravelEstimate;
  onward: AlternativeTravelEstimate | null;
  arrivalAt: string;
  finishAt: string;
  availableMin: number | null;
  requiredMin: number;
  slackMin: number | null;
  googleMapsUrl: string;
  reason: string;
};

export type ExcludedNearbyAlternative = {
  candidate: NearbyAlternative;
  status: Exclude<AlternativePlanningStatus, "fresh-confirmation" | "published-window" | "daylight-window">;
  statusText: string;
};

export type RankNearbyAlternativesInput = {
  day: TripDay;
  targetActivityId: string;
  at?: Date;
  origin?: [number, number];
  region?: NearbyAlternativeRegion;
  candidates?: readonly NearbyAlternative[];
  confirmations?: readonly AlternativeConfirmation[];
  confirmationNow?: Date;
  minimumBufferMin?: number;
  limit?: number;
};

export type RankNearbyAlternativesResult = {
  region: NearbyAlternativeRegion;
  target: Activity | null;
  nextProtected: Activity | null;
  suggestions: NearbyAlternativeSuggestion[];
  excluded: ExcludedNearbyAlternative[];
  emptyReason: string | null;
};

const CHECKED_AT = "2026-08-12";
const SEPTEMBER_2026 = {
  validFrom: "2026-09-01",
  validThrough: "2026-09-30",
} as const;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];
const MONDAY_TO_SATURDAY = [1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];
const derbyWharfPhoto: PlacePhoto = {
  src: "/places/derby-wharf.jpg",
  alt: "Salem 港區與 Derby Wharf 一帶",
  credit: "Wikimedia Commons contributors",
  source: "https://commons.wikimedia.org/wiki/Category:Derby_Wharf",
};

function publishedSchedule(
  windows: readonly AlternativeScheduleWindow[],
  note: string,
  sourceUrl: string,
  options: Pick<AlternativeSchedule, "closedDates" | "lastEntryMinBeforeClose"> = {},
): AlternativeSchedule {
  return {
    kind: "published-hours",
    timezone: "America/New_York",
    ...SEPTEMBER_2026,
    windows,
    note,
    sourceUrl,
    ...options,
  };
}

function daylightSchedule(note: string, sourceUrl: string): AlternativeSchedule {
  return {
    kind: "daylight",
    timezone: "America/New_York",
    ...SEPTEMBER_2026,
    // A deliberately conservative September planning range. The UI must keep
    // showing the official daylight rule and ask travelers to check that day.
    windows: [{ weekdays: EVERY_DAY, open: "07:00", close: "18:00" }],
    note,
    sourceUrl,
  };
}

export const nearbyAlternativeCandidates: readonly NearbyAlternative[] = [
  {
    id: "alt-boston-bpl",
    region: "boston",
    title: "Boston Public Library",
    detail: "從 Copley Square 進館看 Bates Hall、壁畫與中庭，動線短，也方便回飯店。",
    coordinates: [42.3493, -71.0782],
    place: "Boston Public Library, Central Library",
    durationMin: 75,
    photo: photos.bpl,
    officialUrl: "https://www.bpl.org/locations/central/",
    officialLabel: "官方開館資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [
        { weekdays: [1, 2, 3, 4], open: "09:00", close: "20:00" },
        { weekdays: [5, 6], open: "09:00", close: "17:00" },
        { weekdays: [0], open: "11:00", close: "17:00" },
      ],
      "官方頁已列 2026 年休館日；展區與特藏另有各自時段。",
      "https://www.bpl.org/locations/central/",
      { closedDates: ["2026-09-06", "2026-09-07"] },
    ),
  },
  {
    id: "alt-boston-mfa",
    region: "boston",
    title: "Museum of Fine Arts Boston",
    detail: "選一至兩個館區集中看，適合把戶外行程換成完整的室內停留。",
    coordinates: [42.3394, -71.094],
    place: "Museum of Fine Arts Boston",
    durationMin: 120,
    photo: photos.mfa,
    officialUrl: "https://www.mfa.org/visit",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    bookingNote: "官方建議預先購票；最後入館為閉館前 30 分鐘。",
    schedule: publishedSchedule(
      [
        { weekdays: [0, 1, 3, 6], open: "10:00", close: "17:00" },
        { weekdays: [4, 5], open: "10:00", close: "22:00" },
      ],
      "每週二休館，最後入館為閉館前 30 分鐘。",
      "https://www.mfa.org/visit",
      { lastEntryMinBeforeClose: 30 },
    ),
  },
  {
    id: "alt-boston-public-market",
    region: "boston",
    title: "Boston Public Market",
    detail: "可以把景點與簡單用餐合併，同行者也能各自選擇，不必等完整桌菜。",
    coordinates: [42.361, -71.057],
    place: "Boston Public Market",
    durationMin: 50,
    photo: photos.publicMarket,
    officialUrl: "https://bostonpublicmarket.org/about-us/",
    officialLabel: "官方市場資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "08:00", close: "20:00" }],
      "市場每日營業；個別攤商時段可能不同。",
      "https://bostonpublicmarket.org/about-us/",
    ),
  },
  {
    id: "alt-boston-prudential",
    region: "boston",
    title: "Prudential Center",
    detail: "靠近飯店，可在室內補給、用餐或短暫休息，時間最容易收放。",
    coordinates: [42.3474, -71.0815],
    place: "Prudential Center",
    durationMin: 60,
    photo: photos.prudential,
    officialUrl: "https://www.prudentialcenter.com/visit/",
    officialLabel: "官方到訪資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [
        { weekdays: MONDAY_TO_SATURDAY, open: "11:00", close: "21:00" },
        { weekdays: [0], open: "11:00", close: "20:00" },
      ],
      "商場中心時段；個別商店與餐廳可能不同。",
      "https://www.prudentialcenter.com/visit/",
    ),
  },
  {
    id: "alt-boston-old-state-house",
    region: "boston",
    title: "Old State House",
    detail: "把 Freedom Trail 的戶外段縮短，改成一個可控制在一小時內的歷史館舍。",
    coordinates: [42.3588, -71.0575],
    place: "Old State House",
    durationMin: 60,
    photo: photos.oldStateHouse,
    officialUrl: "https://revolutionaryspaces.org/visit/",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "10:00", close: "17:00" }],
      "官方頁不同區塊分別列 17:00、18:00 閉館；計算採 17:00 的保守時段。",
      "https://revolutionaryspaces.org/visit/",
    ),
  },
  {
    id: "alt-salem-pem",
    region: "salem",
    title: "Peabody Essex Museum",
    detail: "延長原本的博物館停留，省去重新移動，也最適合下雨或體力下降時使用。",
    coordinates: [42.5215, -70.8928],
    place: "Peabody Essex Museum",
    durationMin: 105,
    photo: photos.pem,
    officialUrl: "https://www.pem.org/visit",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: [0, 1, 4, 5, 6], open: "10:00", close: "17:00" }],
      "每週二、三休館；官方建議首次參觀預留約兩小時。",
      "https://www.pem.org/visit",
    ),
  },
  {
    id: "alt-salem-witch-house",
    region: "salem",
    title: "The Witch House",
    detail: "以自助參觀取代長距離戶外導覽，離 Salem 市中心景點很近。",
    coordinates: [42.5219, -70.8988],
    place: "The Witch House at Salem",
    durationMin: 50,
    photo: photos.witchHouse,
    officialUrl: "https://www.salemma.gov/witch-house",
    officialLabel: "Salem 市府資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "10:00", close: "17:00" }],
      "Salem 市府列出的主季時段為 4/1–11/14 每日 10:00–17:00。",
      "https://www.salemma.gov/witch-house",
    ),
  },
  {
    id: "alt-salem-seven-gables",
    region: "salem",
    title: "The House of the Seven Gables",
    detail: "室內宅邸導覽加港邊庭園，能依天氣縮成單純室內參觀。",
    coordinates: [42.5209, -70.8865],
    place: "The House of the Seven Gables",
    durationMin: 75,
    photo: photos.gables,
    officialUrl: "https://7gables.org/",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    bookingNote: "宅邸導覽有時段容量，替換前先看票況。",
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "10:00", close: "18:00" }],
      "官方網站標示每日 10:00–18:00；導覽票仍有容量限制。",
      "https://7gables.org/",
    ),
  },
  {
    id: "alt-salem-visitor-center",
    region: "salem",
    title: "Salem Armory Visitor Center",
    detail: "免費展區與短片適合填補零碎時間，也能先向現場人員確認其他館舍狀況。",
    coordinates: [42.5229, -70.8955],
    place: "Salem Armory Regional Visitor Center",
    durationMin: 45,
    photo: photos.salemVisitor,
    officialUrl: "https://www.nps.gov/sama/planyourvisit/basicinfo.htm",
    officialLabel: "NPS 官方資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: [0, 3, 4, 5, 6], open: "09:30", close: "16:30" }],
      "NPS 的 2026 資料列為週三至週日；營運仍可能受人力影響。",
      "https://www.nps.gov/sama/planyourvisit/basicinfo.htm",
    ),
  },
  {
    id: "alt-salem-derby-wharf",
    region: "salem",
    title: "Derby Wharf",
    detail: "免費港邊短走，最適合只剩半小時到一小時、但天氣仍可接受時。",
    coordinates: [42.5167, -70.8873],
    place: "Derby Wharf",
    durationMin: 40,
    photo: derbyWharfPhoto,
    officialUrl: "https://www.nps.gov/places/derby-wharf.htm",
    officialLabel: "NPS 官方資訊",
    sourceCheckedAt: CHECKED_AT,
    outdoors: true,
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "00:00", close: "23:59" }],
      "NPS 標示碼頭與園區戶外空間全天開放；惡劣天候時不建議使用。",
      "https://home.nps.gov/sama/learn/historyculture/wharves.htm",
    ),
  },
  {
    id: "alt-newport-breakers",
    region: "newport",
    title: "The Breakers",
    detail: "若原本排的是戶外停留，可改成 Newport 最完整的宅邸參觀。",
    coordinates: [41.4699, -71.2989],
    place: "The Breakers",
    durationMin: 75,
    photo: photos.breakers,
    officialUrl: "https://www.newportmansions.org/mansions-and-gardens/the-breakers/",
    officialLabel: "官方宅邸資訊",
    sourceCheckedAt: CHECKED_AT,
    bookingNote: "需購票；2026 年後露台施工，但宅邸與庭園仍開放。",
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "09:00", close: "17:00" }],
      "官方已公布 2026 年 9 月每日 09:00–17:00，最後入場 16:00。",
      "https://www.newportmansions.org/plan-a-visit/",
      { lastEntryMinBeforeClose: 60 },
    ),
  },
  {
    id: "alt-newport-marble-house",
    region: "newport",
    title: "Marble House",
    detail: "比海岸步道更不受天氣影響，位置也在原本的 Bellevue Avenue 動線上。",
    coordinates: [41.462, -71.3051],
    place: "Marble House",
    durationMin: 70,
    photo: photos.marbleHouse,
    officialUrl: "https://www.newportmansions.org/mansions-and-gardens/marble-house/",
    officialLabel: "官方宅邸資訊",
    sourceCheckedAt: CHECKED_AT,
    bookingNote: "需購票；替換前確認當日票況。",
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "09:00", close: "17:00" }],
      "官方已公布 2026 年 9 月每日 09:00–17:00，最後入場 16:00。",
      "https://www.newportmansions.org/plan-a-visit/",
      { lastEntryMinBeforeClose: 60 },
    ),
  },
  {
    id: "alt-newport-art-museum",
    region: "newport",
    title: "Newport Art Museum",
    detail: "市中心的小型室內美術館，停留時間比大型宅邸更容易控制。",
    coordinates: [41.4885, -71.3089],
    place: "Newport Art Museum",
    durationMin: 65,
    photo: photos.newportArt,
    officialUrl: "https://newportartmuseum.org/visit/",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [
        { weekdays: [1, 3, 4, 5, 6], open: "11:00", close: "16:00" },
        { weekdays: [0], open: "11:00", close: "16:00" },
      ],
      "每週二休館；因此 2026/9/8 不會列入可用候補。",
      "https://newportartmuseum.org/visit/",
    ),
  },
  {
    id: "alt-newport-cliff-walk",
    region: "newport",
    title: "Cliff Walk 北段",
    detail: "只走 40 Steps 到 Ruggles Avenue 的平緩段，時間不足時可隨時折返。",
    coordinates: [41.474, -71.298],
    place: "Cliff Walk 40 Steps",
    durationMin: 55,
    photo: photos.cliff,
    officialUrl: "https://www.discovernewport.org/things-to-do/cliff-walk/",
    officialLabel: "官方旅遊資訊",
    sourceCheckedAt: CHECKED_AT,
    outdoors: true,
    schedule: daylightSchedule(
      "官方規則為每日由日出至日落；計算使用 07:00–18:00 的保守九月規劃窗，仍要查看封路與天氣。",
      "https://www.discovernewport.org/things-to-do/cliff-walk/",
    ),
  },
  {
    id: "alt-newport-brenton-point",
    region: "newport",
    title: "Brenton Point State Park",
    detail: "以開車看海加短停取代完整步道，體力下降時最容易控制。",
    coordinates: [41.4497, -71.342],
    place: "Brenton Point State Park",
    durationMin: 35,
    photo: photos.ocean,
    officialUrl: "https://riparks.ri.gov/parks/brenton-point-state-park",
    officialLabel: "RI State Parks 官方資訊",
    sourceCheckedAt: CHECKED_AT,
    outdoors: true,
    schedule: daylightSchedule(
      "州立公園規定為日出至日落；計算使用 07:00–18:00 的保守九月規劃窗。",
      "https://rules.sos.ri.gov/regulations/part/250-100-00-8",
    ),
  },
  {
    id: "alt-concord-museum",
    region: "concord",
    title: "Concord Museum",
    detail: "把 Concord 革命史與文學史一次補齊，雨天也不需要更改開車主線。",
    coordinates: [42.457, -71.3421],
    place: "Concord Museum",
    durationMin: 90,
    photo: photos.concordMuseum,
    officialUrl: "https://concordmuseum.org/visit/plan-your-visit/",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: [0, 2, 3, 4, 5, 6], open: "10:00", close: "16:00" }],
      "官方夏季時段為週二至週日 10:00–16:00。",
      "https://concordmuseum.org/visit/plan-your-visit/",
    ),
  },
  {
    id: "alt-concord-orchard-house",
    region: "concord",
    title: "Louisa May Alcott's Orchard House",
    detail: "45 分鐘導覽可取代戶外長走，離 Concord Museum 與市中心都很近。",
    coordinates: [42.4597, -71.3347],
    place: "Louisa May Alcott's Orchard House",
    durationMin: 60,
    photo: photos.orchardHouse,
    officialUrl: "https://louisamayalcott.org/visit",
    officialLabel: "官方參觀資訊",
    sourceCheckedAt: CHECKED_AT,
    bookingNote: "導覽以定時票為主，臨時替換前先看票況。",
    schedule: publishedSchedule(
      [
        { weekdays: MONDAY_TO_SATURDAY, open: "10:00", close: "17:00" },
        { weekdays: [0], open: "11:00", close: "17:00" },
      ],
      "官方頁明列此時段適用至 2026 年 10 月；參觀為約 45 分鐘導覽。",
      "https://louisamayalcott.org/visit",
    ),
  },
  {
    id: "alt-concord-north-bridge-center",
    region: "concord",
    title: "North Bridge Visitor Center",
    detail: "用短片與室內展覽補足 North Bridge 背景，再依天氣決定是否走到橋邊。",
    coordinates: [42.4712, -71.3534],
    place: "North Bridge Visitor Center",
    durationMin: 45,
    photo: photos.bridge,
    officialUrl: "https://www.nps.gov/mima/planyourvisit/directions-transportation.htm",
    officialLabel: "NPS 官方資訊",
    sourceCheckedAt: CHECKED_AT,
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "10:00", close: "17:00" }],
      "NPS 已公布 2026/5/1–10/31 每日 10:00–17:00。",
      "https://www.nps.gov/mima/planyourvisit/directions-transportation.htm",
    ),
  },
  {
    id: "alt-concord-walden",
    region: "concord",
    title: "Walden Pond State Reservation",
    detail: "只走湖邊短段與 Thoreau 小屋複製品；停車場滿場時不要硬繞等候。",
    coordinates: [42.4388, -71.342],
    place: "Walden Pond State Reservation",
    durationMin: 55,
    photo: photos.walden,
    officialUrl: "https://www.mass.gov/locations/walden-pond-state-reservation",
    officialLabel: "Mass.gov 官方資訊",
    sourceCheckedAt: CHECKED_AT,
    outdoors: true,
    schedule: publishedSchedule(
      [{ weekdays: EVERY_DAY, open: "05:00", close: "19:30" }],
      "園區頁列每日 05:00–19:30；停車場滿場會暫停入場，遊客中心另為 10:00–16:00。",
      "https://www.mass.gov/locations/walden-pond-state-reservation",
    ),
  },
] as const;

export function nearbyRegionForDay(day: TripDay): NearbyAlternativeRegion {
  const place = `${day.id} ${day.location} ${day.title}`.toLocaleLowerCase("en-US");
  if (place.includes("salem")) return "salem";
  if (place.includes("newport")) return "newport";
  if (place.includes("concord") || place.includes("lexington")) return "concord";
  return "boston";
}

export function isProtectedAlternativeTarget(activity: Activity): boolean {
  return Boolean(
    activity.fixed
      || activity.ticketed
      || !["sight", "food", "shopping"].includes(activity.category),
  );
}

export function alternativePlanningStatusText(status: AlternativePlanningStatus): string {
  switch (status) {
    case "fresh-confirmation":
      return "24 小時內已確認，仍以現場公告為準";
    case "published-window":
      return "時段符合，仍需當天確認";
    case "daylight-window":
      return "日照時段符合，仍需當天確認";
    case "officially-closed":
      return "官方列為休館日";
    case "outside-hours":
      return "不在官方公布時段";
    case "date-not-covered":
      return "現有資料未涵蓋這天，需先確認";
    case "insufficient-time":
      return "下一個固定行程前來不及";
  }
}

type ScheduleEvaluation =
  | {
    fits: true;
    status: "published-window" | "daylight-window";
    finishAt: Date;
  }
  | {
    fits: false;
    status: "officially-closed" | "outside-hours" | "date-not-covered";
    finishAt: Date;
  };

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const localTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function isoDateInBoston(date: Date): string {
  return localDateFormatter.format(date);
}

function weekdayFromIsoDate(isoDate: string): Weekday {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay() as Weekday;
}

function minutesFromClock(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function localMinutes(date: Date): number {
  const parts = localTimeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function evaluateAlternativeSchedule(
  candidate: NearbyAlternative,
  arrivalAt: Date,
): ScheduleEvaluation {
  const finishAt = new Date(arrivalAt.getTime() + candidate.durationMin * 60_000);
  const arrivalDate = isoDateInBoston(arrivalAt);
  const finishDate = isoDateInBoston(finishAt);
  const schedule = candidate.schedule;

  if (arrivalDate < schedule.validFrom || arrivalDate > schedule.validThrough) {
    return { fits: false, status: "date-not-covered", finishAt };
  }
  if (schedule.closedDates?.includes(arrivalDate)) {
    return { fits: false, status: "officially-closed", finishAt };
  }

  const weekday = weekdayFromIsoDate(arrivalDate);
  const arrivalMin = localMinutes(arrivalAt);
  const finishMin = localMinutes(finishAt);
  const window = schedule.windows.find((item) => item.weekdays.includes(weekday));
  if (!window || finishDate !== arrivalDate) {
    return { fits: false, status: "outside-hours", finishAt };
  }

  const openMin = minutesFromClock(window.open);
  const closeMin = minutesFromClock(window.close);
  const lastEntryMin = closeMin - (schedule.lastEntryMinBeforeClose ?? 0);
  const fits = arrivalMin >= openMin && arrivalMin <= lastEntryMin && finishMin <= closeMin;
  if (!fits) return { fits: false, status: "outside-hours", finishAt };
  return {
    fits: true,
    status: schedule.kind === "daylight" ? "daylight-window" : "published-window",
    finishAt,
  };
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceKm(from: [number, number], to: [number, number]): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(to[0] - from[0]);
  const longitudeDelta = radians(to[1] - from[1]);
  const firstLatitude = radians(from[0]);
  const secondLatitude = radians(to[0]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function estimateAlternativeTravel(
  from: [number, number],
  to: [number, number],
  driveDay: boolean,
): AlternativeTravelEstimate {
  const distance = distanceKm(from, to);
  const mode = driveDay ? "drive" : distance <= 1.6 ? "walk" : "transit";
  const minutes = mode === "walk"
    ? Math.max(4, Math.ceil(distance / 4.5 * 60))
    : mode === "drive"
      ? Math.max(8, Math.ceil(distance / 35 * 60 + 5))
      : Math.max(12, Math.ceil(distance / 18 * 60 + 8));
  return {
    mode,
    modeLabel: mode === "walk" ? "步行" : mode === "drive" ? "車程" : "大眾運輸",
    minutes,
    distanceKm: Math.round(distance * 10) / 10,
  };
}

function googleTravelMode(mode: AlternativeTravelEstimate["mode"]): "walking" | "driving" | "transit" {
  if (mode === "walk") return "walking";
  if (mode === "drive") return "driving";
  return "transit";
}

export function alternativeGoogleMapsUrl(
  from: [number, number],
  candidate: NearbyAlternative,
  mode: AlternativeTravelEstimate["mode"],
): string {
  const parameters = new URLSearchParams({
    api: "1",
    origin: `${from[0]},${from[1]}`,
    destination: `${candidate.coordinates[0]},${candidate.coordinates[1]}`,
    travelmode: googleTravelMode(mode),
  });
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

function normalizeUrl(value: string | undefined): string {
  return (value ?? "").replace(/\/$/, "").toLocaleLowerCase("en-US");
}

function isSamePlace(target: Activity, candidate: NearbyAlternative): boolean {
  if (target.officialUrl && normalizeUrl(target.officialUrl) === normalizeUrl(candidate.officialUrl)) return true;
  const targetName = `${target.title} ${target.place ?? ""}`.toLocaleLowerCase("en-US");
  return targetName.includes(candidate.title.toLocaleLowerCase("en-US"))
    || targetName.includes(candidate.place.toLocaleLowerCase("en-US"));
}

function confirmationIsFresh(
  candidate: NearbyAlternative,
  confirmations: readonly AlternativeConfirmation[],
  now: Date,
): boolean {
  return confirmations.some((confirmation) => {
    const matches = confirmation.candidateId === candidate.id
      || normalizeUrl(confirmation.officialUrl) === normalizeUrl(candidate.officialUrl);
    if (!matches) return false;
    const expiry = confirmation.expiresAt instanceof Date
      ? confirmation.expiresAt.getTime()
      : new Date(confirmation.expiresAt).getTime();
    return Number.isFinite(expiry) && expiry > now.getTime();
  });
}

function firstProtectedActivity(day: TripDay, after: Date, targetId: string): Activity | null {
  return day.activities
    .filter((activity) => activity.id !== targetId && activity.start && isProtectedAlternativeTarget(activity))
    .filter((activity) => new Date(activity.start!).getTime() > after.getTime())
    .sort((first, second) => new Date(first.start!).getTime() - new Date(second.start!).getTime())[0] ?? null;
}

function fallbackOnwardEstimate(nextProtected: Activity, driveDay: boolean): AlternativeTravelEstimate {
  const fallbackMinutes = nextProtected.travelFromPrevious?.minutes ?? (driveDay ? 20 : 15);
  return {
    mode: driveDay ? "drive" : "transit",
    modeLabel: driveDay ? "車程" : "大眾運輸",
    minutes: fallbackMinutes,
    distanceKm: 0,
  };
}

export function rankNearbyAlternatives({
  day,
  targetActivityId,
  at,
  origin,
  region = nearbyRegionForDay(day),
  candidates = nearbyAlternativeCandidates,
  confirmations = [],
  confirmationNow,
  minimumBufferMin = 15,
  limit = 3,
}: RankNearbyAlternativesInput): RankNearbyAlternativesResult {
  const target = day.activities.find((activity) => activity.id === targetActivityId) ?? null;
  const effectiveAt = at ?? (target?.start ? new Date(target.start) : null);
  const effectiveOrigin = origin ?? target?.coordinates;
  const nextProtected = effectiveAt ? firstProtectedActivity(day, effectiveAt, targetActivityId) : null;
  const baseResult = { region, target, nextProtected };

  if (!target) {
    return { ...baseResult, suggestions: [], excluded: [], emptyReason: "找不到要替換的行程。" };
  }
  if (isProtectedAlternativeTarget(target)) {
    return { ...baseResult, suggestions: [], excluded: [], emptyReason: "這一站是固定行程，不能直接替換。" };
  }
  if (!effectiveAt || !Number.isFinite(effectiveAt.getTime())) {
    return { ...baseResult, suggestions: [], excluded: [], emptyReason: "缺少目前時間，無法判斷是否來得及。" };
  }
  if (!effectiveOrigin) {
    return { ...baseResult, suggestions: [], excluded: [], emptyReason: "缺少目前位置，無法計算附近候補。" };
  }

  const driveDay = day.kind === "drive";
  const deadlineMs = nextProtected?.start ? new Date(nextProtected.start).getTime() : null;
  const availableMin = deadlineMs === null
    ? null
    : Math.floor((deadlineMs - effectiveAt.getTime()) / 60_000);
  const evaluated: NearbyAlternativeSuggestion[] = [];
  const excluded: ExcludedNearbyAlternative[] = [];

  for (const candidate of candidates.filter((item) => item.region === region)) {
    if (isSamePlace(target, candidate)) continue;
    const outbound = estimateAlternativeTravel(effectiveOrigin, candidate.coordinates, driveDay);
    const arrivalAt = new Date(effectiveAt.getTime() + outbound.minutes * 60_000);
    const schedule = evaluateAlternativeSchedule(candidate, arrivalAt);
    if (!schedule.fits) {
      excluded.push({
        candidate,
        status: schedule.status,
        statusText: alternativePlanningStatusText(schedule.status),
      });
      continue;
    }

    const onward = nextProtected
      ? nextProtected.coordinates
        ? estimateAlternativeTravel(candidate.coordinates, nextProtected.coordinates, driveDay)
        : fallbackOnwardEstimate(nextProtected, driveDay)
      : null;
    const requiredMin = outbound.minutes + candidate.durationMin + (onward?.minutes ?? 0)
      + (nextProtected ? minimumBufferMin : 0);
    const slackMin = availableMin === null ? null : availableMin - requiredMin;
    if (slackMin !== null && slackMin < 0) {
      excluded.push({
        candidate,
        status: "insufficient-time",
        statusText: alternativePlanningStatusText("insufficient-time"),
      });
      continue;
    }

    const confirmedRecently = confirmationIsFresh(
      candidate,
      confirmations,
      confirmationNow ?? effectiveAt,
    );
    const planningStatus = confirmedRecently
      ? "fresh-confirmation"
      : schedule.status;
    const distance = outbound.distanceKm;
    evaluated.push({
      candidate,
      confirmedRecently,
      planningStatus,
      planningStatusText: alternativePlanningStatusText(planningStatus),
      distanceKm: distance,
      outbound,
      onward,
      arrivalAt: arrivalAt.toISOString(),
      finishAt: schedule.finishAt.toISOString(),
      availableMin,
      requiredMin,
      slackMin,
      googleMapsUrl: alternativeGoogleMapsUrl(effectiveOrigin, candidate, outbound.mode),
      reason: slackMin === null
        ? `距離約 ${distance.toFixed(1)} 公里；今天後面沒有已定時的固定行程。`
        : `含交通與 ${minimumBufferMin} 分鐘緩衝後，還有 ${slackMin} 分鐘。`,
    });
  }

  evaluated.sort((first, second) => {
    if (first.confirmedRecently !== second.confirmedRecently) return first.confirmedRecently ? -1 : 1;
    if (first.distanceKm !== second.distanceKm) return first.distanceKm - second.distanceKm;
    return (second.slackMin ?? Number.MAX_SAFE_INTEGER) - (first.slackMin ?? Number.MAX_SAFE_INTEGER);
  });

  const suggestions = evaluated.slice(0, Math.max(0, Math.min(3, limit)));
  return {
    ...baseResult,
    suggestions,
    excluded,
    emptyReason: suggestions.length
      ? null
      : "附近沒有同時符合官方公布時段與剩餘時間的候補，請保留原行程或放寬範圍。",
  };
}

export type AlternativeReplacementResult =
  | {
    ok: true;
    patch: Omit<Partial<Omit<Activity, "id">>, "outdoors" | "fixed" | "ticketed" | "vague" | "rainAlternative"> & {
      outdoors?: boolean | null;
      fixed?: null;
      ticketed?: null;
      vague?: null;
      rainAlternative?: null;
    };
  }
  | { ok: false; reason: string };

export function createAlternativeReplacement(
  target: Activity,
  suggestion: NearbyAlternativeSuggestion,
): AlternativeReplacementResult {
  if (isProtectedAlternativeTarget(target)) {
    return { ok: false, reason: "固定、已購票、交通、住宿與會議行程不能直接替換。" };
  }

  const candidate = suggestion.candidate;
  const travelFromPrevious: TravelLeg = {
    mode: suggestion.outbound.mode,
    summary: `前一站→${candidate.title}（估算）`,
    minutes: suggestion.outbound.minutes,
    bufferMin: 10,
    note: "估算時間；出發時仍請以 Google Maps 的即時路況為準。",
  };
  return {
    ok: true,
    patch: {
      title: candidate.title,
      detail: candidate.detail,
      icon: "landmark",
      category: "sight",
      durationMin: candidate.durationMin,
      coordinates: [...candidate.coordinates],
      place: candidate.place,
      photo: candidate.photo,
      officialUrl: candidate.officialUrl,
      officialLabel: candidate.officialLabel,
      outdoors: candidate.outdoors ?? null,
      fixed: null,
      ticketed: null,
      vague: null,
      rainAlternative: null,
      travelFromPrevious,
    },
  };
}
