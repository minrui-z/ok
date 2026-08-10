"use client";

import {
  BadgeInfo,
  BookOpen,
  BusFront,
  CalendarDays,
  Camera,
  Car,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock3,
  Coffee,
  Copy,
  ExternalLink,
  Footprints,
  Globe2,
  Hotel,
  Landmark,
  Link as LinkIcon,
  ListChecks,
  Luggage,
  Menu,
  Moon,
  Navigation,
  Plane,
  Presentation,
  Route,
  ShieldCheck,
  Ship,
  ShoppingBag,
  Store,
  Sun,
  Ticket,
  TrainFront,
  Trophy,
  Utensils,
  WalletCards,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type IconKey =
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

type Activity = {
  time: string;
  title: string;
  detail: string;
  icon: IconKey;
  photo?: PlacePhoto;
  map?: string;
  link?: string;
  linkLabel?: string;
};

type PlacePhoto = {
  src: string;
  alt: string;
  credit: string;
  source: string;
};

type Day = {
  id: string;
  date: string;
  weekday: string;
  location: string;
  title: string;
  note: string;
  kind: "flight" | "city" | "apsa" | "daytrip" | "drive" | "return";
  activities: Activity[];
};

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

const mapUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const photos = {
  bpl: {
    src: "/places/bpl.jpg",
    alt: "Copley Square 旁的 Boston Public Library 外觀",
    credit: "Boston Starbucks Rebel／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Boston_Public_Library,_Copley_Square.jpg",
  },
  freedom: {
    src: "/places/freedom.jpg",
    alt: "Boston Freedom Trail 的紅磚路線",
    credit: "Yaron1m／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Boston_Freedom_Trail.jpg",
  },
  faneuil: {
    src: "/places/faneuil.jpg",
    alt: "Boston 的 Faneuil Hall 外觀",
    credit: "Kgriff2002／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Faneuil_Hall_Boston.jpg",
  },
  oldNorth: {
    src: "/places/old-north.jpg",
    alt: "Boston Old North Church 的歷史照片",
    credit: "Boston Public Library／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Old_North_Church_-_DPLA_-_098d9291dab42143f93a2ee445536945.jpg",
  },
  uss: {
    src: "/places/uss-constitution.jpg",
    alt: "停泊在 Charlestown Navy Yard 的 USS Constitution",
    credit: "National Park Service／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:The_USS_CONSTITUTION_docked_at_the_Charlestown_Navy_Yard_with_the_Bunker_Hill_Monument_behind_it._(887e98c5-c5d7-468d-803b-8bd0c1680284).jpg",
  },
  gardner: {
    src: "/places/gardner.jpg",
    alt: "Isabella Stewart Gardner Museum 的建築外觀",
    credit: "Biruitorul／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:ISGardnerMuseum.JPG",
  },
  fens: {
    src: "/places/back-bay-fens.jpg",
    alt: "Back Bay Fens 的水岸與樹林",
    credit: "Marc Choquette／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Back_Bay_Fens_(4204380847).jpg",
  },
  fenway: {
    src: "/places/fenway.jpg",
    alt: "Boston Fenway Park 球場",
    credit: "RoastedGarlic2018／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Fenway_Park,_Boston_MA.jpg",
  },
  newbury: {
    src: "/places/newbury.jpg",
    alt: "Boston Newbury Street 街景",
    credit: "Sharon Hahn Darlin／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Newbury_Street,_Boston,_Massachusetts_March_2020_-_11.jpg",
  },
  pem: {
    src: "/places/pem.jpg",
    alt: "Salem Peabody Essex Museum 的 Essex Street 外觀",
    credit: "David Adam Kess／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:PEM_Salem,_exterior_Essex_Street,_exterior._The_Peabody_Essex_Museum_in_Salem,_Massachusetts.jpg",
  },
  witchMemorial: {
    src: "/places/witch-memorial.jpg",
    alt: "Salem Witch Trials Memorial 的石造紀念座椅",
    credit: "Magicpiano／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:SalemMA_WitchTrialMemorial.jpg",
  },
  sevenGables: {
    src: "/places/seven-gables.jpg",
    alt: "Salem House of the Seven Gables 與周邊建築",
    credit: "Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:HouseOfSevenGables.jpg",
  },
  derbyWharf: {
    src: "/places/derby-wharf.jpg",
    alt: "Salem Derby Wharf 港邊景色",
    credit: "Robert Linsdell／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Derby_Wharf,_Salem_(493794)_(11319601414).jpg",
  },
  breakers: {
    src: "/places/breakers.jpg",
    alt: "Newport The Breakers 豪宅正面",
    credit: "Wikimedia Commons／Public domain",
    source: "https://commons.wikimedia.org/wiki/File:The_Breakers,_Newport,_Rhode_Island.jpg",
  },
  cliffWalk: {
    src: "/places/cliff-walk.jpg",
    alt: "Newport Cliff Walk 海岸步道",
    credit: "OldPine／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Newport_RI_Cliff_Walk.jpg",
  },
  oceanDrive: {
    src: "/places/ocean-drive.jpg",
    alt: "Newport Ocean Drive 的海岸景色",
    credit: "VitaleBaby／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Newport_Ocean_Drive.jpg",
  },
  newBalance: {
    src: "/places/new-balance-hq.jpg",
    alt: "Boston Landing 的 New Balance 世界總部大樓",
    credit: "NB Development Group",
    source: "https://nbdevelopment.com/portfolio-item/new-balance-athletics-inc-world-headquarters-building/",
  },
  lexington: {
    src: "/places/lexington.jpg",
    alt: "Lexington Battle Green 的草地與紀念碑",
    credit: "John Phelan／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Lexington_Battle_Green,_Lexington_MA.jpg",
  },
  oldNorthBridge: {
    src: "/places/old-north-bridge.jpg",
    alt: "Concord Old North Bridge 跨越河面的木橋",
    credit: "Historical Perspective／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Concord_Old_North_Bridge.JPG",
  },
  walden: {
    src: "/places/walden.jpg",
    alt: "秋天的 Walden Pond 湖面與樹林",
    credit: "John Phelan／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Walden_Pond_in_October,_Concord_MA.jpg",
  },
  skyline: {
    src: "/places/boston-skyline.jpg",
    alt: "從 Prudential Tower 俯瞰 Boston 市區",
    credit: "WonderWhy／Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Boston_skyline_from_the_Prudential_Tower.JPG",
  },
} satisfies Record<string, PlacePhoto>;

const days: Day[] = [
  {
    id: "sep-01",
    date: "9/1",
    weekday: "週二",
    location: "TPE → SEA",
    title: "越過換日線",
    note: "七小時留在 SEA：入境、重新托運、安檢、晚餐。",
    kind: "flight",
    activities: [
      {
        time: "20:00",
        title: "台灣出發",
        detail: "起飛前把 ESTA、飯店與 APSA 文件存成離線版本。",
        icon: "plane",
      },
      {
        time: "16:10",
        title: "抵達 Seattle",
        detail: "完成入境、領取／重新托運行李與安檢，預留 2–3 小時。",
        icon: "luggage",
        map: mapUrl("Seattle-Tacoma International Airport"),
      },
      {
        time: "18:30",
        title: "機場晚餐",
        detail: "Beecher’s、Floret 或 Salty’s at the SEA；晚餐後在航廈休息。",
        icon: "food",
      },
      {
        time: "23:00",
        title: "SEA → BOS",
        detail: "21:30 前回到登機門，保留航廈移動緩衝。",
        icon: "plane",
      },
    ],
  },
  {
    id: "sep-02",
    date: "9/2",
    weekday: "週三",
    location: "Back Bay",
    title: "抵達、報到，下午補眠",
    note: "第一天只走飯店周邊，下午保留完整休息。",
    kind: "city",
    activities: [
      {
        time: "07:40",
        title: "抵達 Boston Logan",
        detail: "領行李後搭 Logan Express Back Bay 前往 Prudential。",
        icon: "plane",
        map: mapUrl("Boston Logan International Airport"),
      },
      {
        time: "09:30",
        title: "飯店寄放行李",
        detail: "Boston Marriott Copley Place，110 Huntington Ave。",
        icon: "hotel",
        map: mapUrl("Boston Marriott Copley Place"),
      },
      {
        time: "10:00",
        title: "APSA 報到",
        detail: "到 Hynes 領證並確認 9/4、9/5 的房間與樓層。",
        icon: "talk",
        map: mapUrl("Hynes Convention Center Boston"),
      },
      {
        time: "11:00",
        title: "Flour／Tatte 早午餐",
        detail: "接著散步 Copley Square、Trinity Church、BPL 與 Newbury Street。",
        photo: photos.bpl,
        icon: "food",
      },
      {
        time: "16:00",
        title: "入住與補眠",
        detail: "洗澡後小睡 60–90 分鐘，19:00 起床吃飯。",
        icon: "hotel",
      },
      {
        time: "19:00",
        title: "Atlantic Fish 晚餐",
        detail: "第一餐點蛤蜊濃湯、龍蝦捲或當日鮮魚，之後早睡。",
        icon: "food",
        map: mapUrl("Atlantic Fish Company Boston"),
      },
    ],
  },
  {
    id: "sep-03",
    date: "9/3",
    weekday: "週四",
    location: "Historic Boston",
    title: "Freedom Trail 全日步行",
    note: "從 Boston Common 一路往北走到 Charlestown。",
    kind: "city",
    activities: [
      {
        time: "09:00",
        title: "Boston Common 起走",
        detail: "State House、Granary、Old South、Old State House。",
        photo: photos.freedom,
        icon: "walk",
        map: mapUrl("Boston Common Visitor Information Center"),
      },
      {
        time: "11:30",
        title: "Faneuil Hall 與 North End",
        detail: "Neptune Oyster 排隊少於 45 分鐘就吃；排太久改 Regina Pizzeria。",
        photo: photos.faneuil,
        icon: "food",
        map: mapUrl("Neptune Oyster Boston"),
      },
      {
        time: "13:30",
        title: "Paul Revere 與 Old North Church",
        detail: "離開前到 Modern Pastry 買 cannoli。",
        photo: photos.oldNorth,
        icon: "landmark",
      },
      {
        time: "15:00",
        title: "USS Constitution",
        detail: "備妥附照片證件；15:00 視體力前往 USS Constitution，或留在 North End。",
        photo: photos.uss,
        icon: "ship",
        map: mapUrl("USS Constitution Boston"),
      },
      {
        time: "18:00",
        title: "APSA 國際與會者活動",
        detail: "參加 APSA 活動，或回 Prudential 到 Legal Sea Foods、Eataly 吃晚餐。",
        icon: "talk",
      },
    ],
  },
  {
    id: "sep-04",
    date: "9/4",
    weekday: "週五",
    location: "APSA / Fenway",
    title: "上午發表，午後看藝術",
    note: "發表前 90 分鐘留給準備，提前 45 分鐘抵達會場。",
    kind: "apsa",
    activities: [
      {
        time: "T−90",
        title: "發表準備",
        detail: "確認離線投影片、HDMI／USB-C 轉接器與會議室。",
        icon: "talk",
      },
      {
        time: "上午",
        title: "APSA 發表",
        detail: "發表後先回房放資料，午餐選 Santouka、Flour 或 Eataly。",
        icon: "talk",
      },
      {
        time: "14:30",
        title: "Gardner Museum",
        detail: "預約定時票，停留約 2 小時；週五 17:00 閉館。",
        photo: photos.gardner,
        icon: "landmark",
        map: mapUrl("Isabella Stewart Gardner Museum"),
        link: "https://www.gardnermuseum.org/visit/hours",
        linkLabel: "預約門票",
      },
      {
        time: "17:00",
        title: "Back Bay Fens",
        detail: "沿 Fenway 綠地慢慢走回 Back Bay。",
        photo: photos.fens,
        icon: "walk",
      },
      {
        time: "18:30",
        title: "Eastern Standard 晚餐",
        detail: "Eastern Standard 先訂位；晚餐後回飯店休息。",
        icon: "food",
        map: mapUrl("Eastern Standard Boston"),
      },
    ],
  },
  {
    id: "sep-05",
    date: "9/5",
    weekday: "週六",
    location: "Copley / APSA",
    title: "圖書館晨間，午後發表",
    note: "上午只安排飯店步行圈，保留午休與整理時間。",
    kind: "apsa",
    activities: [
      {
        time: "09:15",
        title: "Boston Public Library",
        detail: "Bates Hall、壁畫、庭院與 2026 年特展。",
        photo: photos.bpl,
        icon: "landmark",
        map: mapUrl("Boston Public Library Central"),
      },
      {
        time: "11:00",
        title: "Newbury Street 短逛",
        detail: "午餐選 GRECO、NAYA 或 Eataly，份量抓輕一些。",
        photo: photos.newbury,
        icon: "shop",
      },
      {
        time: "T−90",
        title: "回房整理",
        detail: "換裝、確認檔案，發表前 45 分鐘抵達會場。",
        icon: "talk",
      },
      {
        time: "下午",
        title: "APSA 發表",
        detail: "發表完先回房休息，晚一點再去餐廳。",
        icon: "talk",
      },
      {
        time: "19:00",
        title: "Krasi 慶祝晚餐",
        detail: "首選 Krasi；備案 Atlantic Fish、Porto 或 Legal Sea Foods。",
        icon: "trophy",
        map: mapUrl("Krasi Boston"),
      },
    ],
  },
  {
    id: "sep-06",
    date: "9/6",
    weekday: "週日",
    location: "Salem",
    title: "巫術史、博物館與港口",
    note: "搭火車比開車輕鬆；導覽與 Witch House 只選一項。",
    kind: "daytrip",
    activities: [
      {
        time: "07:45",
        title: "Back Bay → North Station",
        detail: "Orange Line 轉 Newburyport／Rockport Line，車程約 30 分鐘。",
        icon: "train",
      },
      {
        time: "09:30",
        title: "Salem Visitor Center",
        detail: "先拿地圖，再走到 Peabody Essex Museum。",
        icon: "landmark",
        map: mapUrl("Salem Regional Visitor Center"),
      },
      {
        time: "10:00",
        title: "Peabody Essex Museum",
        detail: "停留約 2 小時；雨天可延長館內時間。",
        photo: photos.pem,
        icon: "landmark",
        map: mapUrl("Peabody Essex Museum"),
      },
      {
        time: "12:30",
        title: "Turner’s／Ledger 午餐",
        detail: "週日建議訂位，海鮮餐控制在 75 分鐘內。",
        icon: "food",
      },
      {
        time: "14:00",
        title: "Witch Trials Memorial",
        detail: "下午在歷史步行導覽和 Witch House 之間擇一。",
        photo: photos.witchMemorial,
        icon: "walk",
      },
      {
        time: "16:00",
        title: "Seven Gables 與 Derby Wharf",
        detail: "看完港口後依體力搭 17:30–18:30 的車回 Boston。",
        photo: photos.sevenGables,
        icon: "waves",
        map: mapUrl("The House of the Seven Gables"),
      },
    ],
  },
  {
    id: "sep-07",
    date: "9/7",
    weekday: "週一",
    location: "Fenway",
    title: "Labor Day 紅襪日",
    note: "上午留在 Fenway 周邊散步，下午看球。",
    kind: "daytrip",
    activities: [
      {
        time: "09:00",
        title: "Emerald Necklace",
        detail: "Back Bay Fens 輕鬆散步，為下午球賽留體力。",
        photo: photos.fens,
        icon: "walk",
      },
      {
        time: "10:30",
        title: "Fenway 早午餐",
        detail: "Time Out Market 或附近咖啡店，預留排隊時間。",
        icon: "coffee",
      },
      {
        time: "12:15",
        title: "提早抵達 Fenway Park",
        detail: "逛 Jersey Street 與球隊商店，球場內可吃 Fenway Frank。",
        photo: photos.fenway,
        icon: "ticket",
        map: mapUrl("Fenway Park"),
      },
      {
        time: "13:35",
        title: "Red Sox vs. Angels",
        detail: "購票後重新確認開賽時間與入場規定。",
        photo: photos.fenway,
        icon: "trophy",
        link: "https://www.mlb.com/redsox/tickets/single-game-tickets",
        linkLabel: "官方售票",
      },
      {
        time: "17:00",
        title: "Eventide／Row 34",
        detail: "賽後吃龍蝦捲或生蠔；有精神再去 Esplanade 看夕陽。",
        icon: "food",
      },
    ],
  },
  {
    id: "sep-08",
    date: "9/8",
    weekday: "週二",
    location: "Newport",
    title: "租車一：鍍金年代與海岸線",
    note: "The Breakers、Cliff Walk 和 Ocean Drive 都在同一區，這天開車最省事。",
    kind: "drive",
    activities: [
      {
        time: "08:00",
        title: "Back Bay 取車",
        detail: "100 Clarendon Street 一帶取車，拍照記錄車況後出發。",
        icon: "car",
        map: mapUrl("100 Clarendon Street Boston"),
      },
      {
        time: "10:00",
        title: "The Breakers",
        detail: "預約定時票，語音導覽約 90 分鐘；後方露台 2026 年整修。",
        photo: photos.breakers,
        icon: "landmark",
        map: mapUrl("The Breakers Newport Rhode Island"),
        link: "https://www.newportmansions.org/plan-a-visit/",
        linkLabel: "預約門票",
      },
      {
        time: "11:45",
        title: "Cliff Walk 北段",
        detail: "走 Ruggles Avenue 至 40 Steps；遇封閉路段依現場繞道。",
        photo: photos.cliffWalk,
        icon: "walk",
        map: mapUrl("Cliff Walk 40 Steps Newport"),
      },
      {
        time: "13:15",
        title: "Newport 海鮮午餐",
        detail: "The Mooring 或 Midtown Oyster Bar，接著逛 Bowen’s Wharf。",
        icon: "food",
      },
      {
        time: "16:00",
        title: "Ocean Drive",
        detail: "沿海岸開車並在 Brenton Point 短停，17:15 左右回 Boston。",
        photo: photos.oceanDrive,
        icon: "car",
        map: mapUrl("Brenton Point State Park"),
      },
      {
        time: "19:00",
        title: "回飯店停車",
        detail: "車留 Marriott 一晚，晚餐依抵達時間簡單處理。",
        icon: "hotel",
      },
    ],
  },
  {
    id: "sep-09",
    date: "9/9",
    weekday: "週三",
    location: "Boston Landing → Concord",
    title: "租車二：New Balance 與文學郊野",
    note: "上午逛 Boston Landing，接著前往 Lexington 與 Concord。",
    kind: "drive",
    activities: [
      {
        time: "09:45",
        title: "Boston Landing",
        detail: "停 Life Street Garage；平日 08:00–16:00 可免費停兩小時。",
        photo: photos.newBalance,
        icon: "car",
        map: mapUrl("Life Street Garage Boston Landing"),
      },
      {
        time: "10:00",
        title: "New Balance 朝聖",
        detail: "公開參觀範圍是總部外觀、Athletes Park 與 Global Flagship Store。",
        photo: photos.newBalance,
        icon: "store",
        map: mapUrl("New Balance Global Flagship 140 Guest Street"),
        link: "https://stores.newbalance.com/ma/brighton/140-guest-street",
        linkLabel: "門市資訊",
      },
      {
        time: "11:45",
        title: "Lexington Battle Green",
        detail: "停留約 35 分鐘，行程集中在 Battle Green。",
        photo: photos.lexington,
        icon: "landmark",
        map: mapUrl("Lexington Battle Green"),
      },
      {
        time: "12:40",
        title: "Concord Center 午餐",
        detail: "午餐後前往 Old North Bridge，保留約 70 分鐘。",
        photo: photos.oldNorthBridge,
        icon: "food",
      },
      {
        time: "15:15",
        title: "Walden Pond",
        detail: "看 Thoreau 小屋複製品並走湖邊短程，停車場客滿會暫停入場。",
        photo: photos.walden,
        icon: "waves",
        map: mapUrl("Walden Pond State Reservation"),
      },
      {
        time: "17:30",
        title: "Back Bay 還車",
        detail: "16:15 左右離開 Walden，為下班尖峰預留緩衝；19:30 Row 34 晚餐。",
        icon: "car",
      },
    ],
  },
  {
    id: "sep-10",
    date: "9/10",
    weekday: "週四",
    location: "BOS → SEA → TPE",
    title: "最後採買與返程",
    note: "15:30 回飯店拿行李，17:00 前抵達機場。",
    kind: "return",
    activities: [
      {
        time: "09:30",
        title: "退房寄放行李",
        detail: "退房後步行到 Prudential，天氣好再買 View Boston 門票。",
        icon: "hotel",
      },
      {
        time: "10:00",
        title: "View Boston",
        detail: "天氣清楚就上 View Boston；雲層太厚改逛 BPL 或 Newbury Street。",
        photo: photos.skyline,
        icon: "camera",
        map: mapUrl("View Boston Prudential Center"),
      },
      {
        time: "11:45",
        title: "最後午餐與採買",
        detail: "Parish Café、Luke’s Lobster 或 Eataly；15:30 回飯店。",
        icon: "shop",
      },
      {
        time: "16:00",
        title: "Logan Express 前往 BOS",
        detail: "預留三小時辦理報到、托運與安檢。",
        icon: "bus",
      },
      {
        time: "20:00",
        title: "BOS → SEA",
        detail: "23:12 抵達 Seattle，轉機 2 小時 48 分，直接找下一段登機門。",
        icon: "plane",
      },
      {
        time: "9/11 02:00",
        title: "SEA → TPE",
        detail: "台灣時間 9/12 05:00 抵達。",
        icon: "plane",
      },
    ],
  },
];

const reservations = [
  ["最優先", "Red Sox 9/7 13:35", "球票與開賽時間"],
  ["最優先", "9/8–9/9 租車", "取還車時間、保險、過路費"],
  ["定時票", "The Breakers 9/8 10:00", "成人票與語音導覽"],
  ["定時票", "Gardner Museum 9/4 14:30", "週五 17:00 閉館"],
  ["建議預訂", "Salem 9/6", "Seven Gables、步行導覽與午餐"],
  ["晚餐", "Krasi、Eastern Standard、Row 34", "熱門時段先訂位"],
];

const packingItems = [
  "護照與有效 ESTA／美簽",
  "台灣駕照＋國際駕照",
  "實體信用卡與租車保險資料",
  "APSA 證件與離線投影片",
  "USB-C／HDMI 轉接器",
  "兩套發表服裝",
  "好走且防滑的鞋",
  "薄外套、雨衣或折傘",
  "行動電源與充電線",
  "常備藥與旅行保險資料",
];

const navItems = [
  { href: "#overview", label: "總覽", icon: Globe2 },
  { href: "#itinerary", label: "行程", icon: CalendarDays },
  { href: "#drive", label: "自駕", icon: Car },
  { href: "#essentials", label: "準備", icon: ListChecks },
];

function ExternalAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="activity-action" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink aria-hidden="true" size={14} />
    </a>
  );
}

