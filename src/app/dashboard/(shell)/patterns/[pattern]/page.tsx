import { PatternDetailView } from "@/components/patterns/pattern-detail-view";
import { isPatternName } from "@/lib/patterns/vocabulary";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ pattern: string }>;
};

/**
 * Pattern detail - a dedicated Insights workspace for one pattern.
 */
export default async function PatternDetailPage({ params }: PageProps) {
  const { pattern } = await params;
  if (!isPatternName(pattern)) notFound();
  return <PatternDetailView patternName={pattern} />;
}
