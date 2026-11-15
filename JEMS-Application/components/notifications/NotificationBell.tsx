"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, BriefcaseBusiness, CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useDemoMode } from "@/components/tour/DemoMode";
import type { AiTaskView } from "@/lib/ai-tasks/types";
import type { NotificationKind, NotificationView } from "@/lib/db/notifications";

const FAST_MS = 5_000;
const SLOW_MS = 30_000;
/** How long a heads-up toast stays on screen. */
const TOAST_MS = 6_000;
/** At most this many toasts are stacked at once (newest on top). */
const MAX_TOASTS = 3;

// ── Sound ───────────────────────────────────────────────────────

// One shared AudioContext: browsers cap how many can exist, and a context
// only produces sound after it has been resumed inside a user gesture.
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  audioCtx = Ctx ? new Ctx() : null;
  return audioCtx;
}

/** Resumes the shared context on the first click / key press so later sounds are audible. */
function unlockAudioOnFirstGesture(): () => void {
  const unlock = () => {
    getAudioContext()?.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return unlock;
}

/**
 * One short, bright "ding" in the style of a stock Android notification:
 * a single bell-like tone (fundamental + soft overtone) with a fast attack and
 * a quick decay. Generated with Web Audio, so there's no sound file to load.
 * Silent until the user has interacted with the page (browser autoplay rules).
 */
function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.22, t + 0.008); // ~8 ms attack
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); // bell-like decay
    out.connect(ctx.destination);
    // Fundamental (E6) with a quieter octave overtone gives the glassy "ding".
    for (const [freq, level] of [[1318.5, 1], [2637, 0.28]] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      g.gain.value = level;
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.6);
    }
  } catch {
    // Audio is a nicety; never let it break the bell.
  }
}

/**
 * Plays the sound once per batch of genuinely new notifications — and only in
 * one browser tab, since every open tab polls and would otherwise ding for the
 * same notification. Announced ids are shared through localStorage.
 */
const ANNOUNCED_KEY = "jems.notifications.announced";
function announceOnce(ids: string[]): boolean {
  try {
    const seen = new Set<string>(JSON.parse(window.localStorage.getItem(ANNOUNCED_KEY) ?? "[]"));
    const fresh = ids.filter((id) => !seen.has(id));
    if (fresh.length === 0) return false;
    window.localStorage.setItem(ANNOUNCED_KEY, JSON.stringify([...seen, ...fresh].slice(-100)));
    return true;
  } catch {
    return true; // storage blocked: still announce in this tab
  }
}

// ── UI helpers ──────────────────────────────────────────────────

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

const KIND_ICON: Record<NotificationKind, { icon: typeof Bell; tone: string }> = {
  "ai-success": { icon: CircleCheck, tone: "bg-emerald/10 text-emerald" },
  "ai-failure": { icon: CircleAlert, tone: "bg-red-50 text-red-600" },
  application: { icon: BriefcaseBusiness, tone: "bg-slate/10 text-slate" },
  info: { icon: Info, tone: "bg-surface text-mediumgray" },
};

