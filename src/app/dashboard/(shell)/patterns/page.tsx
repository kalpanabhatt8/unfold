import { redirect } from "next/navigation";
import { PatternsView } from "@/components/patterns/patterns-view";
import { isPatternName } from "@/lib/patterns/vocabulary";

type PageProps = {
  searchParams: Promise<{ p?: string }>;
};

export default async function PatternsPage({ searchParams }: PageProps) {
  const { p } = await searchParams;
  // Legacy `?p=` deep links open the dedicated detail route.
  if (p && isPatternName(p)) {
    redirect(`/dashboard/patterns/${encodeURIComponent(p)}`);
  }
  return <PatternsView />;
}
