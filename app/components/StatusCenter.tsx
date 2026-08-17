"use client";

import { AlertTriangle, CloudSun, ExternalLink, Landmark, RefreshCw, TrainFront, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  destinationDetails,
  destinationForDate,
  weatherLabel,
  type TripStatusPayload,
} from "../status-utils";
import { UrgentAlertStrip } from "./UrgentAlertStrip";

export type StatusCenterProps = {
  selectedDate: string;
};

function placeStateLabel(state: TripStatusPayload["places"]["items"][number]["state"]) {
  if (state === "planned-open") return "官方時段符合";
  if (state === "official-exception") return "官方有異動";
  return "出發前確認";
}

function formatBostonTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
    hour12: false,
  }).format(new Date(value));
}

export function StatusCenter({ selectedDate }: StatusCenterProps) {
  const [data, setData] = useState<TripStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/trip-status", { cache: "no-store" });
      if (!response.ok) throw new Error("即時資訊暫時無法更新。");
      setData(await response.json() as TripStatusPayload);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "即時資訊暫時無法更新。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(true), 5 * 60_000);
    const onFocus = () => void refresh(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const destination = destinationForDate(selectedDate);
  const destinationLabel = destinationDetails[destination].label;
  const weatherStatus = data?.weather[destination] ?? null;
  const nwsStatus = data?.weatherAlerts[destination] ?? null;
  const forecast = useMemo(
    () => weatherStatus?.days.find((day) => day.date === selectedDate) ?? null,
    [selectedDate, weatherStatus],
  );
  const placeStatuses = useMemo(
    () => data?.places.items.filter((place) => place.date === selectedDate) ?? [],
    [data, selectedDate],
  );
  const updated = data ? formatBostonTime(data.checkedAt) : "—";
  const delayed = Boolean(data?.baseball.game && /(delay|postpon|cancel|suspend|resched)/i.test(data.baseball.game.status));

  let weatherTitle = loading && !data ? "更新中" : "尚未進入預報範圍";
  let weatherDetail = "接近旅程時會自動顯示。";
  if (weatherStatus && !weatherStatus.ok) {
    weatherTitle = "天氣預報暫時無法讀取";
    weatherDetail = weatherStatus.error ?? "請直接查看天氣來源。";
  } else if (forecast) {
    weatherTitle = `${weatherLabel(forecast.weatherCode)} · ${forecast.maxC}°／${forecast.minC}°`;
    weatherDetail = `最高降雨機率 ${forecast.rainChance}%`;
  }
  if (nwsStatus && !nwsStatus.ok) weatherDetail += " · NWS 警報未更新";
  else if (nwsStatus?.alerts[0]) weatherDetail = `NWS：${nwsStatus.alerts[0].headline}`;
  else if (nwsStatus?.ok && forecast) weatherDetail += " · NWS 目前無生效警報";

  let transitTitle = loading && !data ? "更新中" : "暫時無法讀取";
  let transitDetail = "只檢查 Green、Orange 與 Salem 通勤鐵路。";
  if (data?.transit.ok) {
    transitTitle = data.transit.alerts.length ? `${data.transit.alerts.length} 則相關公告` : "目前沒有相關路線公告";
    if (data.transit.alerts[0]) transitDetail = data.transit.alerts[0].title;
  } else if (data?.transit.error) transitDetail = data.transit.error;

  let baseballTitle = loading && !data ? "更新中" : "賽程暫時無法讀取";
  let baseballDetail = "Boston 9/2 16:10；台灣時間 9/3 04:10。";
  if (data?.baseball.ok && data.baseball.game) {
    baseballTitle = `${data.baseball.game.away.replace("Los Angeles ", "")} @ ${data.baseball.game.home.replace("Boston ", "")} · ${data.baseball.game.status}`;
    if (delayed) baseballDetail = "官方狀態有變，請先不要前往球場。";
  } else if (data?.baseball.ok && !data.baseball.game) {
    baseballTitle = "官方尚未列出這場比賽";
  } else if (data?.baseball.error) baseballDetail = data.baseball.error;

  return (
    <section className="status-center" aria-labelledby="status-title">
      {data && <UrgentAlertStrip alerts={data.urgentAlerts} selectedDate={selectedDate} />}
      <div className="compact-heading">
        <div><span className="section-kicker">LIVE CHECK</span><h2 id="status-title">出發前快查</h2></div>
        <button className="text-button status-refresh" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />{loading ? "更新中" : `Boston ${updated}`}
        </button>
      </div>
      {error && <p className="status-error" role="alert"><AlertTriangle size={16} />{error}<button onClick={() => void refresh()}>重試</button></p>}
      <div className="status-grid">
        <article className={`status-card glass-card ${weatherStatus && !weatherStatus.ok ? "status-warning" : ""}`}>
          <span className="status-icon"><CloudSun size={20} /></span>
          <div>
            <small>{selectedDate.slice(5).replace("-", "/")} {destinationLabel} 天氣</small>
            <strong>{weatherTitle}</strong>
            <p>{weatherDetail}</p>
          </div>
          <a href={nwsStatus?.alerts[0]?.source ?? weatherStatus?.source ?? "https://open-meteo.com/en/docs"} target="_blank" rel="noreferrer" aria-label={`${destinationLabel}天氣官方來源`}><ExternalLink size={16} /></a>
        </article>
        <article className={`status-card glass-card ${data?.transit.ok === false ? "status-warning" : ""}`}>
          <span className="status-icon"><TrainFront size={20} /></span>
          <div><small>MBTA 相關路線</small><strong>{transitTitle}</strong><p>{transitDetail}</p></div>
          <a href={data?.transit.source ?? "https://www.mbta.com/alerts"} target="_blank" rel="noreferrer" aria-label="MBTA 官方公告"><ExternalLink size={16} /></a>
        </article>
        <article className={`status-card glass-card ${delayed || data?.baseball.ok === false ? "status-warning" : ""}`}>
          <span className="status-icon"><Trophy size={20} /></span>
          <div><small>Boston 9/2 Red Sox</small><strong>{baseballTitle}</strong><p>{baseballDetail}</p></div>
          <a href={data?.baseball.game?.gamePk ? `https://www.mlb.com/gameday/${data.baseball.game.gamePk}` : data?.baseball.source ?? "https://www.mlb.com/redsox/schedule/2026-09"} target="_blank" rel="noreferrer" aria-label="MLB 官方賽程"><ExternalLink size={16} /></a>
        </article>
        <article className={`status-card places-card glass-card ${placeStatuses.some((place) => place.state !== "planned-open") ? "status-warning" : ""}`}>
          <span className="status-icon"><Landmark size={20} /></span>
          <div>
            <small>主要景點 · 人工核對{placeStatuses[0] ? ` ${placeStatuses[0].curatedAt}` : ""}</small>
            <strong>{placeStatuses.length ? `${placeStatuses.length} 個行程點` : "這天沒有可自動核對的主要景點"}</strong>
            <p>{placeStatuses[0]?.summary ?? "沒有可靠資料的場所不會顯示為正常營業。"}</p>
            {placeStatuses.length > 0 && (
              <div className="official-place-links">
                {placeStatuses.map((place) => <a key={place.id} href={place.source} target="_blank" rel="noreferrer" title={place.detail}>{place.name} · {placeStateLabel(place.state)}</a>)}
              </div>
            )}
          </div>
        </article>
      </div>
      {nwsStatus?.alerts.length ? (
        <details className="alert-details glass-card">
          <summary>查看 {destinationLabel} NWS 官方警報</summary>
          <ul>{nwsStatus.alerts.map((alert) => <li key={alert.id}><strong>{alert.severity} · {alert.event}</strong><span>{alert.headline}</span></li>)}</ul>
        </details>
      ) : null}
      {data?.transit.alerts.length ? (
        <details className="alert-details glass-card">
          <summary>查看全部相關 MBTA 公告</summary>
          <ul>{data.transit.alerts.map((alert) => <li key={alert.id}><strong>{alert.routeIds.join(" · ") || alert.effect}</strong><span>{alert.title}</span></li>)}</ul>
        </details>
      ) : null}
      {placeStatuses.length ? (
        <details className="alert-details glass-card">
          <summary>查看景點核對依據</summary>
          <ul>{placeStatuses.map((place) => <li key={place.id}><strong>{placeStateLabel(place.state)} · 整理 {place.curatedAt}</strong><span>{place.detail}</span></li>)}</ul>
        </details>
      ) : null}
    </section>
  );
}
