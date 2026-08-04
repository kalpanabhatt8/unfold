import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { SyncProvider } from "@/components/sync/sync-provider";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Resolved server-side so the sync engine knows which account owns the local
  // caches on the first client commit, instead of waiting for clerk-js to load.
  const { userId } = await auth();

  return (
    <>
      <SyncProvider userId={userId} />
      {children}
    </>
  );
}
