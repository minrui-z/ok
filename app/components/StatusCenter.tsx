"use client";

import { AlertTriangle, CloudSun, ExternalLink, Landmark, RefreshCw, TrainFront, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { weatherLabel, type DailyForecast, type TransitAlert } from "../status-utils";

type StatusPayload = {
  checkedAt: string;
  weather: { ok: boolean; days: DailyForecast[]; source: string };
  transit: { ok: boolean; alerts: TransitAlert[]; source: string };
  baseball: { ok: boolean; game: null | { gamePk: number; gameDate: string | null; status: string; abstractState: string; away: string; home: string }; source: string };
};

const officialPlaces = [
  { label: "BPL", url: "https://www.bpl.org/locations/central/" },
  { label: "Gardner", url: "https://www.gardnermuseum.org/visit" },
  { label: "PEM", url: "https://www.pem.org/visit" },
  { label: "Newport Mansions", url: "https://www.newportmansions.org/plan-a-visit/" },
  { label: "Concord Museum", url: "https://concordmuseum.org/visit/" },
];

export function StatusCenter({ selectedDate }: { selectedDate: string }) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/trip-status", { cache: "no-store" });
      if (!response.ok) throw new Error("即時資訊暫時無法更新。");
      setData(await response.json() as StatusPayload);
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

  const forecast = useMemo(() => data?.weather.days.find((day) => day.date === selectedDate) ?? null, [data, selectedDate]);
  const updated = data ? new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York", hour12: false }).format(new Date(data.checkedAt)) : "—";
  const delayed = data?.baseball.game && ["Delayed", "Postponed", "Cancelled", "Suspended"].some((word) => data.baseball.game!.status.includes(word));

  return (
    <section className="status-center" aria-labelledby="status-title">
      <div className="compact-heading">
        <div><span className="section-kicker">LIVE CHECK</span><h2 id="status-title">出發前快查</h2></div>
        <button className="text-button status-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} />{loading ? "更新中" : `Boston ${updated}`}</button>
      </div>
      {error && <p className="status-error" role="alert"><AlertTriangle size={16} />{error}<button onClick={() => void refresh()}>重試</button></p>}
      <div className="status-grid">
        <article className="status-card glass-card">
          <span className="status-icon"><CloudSun size={20} /></span>
          <div><small>{selectedDate.slice(5).replace("-", "/")} Boston 天氣</small>{forecast ? <><strong>{weatherLabel(forecast.weatherCode)} · {forecast.maxC}°／{forecast.minC}°</strong><p>最高降雨機率 {forecast.rainChance}%</p></> : <><strong>尚未進入預報範圍</strong><p>接近旅程時會自動顯示。</p></>}</div>
          <a href={data?.weather.source ?? "https://open-meteo.com/en/docs"} target="_blank" rel="noreferrer" aria-label="Open-Meteo 天氣來源"><ExternalLink size={16} /></a>
        </article>
        <article className="status-card glass-card">
          <span className="status-icon"><TrainFront size={20} /></span>
          <div><small>MBTA 服務公告</small><strong>{data?.transit.ok ? (data.transit.alerts.length ? `${data.transit.alerts.length} 則需留意` : "目前沒有重大公告") : "暫時無法讀取"}</strong>{data?.transit.alerts[0] && <p>{data.transit.alerts[0].title}</p>}</div>
          <a href={data?.transit.source ?? "https://www.mbta.com/alerts/subway"} target="_blank" rel="noreferrer" aria-label="MBTA 官方公告"><ExternalLink size={16} /></a>
        </article>
        <article className={`status-card glass-card ${delayed ? "status-warning" : ""}`}>
          <span className="status-icon"><Trophy size={20} /></span>
          <div><small>9/7 Red Sox</small><strong>{data?.baseball.game ? `${data.baseball.game.away.replace("Los Angeles ", "")} @ ${data.baseball.game.home.replace("Boston ", "")} · ${data.baseball.game.status}` : "賽程暫時無法讀取"}</strong><p>{delayed ? "官方狀態有變，請先不要前往球場。" : "13:35 Fenway Park；時間仍可能調整。"}</p></div>
          <a href={data?.baseball.game?.gamePk ? `https://www.mlb.com/gameday/${data.baseball.game.gamePk}` : "https://www.mlb.com/redsox/schedule/2026-09"} target="_blank" rel="noreferrer" aria-label="MLB 官方賽程"><ExternalLink size={16} /></a>
        </article>
        <article className="status-card places-card glass-card">
          <span className="status-icon"><Landmark size={20} /></span>
          <div><small>景點臨時公告</small><strong>官網快查</strong><p>景點沒有統一的即時休館介面，出發前一天查看。</p><div className="official-place-links">{officialPlaces.map((place) => <a key={place.label} href={place.url} target="_blank" rel="noreferrer">{place.label}</a>)}</div></div>
        </article>
      </div>
      {data?.transit.alerts.length ? <details className="alert-details glass-card"><summary>查看全部 MBTA 公告</summary><ul>{data.transit.alerts.map((alert) => <li key={alert.id}><strong>{alert.effect}</strong><span>{alert.title}</span></li>)}</ul></details> : null}
    </section>
  );
}
