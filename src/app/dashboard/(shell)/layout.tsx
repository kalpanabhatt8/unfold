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
      <div className="flex h-svh min-h-0 w-full max-w-[100vw] overflow-hidden bg-(--app-bg)">
        <Sidebar initialPatternsActive={initialPatternsActive} />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardScrollLock>
  );
}
