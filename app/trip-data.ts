export type IconKey =
  | "plane"
  | "bus"
  | "train"
  | "hotel"
  | "food"
  | "walk"
  | "landmark"
  | "talk"
  | "car"
  | "shop"
  | "ship"
  | "ticket"
  | "camera"
  | "coffee"
  | "trophy"
  | "store"
  | "waves"
  | "luggage";

export type ActivityCategory =
  | "flight"
  | "transit"
  | "stay"
  | "conference"
  | "sight"
  | "food"
  | "shopping";

export type ActivityPriority = "essential" | "recommended" | "optional";

export type TravelMode = "walk" | "transit" | "train" | "drive" | "flight" | "indoor";

export type TravelLeg = {
  mode: TravelMode;
  summary: string;
  minutes: number;
  bufferMin: number;
  note?: string;
};

export type PlacePhoto = {
  src: string;
  alt: string;
  credit: string;
  source: string;
};

export type Activity = {
  id: string;
  timeLabel: string;
  start?: string;
  timezone: "Asia/Taipei" | "America/Los_Angeles" | "America/New_York";
  title: string;
  detail: string;
  icon: IconKey;
  category: ActivityCategory;
  priority: ActivityPriority;
  durationMin: number;
  coordinates?: [number, number];
  place?: string;
  photo?: PlacePhoto;
  officialUrl?: string;
  officialLabel?: string;
  outdoors?: boolean;
  fixed?: boolean;
  ticketed?: boolean;
  vague?: boolean;
  travelFromPrevious?: TravelLeg;
  rainAlternative?: Omit<Activity, "rainAlternative">;
};

export type TripDay = {
  id: string;
  date: string;
  isoDate: string;
  weekday: string;
  location: string;
  title: string;
  note: string;
  color: string;
  kind: "flight" | "city" | "apsa" | "daytrip" | "drive" | "return";
  activities: Activity[];
};

export type Restaurant = {
  id: string;
  name: string;
  area: string;
  cuisine: string;
  price: "$" | "$$" | "$$$";
  reason: string;
  address: string;
  officialUrl: string;
  reservationUrl?: string;
  reservationLabel: string;
};

export type RestaurantGroup = {
  id: string;
  title: string;
  dayIds: string[];
  restaurants: Restaurant[];
};

const mapPhoto = (name: string, alt: string, credit: string, source: string): PlacePhoto => ({
  src: `/places/${name}`,
  alt,
  credit,
  source,
});

export const photos = {
  bpl: mapPhoto("bpl.jpg", "Copley Square 旁的 Boston Public Library", "Boston Starbucks Rebel／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Boston_Public_Library,_Copley_Square.jpg"),
  freedom: mapPhoto("freedom.jpg", "Freedom Trail 的紅磚步道", "Yaron1m／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Boston_Freedom_Trail.jpg"),
  faneuil: mapPhoto("faneuil.jpg", "Faneuil Hall 外觀", "Kgriff2002／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Faneuil_Hall_Boston.jpg"),
  oldNorth: mapPhoto("old-north.jpg", "Old North Church", "Boston Public Library／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Old_North_Church_-_DPLA_-_098d9291dab42143f93a2ee445536945.jpg"),
  uss: mapPhoto("uss-constitution.jpg", "Charlestown Navy Yard 的 USS Constitution", "National Park Service／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:The_USS_CONSTITUTION_docked_at_the_Charlestown_Navy_Yard_with_the_Bunker_Hill_Monument_behind_it._(887e98c5-c5d7-468d-803b-8bd0c1680284).jpg"),
  gardner: mapPhoto("gardner.jpg", "Isabella Stewart Gardner Museum", "Biruitorul／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:ISGardnerMuseum.JPG"),
  fens: mapPhoto("back-bay-fens.jpg", "Back Bay Fens 水岸", "Marc Choquette／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Back_Bay_Fens_(4204380847).jpg"),
  fenway: mapPhoto("fenway.jpg", "Fenway Park", "RoastedGarlic2018／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Fenway_Park,_Boston_MA.jpg"),
  newbury: mapPhoto("newbury.jpg", "Newbury Street 街景", "Sharon Hahn Darlin／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Newbury_Street,_Boston,_Massachusetts_March_2020_-_11.jpg"),
  pem: mapPhoto("pem.jpg", "Peabody Essex Museum", "David Adam Kess／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:PEM_Salem,_exterior_Essex_Street,_exterior._The_Peabody_Essex_Museum_in_Salem,_Massachusetts.jpg"),
  witch: mapPhoto("witch-memorial.jpg", "Salem Witch Trials Memorial", "Magicpiano／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:SalemMA_WitchTrialMemorial.jpg"),
  gables: mapPhoto("seven-gables.jpg", "House of the Seven Gables", "Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:HouseOfSevenGables.jpg"),
  breakers: mapPhoto("breakers.jpg", "Newport The Breakers", "Wikimedia Commons／Public domain", "https://commons.wikimedia.org/wiki/File:The_Breakers,_Newport,_Rhode_Island.jpg"),
  cliff: mapPhoto("cliff-walk.jpg", "Newport Cliff Walk", "OldPine／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Newport_RI_Cliff_Walk.jpg"),
  ocean: mapPhoto("ocean-drive.jpg", "Newport Ocean Drive", "VitaleBaby／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Newport_Ocean_Drive.jpg"),
  newBalance: mapPhoto("new-balance-hq.jpg", "Boston Landing 的 New Balance 世界總部", "NB Development Group", "https://nbdevelopment.com/portfolio-item/new-balance-athletics-inc-world-headquarters-building/"),
  lexington: mapPhoto("lexington.jpg", "Lexington Battle Green", "John Phelan／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Lexington_Battle_Green,_Lexington_MA.jpg"),
  bridge: mapPhoto("old-north-bridge.jpg", "Concord Old North Bridge", "Historical Perspective／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Concord_Old_North_Bridge.JPG"),
  walden: mapPhoto("walden.jpg", "Walden Pond", "John Phelan／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Walden_Pond_in_October,_Concord_MA.jpg"),
  skyline: mapPhoto("boston-skyline.jpg", "Prudential Tower 俯瞰 Boston", "WonderWhy／Wikimedia Commons", "https://commons.wikimedia.org/wiki/File:Boston_skyline_from_the_Prudential_Tower.JPG"),
  oldStateHouse: mapPhoto("old-state-house.jpg", "Boston Old State House 外觀", "Rizka／Wikimedia Commons · CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Old_State_House,_Boston,_Massachusetts.JPG"),
  publicMarket: mapPhoto("boston-public-market.jpg", "Boston Public Market 外觀", "NewtonCourt／Wikimedia Commons · CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Boston_Public_Market_Exterior.jpg"),
  mfa: mapPhoto("mfa.jpg", "Museum of Fine Arts Boston 外觀", "Regan Vercruysse／Wikimedia Commons · CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Exterior_Museum_of_Fine_Arts_Boston(4)_(49464470076).jpg"),
  prudential: mapPhoto("prudential-center.jpg", "Prudential Center Boylston Street 入口", "Beyond My Ken／Wikimedia Commons · CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:2017_Prudential_Center_entrance,_Boylston_Street,_Boston,_Massachusetts.jpg"),
  salemVisitor: mapPhoto("salem-visitor-center.jpg", "Salem Armory Visitor Center", "National Park Service", "https://www.nps.gov/sama/planyourvisit/salem-armory.htm"),
  witchHouse: mapPhoto("witch-house.jpg", "Salem Witch House 外觀", "massmatt／Wikimedia Commons · CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Witch_House,_Salem.jpg"),
  marbleHouse: mapPhoto("marble-house.jpg", "Newport Marble House 外觀", "Daderot／Wikimedia Commons · CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Marble_House,_Newport,_Rhode_Island_edit1.jpg"),
  newportArt: mapPhoto("newport-art-museum.jpg", "Newport Art Museum 的 Griswold House", "Beyond My Ken／Wikimedia Commons · CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:2021_Newport_Art_Museum,_John_N._A._Griswold_House,_Newport.jpg"),
  concordMuseum: mapPhoto("concord-museum.jpg", "Concord Museum 外觀", "Daderot／Wikimedia Commons · CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Concord_Museum_(Concord,_MA).JPG"),
  orchardHouse: mapPhoto("orchard-house.jpg", "Louisa May Alcott's Orchard House", "Daderot／Wikimedia Commons · CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:OrchardHouseConcord2CMA.jpg"),
};

