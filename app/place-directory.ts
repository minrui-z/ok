import type { Activity, TripDay } from "./trip-data";

export type OfficialPlace = {
  title: string;
  officialUrl: string;
  officialLabel: string;
  expectedNames: string[];
  checkedAt: string;
};

const checkedAt = "2026-08-12";

const place = (
  title: string,
  officialUrl: string,
  expectedNames: string[],
  officialLabel = "官方資訊",
): OfficialPlace => ({ title, officialUrl, expectedNames, officialLabel, checkedAt });

// This directory supplies trusted official links for the original itinerary,
// including snapshots saved before officialUrl was added to every stop. Name
// matching prevents a stable ID that was later repurposed from inheriting an
// unrelated link.
export const officialPlaces: Record<string, OfficialPlace> = {
  "sep02-copley": place("Boston Public Library", "https://www.bpl.org/locations/central/", ["Copley Square 與午餐", "Boston Public Library"]),
  "sep02-copley-rain": place("Boston Public Library", "https://www.bpl.org/locations/central/", ["Boston Public Library 與 Prudential Center"]),
  "sep03-common": place("Freedom Trail", "https://www.thefreedomtrail.org/visit", ["Boston Common 起走", "Freedom Trail"]),
  "sep03-common-rain": place("Old State House", "https://www.revolutionaryspaces.org/old-state-house/", ["Old State House"]),
  "sep03-market-rain": place("Boston Public Market", "https://bostonpublicmarket.org/", ["Boston Public Market"]),
  "sep03-old-north": place("Old North Church", "https://oldnorth.com/visit/", ["Paul Revere 與 Old North Church", "Old North Church"]),
  "sep03-old-north-rain": place("Old North Church", "https://oldnorth.com/visit/", ["Old North Church 室內參觀"]),
  "sep03-uss": place("USS Constitution", "https://www.nps.gov/bost/learn/historyculture/ussconst.htm", ["USS Constitution"]),
  "sep03-uss-rain": place("USS Constitution Museum", "https://ussconstitutionmuseum.org/visit/", ["USS Constitution Museum"]),
  "sep04-gardner": place("Isabella Stewart Gardner Museum", "https://www.gardnermuseum.org/visit", ["Isabella Stewart Gardner Museum"], "參觀資訊"),
  "sep04-fens": place("Back Bay Fens", "https://www.emeraldnecklace.org/park-overview/back-bay-fens/", ["Back Bay Fens"]),
  "sep04-mfa-rain": place("Museum of Fine Arts", "https://www.mfa.org/visit", ["Museum of Fine Arts", "Museum of Fine Arts Boston"]),
  "sep05-bpl": place("Boston Public Library", "https://www.bpl.org/locations/central/", ["Boston Public Library"]),
  "sep05-pru-rain": place("Prudential Center", "https://www.prudentialcenter.com/", ["Prudential Center"]),
  "sep06-visitor": place("Salem Armory Visitor Center", "https://www.nps.gov/sama/planyourvisit/placestogo.htm", ["Salem Visitor Center", "Salem Armory Visitor Center"]),
  "sep06-pem": place("Peabody Essex Museum", "https://www.pem.org/visit", ["Peabody Essex Museum"], "參觀資訊"),
  "sep06-memorial": place("Salem Witch Trials Memorial", "https://www.salem.org/listing/salem-witch-trials-memorial/", ["Witch Trials Memorial", "Salem Witch Trials Memorial"]),
  "sep06-history-rain": place("The Witch House", "https://www.thewitchhouse.org/new-page-5", ["Witch House 與 PEM 延長參觀", "The Witch House at Salem"]),
  "sep06-gables": place("The House of the Seven Gables", "https://7gables.org/tickets/", ["Seven Gables 與 Derby Wharf", "The House of the Seven Gables"]),
  "sep06-gables-rain": place("The House of the Seven Gables", "https://7gables.org/tickets/", ["House of the Seven Gables 室內導覽"]),
  "sep07-fens": place("Back Bay Fens", "https://www.emeraldnecklace.org/park-overview/back-bay-fens/", ["Emerald Necklace", "Back Bay Fens"]),
  "sep07-mfa-rain": place("Museum of Fine Arts", "https://www.mfa.org/visit", ["Museum of Fine Arts", "Museum of Fine Arts Boston"]),
  "sep07-arrive": place("Fenway Park", "https://www.mlb.com/redsox/ballpark", ["提早抵達 Fenway Park", "Fenway Park"]),
  "sep07-game": place("Red Sox", "https://www.mlb.com/redsox/schedule/2026-09", ["Red Sox vs. Angels", "Fenway Park"], "官方賽程"),
  "sep08-breakers": place("The Breakers", "https://www.newportmansions.org/mansions-and-gardens/the-breakers/", ["The Breakers"], "參觀資訊"),
  "sep08-cliff": place("Newport Cliff Walk", "https://www.discovernewport.org/things-to-do/cliff-walk/", ["Cliff Walk 北段", "Cliff Walk 40 Steps"]),
  "sep08-marble-rain": place("Marble House", "https://www.newportmansions.org/mansions-and-gardens/marble-house/", ["Marble House"]),
  "sep08-ocean": place("Brenton Point State Park", "https://riparks.ri.gov/parks/brenton-point-state-park", ["Ocean Drive", "Brenton Point State Park"]),
  "sep08-art-rain": place("Newport Art Museum", "https://newportartmuseum.org/visit/", ["Newport Art Museum"]),
  "sep09-lexington": place("Lexington Battle Green", "https://www.tourlexington.us/battle-green", ["Lexington Battle Green"]),
  "sep09-concord-museum-rain": place("Concord Museum", "https://concordmuseum.org/visit/", ["Concord Museum"]),
  "sep09-bridge": place("North Bridge", "https://www.nps.gov/mima/planyourvisit/north-bridge-visitor-center.htm", ["Old North Bridge", "North Bridge"]),
  "sep09-orchard-rain": place("Orchard House", "https://louisamayalcott.org/visit", ["Orchard House", "Louisa May Alcott's Orchard House"]),
  "sep09-walden": place("Walden Pond", "https://www.mass.gov/locations/walden-pond-state-reservation", ["Walden Pond", "Walden Pond State Reservation"]),
  "sep09-museum-rain-2": place("Concord Museum", "https://concordmuseum.org/visit/", ["Concord Museum 延長參觀", "Concord Museum"]),
  "sep10-last": place("Boston Public Garden", "https://www.boston.gov/parks/public-garden", ["最後半天", "Boston Public Garden"]),
  "sep10-rain": place("Boston Public Library", "https://www.bpl.org/locations/central/", ["Boston Public Library 與 Prudential Center"]),
};

function normalized(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("en-US");
}

export function officialPlaceForActivity(activity: Pick<Activity, "id" | "title" | "place" | "officialUrl" | "officialLabel">): OfficialPlace | null {
  if (activity.officialUrl?.startsWith("https://")) {
    return {
      title: activity.title,
      officialUrl: activity.officialUrl,
      officialLabel: activity.officialLabel || "官方資訊",
      expectedNames: [activity.title, activity.place ?? ""].filter(Boolean),
      checkedAt,
    };
  }
  const saved = officialPlaces[activity.id];
  if (!saved) return null;
  const names = [normalized(activity.title), normalized(activity.place)];
  return saved.expectedNames.some((expected) => names.includes(normalized(expected))) ? saved : null;
}

export function findActivityById(days: TripDay[], activityId: string): Activity | null {
  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.id === activityId) return activity;
      if (activity.rainAlternative?.id === activityId) return activity.rainAlternative;
    }
  }
  return null;
}
