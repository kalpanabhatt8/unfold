import type { ReactNode } from "react";
import { SyncProvider } from "@/components/sync/sync-provider";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SyncProvider />
      {children}
    </>
  );
}
