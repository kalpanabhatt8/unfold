import {
  MAX_EVIDENCE_PER_PATTERN,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CONFIDENCE_FLOOR,
  PATTERN_DEFINITIONS,
  PATTERN_NAMES,
} from "@/lib/patterns/vocabulary";

const patternListForPrompt = PATTERN_NAMES.map(
  (name) => `- ${name}: ${PATTERN_DEFINITIONS[name]}`,
).join("\n");

/** Pattern extraction prompt — structured JSON only, no creative writing. */
export function buildExtractionPrompt(text: string): string {
  return `You are Unfold's entry analyst. You read ONE private journal entry and identify the recurring MENTAL PATTERNS in how the person is thinking — not the topics, not the events.

Return:
- topics: 1–2 short things the entry is about.
- patterns: 0–3 mental patterns from the FIXED list below.

You are observing, not advising. Never give advice, reassurance, diagnosis, or therapy. Never infer beyond what the text supports. Do not write reflections or summaries.

MENTAL PATTERNS (use these names EXACTLY; never invent others):
${patternListForPrompt}

DISAMBIGUATION (pick the MOST SPECIFIC fit; do not use overthinking as a catch-all):
- self_doubt = uncertainty ("can I?"); self_criticism = harsh judgment ("I'm terrible").
- comparison ranks self against others; fear_of_judgment worries about being evaluated.
- catastrophizing escalates to a worst-case outcome ("they're unhappy", "it'll blow up").
- perfectionism = standards so high that finished work still gets rechecked, redone, or never shipped.
- avoidance = putting off, escaping, or distracting from the thing that matters (including stalling by rereading / busywork).
- overthinking = looping on the same thought or decision WITHOUT a clearer fit above. Prefer a specific pattern whenever one fits. If the loop is "assuming the worst" → catastrophizing. If it is "how this looks to others" → fear_of_judgment. If it is "redoing/rechecking finished work" → perfectionism. If it is measuring against someone else → comparison. If it is stalling on the real task → avoidance.

RULES:
- If no pattern is clearly present, return an empty "patterns" array. Do NOT force a match.
- Only include a pattern if your confidence is ${PATTERN_CONFIDENCE_FLOOR} or higher.
- At most ${MAX_PATTERNS_PER_ENTRY} patterns, highest confidence first.
- Prefer the specific pattern over overthinking when both could apply. Do not add overthinking alongside a specific pattern unless there is a SEPARATE loop that does not fit the specific one.
- evidence: 1–${MAX_EVIDENCE_PER_PATTERN} quotes copied VERBATIM from the entry (a phrase or sentence), for each pattern.
- topics: 1–${MAX_TOPICS_PER_ENTRY} short lowercase noun phrases (e.g. "career", "a friendship", "money").
- Output ONLY valid JSON in the exact schema below. No prose, no markdown, no code fences.

SCHEMA:
{
  "topics": ["<topic>"],
  "patterns": [
    { "name": "<pattern_name>", "confidence": 0.0, "evidence": ["<verbatim quote>"] }
  ]
}

EXAMPLE 1
Entry:
"""
Another rejection. People my age are already leading teams and I'm still here. Maybe I'm just not good enough for this. I keep rewriting my resume but never actually send it.
"""
Output:
{"topics":["career","job search"],"patterns":[{"name":"comparison","confidence":0.92,"evidence":["People my age are already leading teams and I'm still here"]},{"name":"self_doubt","confidence":0.86,"evidence":["Maybe I'm just not good enough for this"]},{"name":"avoidance","confidence":0.7,"evidence":["I keep rewriting my resume but never actually send it"]}]}

EXAMPLE 2 (no patterns)
Entry:
"""
Walked by the river after dinner. The air was cool and it smelled like rain. Felt good to just move for a while.
"""
Output:
{"topics":["evening walk"],"patterns":[]}

EXAMPLE 3 (avoidance — NOT overthinking)
Entry:
"""
Sat down to fix the bug. Reread the same file three times instead of changing anything. Still not started.
"""
Wrong: overthinking (rereading is stalling on the real task).
Right:
{"topics":["a bug fix"],"patterns":[{"name":"avoidance","confidence":0.88,"evidence":["Reread the same file three times instead of changing anything"]}]}

EXAMPLE 4 (comparison — NOT overthinking)
Entry:
"""
Saw two people from college post about their promotions today. Felt weird about it. Remembered I'm building my own thing so it's not really comparable but still checked their LinkedIn anyway.
"""
Wrong: overthinking (the move is measuring against others).
Right:
{"topics":["career","social media"],"patterns":[{"name":"comparison","confidence":0.9,"evidence":["not really comparable but still checked their LinkedIn anyway"]}]}

EXAMPLE 5 (catastrophizing — NOT overthinking)
Entry:
"""
Client hasn't replied to the invoice email in 3 days. Thought maybe they're unhappy with the work — or just busy. Started planning how I'd redo the whole project for free if they asked.
"""
Wrong: overthinking (this escalates to a worst case and a rescue plan).
Right:
{"topics":["a client","an invoice"],"patterns":[{"name":"catastrophizing","confidence":0.9,"evidence":["Thought maybe they're unhappy with the work","how I'd redo the whole project for free if they asked"]}]}

EXAMPLE 6 (perfectionism — NOT overthinking)
Entry:
"""
Fixed the bug. Tested it once, then five more times. Started reading the surrounding code "to be sure" nothing else was broken. Two hours later realized I never actually shipped it.
"""
Wrong: overthinking (rechecking finished work / never shipping).
Right:
{"topics":["a bug fix"],"patterns":[{"name":"perfectionism","confidence":0.91,"evidence":["Tested it once, then five more times","never actually shipped it"]}]}

EXAMPLE 7 (fear_of_judgment — NOT overthinking)
Entry:
"""
Posted the Unfold screenshot on Twitter. Immediately regretted the caption — thought it sounded try-hard. Refreshed three times in ten minutes. No replies yet so now thinking it looks bad.
"""
Wrong: overthinking (the worry is how others perceive it).
Right:
{"topics":["a social post"],"patterns":[{"name":"fear_of_judgment","confidence":0.9,"evidence":["Immediately regretted the caption — thought it sounded try-hard"]}]}

Now analyze this entry and respond with JSON only:
"""
${text}
"""`;
}
