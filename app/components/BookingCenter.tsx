"use client";

import { CalendarClock, Car, Check, ExternalLink, Plane, Presentation, Ticket, Utensils } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { bookingItems, type BookingKind } from "../trip-data";

const labels: Record<BookingKind, string> = { flight: "航班", conference: "APSA", ticket: "門票", restaurant: "餐廳", rental: "租車" };
const icons: Record<BookingKind, ComponentType<{ size?: number }>> = { flight: Plane, conference: Presentation, ticket: Ticket, restaurant: Utensils, rental: Car };

function readCompleted() {
  try {
    const value = JSON.parse(localStorage.getItem("boston-bookings-completed") ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch { return new Set<string>(); }
}

function daysUntil(deadline: string, now: Date) {
  const target = new Date(`${deadline}T23:59:59-04:00`).getTime();
  return Math.ceil((target - now.getTime()) / 86_400_000);
}

export function BookingCenter({ now, onOpenDay }: { now: Date | null; onOpenDay: (dayId: string) => void }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"pending" | "all" | "complete">("pending");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setCompleted(readCompleted()); setReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("boston-bookings-completed", JSON.stringify([...completed])); }, [completed, ready]);

  const visible = useMemo(() => bookingItems.filter((item) => filter === "all" || (filter === "complete") === completed.has(item.id)), [completed, filter]);
  const overdue = now ? bookingItems.filter((item) => !completed.has(item.id) && daysUntil(item.recommendedBy, now) < 0).length : 0;

  function toggle(id: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="booking-center">
      <div className="booking-summary glass-card">
        <div><span>待處理</span><strong>{bookingItems.length - completed.size}</strong></div>
        <div><span>已完成</span><strong>{completed.size}</strong></div>
        <div><span>超過建議日</span><strong>{overdue}</strong></div>
        <p>日期是行程規劃用的建議完成日，不是店家最後期限。</p>
      </div>
      <div className="booking-toolbar">
        <div className="segmented" aria-label="篩選預約">
          <button className={filter === "pending" ? "active" : ""} aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}>待處理</button>
          <button className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button>
          <button className={filter === "complete" ? "active" : ""} aria-pressed={filter === "complete"} onClick={() => setFilter("complete")}>已完成</button>
        </div>
      </div>
      <div className="booking-list">
        {visible.length === 0 && <div className="empty-card glass-card">這個分類目前沒有項目。</div>}
        {visible.map((item) => {
          const Icon = icons[item.kind];
          const remaining = now ? daysUntil(item.recommendedBy, now) : null;
          const isDone = completed.has(item.id);
          return <article key={item.id} className={`booking-row glass-card ${isDone ? "is-complete" : ""}`}>
            <button className="booking-check" aria-label={`${isDone ? "標示未完成" : "標示完成"}：${item.title}`} aria-pressed={isDone} onClick={() => toggle(item.id)}>{isDone ? <Check size={18} /> : null}</button>
            <span className="booking-kind"><Icon size={20} /><small>{labels[item.kind]}</small></span>
            <div className="booking-copy"><div><span>{item.forDate}</span><h3>{item.title}</h3></div><p>{item.detail}</p></div>
            <div className="booking-deadline"><CalendarClock size={16} /><span>建議 {item.recommendedBy.slice(5).replace("-", "/")} 前</span>{remaining !== null && !isDone && <strong className={remaining < 0 ? "late" : remaining <= 7 ? "soon" : ""}>{remaining < 0 ? "現在處理" : remaining === 0 ? "今天" : `還有 ${remaining} 天`}</strong>}</div>
            <div className="booking-actions"><button onClick={() => onOpenDay(item.dayId)}>看行程</button><a href={item.url} target="_blank" rel="noreferrer">{item.actionLabel}<ExternalLink size={14} /></a></div>
          </article>;
        })}
      </div>
    </div>
  );
}
