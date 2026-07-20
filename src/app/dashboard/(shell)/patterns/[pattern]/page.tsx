import { redirect } from "next/navigation";
import { isPatternName } from "@/lib/patterns/vocabulary";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ pattern: string }>;
};

/**
 * Legacy deep link — patterns live on one page as a collapsible list.
 * Bounce to the index and expand the matching pattern.
 */
export default async function PatternDetailPage({ params }: PageProps) {
  const { pattern } = await params;
  if (!isPatternName(pattern)) notFound();
  redirect(`/dashboard/patterns?p=${encodeURIComponent(pattern)}`);
}
