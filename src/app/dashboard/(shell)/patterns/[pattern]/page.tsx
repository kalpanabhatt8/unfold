import { notFound, redirect } from "next/navigation";
import { isPatternName } from "@/lib/patterns/vocabulary-public";

type PageProps = {
  params: Promise<{ pattern: string }>;
};

/**
 * Legacy detail URLs open the Patterns list with that card expanded.
 */
export default async function PatternDetailPage({ params }: PageProps) {
  const { pattern } = await params;
  if (!isPatternName(pattern)) notFound();
  redirect(`/dashboard/patterns?p=${encodeURIComponent(pattern)}`);
}