const rain = (
  id: string,
  title: string,
  detail: string,
  coordinates: [number, number],
  place: string,
  photo?: PlacePhoto,
): Omit<Activity, "rainAlternative"> => ({
  id,
  timeLabel: "雨天",
  timezone: "America/New_York",
  title,
  detail,
  icon: "landmark",
  category: "sight",
  priority: "recommended",
  durationMin: 90,
  coordinates,
  place,
  photo,
});

const travel = (
  mode: TravelMode,
  summary: string,
  minutes: number,
  bufferMin: number,
  note?: string,
): TravelLeg => ({ mode, summary, minutes, bufferMin, note });

export const tripDays: TripDay[] = [
  {
    id: "sep-01", date: "9/1", isoDate: "2026-09-01", weekday: "週二", location: "TPE → SEA", title: "台北飛往西雅圖", note: "在 SEA 完成入境、重新托運與安檢，晚餐留在航廈。", color: "#5077c8", kind: "flight",
    activities: [
      { id: "sep01-tpe", timeLabel: "20:00", start: "2026-09-01T20:00:00+08:00", timezone: "Asia/Taipei", title: "台灣出發", detail: "起飛前把 ESTA、飯店與 APSA 文件存成離線版本。", icon: "plane", category: "flight", priority: "essential", durationMin: 0, coordinates: [25.0797, 121.2342], place: "桃園國際機場", fixed: true },
      { id: "sep01-sea", timeLabel: "16:10", start: "2026-09-01T16:10:00-07:00", timezone: "America/Los_Angeles", title: "抵達 Seattle", detail: "完成入境、領取／重新托運行李與安檢，預留 2–3 小時。", icon: "luggage", category: "transit", priority: "essential", durationMin: 140, coordinates: [47.4502, -122.3088], place: "Seattle–Tacoma International Airport", fixed: true, travelFromPrevious: travel("flight", "TPE 直飛 SEA", 650, 0, "抵達後先入境、領行李與重新托運") },
      { id: "sep01-dinner", timeLabel: "18:30", start: "2026-09-01T18:30:00-07:00", timezone: "America/Los_Angeles", title: "機場晚餐", detail: "Beecher’s、Floret 或 Salty’s at the SEA；晚餐後在航廈休息。", icon: "food", category: "food", priority: "recommended", durationMin: 75, coordinates: [47.4502, -122.3088], place: "SEA Airport", travelFromPrevious: travel("indoor", "安檢後前往用餐區", 10, 80, "依下一段登機門位置選航廈") },
      { id: "sep01-sea-bos", timeLabel: "23:00", start: "2026-09-01T23:00:00-07:00", timezone: "America/Los_Angeles", title: "SEA → BOS", detail: "21:30 前回到登機門，保留航廈移動緩衝。", icon: "plane", category: "flight", priority: "essential", durationMin: 280, coordinates: [47.4502, -122.3088], place: "SEA Airport", fixed: true, travelFromPrevious: travel("indoor", "用餐區→登機門", 15, 75, "21:30 前回到登機門") },
    ],
  },
  {
    id: "sep-02", date: "9/2", isoDate: "2026-09-02", weekday: "週三", location: "Back Bay", title: "抵達 Boston", note: "第一天只走飯店周邊，下午保留完整休息。", color: "#287f8d", kind: "city",
    activities: [
      { id: "sep02-bos", timeLabel: "07:40", start: "2026-09-02T07:40:00-04:00", timezone: "America/New_York", title: "抵達 Boston Logan", detail: "領行李後搭 Logan Express Back Bay 前往 Prudential。", icon: "plane", category: "flight", priority: "essential", durationMin: 80, coordinates: [42.3656, -71.0096], place: "Boston Logan International Airport", fixed: true },
      { id: "sep02-hotel", timeLabel: "09:30", start: "2026-09-02T09:30:00-04:00", timezone: "America/New_York", title: "飯店寄放行李", detail: "Boston Marriott Copley Place，110 Huntington Ave。", icon: "hotel", category: "stay", priority: "essential", durationMin: 20, coordinates: [42.3472, -71.0797], place: "Boston Marriott Copley Place", fixed: true, travelFromPrevious: travel("transit", "Logan Express→Prudential", 45, 25, "下車後步行約 5 分鐘到飯店") },
      { id: "sep02-apsa", timeLabel: "10:00", start: "2026-09-02T10:00:00-04:00", timezone: "America/New_York", title: "APSA 報到", detail: "到 Hynes 領證並確認 9/4、9/5 的房間與樓層。", icon: "talk", category: "conference", priority: "essential", durationMin: 40, coordinates: [42.3481, -71.0837], place: "Hynes Convention Center", fixed: true, travelFromPrevious: travel("walk", "飯店→Hynes", 8, 12, "走室內連通道也可以") },
      { id: "sep02-copley", timeLabel: "11:00", start: "2026-09-02T11:00:00-04:00", timezone: "America/New_York", title: "Copley Square 與午餐", detail: "Flour 或 Tatte 早午餐，接著看 BPL、Trinity Church 與 Newbury Street。", icon: "food", category: "sight", priority: "recommended", durationMin: 150, coordinates: [42.3493, -71.0782], place: "Boston Public Library", photo: photos.bpl, outdoors: true, travelFromPrevious: travel("walk", "Hynes→Copley Square", 8, 12), rainAlternative: rain("sep02-copley-rain", "Boston Public Library 與 Prudential Center", "先看 Bates Hall 與館內壁畫，再走連通室內空間回飯店。", [42.3493, -71.0782], "Boston Public Library", photos.bpl) },
      { id: "sep02-rest", timeLabel: "16:00", start: "2026-09-02T16:00:00-04:00", timezone: "America/New_York", title: "入住與補眠", detail: "小睡 60–90 分鐘，晚上再出門吃飯。", icon: "hotel", category: "stay", priority: "essential", durationMin: 120, coordinates: [42.3472, -71.0797], place: "Boston Marriott Copley Place", travelFromPrevious: travel("walk", "Copley Square→飯店", 6, 20) },
      { id: "sep02-dinner", timeLabel: "19:00", start: "2026-09-02T19:00:00-04:00", timezone: "America/New_York", title: "Back Bay 晚餐", detail: "Atlantic Fish 為首選；餐後直接回飯店早睡。", icon: "food", category: "food", priority: "recommended", durationMin: 90, coordinates: [42.3494, -71.0810], place: "Atlantic Fish Company", travelFromPrevious: travel("walk", "飯店→Boylston Street", 8, 15) },
    ],
  },
  {
    id: "sep-03", date: "9/3", isoDate: "2026-09-03", weekday: "週四", location: "Historic Boston", title: "Freedom Trail", note: "從 Boston Common 一路走到 Charlestown，穿好走的鞋。", color: "#c46b42", kind: "city",
    activities: [
      { id: "sep03-common", timeLabel: "09:00", start: "2026-09-03T09:00:00-04:00", timezone: "America/New_York", title: "Boston Common 起走", detail: "State House、Granary、Old South Meeting House、Old State House。", icon: "walk", category: "sight", priority: "essential", durationMin: 150, coordinates: [42.3550, -71.0656], place: "Boston Common Visitor Center", photo: photos.freedom, outdoors: true, travelFromPrevious: travel("transit", "Copley→Boston Common", 20, 15, "搭 Green Line 至 Park Street，也可步行約 25 分"), rainAlternative: rain("sep03-common-rain", "Old State House", "把戶外步行縮短，改看 Old State House 的室內展覽。", [42.3588, -71.0575], "Old State House", photos.oldStateHouse) },
      { id: "sep03-faneuil", timeLabel: "11:30", start: "2026-09-03T11:30:00-04:00", timezone: "America/New_York", title: "Faneuil Hall 與 North End", detail: "午餐從 North End 候補清單挑一間。", icon: "food", category: "food", priority: "recommended", durationMin: 110, coordinates: [42.3600, -71.0563], place: "Faneuil Hall", photo: photos.faneuil, outdoors: true, travelFromPrevious: travel("walk", "Freedom Trail 徒步繼續", 10, 10), rainAlternative: rain("sep03-market-rain", "Boston Public Market", "在室內市場吃午餐，再從 Haymarket 進 North End。", [42.3610, -71.0570], "Boston Public Market", photos.publicMarket) },
      { id: "sep03-old-north", timeLabel: "13:30", start: "2026-09-03T13:30:00-04:00", timezone: "America/New_York", title: "Paul Revere 與 Old North Church", detail: "離開前到 Hanover Street 買 cannoli。", icon: "landmark", category: "sight", priority: "recommended", durationMin: 80, coordinates: [42.3663, -71.0544], place: "Old North Church", photo: photos.oldNorth, outdoors: true, travelFromPrevious: travel("walk", "Faneuil Hall→Old North Church", 15, 10, "穿過 North End 街區"), rainAlternative: rain("sep03-old-north-rain", "Old North Church 室內參觀", "保留教堂與歷史展區，減少巷弄步行。", [42.3663, -71.0544], "Old North Church", photos.oldNorth) },
      { id: "sep03-uss", timeLabel: "15:00", start: "2026-09-03T15:00:00-04:00", timezone: "America/New_York", title: "USS Constitution", detail: "備妥附照片證件；體力不足可留在 North End。", icon: "ship", category: "sight", priority: "optional", durationMin: 100, coordinates: [42.3725, -71.0554], place: "USS Constitution", photo: photos.uss, outdoors: true, travelFromPrevious: travel("walk", "Old North Church→Navy Yard", 18, 12, "過 Charlestown Bridge"), rainAlternative: rain("sep03-uss-rain", "USS Constitution Museum", "改看船塢旁的室內博物館，依現場公告決定是否登艦。", [42.3737, -71.0551], "USS Constitution Museum", photos.uss) },
      { id: "sep03-apsa-event", timeLabel: "18:00", start: "2026-09-03T18:00:00-04:00", timezone: "America/New_York", title: "APSA 活動或回 Back Bay", detail: "依會議日程決定；沒有活動就回飯店附近晚餐。", icon: "talk", category: "conference", priority: "optional", durationMin: 120, coordinates: [42.3481, -71.0837], place: "Hynes Convention Center", fixed: true, travelFromPrevious: travel("transit", "Charlestown→Back Bay", 40, 30, "橘線轉 Green Line；由 North End 回程可再少 10 分") },
    ],
  },
  {
    id: "sep-04", date: "9/4", isoDate: "2026-09-04", weekday: "週五", location: "APSA / Fenway", title: "上午發表", note: "確切場次時間補上後，下一站倒數會自動接手。", color: "#a25875", kind: "apsa",
    activities: [
      { id: "sep04-prep", timeLabel: "T−90", timezone: "America/New_York", title: "發表準備", detail: "確認離線投影片、轉接器與會議室。", icon: "talk", category: "conference", priority: "essential", durationMin: 90, vague: true, fixed: true },
      { id: "sep04-talk", timeLabel: "上午", timezone: "America/New_York", title: "APSA 發表", detail: "確切時間未定；完成後可在下一站模式手動勾選。", icon: "talk", category: "conference", priority: "essential", durationMin: 90, coordinates: [42.3481, -71.0837], place: "Hynes Convention Center", vague: true, fixed: true, travelFromPrevious: travel("walk", "飯店→Hynes 會場", 8, 45, "發表前 45 分鐘到房間附近") },
      { id: "sep04-gardner", timeLabel: "14:30", start: "2026-09-04T14:30:00-04:00", timezone: "America/New_York", title: "Isabella Stewart Gardner Museum", detail: "預約定時票，停留約 2 小時。", icon: "landmark", category: "sight", priority: "essential", durationMin: 120, coordinates: [42.3389, -71.0990], place: "Isabella Stewart Gardner Museum", photo: photos.gardner, ticketed: true, fixed: true, officialUrl: "https://www.gardnermuseum.org/visit", officialLabel: "門票", travelFromPrevious: travel("transit", "Hynes→Gardner Museum", 25, 30, "步行或 Green Line E 線至 Museum of Fine Arts 站") },
      { id: "sep04-fens", timeLabel: "17:00", start: "2026-09-04T17:00:00-04:00", timezone: "America/New_York", title: "Back Bay Fens", detail: "沿 Fenway 綠地散步，再回 Back Bay。", icon: "walk", category: "sight", priority: "optional", durationMin: 60, coordinates: [42.3413, -71.0970], place: "Back Bay Fens", photo: photos.fens, outdoors: true, travelFromPrevious: travel("walk", "Gardner Museum→Fens", 8, 10), rainAlternative: rain("sep04-mfa-rain", "Museum of Fine Arts", "改到 MFA 看一個館區，避免在雨中走 Fens。", [42.3394, -71.0940], "Museum of Fine Arts Boston", photos.mfa) },
      { id: "sep04-dinner", timeLabel: "18:30", start: "2026-09-04T18:30:00-04:00", timezone: "America/New_York", title: "Fenway 晚餐", detail: "從 Fenway 候補清單選一間，訂位後再調整離館時間。", icon: "food", category: "food", priority: "recommended", durationMin: 90, coordinates: [42.3458, -71.1008], place: "Eastern Standard", travelFromPrevious: travel("walk", "Fens→Fenway 餐廳", 15, 20) },
    ],
  },
  {
    id: "sep-05", date: "9/5", isoDate: "2026-09-05", weekday: "週六", location: "Copley / APSA", title: "下午發表", note: "上午只排飯店步行圈，中午回房整理。", color: "#8a69ad", kind: "apsa",
    activities: [
      { id: "sep05-bpl", timeLabel: "09:15", start: "2026-09-05T09:15:00-04:00", timezone: "America/New_York", title: "Boston Public Library", detail: "Bates Hall、壁畫與庭院。", icon: "landmark", category: "sight", priority: "essential", durationMin: 90, coordinates: [42.3493, -71.0782], place: "Boston Public Library Central", photo: photos.bpl, travelFromPrevious: travel("walk", "飯店→Boston Public Library", 7, 10) },
      { id: "sep05-newbury", timeLabel: "11:00", start: "2026-09-05T11:00:00-04:00", timezone: "America/New_York", title: "Newbury Street", detail: "午餐吃輕一些，12:30 前回飯店。", icon: "shop", category: "shopping", priority: "optional", durationMin: 80, coordinates: [42.3503, -71.0810], place: "Newbury Street", photo: photos.newbury, outdoors: true, travelFromPrevious: travel("walk", "BPL→Newbury Street", 8, 10), rainAlternative: rain("sep05-pru-rain", "Prudential Center", "改走室內商場與 Eataly，從連通道回飯店。", [42.3472, -71.0825], "Prudential Center", photos.prudential) },
      { id: "sep05-prep", timeLabel: "T−90", timezone: "America/New_York", title: "回房整理", detail: "換裝、確認檔案，發表前 45 分鐘抵達會場。", icon: "talk", category: "conference", priority: "essential", durationMin: 90, vague: true, fixed: true },
      { id: "sep05-talk", timeLabel: "下午", timezone: "America/New_York", title: "APSA 發表", detail: "確切時間未定；結束後可在下一站模式手動勾選。", icon: "talk", category: "conference", priority: "essential", durationMin: 90, coordinates: [42.3481, -71.0837], place: "Hynes Convention Center", vague: true, fixed: true, travelFromPrevious: travel("walk", "飯店→Hynes 會場", 8, 45, "發表前 45 分鐘到房間附近") },
      { id: "sep05-dinner", timeLabel: "19:00", start: "2026-09-05T19:00:00-04:00", timezone: "America/New_York", title: "慶祝晚餐", detail: "Krasi 為首選，訂不到再看 Back Bay 候補。", icon: "trophy", category: "food", priority: "recommended", durationMin: 120, coordinates: [42.3494, -71.0826], place: "Krasi", travelFromPrevious: travel("walk", "Hynes→Back Bay 餐廳", 12, 20) },
    ],
  },
  {
    id: "sep-06", date: "9/6", isoDate: "2026-09-06", weekday: "週日", location: "Salem", title: "Salem 一日", note: "搭通勤鐵路，不必找停車位；導覽和 Witch House 擇一。", color: "#526f74", kind: "daytrip",
    activities: [
      { id: "sep06-train", timeLabel: "07:45", start: "2026-09-06T07:45:00-04:00", timezone: "America/New_York", title: "前往 North Station", detail: "Orange Line 轉 Newburyport／Rockport Line，出發前查當日時刻。", icon: "train", category: "transit", priority: "essential", durationMin: 100, coordinates: [42.3664, -71.0623], place: "North Station", fixed: true, travelFromPrevious: travel("transit", "Back Bay→North Station", 25, 25, "到站後轉 Newburyport／Rockport Line") },
      { id: "sep06-visitor", timeLabel: "09:30", start: "2026-09-06T09:30:00-04:00", timezone: "America/New_York", title: "Salem Visitor Center", detail: "先拿地圖，再走到 Peabody Essex Museum。", icon: "landmark", category: "sight", priority: "recommended", durationMin: 25, coordinates: [42.5229, -70.8955], place: "Salem Regional Visitor Center", photo: photos.salemVisitor, travelFromPrevious: travel("walk", "Salem 車站→Visitor Center", 10, 15) },
      { id: "sep06-pem", timeLabel: "10:00", start: "2026-09-06T10:00:00-04:00", timezone: "America/New_York", title: "Peabody Essex Museum", detail: "停留約 2 小時；雨天可把下午更多時間留在館內。", icon: "landmark", category: "sight", priority: "essential", durationMin: 120, coordinates: [42.5215, -70.8928], place: "Peabody Essex Museum", photo: photos.pem, fixed: true, officialUrl: "https://www.pem.org/visit", officialLabel: "參觀資訊", travelFromPrevious: travel("walk", "Visitor Center→PEM", 5, 10) },
      { id: "sep06-lunch", timeLabel: "12:30", start: "2026-09-06T12:30:00-04:00", timezone: "America/New_York", title: "Salem 午餐", detail: "從 Salem 候補清單選一間，週日先訂位。", icon: "food", category: "food", priority: "recommended", durationMin: 75, coordinates: [42.5205, -70.8917], place: "Downtown Salem", travelFromPrevious: travel("walk", "PEM→市中心餐廳", 6, 15) },
      { id: "sep06-memorial", timeLabel: "14:00", start: "2026-09-06T14:00:00-04:00", timezone: "America/New_York", title: "Witch Trials Memorial", detail: "接著在歷史步行導覽和 Witch House 之間擇一。", icon: "walk", category: "sight", priority: "recommended", durationMin: 90, coordinates: [42.5213, -70.8914], place: "Salem Witch Trials Memorial", photo: photos.witch, outdoors: true, travelFromPrevious: travel("walk", "午餐點→Witch Trials Memorial", 5, 10), rainAlternative: rain("sep06-history-rain", "Witch House 與 PEM 延長參觀", "把戶外導覽換成 Witch House，並把 PEM 停留延長一小時。", [42.5219, -70.8988], "The Witch House at Salem", photos.witchHouse) },
      { id: "sep06-gables", timeLabel: "16:00", start: "2026-09-06T16:00:00-04:00", timezone: "America/New_York", title: "Seven Gables 與 Derby Wharf", detail: "看完港口後依體力搭 17:30–18:30 的車回 Boston。", icon: "waves", category: "sight", priority: "optional", durationMin: 90, coordinates: [42.5209, -70.8865], place: "The House of the Seven Gables", photo: photos.gables, outdoors: true, travelFromPrevious: travel("walk", "Memorial→Seven Gables", 15, 15), rainAlternative: rain("sep06-gables-rain", "House of the Seven Gables 室內導覽", "保留室內導覽，取消 Derby Wharf 港邊步行。", [42.5209, -70.8865], "The House of the Seven Gables", photos.gables) },
    ],
  },
  {
    id: "sep-07", date: "9/7", isoDate: "2026-09-07", weekday: "週一", location: "Fenway", title: "Red Sox 比賽日", note: "球賽不會因雨天模式自動移除；只依 MLB 官方公告調整。", color: "#bd3d3a", kind: "daytrip",
    activities: [
      { id: "sep07-fens", timeLabel: "09:00", start: "2026-09-07T09:00:00-04:00", timezone: "America/New_York", title: "Emerald Necklace", detail: "Back Bay Fens 輕鬆散步，為下午球賽留體力。", icon: "walk", category: "sight", priority: "optional", durationMin: 60, coordinates: [42.3413, -71.0970], place: "Back Bay Fens", photo: photos.fens, outdoors: true, travelFromPrevious: travel("walk", "飯店→Back Bay Fens", 20, 10), rainAlternative: rain("sep07-mfa-rain", "Museum of Fine Arts", "取消晨間散步，改看 MFA 一個館區。", [42.3394, -71.0940], "Museum of Fine Arts Boston", photos.mfa) },
      { id: "sep07-brunch", timeLabel: "10:30", start: "2026-09-07T10:30:00-04:00", timezone: "America/New_York", title: "Fenway 早午餐", detail: "從 Fenway 候補清單挑一間，預留排隊時間。", icon: "coffee", category: "food", priority: "recommended", durationMin: 75, coordinates: [42.3447, -71.1005], place: "Fenway", travelFromPrevious: travel("walk", "Fens→Fenway 餐廳", 10, 15) },
      { id: "sep07-arrive", timeLabel: "12:15", start: "2026-09-07T12:15:00-04:00", timezone: "America/New_York", title: "提早抵達 Fenway Park", detail: "逛 Jersey Street 與球隊商店。", icon: "ticket", category: "sight", priority: "essential", durationMin: 70, coordinates: [42.3467, -71.0972], place: "Fenway Park", photo: photos.fenway, ticketed: true, fixed: true, travelFromPrevious: travel("walk", "早午餐→Fenway Park", 10, 30, "入場排隊時間已計入") },
      { id: "sep07-game", timeLabel: "13:35", start: "2026-09-07T13:35:00-04:00", timezone: "America/New_York", title: "Red Sox vs. Angels", detail: "購票後再以 MLB 官方賽程確認開賽時間；若官方延期，再改安排室內備案。", icon: "trophy", category: "sight", priority: "essential", durationMin: 210, coordinates: [42.3467, -71.0972], place: "Fenway Park", photo: photos.fenway, ticketed: true, fixed: true, outdoors: true, officialUrl: "https://www.mlb.com/redsox/tickets/single-game-tickets", officialLabel: "官方售票", travelFromPrevious: travel("indoor", "Jersey Street→座位", 10, 20) },
      { id: "sep07-dinner", timeLabel: "17:30", start: "2026-09-07T17:30:00-04:00", timezone: "America/New_York", title: "賽後晚餐", detail: "看實際散場時間，再從 Fenway 候補清單挑一間。", icon: "food", category: "food", priority: "recommended", durationMin: 90, coordinates: [42.3454, -71.0986], place: "Fenway", travelFromPrevious: travel("walk", "Fenway Park→晚餐", 10, 20, "散場人潮可能再加 10 分") },
    ],
  },
  {
    id: "sep-08", date: "9/8", isoDate: "2026-09-08", weekday: "週二", location: "Newport", title: "租車去 Newport", note: "The Breakers、Cliff Walk 和 Ocean Drive 排在同一圈。", color: "#2a8893", kind: "drive",
    activities: [
      { id: "sep08-car", timeLabel: "08:00", start: "2026-09-08T08:00:00-04:00", timezone: "America/New_York", title: "Back Bay 取車", detail: "100 Clarendon Street 一帶取車，拍照記錄車況後出發。", icon: "car", category: "transit", priority: "essential", durationMin: 120, coordinates: [42.3473, -71.0758], place: "100 Clarendon Street", fixed: true, travelFromPrevious: travel("walk", "飯店→Back Bay 取車點", 12, 30, "保留租車合約與驗車時間") },
      { id: "sep08-breakers", timeLabel: "10:00", start: "2026-09-08T10:00:00-04:00", timezone: "America/New_York", title: "The Breakers", detail: "預約定時票，語音導覽約 90 分鐘。", icon: "landmark", category: "sight", priority: "essential", durationMin: 100, coordinates: [41.4699, -71.2989], place: "The Breakers", photo: photos.breakers, ticketed: true, fixed: true, officialUrl: "https://www.newportmansions.org/plan-a-visit/", officialLabel: "門票", travelFromPrevious: travel("drive", "Back Bay→The Breakers", 90, 20, "不中途排景點，依當日車流微調") },
      { id: "sep08-cliff", timeLabel: "11:45", start: "2026-09-08T11:45:00-04:00", timezone: "America/New_York", title: "Cliff Walk 北段", detail: "從 Ruggles Avenue 走到 40 Steps；遇封閉依現場繞道。", icon: "walk", category: "sight", priority: "recommended", durationMin: 75, coordinates: [41.4740, -71.2980], place: "Cliff Walk 40 Steps", photo: photos.cliff, outdoors: true, travelFromPrevious: travel("walk", "The Breakers→Cliff Walk", 8, 10), rainAlternative: rain("sep08-marble-rain", "Marble House", "把海岸步道換成另一座鍍金年代宅邸。", [41.4620, -71.3051], "Marble House", photos.marbleHouse) },
      { id: "sep08-lunch", timeLabel: "13:15", start: "2026-09-08T13:15:00-04:00", timezone: "America/New_York", title: "Newport 午餐", detail: "從 Newport 候補清單選一間，接著逛 Bowen’s Wharf。", icon: "food", category: "food", priority: "recommended", durationMin: 100, coordinates: [41.4862, -71.3155], place: "Bowen's Wharf", travelFromPrevious: travel("drive", "Cliff Walk→Bowen's Wharf", 12, 20, "停車後步行進碼頭") },
      { id: "sep08-ocean", timeLabel: "16:00", start: "2026-09-08T16:00:00-04:00", timezone: "America/New_York", title: "Ocean Drive", detail: "沿海岸開車，在 Brenton Point 短停後回 Boston。", icon: "car", category: "sight", priority: "optional", durationMin: 75, coordinates: [41.4497, -71.3420], place: "Brenton Point State Park", photo: photos.ocean, outdoors: true, travelFromPrevious: travel("drive", "Bowen's Wharf→Ocean Drive", 15, 15), rainAlternative: rain("sep08-art-rain", "Newport Art Museum", "取消 Ocean Drive 停留，改看 Newport Art Museum。", [41.4885, -71.3089], "Newport Art Museum", photos.newportArt) },
      { id: "sep08-return", timeLabel: "17:15", start: "2026-09-08T17:15:00-04:00", timezone: "America/New_York", title: "回 Boston", detail: "避開疲勞駕駛，晚餐回 Copley 再吃。", icon: "car", category: "transit", priority: "essential", durationMin: 130, coordinates: [42.3473, -71.0758], place: "Back Bay", fixed: true, travelFromPrevious: travel("drive", "Newport→Back Bay", 95, 30, "回程預留車流與休息時間") },
    ],
  },
  {
    id: "sep-09", date: "9/9", isoDate: "2026-09-09", weekday: "週三", location: "Boston Landing / Concord", title: "New Balance 與 Concord", note: "上午看總部建築外觀與旗艦店；辦公區沒有一般觀光導覽。", color: "#47775e", kind: "drive",
    activities: [
      { id: "sep09-nb", timeLabel: "09:00", start: "2026-09-09T09:00:00-04:00", timezone: "America/New_York", title: "New Balance 世界總部與旗艦店", detail: "拍攝總部外觀，在 Boston Landing 旗艦店購物；不進入辦公區。", icon: "store", category: "shopping", priority: "essential", durationMin: 75, coordinates: [42.3571, -71.1445], place: "New Balance World Headquarters", photo: photos.newBalance, officialUrl: "https://www.newbalance.com/stores/", officialLabel: "門市資訊", travelFromPrevious: travel("drive", "Back Bay→Boston Landing", 20, 15, "先停公開停車場，再步行到總部外圍") },
      { id: "sep09-lexington", timeLabel: "10:45", start: "2026-09-09T10:45:00-04:00", timezone: "America/New_York", title: "Lexington Battle Green", detail: "短停看 Battle Green，再沿 MA-2A 前往 Concord。", icon: "landmark", category: "sight", priority: "recommended", durationMin: 55, coordinates: [42.4494, -71.2306], place: "Lexington Battle Green", photo: photos.lexington, outdoors: true, travelFromPrevious: travel("drive", "Boston Landing→Lexington", 25, 15), rainAlternative: rain("sep09-concord-museum-rain", "Concord Museum", "取消 Battle Green 戶外停留，直接到 Concord Museum。", [42.4570, -71.3421], "Concord Museum", photos.concordMuseum) },
      { id: "sep09-concord-lunch", timeLabel: "12:15", start: "2026-09-09T12:15:00-04:00", timezone: "America/New_York", title: "Concord 午餐", detail: "從 Concord 候補清單挑一間。", icon: "food", category: "food", priority: "recommended", durationMin: 75, coordinates: [42.4604, -71.3489], place: "Concord Center", travelFromPrevious: travel("drive", "Lexington→Concord Center", 20, 15) },
      { id: "sep09-bridge", timeLabel: "14:00", start: "2026-09-09T14:00:00-04:00", timezone: "America/New_York", title: "Old North Bridge", detail: "走到橋邊與 Minute Man Visitor Center 周邊。", icon: "walk", category: "sight", priority: "essential", durationMin: 90, coordinates: [42.4692, -71.3507], place: "Old North Bridge", photo: photos.bridge, outdoors: true, travelFromPrevious: travel("drive", "Concord Center→Old North Bridge", 10, 15), rainAlternative: rain("sep09-orchard-rain", "Orchard House", "改看 Louisa May Alcott’s Orchard House 室內導覽。", [42.4597, -71.3347], "Louisa May Alcott's Orchard House", photos.orchardHouse) },
      { id: "sep09-walden", timeLabel: "16:00", start: "2026-09-09T16:00:00-04:00", timezone: "America/New_York", title: "Walden Pond", detail: "湖邊短走；若太累就提前回 Boston 還車。", icon: "waves", category: "sight", priority: "optional", durationMin: 70, coordinates: [42.4388, -71.3420], place: "Walden Pond State Reservation", photo: photos.walden, outdoors: true, travelFromPrevious: travel("drive", "Old North Bridge→Walden Pond", 15, 15), rainAlternative: rain("sep09-museum-rain-2", "Concord Museum 延長參觀", "把 Walden Pond 改成完整看完 Concord Museum 的常設展。", [42.4570, -71.3421], "Concord Museum", photos.concordMuseum) },
      { id: "sep09-return", timeLabel: "17:30", start: "2026-09-09T17:30:00-04:00", timezone: "America/New_York", title: "回 Back Bay 還車", detail: "加滿油、保留收據，檢查座位與後車廂。", icon: "car", category: "transit", priority: "essential", durationMin: 90, coordinates: [42.3473, -71.0758], place: "Back Bay", fixed: true, travelFromPrevious: travel("drive", "Concord→Back Bay", 40, 30, "先加滿油再還車") },
    ],
  },
  {
    id: "sep-10", date: "9/10", isoDate: "2026-09-10", weekday: "週四", location: "Boston → SEA", title: "最後半天與返程", note: "退房後留在 Back Bay，16:30 左右出發去機場。", color: "#5969a9", kind: "return",
    activities: [
      { id: "sep10-checkout", timeLabel: "10:00", start: "2026-09-10T10:00:00-04:00", timezone: "America/New_York", title: "退房寄放行李", detail: "核對帳單，把登機用品移到隨身行李。", icon: "hotel", category: "stay", priority: "essential", durationMin: 30, coordinates: [42.3472, -71.0797], place: "Boston Marriott Copley Place", fixed: true },
      { id: "sep10-last", timeLabel: "10:45", start: "2026-09-10T10:45:00-04:00", timezone: "America/New_York", title: "最後半天", detail: "依體力選 Newbury Street、Boston Public Garden 或 View Boston。", icon: "camera", category: "sight", priority: "recommended", durationMin: 180, coordinates: [42.3519, -71.0704], place: "Boston Public Garden", photo: photos.skyline, outdoors: true, travelFromPrevious: travel("walk", "飯店→Back Bay 景點", 10, 15), rainAlternative: rain("sep10-rain", "Boston Public Library 與 Prudential Center", "在 BPL、Prudential 與 Eataly 之間安排室內半日。", [42.3493, -71.0782], "Boston Public Library", photos.bpl) },
      { id: "sep10-lunch", timeLabel: "13:00", start: "2026-09-10T13:00:00-04:00", timezone: "America/New_York", title: "返程前午餐", detail: "從返程日候補挑一間，不安排需要久候的店。", icon: "food", category: "food", priority: "recommended", durationMin: 70, coordinates: [42.3475, -71.0825], place: "Prudential Center", travelFromPrevious: travel("walk", "最後一站→Prudential", 15, 20) },
      { id: "sep10-airport", timeLabel: "16:30", start: "2026-09-10T16:30:00-04:00", timezone: "America/New_York", title: "前往 Logan Airport", detail: "領行李後搭 Logan Express Back Bay；至少提前 3 小時到機場。", icon: "bus", category: "transit", priority: "essential", durationMin: 90, coordinates: [42.3656, -71.0096], place: "Boston Logan International Airport", fixed: true, travelFromPrevious: travel("transit", "Back Bay→Logan Airport", 50, 60, "先回飯店領行李，再搭 Logan Express") },
      { id: "sep10-depart", timeLabel: "20:00", start: "2026-09-10T20:00:00-04:00", timezone: "America/New_York", title: "BOS → SEA", detail: "抵達 SEA 約 23:12，依轉機指標前往下一段登機門。", icon: "plane", category: "flight", priority: "essential", durationMin: 372, coordinates: [42.3656, -71.0096], place: "Boston Logan International Airport", fixed: true, travelFromPrevious: travel("indoor", "報到、托運與安檢", 45, 135, "17:00 前進航廈比較從容") },
      { id: "sep11-depart", timeLabel: "9/11 02:00", start: "2026-09-11T02:00:00-07:00", timezone: "America/Los_Angeles", title: "SEA → TPE", detail: "在 SEA 轉機約 2 小時 48 分。", icon: "plane", category: "flight", priority: "essential", durationMin: 780, coordinates: [47.4502, -122.3088], place: "Seattle–Tacoma International Airport", fixed: true, travelFromPrevious: travel("indoor", "SEA 國內線→國際線登機門", 20, 120, "不排出機場的活動") },
      { id: "sep12-arrive", timeLabel: "9/12 05:00", start: "2026-09-12T05:00:00+08:00", timezone: "Asia/Taipei", title: "抵達台灣", detail: "通過入境與領行李後返家。", icon: "luggage", category: "flight", priority: "essential", durationMin: 0, coordinates: [25.0797, 121.2342], place: "桃園國際機場", fixed: true },
    ],
  },
];

