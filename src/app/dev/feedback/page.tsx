/**
 * Dev inbox — product feedback + pattern closing votes.
 * Open at /dev/feedback (local development only).
 */

import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/server/db";
import {
  isPatternClosingFeedback,
  parsePatternClosingFeedback,
} from "@/lib/feedback-pattern-closing";
import { PATTERN_LABELS, type PatternName } from "@/lib/patterns/vocabulary";
import { resolvePreferredName } from "@/lib/user-display";
import { FeedbackDevView } from "./feedback-dev-view";
import type { FeedbackInboxItem } from "./feedback-inbox";
import type { PatternFeedbackItem } from "./pattern-feedback-panel";

const labelFor = (patternName: string): string =>
  PATTERN_LABELS[patternName as PatternName] ?? patternName;

const shortUserId = (userId: string): string =>
  userId.length <= 12 ? userId : `${userId.slice(0, 8)}…`;

const resolveUserProfiles = async (
  userIds: string[],
): Promise<Map<string, { name: string; imageUrl: string | null }>> => {
  const client = await clerkClient();
  const map = new Map<string, { name: string; imageUrl: string | null }>();

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const user = await client.users.getUser(userId);
        const name =
          resolvePreferredName(user) ||
          user.username ||
          shortUserId(userId);
        map.set(userId, {
          name,
          imageUrl: user.imageUrl ?? null,
        });
      } catch {
        map.set(userId, {
          name: shortUserId(userId),
          imageUrl: null,
        });
      }
    }),
  );

  return map;
};

export default async function FeedbackDevPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <main
        className="min-h-svh w-full px-6 py-12"
        style={{
          backgroundColor: "var(--surface-canvas)",
          fontFamily: "var(--font-body)",
        }}
      >
        <p className="text-sm text-(--sidebar-ink-soft)">
          Feedback inbox is only available in local development.
        </p>
      </main>
    );
  }

  const [feedback, votes] = await Promise.all([
    db.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        userId: true,
        categories: true,
        text: true,
        createdAt: true,
      },
    }),
    db.patternVote.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        userId: true,
        patternName: true,
        vote: true,
        updatedAt: true,
      },
    }),
  ]);

  const productRows = feedback.filter((row) => !isPatternClosingFeedback(row.text));
  const patternReasonRows = feedback.filter((row) =>
    isPatternClosingFeedback(row.text),
  );

  const reasonByVoteKey = new Map<string, string>();
  for (const row of patternReasonRows) {
    const parsed = parsePatternClosingFeedback(row.text);
    if (!parsed?.patternName) continue;
    reasonByVoteKey.set(
      `${row.userId}:${parsed.patternName}`,
      parsed.reason,
    );
  }

  const allUserIds = [
    ...new Set([
      ...productRows.map((row) => row.userId),
      ...votes.map((row) => row.userId),
    ]),
  ];
  const profiles = await resolveUserProfiles(allUserIds);

  const profileFor = (userId: string) => {
    const profile = profiles.get(userId);
    return {
      userName: profile?.name ?? shortUserId(userId),
      userImageUrl: profile?.imageUrl ?? null,
    };
  };

  const productItems: FeedbackInboxItem[] = productRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    ...profileFor(row.userId),
    categories: row.categories,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  }));

  const patternItems: PatternFeedbackItem[] = votes.map((row) => ({
    id: `${row.userId}:${row.patternName}`,
    userId: row.userId,
    ...profileFor(row.userId),
    patternName: row.patternName,
    patternLabel: labelFor(row.patternName),
    vote: row.vote as "up" | "down",
    reason: reasonByVoteKey.get(`${row.userId}:${row.patternName}`) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <main
      className="min-h-svh w-full"
      style={{
        backgroundColor: "var(--surface-canvas)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        <FeedbackDevView
          productItems={productItems}
          patternItems={patternItems}
        />
      </div>
    </main>
  );
}
