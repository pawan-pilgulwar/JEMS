"use client";

import { createContext, useContext } from "react";

/**
 * True inside the guided-tour pages (/tour/*), which render the real portal
 * screens from static sample data. Components that would otherwise fetch,
 * poll or write (refresh buttons, notifications, AI actions, interest
 * toggles) check this and stay local, so a tour never touches the database.
 */
const DemoModeContext = createContext(false);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  return <DemoModeContext.Provider value>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): boolean {
  return useContext(DemoModeContext);
}