export const restaurantGroups: RestaurantGroup[] = [
  {
    id: "back-bay", title: "Back Bay／Copley", dayIds: ["sep-02", "sep-05"],
    restaurants: [
      { id: "atlantic-fish", name: "Atlantic Fish Company", area: "Back Bay", cuisine: "New England 海鮮", price: "$$$", reason: "離飯店近，抵達日不用再拉長動線。", address: "761 Boylston St, Boston", officialUrl: "https://www.atlanticfish.com/", reservationUrl: "https://www.atlanticfish.com/reservations/", reservationLabel: "訂位" },
      { id: "krasi", name: "Krasi", area: "Back Bay", cuisine: "希臘料理與葡萄酒", price: "$$$", reason: "適合發表後的慶祝晚餐。", address: "48 Gloucester St, Boston", officialUrl: "https://www.krasi-boston.com/", reservationUrl: "https://www.krasi-boston.com/reservations", reservationLabel: "訂位" },
      { id: "eataly", name: "Eataly Boston", area: "Prudential", cuisine: "義大利料理", price: "$$", reason: "與飯店室內相連，時差或雨天最好調整。", address: "800 Boylston St, Boston", officialUrl: "https://www.eataly.com/us_en/stores/boston", reservationLabel: "餐廳資訊" },
    ],
  },
  {
    id: "north-end", title: "North End", dayIds: ["sep-03"],
    restaurants: [
      { id: "neptune", name: "Neptune Oyster", area: "North End", cuisine: "生蠔與龍蝦捲", price: "$$$", reason: "經典海鮮；官方標示只收現場候位。", address: "63 Salem St, Boston", officialUrl: "https://www.neptuneoyster.com/", reservationLabel: "官方資訊" },
      { id: "regina", name: "Regina Pizzeria", area: "North End", cuisine: "磚窯披薩", price: "$$", reason: "不用把午餐時間綁在長桌菜上。", address: "11 1/2 Thacher St, Boston", officialUrl: "https://www.reginapizzeria.com/north_end.html", reservationLabel: "官方資訊" },
      { id: "carmelinas", name: "Carmelina’s", area: "North End", cuisine: "Sicilian comfort food", price: "$$$", reason: "想坐下吃完整午餐時的選項。", address: "307 Hanover St, Boston", officialUrl: "https://www.carmelinasboston.com/", reservationLabel: "訂位資訊" },
    ],
  },
  {
    id: "fenway", title: "Fenway", dayIds: ["sep-04", "sep-07"],
    restaurants: [
      { id: "eastern-standard", name: "Eastern Standard", area: "Fenway", cuisine: "美式餐館", price: "$$$", reason: "Gardner 或球賽後都順路。", address: "775 Beacon St, Boston", officialUrl: "https://www.easternstandardboston.com/", reservationLabel: "訂位資訊" },
      { id: "eventide", name: "Eventide Fenway", area: "Fenway", cuisine: "海鮮與龍蝦捲", price: "$$", reason: "出餐節奏較適合球賽前後。", address: "1321 Boylston St, Boston", officialUrl: "https://www.eventideoysterco.com/eventide-fenway", reservationLabel: "官方資訊" },
      { id: "timeout", name: "Time Out Market Boston", area: "Fenway", cuisine: "多店美食市場", price: "$$", reason: "同行者想吃不同料理時最好用。", address: "401 Park Dr, Boston", officialUrl: "https://www.timeoutmarket.com/boston/", reservationLabel: "店家名單" },
    ],
  },
  {
    id: "salem", title: "Salem", dayIds: ["sep-06"],
    restaurants: [
      { id: "turners", name: "Turner’s Seafood", area: "Downtown Salem", cuisine: "New England 海鮮", price: "$$$", reason: "在 PEM 與午後景點之間。", address: "43 Church St, Salem", officialUrl: "https://www.turners-seafood.com/locations/salem/", reservationLabel: "訂位資訊" },
      { id: "ledger", name: "Ledger", area: "Downtown Salem", cuisine: "New American", price: "$$$", reason: "適合週日先訂好一桌。", address: "125 Washington St, Salem", officialUrl: "https://www.ledgersalem.com/", reservationLabel: "訂位資訊" },
      { id: "bambolina", name: "Bambolina", area: "Downtown Salem", cuisine: "窯烤披薩", price: "$$", reason: "時間被博物館壓縮時比較好控制。", address: "288 Derby St, Salem", officialUrl: "https://bambolinarestaurant.com/", reservationLabel: "官方資訊" },
    ],
  },
  {
    id: "newport", title: "Newport", dayIds: ["sep-08"],
    restaurants: [
      { id: "mooring", name: "The Mooring", area: "Sayer’s Wharf", cuisine: "海鮮", price: "$$$", reason: "吃完可直接逛 Bowen’s Wharf。", address: "1 Sayer’s Wharf, Newport", officialUrl: "https://www.mooringrestaurant.com/", reservationLabel: "訂位資訊" },
      { id: "midtown", name: "Midtown Oyster Bar", area: "Thames Street", cuisine: "生蠔與海鮮", price: "$$$", reason: "離港邊近，菜色選擇多。", address: "345 Thames St, Newport", officialUrl: "https://www.midtownoyster.com/", reservationLabel: "訂位資訊" },
      { id: "pasta-beach", name: "Pasta Beach", area: "Bellevue Avenue", cuisine: "義大利料理", price: "$$", reason: "不想連續吃海鮮時的替代。", address: "7 Memorial Blvd, Newport", officialUrl: "https://www.pastabeach.com/newport", reservationLabel: "訂位資訊" },
    ],
  },
  {
    id: "concord", title: "Concord", dayIds: ["sep-09"],
    restaurants: [
      { id: "main-streets", name: "Main Streets Market & Cafe", area: "Concord Center", cuisine: "美式早午餐", price: "$$", reason: "就在市中心，週三午餐時段有營業。", address: "42 Main St, Concord", officialUrl: "https://mainstreetsmarketcafe.com/", reservationLabel: "官方資訊" },
      { id: "saltbox", name: "Saltbox Kitchen", area: "West Concord", cuisine: "農場直送午餐", price: "$$", reason: "白天動線彈性高，份量容易控制。", address: "84 Commonwealth Ave, Concord", officialUrl: "https://www.saltboxkitchen.com/", reservationLabel: "官方資訊" },
      { id: "colonial-inn", name: "Concord’s Colonial Inn", area: "Concord Center", cuisine: "New England 美式", price: "$$", reason: "就在市中心，吃完可直接走歷史街區。", address: "48 Monument Sq, Concord", officialUrl: "https://www.concordscolonialinn.com/dining/", reservationLabel: "訂位資訊" },
    ],
  },
  {
    id: "return", title: "返程日", dayIds: ["sep-10"],
    restaurants: [
      { id: "flour", name: "Flour Bakery + Cafe", area: "Back Bay", cuisine: "三明治與烘焙", price: "$", reason: "出餐快，適合要抓機場時間的午餐。", address: "131 Clarendon St, Boston", officialUrl: "https://www.flourbakery.com/locations", reservationLabel: "門市資訊" },
      { id: "tatte", name: "Tatte Bakery & Cafe", area: "Back Bay", cuisine: "咖啡與地中海輕食", price: "$$", reason: "容易控制用餐時間，也能外帶。", address: "399 Boylston St, Boston", officialUrl: "https://tattebakery.com/locations/", reservationLabel: "門市資訊" },
      { id: "eataly-return", name: "Eataly Boston", area: "Prudential", cuisine: "義大利料理", price: "$$", reason: "與飯店相連，下雨或拖行李都方便。", address: "800 Boylston St, Boston", officialUrl: "https://www.eataly.com/us_en/stores/boston", reservationLabel: "餐廳資訊" },
    ],
  },
];

export const categoryLabels: Record<ActivityCategory, string> = {
  flight: "航班",
  transit: "交通",
  stay: "住宿",
  conference: "APSA",
  sight: "景點",
  food: "餐飲",
  shopping: "購物",
};

export const tripStart = "2026-09-01T20:00:00+08:00";
export const tripEnd = "2026-09-12T05:00:00+08:00";