function KindIcon({ kind, size = "h-8 w-8" }: { kind: NotificationKind; size?: string }) {
  const { icon: Icon, tone } = KIND_ICON[kind];
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/**
 * Top-bar bell: notifications only — no in-progress loader. Polls fast while
 * an AI task is running, slowly otherwise. New notifications after the first
 * load appear as heads-up toasts at the top-right of the screen, with one
 * sound per batch.
 *
 * The panel and the toasts are portalled to <body>: the top bars use
 * `backdrop-blur`, and a backdrop filter turns the header into the containing
 * block for `position: fixed` children — rendered in place, the toasts were
 * pinned to the 64px header and spilled over the page.
 */
function LiveNotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<NotificationView[]>([]);
  const [mounted, setMounted] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The poll re-schedules itself through this ref (a callback can't name itself).
  const pollRef = useRef<() => void>(() => {});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let busy = false;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: NotificationView[]; unread: number; activeTasks: AiTaskView[] };
        // First load only records what exists; later polls surface what's new.
        if (known.current) {
          const fresh = data.notifications.filter((n) => !n.read && !known.current!.has(n.id));
          if (fresh.length) {
            setToasts((prev) => [...fresh, ...prev.filter((t) => !fresh.some((f) => f.id === t.id))].slice(0, MAX_TOASTS));
            if (announceOnce(fresh.map((n) => n.id))) playNotificationSound();
          }
        }
        known.current = new Set(data.notifications.map((n) => n.id));
        setItems(data.notifications);
        setUnread(data.unread);
        busy = data.activeTasks.length > 0;
      }
    } catch {
      // Network blip — keep the last state and retry.
    }
    timer.current = setTimeout(() => pollRef.current(), busy ? FAST_MS : SLOW_MS);
  }, []);

  // Portals need document.body, which only exists after hydration.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => unlockAudioOnFirstGesture(), []);

  useEffect(() => {
    pollRef.current = poll;
    poll();
    // startAiTask() fires this so the bell switches to fast polling at once.
    const kick = () => poll();
    window.addEventListener("jems:ai-task-started", kick);
    return () => {
      window.removeEventListener("jems:ai-task-started", kick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  // Each toast dismisses itself after TOAST_MS (oldest first).
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(0, -1)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const markRead = async (ids: string[]) => {
    setItems((prev) => prev.map((n) => (ids.length === 0 || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids.length === 0 ? 0 : Math.max(0, u - ids.length)));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => {});
  };

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const openItem = (n: NotificationView) => {
    if (!n.read) markRead([n.id]);
    setOpen(false);
    dismiss(n.id);
    if (n.link) {
      router.push(n.link);
      router.refresh();
    }
  };

  const toggle = () => {
    setOpen((v) => !v);
    setToasts([]); // the panel shows them all; don't leave toasts on top of it
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={unread ? `Notifications (${unread} new)` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-mediumgray transition-colors hover:bg-surface hover:text-navy"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            // Just under the 64px top bar, right-aligned to the screen (never off-screen on phones).
            className="fixed right-2 top-[4.5rem] z-[1000] flex max-h-[calc(100dvh-5.5rem)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-navy/[0.08] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)] sm:right-4"
            style={{ animation: "fade-in 0.18s ease-out" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-lightgray px-4 py-2.5">
              <p className="text-sm font-semibold text-navy">
                Notifications{unread > 0 && <span className="ml-1.5 rounded-full bg-orange/10 px-1.5 py-0.5 text-[11px] font-semibold text-orange">{unread} new</span>}
              </p>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button type="button" onClick={() => markRead([])} className="text-xs font-semibold text-slate hover:underline">
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-md p-1 text-mediumgray hover:bg-surface hover:text-navy">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-mediumgray">You&apos;re all caught up.</p>
              ) : (
                <ul className="divide-y divide-lightgray">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${n.read ? "" : "bg-orange/[0.04]"}`}
                      >
                        <KindIcon kind={n.kind} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={`break-words text-sm text-navy ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange" aria-label="Unread" />}
                          </span>
                          {n.body && <span className="mt-0.5 line-clamp-2 block break-words text-xs text-mediumgray">{n.body}</span>}
                          <span className="mt-1 block text-[11px] text-mediumgray">{timeAgo(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}

      {mounted &&
        !open &&
        toasts.length > 0 &&
        createPortal(
          // Heads-up stack under the top bar; pointer events only on the cards themselves.
          <div aria-live="polite" className="pointer-events-none fixed right-2 top-[4.5rem] z-[1000] flex w-[min(24rem,calc(100vw-1rem))] flex-col gap-2 sm:right-4">
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-navy/[0.08] bg-white p-3.5 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
                style={{ animation: "slide-down 0.25s ease-out" }}
              >
                <KindIcon kind={t.kind} size="h-9 w-9" />
                <button type="button" onClick={() => openItem(t)} className="min-w-0 flex-1 text-left">
                  <span className="block break-words text-sm font-semibold text-navy">{t.title}</span>
                  {t.body && <span className="mt-0.5 line-clamp-2 block break-words text-xs text-mediumgray">{t.body}</span>}
                  {t.link && <span className="mt-1 block text-xs font-semibold text-slate">View →</span>}
                </button>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-mediumgray hover:bg-surface hover:text-navy">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Tour pages show a quiet bell: no polling, no real notifications. */
export default function NotificationBell() {
  const demo = useDemoMode();
  if (demo) {
    return (
      <span aria-hidden="true" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-mediumgray">
        <Bell className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-white ring-2 ring-white">3</span>
      </span>
    );
  }
  return <LiveNotificationBell />;
}
