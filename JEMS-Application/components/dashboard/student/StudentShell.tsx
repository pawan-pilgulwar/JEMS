"use client";

import { useState } from "react";
import { useLocalFlag } from "@/lib/local-flag";
import Sidebar from "./Sidebar";
import { OpenMobileSidebarProvider, SidebarPinnedProvider } from "./sidebar-context";

const PINNED_STORAGE_KEY = "jems.sidebarPinned";

/**
 * Renders once per student session (from the layout, not per page) so the
 * sidebar — and whether it's pinned open — survives navigating between
 * dashboard sections instead of resetting on every route change.
 */
export default function StudentShell({
  name,
  email,
  image,
  children,
}: {
  name: string;
  email: string;
  image: string | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Read after hydration so the server and first client render agree.
  const [sidebarPinned, setSidebarPinned] = useLocalFlag(PINNED_STORAGE_KEY);
  const togglePinned = () => setSidebarPinned(!sidebarPinned);

  return (
    <SidebarPinnedProvider value={sidebarPinned}>
      <OpenMobileSidebarProvider value={() => setSidebarOpen(true)}>
        <div className="min-h-screen bg-surface">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            pinned={sidebarPinned}
            onTogglePinned={togglePinned}
            name={name}
            email={email}
            image={image}
          />

          <div
            className={`flex min-h-screen flex-col transition-[padding] duration-300 ease-in-out ${
              sidebarPinned ? "lg:pl-60" : "lg:pl-16"
            }`}
          >
            {children}
          </div>
        </div>
      </OpenMobileSidebarProvider>
    </SidebarPinnedProvider>
  );
}
