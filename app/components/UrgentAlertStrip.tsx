"use client";

import { AlertTriangle, ExternalLink, Info, OctagonAlert } from "lucide-react";
import { useEffect, useMemo } from "react";
import { destinationForDate, type UrgentAlert } from "../status-utils";

export type UrgentAlertStripProps = {
  alerts: UrgentAlert[];
  selectedDate: string;
  className?: string;
  maxVisible?: number;
};

const preferenceKey = "boston-notification-preferences";
const notificationHistoryKey = "boston-alert-notification-history-v1";
const notificationPreferences = new Set(["places", "weather", "transit", "baseball", "departure"]);
const notificationsInFlight = new Set<string>();

function alertsForDate(alerts: UrgentAlert[], selectedDate: string) {
  const destination = destinationForDate(selectedDate);
  return alerts.filter((alert) => {
    if (alert.date && alert.date !== selectedDate) return false;
    return alert.destinations.length === 0 || alert.destinations.includes(destination);
  });
}

function readEnabledPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(preferenceKey) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === "string" && notificationPreferences.has(value)));
  } catch {
    return new Set<string>();
  }
}

function readNotificationHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(notificationHistoryKey) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {} as Record<string, number>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
  } catch {
    return {} as Record<string, number>;
  }
}

function saveNotificationHistory(history: Record<string, number>) {
  const recent = Object.entries(history).sort((left, right) => right[1] - left[1]).slice(0, 60);
  localStorage.setItem(notificationHistoryKey, JSON.stringify(Object.fromEntries(recent)));
}

function iconFor(level: UrgentAlert["level"]) {
  if (level === "critical") return <OctagonAlert size={18} aria-hidden="true" />;
  if (level === "warning") return <AlertTriangle size={18} aria-hidden="true" />;
  return <Info size={18} aria-hidden="true" />;
}

function levelLabel(level: UrgentAlert["level"]) {
  if (level === "critical") return "需要立即處理";
  if (level === "warning") return "需要留意";
  return "行程資訊";
}

export function UrgentAlertStrip({ alerts, selectedDate, className = "", maxVisible = 3 }: UrgentAlertStripProps) {
  const relevantAlerts = useMemo(() => alertsForDate(alerts, selectedDate), [alerts, selectedDate]);
  const visibleAlerts = relevantAlerts.slice(0, Math.max(1, maxVisible));
  const primary = visibleAlerts[0];

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || Notification.permission !== "granted") return;

    const enabled = readEnabledPreferences();
    const candidates = relevantAlerts.filter((alert) => (
      alert.notify
      && alert.preference
      && enabled.has(alert.preference)
      && !notificationsInFlight.has(alert.fingerprint)
    )).slice(0, 3);
    if (!candidates.length) return;

    const history = readNotificationHistory();
    const pending = candidates.filter((alert) => !history[alert.fingerprint]);
    if (!pending.length) return;
    pending.forEach((alert) => notificationsInFlight.add(alert.fingerprint));

    void navigator.serviceWorker.getRegistration("/").then(async (registration) => {
      if (!registration) return;
      for (const alert of pending) {
        try {
          await registration.showNotification(alert.title, {
            body: alert.detail.slice(0, 180),
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: `boston-trip-${alert.id}`,
            data: { url: "/#today" },
          });
          history[alert.fingerprint] = Date.now();
        } catch {
          // Keep it out of history so a later refresh can retry after a transient browser error.
        } finally {
          notificationsInFlight.delete(alert.fingerprint);
        }
      }
      saveNotificationHistory(history);
    }).catch(() => {
      pending.forEach((alert) => notificationsInFlight.delete(alert.fingerprint));
    });
  }, [relevantAlerts]);

  if (!primary) return null;

  return (
    <section className={`urgent-alert-strip glass-card is-${primary.level} ${className}`.trim()} aria-label="目前行程警告" aria-live="polite">
      <span className="urgent-alert-icon">{iconFor(primary.level)}</span>
      <div className="urgent-alert-copy">
        <small>{levelLabel(primary.level)}</small>
        <strong>{primary.title}</strong>
        <p>{primary.detail}</p>
      </div>
      <a href={primary.source} target="_blank" rel="noreferrer">
        {primary.sourceLabel}<ExternalLink size={14} aria-hidden="true" />
      </a>
      {visibleAlerts.length > 1 && (
        <details className="urgent-alert-more">
          <summary>另外 {visibleAlerts.length - 1} 則</summary>
          <ul>
            {visibleAlerts.slice(1).map((alert) => (
              <li key={alert.id}>
                <span>{iconFor(alert.level)}</span>
                <div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
                <a href={alert.source} target="_blank" rel="noreferrer" aria-label={`${alert.title}官方來源`}><ExternalLink size={14} /></a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
