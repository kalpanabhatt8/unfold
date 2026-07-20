import { PatternsView } from "@/components/patterns/patterns-view";
import { isPatternName } from "@/lib/patterns/vocabulary";

type PageProps = {
  searchParams: Promise<{ p?: string }>;
};

export default async function PatternsPage({ searchParams }: PageProps) {
  const { p } = await searchParams;
  const initialPattern = p && isPatternName(p) ? p : undefined;
  return <PatternsView initialPattern={initialPattern} />;
}