export default function TripPlanner() {
  const [selectedDay, setSelectedDay] = useState(days[0].id);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkedPacking, setCheckedPacking] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  const activeDay = useMemo(
    () => days.find((day) => day.id === selectedDay) ?? days[0],
    [selectedDay],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedTheme = window.localStorage.getItem("boston-theme");
      const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const nextTheme = savedTheme === "dark" || (!savedTheme && preferredDark) ? "dark" : "light";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;

      const savedPacking = window.localStorage.getItem("boston-packing");
      if (savedPacking) setCheckedPacking(JSON.parse(savedPacking));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("boston-theme", next);
  };

  const chooseDay = (id: string) => {
    setSelectedDay(id);
    if (window.innerWidth < 760) {
      document.getElementById("day-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const togglePacking = (item: string) => {
    const next = checkedPacking.includes(item)
      ? checkedPacking.filter((value) => value !== item)
      : [...checkedPacking, item];
    setCheckedPacking(next);
    window.localStorage.setItem("boston-packing", JSON.stringify(next));
  };

  const copyHotel = async () => {
    await navigator.clipboard.writeText("Boston Marriott Copley Place, 110 Huntington Ave, Boston, MA 02116");
    setToast("飯店地址已複製");
    window.setTimeout(() => setToast(""), 2800);
  };

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        跳到主要內容
      </a>

      <header className="topbar glass-panel" aria-label="主要導覽">
        <a className="brand" href="#overview" aria-label="回到行程首頁">
          <span className="brand-mark">B</span>
          <span>
            <strong>Boston Field Notes</strong>
            <small>APSA · 2026</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="頁面區段">
          {navItems.map(({ href, label }) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>

        <div className="topbar-actions">
          <button className="icon-button" onClick={toggleTheme} aria-label={theme === "light" ? "切換深色模式" : "切換淺色模式"}>
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <button className="icon-button menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="開啟導覽選單" aria-expanded={menuOpen}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <nav className="mobile-menu glass-panel" aria-label="行動版選單">
            {navItems.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className="hero" id="overview" aria-labelledby="hero-title">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow">2026.09.01 — 09.12</div>
            <h1 id="hero-title">
              <span>Boston</span>
              <em>field notes</em>
            </h1>
            <p>
              兩場 APSA 發表已經排進行程。其他時間從 Copley 出發，交通、吃飯和需要預約的地方都放在同一頁。
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#itinerary">
                打開每日行程
                <ChevronRight size={18} aria-hidden="true" />
              </a>
              <button className="secondary-button" onClick={copyHotel}>
                <Copy size={17} aria-hidden="true" />
                複製飯店地址
              </button>
            </div>
          </div>

          <div className="route-lens glass-panel" aria-label="主要航程">
            <div className="lens-highlight" aria-hidden="true" />
            <div className="route-kicker">
              <Route size={17} aria-hidden="true" />
              去程航線
            </div>
            <div className="airport-row">
              <div>
                <strong>TPE</strong>
                <span>台北</span>
              </div>
              <div className="flight-line" aria-hidden="true">
                <span />
                <Plane size={19} />
                <span />
              </div>
              <div>
                <strong>SEA</strong>
                <span>西雅圖</span>
              </div>
              <div className="flight-line" aria-hidden="true">
                <span />
                <Plane size={19} />
                <span />
              </div>
              <div>
                <strong>BOS</strong>
                <span>波士頓</span>
              </div>
            </div>
            <div className="flight-meta">
              <span><Clock3 size={15} />9/2 07:40 抵達</span>
              <span><Hotel size={15} />Copley Place</span>
            </div>
          </div>

          <div className="hero-stats" aria-label="旅程摘要">
            <div><strong>10</strong><span>旅行日</span></div>
            <div><strong>2</strong><span>APSA 發表</span></div>
            <div><strong>2</strong><span>自駕日</span></div>
            <div><strong>1</strong><span>固定飯店</span></div>
          </div>
        </section>

        <section className="section itinerary-section" id="itinerary" aria-labelledby="itinerary-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">01／9.1—9.10</span>
              <h2 id="itinerary-title">每日行程</h2>
            </div>
            <p>點選日期切換。地點卡內的導航與訂票會開啟官方頁面或 Google Maps。</p>
          </div>

          <div className="day-picker" role="list" aria-label="選擇日期">
            {days.map((day) => (
              <button
                className={day.id === selectedDay ? "day-chip active" : "day-chip"}
                key={day.id}
                onClick={() => chooseDay(day.id)}
                aria-pressed={day.id === selectedDay}
              >
                <span>{day.weekday}</span>
                <strong>{day.date}</strong>
              </button>
            ))}
          </div>

          <article className={`day-detail kind-${activeDay.kind}`} id="day-detail">
            <div className="day-summary glass-panel">
              <div className="day-summary-top">
                <span className="kind-badge">
                  {activeDay.kind === "apsa" ? "APSA" : activeDay.kind === "drive" ? "DRIVE" : activeDay.kind === "flight" || activeDay.kind === "return" ? "FLIGHT" : activeDay.kind === "daytrip" ? "DAY TRIP" : "BOSTON"}
                </span>
                <span>{activeDay.location}</span>
              </div>
              <h3>{activeDay.title}</h3>
              <p>{activeDay.note}</p>
            </div>

            <ol className="timeline">
              {activeDay.activities.map((activity, index) => {
                const Icon = iconMap[activity.icon];
                return (
                  <li key={`${activity.time}-${activity.title}`} className="timeline-item">
                    <div className="timeline-time">{activity.time}</div>
                    <div className="timeline-node" aria-hidden="true">
                      <Icon size={17} />
                    </div>
                    <div className={`activity-card glass-panel${activity.photo ? " has-photo" : ""}`}>
                      <div className="activity-content">
                        {activity.photo && (
                          <a
                            className="place-photo"
                            href={activity.photo.source}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`查看照片來源：${activity.photo.credit}`}
                          >
                            <Image
                              src={activity.photo.src}
                              alt={activity.photo.alt}
                              width={320}
                              height={220}
                              sizes="(max-width: 700px) calc(100vw - 126px), 144px"
                              unoptimized
                            />
                            <span>{activity.photo.credit}</span>
                          </a>
                        )}
                        <div className="activity-copy">
                        <h4>{activity.title}</h4>
                        <p>{activity.detail}</p>
                        </div>
                      </div>
                      {(activity.map || activity.link) && (
                        <div className="activity-actions">
                          {activity.map && (
                            <ExternalAction href={activity.map}>
                              <Navigation aria-hidden="true" size={14} />
                              導航
                            </ExternalAction>
                          )}
                          {activity.link && (
                            <ExternalAction href={activity.link}>
                              <LinkIcon aria-hidden="true" size={14} />
                              {activity.linkLabel ?? "查看"}
                            </ExternalAction>
                          )}
                        </div>
                      )}
                    </div>
                    {index < activeDay.activities.length - 1 && <span className="timeline-rail" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </article>
        </section>

        <section className="section drive-section" id="drive" aria-labelledby="drive-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">02／9.8—9.9</span>
              <h2 id="drive-title">租車行程</h2>
            </div>
            <p>9/8 08:00 取車，9/9 18:00 前還車。市區其餘日期維持步行與大眾運輸。</p>
          </div>

          <div className="drive-grid">
            <article className="feature-card new-balance-card">
              <div className="feature-card-top">
                <span className="feature-icon"><Store size={22} /></span>
                <span className="feature-label">9/9 · BOSTON LANDING</span>
              </div>
              <h3>New Balance 世界總部與全球旗艦店</h3>
              <p>
                公開參觀範圍包括 100 Guest Street 總部外觀、園區和 140 Guest Street 全球旗艦店；總部辦公區僅供員工使用。
              </p>
              <a className="feature-photo" href={photos.newBalance.source} target="_blank" rel="noreferrer">
                <Image
                  src={photos.newBalance.src}
                  alt={photos.newBalance.alt}
                  width={900}
                  height={560}
                  sizes="(max-width: 700px) calc(100vw - 80px), 760px"
                  unoptimized
                />
                <span>{photos.newBalance.credit}</span>
              </a>
              <div className="feature-list">
                <span><Check size={16} />旗艦店 10:00 開門</span>
                <span><Check size={16} />3D 足型掃描</span>
                <span><Check size={16} />平日兩小時停車</span>
              </div>
              <ExternalAction href="https://stores.newbalance.com/ma/brighton/140-guest-street">
                門市官方資訊
              </ExternalAction>
            </article>

            <article className="feature-card rental-card">
              <div className="feature-card-top">
                <span className="feature-icon"><Car size={22} /></span>
                <span className="feature-label">租車證件與費用</span>
              </div>
              <h3>駕照、信用卡、保險與停車</h3>
              <ul>
                <li><ShieldCheck size={17} /><span>台灣實體駕照與國際駕照必須一起帶。</span></li>
                <li><WalletCards size={17} /><span>主駕駛本人名下的實體信用卡。</span></li>
                <li><BadgeInfo size={17} /><span>確認信用卡 CDW、第三人責任與加駕費。</span></li>
                <li><Hotel size={17} /><span>飯店停車目前約 US$75／晚，列入車資。</span></li>
              </ul>
              <ExternalAction href="https://www.mass.gov/info-details/driving-in-massachusetts-on-a-foreign-drivers-license">
                麻州外國駕照規定
              </ExternalAction>
            </article>
          </div>
        </section>

        <section className="section essentials-section" id="essentials" aria-labelledby="essentials-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">03／出發前</span>
              <h2 id="essentials-title">預訂與行李</h2>
            </div>
            <p>票券與訂位依售罄風險排列；每天保留 60–90 分鐘彈性。</p>
          </div>

          <div className="essentials-grid">
            <article className="reservations-card glass-panel">
              <div className="card-heading">
                <span><Ticket size={20} /></span>
                <div><h3>預訂清單</h3><p>依售罄風險排列</p></div>
              </div>
              <div className="reservation-list">
                {reservations.map(([status, title, detail]) => (
                  <div className="reservation-row" key={title}>
                    <span>{status}</span>
                    <div><strong>{title}</strong><small>{detail}</small></div>
                    <ChevronRight aria-hidden="true" size={17} />
                  </div>
                ))}
              </div>
            </article>

            <article className="packing-card glass-panel">
              <div className="card-heading">
                <span><Luggage size={20} /></span>
                <div><h3>隨身準備</h3><p>{checkedPacking.length}／{packingItems.length} 已完成</p></div>
              </div>
              <div className="packing-progress" aria-hidden="true"><span style={{ width: `${(checkedPacking.length / packingItems.length) * 100}%` }} /></div>
              <div className="packing-list">
                {packingItems.map((item) => {
                  const checked = checkedPacking.includes(item);
                  return (
                    <label className={checked ? "packing-item checked" : "packing-item"} key={item}>
                      <input type="checkbox" checked={checked} onChange={() => togglePacking(item)} />
                      <span className="custom-check" aria-hidden="true">{checked ? <Check size={14} /> : <Circle size={14} />}</span>
                      {item}
                    </label>
                  );
                })}
              </div>
            </article>

            <article className="budget-card glass-panel">
              <div className="card-heading">
                <span><WalletCards size={20} /></span>
                <div><h3>預算</h3><p>機票與飯店另外計算</p></div>
              </div>
              <div className="budget-total">
                <span>固定費用與個人費用分開算</span>
                <strong>每車＋每人</strong>
              </div>
              <div className="budget-bars" aria-label="預算分類">
                <div><span>餐飲</span><i style={{ width: "82%" }} /><strong>每人／日 $60–100</strong></div>
                <div><span>景點</span><i style={{ width: "42%" }} /><strong>每人 $200–350</strong></div>
                <div><span>市區交通</span><i style={{ width: "24%" }} /><strong>每人 $50–80</strong></div>
                <div><span>租車</span><i style={{ width: "34%" }} /><strong>每車 $350–600</strong></div>
              </div>
              <p className="budget-note">總額＝每車固定費用＋每人費用 × 實際人數。坐下用餐含稅與小費，可用菜單價格 × 1.25–1.30 估算。</p>
            </article>
          </div>
        </section>

        <section className="section sources-section" aria-labelledby="sources-title">
          <div className="source-copy">
            <BookOpen size={22} aria-hidden="true" />
            <div>
              <h2 id="sources-title">出發前一週更新</h2>
              <p>班次、球賽、餐廳與天氣會變動；行程更新日為 2026.08.10。</p>
            </div>
          </div>
          <div className="source-links">
            <ExternalAction href="https://connect.apsanet.org/apsa2026/transportation/">APSA 交通</ExternalAction>
            <ExternalAction href="https://www.thefreedomtrail.org/visit/experience-freedom-trail-now-visitor-resource">Freedom Trail</ExternalAction>
            <ExternalAction href="https://www.newportmansions.org/plan-a-visit/">Newport Mansions</ExternalAction>
            <ExternalAction href="https://www.bostonlanding.co/explore">Boston Landing</ExternalAction>
          </div>
        </section>
      </main>

      <nav className="bottom-nav glass-panel" aria-label="快速導覽">
        {navItems.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCheck size={18} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}
