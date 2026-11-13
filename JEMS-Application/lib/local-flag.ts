"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean persisted in localStorage, read without hydration mismatches:
 * the server snapshot is always `fallback`, and the browser value takes over
 * right after hydration. Changes sync across components and tabs.
 */

const EVENT = "jems:local-flag";

function read(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

export function useLocalFlag(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (e: StorageEvent) => e.key === key && onChange();
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, onChange);
    };
  }, [key]);
  const value = useSyncExternalStore(subscribe, () => read(key, fallback), () => fallback);
  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "true" : "false");
      } catch {
        /* storage blocked — the change just won't persist */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
