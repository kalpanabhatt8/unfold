import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { DashboardScrollLock } from "./dashboard-scroll-lock";

export default function DashboardShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardScrollLock>
      <div className="flex h-svh min-h-0 w-full max-w-[100vw] overflow-hidden bg-(--app-bg)">
        <Sidebar />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardScrollLock>
  );
}
