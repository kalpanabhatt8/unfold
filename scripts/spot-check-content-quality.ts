/**
 * Spot-check the wired content-quality gate (prompt + classify + skip rule)
 * against worked examples A–M and boundary entries N–R.
 *
 * Uses the same module + `shouldSkipPatternExtractionForQuality` as
 * `notifyEntryCompleted` (does not call crisis or pattern extraction).
 *
 *   npx tsx scripts/spot-check-content-quality.ts
 */

import { readFileSync } from "node:fs";
import { classifyContentQuality } from "../src/lib/ai/content-quality/generate";
import {
  QUALITY_FLAG_CONFIDENCE_FLOOR,
  shouldSkipPatternExtractionForQuality,
} from "../src/lib/ai/content-quality/constants";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}

const EXAMPLES: Array<{
  id: string;
  expectSkip: boolean;
  note: string;
  text: string;
}> = [
  {
    id: "A",
    expectSkip: false,
    note: "self+other",
    text: "I said yes to my coworker even though I was already behind. I keep doing this and then resenting the pile that shows up later.",
  },
  {
    id: "B",
    expectSkip: false,
    note: "self+friend",
    text: "My friend cancelled again and I told her it was fine, but I sat in the car for ten minutes feeling stupid for rearranging my night.",
  },
  {
    id: "C",
    expectSkip: false,
    note: "Hinglish self",
    text: "Aaj phir maine haan bol diya even though I was drowning in work. Baad mein gussa aa raha hai khud pe.",
  },
  {
    id: "D",
    expectSkip: false,
    note: "plain reflective",
    text: "Walked home in the rain. Felt oddly calm. Not sure what that means yet.",
  },
  { id: "E", expectSkip: true, note: "too short", text: "ok" },
  {
    id: "F",
    expectSkip: true,
    note: "logistics",
    text: "Buy milk, call dentist, pick up dry cleaning, 3pm meeting with Priya",
  },
  {
    id: "G",
    expectSkip: true,
    note: "gibberish",
    text: "asdfgh test test 123 hello world",
  },
  {
    id: "H",
    expectSkip: true,
    note: "fiction",
    text: "In a kingdom of glass, the orphan thief climbed the clock tower while the queen slept. She had one night to steal the star.",
  },
  {
    id: "I",
    expectSkip: true,
    note: "hypothetical",
    text: "Suppose I was a CEO who fired everyone for fun. Here's how that board meeting would go...",
  },
  {
    id: "J",
    expectSkip: true,
    note: "third-person",
    text: "My friend keeps comparing herself to her sister and spiraling about her body. She cried for an hour about how unfair it is. She doesn't listen when people try to help.",
  },
  {
    id: "K",
    expectSkip: true,
    note: "Hinglish logistics",
    text: "Kal market jana hai, sabzi lena hai, bill dena hai, 5 baje meeting",
  },
  {
    id: "L",
    expectSkip: true,
    note: "Hinglish third-person",
    text: "Meri friend har time apni sister se compare karti hai and phir rona shuru. Usse kuch samajh nahi aata.",
  },
  {
    id: "M",
    expectSkip: false,
    note: "Hinglish self+other",
    text: "Boss ne last minute kaam diya and maine mana nahi kiya. Ab regret ho raha hai, neend nahi aa rahi.",
  },
  {
    id: "N",
    expectSkip: false,
    note: "boundary plain reflective",
    text: "tired today, work was a lot",
  },
  {
    id: "O",
    expectSkip: false,
    note: "boundary mild self",
    text: "Long day. Inbox never ended. Just want tomorrow to be quieter.",
  },
  {
    id: "P",
    expectSkip: true,
    note: "boundary logistics-ish",
    text: "Standup 10, send deck, lunch with Ravi, gym 7",
  },
  {
    id: "Q",
    expectSkip: false,
    note: "boundary Hinglish plain",
    text: "Aaj bahut thak gayi. Office se seedha so gayi.",
  },
  {
    id: "R",
    expectSkip: false,
    note: "boundary thin but self",
    text: "Couldn't focus in meetings. Kept zoning out. Annoying.",
  },
];

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  console.log(
    `floor=${QUALITY_FLAG_CONFIDENCE_FLOOR} | skip = flagged && conf >= floor\n`,
  );

  let pass = 0;
  let fail = 0;

  for (const example of EXAMPLES) {
    try {
      const result = await classifyContentQuality(apiKey, example.text);
      const gateSkip = shouldSkipPatternExtractionForQuality(result);
      const ok = gateSkip === example.expectSkip;
      if (ok) pass += 1;
      else fail += 1;

      console.log(
        [
          ok ? "PASS" : "FAIL",
          `id=${example.id}`,
          `note=${example.note}`,
          `expectSkip=${example.expectSkip}`,
          `flagged=${result.flagged}`,
          `conf=${result.confidence.toFixed(2)}`,
          `gateSkip=${gateSkip}`,
        ].join(" | "),
      );
    } catch (error) {
      fail += 1;
      console.log(
        `ERR  | id=${example.id} | note=${example.note} | ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  console.log(`\n${pass} pass, ${fail} fail / ${EXAMPLES.length} total`);
  if (fail > 0) process.exit(1);
}

void main();
