import { notFound } from "next/navigation";
import { PatternDetailView } from "@/components/patterns/pattern-detail-view";
import { isPatternName } from "@/lib/patterns/vocabulary";

type PageProps = {
  params: Promise<{ pattern: string }>;
};

export default async function PatternDetailPage({ params }: PageProps) {
  const { pattern } = await params;
  if (!isPatternName(pattern)) notFound();
  return <PatternDetailView patternName={pattern} />;
}
