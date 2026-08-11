"use client";

import { Bell, BellRing, CheckCircle2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

export type NotificationPreference = "places" | "weather" | "transit" | "baseball" | "departure";

const options: Array<{ id: NotificationPreference; label: string; detail: string }> = [
  { id: "places", label: "景點營業異常", detail: "休館、臨時公告與出發前確認" },
  { id: "weather", label: "天氣與降雨", detail: "大雨、雷雨與官方警報" },
  { id: "transit", label: "MBTA 交通異常", detail: "與行程相關的路線公告" },
  { id: "baseball", label: "Red Sox 狀態", detail: "延期、取消或延後開賽" },
  { id: "departure", label: "建議出發時間", detail: "依交通與緩衝提醒" },
];

function readPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem("boston-notification-preferences") ?? "null");
    if (!Array.isArray(raw)) return new Set<NotificationPreference>(["places", "weather", "transit", "baseball"]);
    return new Set(raw.filter((value): value is NotificationPreference => options.some((option) => option.id === value)));
  } catch {
    return new Set<NotificationPreference>(["places", "weather", "transit", "baseball"]);
  }
}

export function NotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [preferences, setPreferences] = useState<Set<NotificationPreference>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSupported("Notification" in window && "serviceWorker" in navigator);
      if ("Notification" in window) setPermission(Notification.permission);
      setPreferences(readPreferences());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("boston-notification-preferences", JSON.stringify([...preferences]));
  }, [preferences, ready]);

  async function enableNotifications() {
    if (!supported) return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  async function testNotification() {
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await registration.showNotification("Boston 行程提醒已開啟", {
      body: "重大異常會清楚標示來源與確認時間。",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "boston-notification-test",
    });
  }

  return (
    <section id="notification-settings" className="notification-settings glass-card" aria-labelledby="notification-title">
      <div className="notification-heading">
        <span><BellRing size={22} /></span>
        <div><span className="section-kicker">ALERTS</span><h2 id="notification-title">提醒設定</h2><p>重大異常立即顯示；一般資訊集中在當日快查。</p></div>
        {permission === "granted" ? <b><CheckCircle2 size={16} />這台裝置已允許</b> : <button className="primary-button" onClick={() => void enableNotifications()} disabled={!supported}><Bell size={17} />開啟通知</button>}
      </div>
      {!supported && <p className="notification-note">這個瀏覽器不支援網站通知，站內警告仍會正常顯示。</p>}
      {permission === "denied" && <p className="form-error" role="alert">通知已被瀏覽器封鎖，請從網站設定重新允許。</p>}
      <div className="notification-options">{options.map((option) => <label key={option.id} htmlFor={`notification-${option.id}`} aria-label={option.label}><input id={`notification-${option.id}`} type="checkbox" checked={preferences.has(option.id)} onChange={() => setPreferences((current) => { const next = new Set(current); if (next.has(option.id)) next.delete(option.id); else next.add(option.id); return next; })} /><span><strong>{option.label}</strong><small>{option.detail}</small></span></label>)}</div>
      <div className="notification-footer"><p><Smartphone size={16} />iPhone 若要使用系統通知，請先用 Safari 將網站加入主畫面。</p>{permission === "granted" && <button className="secondary-button compact" onClick={() => void testNotification()}>傳送測試通知</button>}</div>
      <p className="notification-note">目前會在開啟網站、回到網站及定期更新時檢查。網站完全關閉時的全天候推播，仍需要額外的背景排程服務。</p>
    </section>
  );
}
