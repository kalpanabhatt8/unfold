import type { ReactNode } from "react";
import { headers } from "next/headers";
import { SignOutOverlay } from "@/components/auth/sign-out-overlay";
import { Sidebar } from "@/components/sidebar/sidebar";
import { DashboardScrollLock } from "./dashboard-scroll-lock";

export default async function DashboardShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-unfold-pathname") ?? "";
  const initialPatternsActive = pathname.startsWith("/dashboard/patterns");

  return (
    <DashboardScrollLock>
      <SignOutOverlay />
      <div className="flex h-svh min-h-0 w-full max-w-[100vw] overflow-hidden bg-(--app-bg) p-2 sm:p-3 lg:p-4">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[1.5rem] border border-black/[0.04] bg-(--surface-canvas) shadow-[0_1px_2px_rgba(16,16,20,0.04),0_18px_44px_-16px_rgba(16,16,20,0.16)] lg:rounded-[1.75rem]">
          <Sidebar initialPatternsActive={initialPatternsActive} />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-(--border) bg-(--surface-raised)">
              {children}
            </div>
          </div>
        </div>
      </div>
    </DashboardScrollLock>
  );
}
