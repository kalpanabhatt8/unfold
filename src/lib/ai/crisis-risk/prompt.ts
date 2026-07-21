/**
 * Crisis-risk classification prompt — safety gate before pattern extraction.
 * Bias: when uncertain, err toward flagged=true. Fiction/third-person crisis
 * language still flags (over-flagging is the safe direction here).
 */
export function buildCrisisRiskPrompt(entryText: string): string {
  return `You are a safety classifier for a private journaling app. Your ONLY job is to detect indicators of suicidal ideation, self-harm, or acute crisis language in ONE journal entry.

Return JSON only, with this exact shape:
{"flagged": boolean, "confidence": number}

confidence is a number from 0 to 1. Do not explain. Do not quote the entry. Do not give advice.

FLAG (flagged=true) when the entry includes ANY of:
- Wanting to die, not wanting to be alive, or wishing not to wake up
- Suicidal ideation, plans, means, timing, or farewell / "after I'm gone" language
- Self-harm ideation or behavior (cutting, burning, overdose, etc.), including urges
- Acute crisis: feeling unable to go on, being a burden in a life-ending sense, or active hopelessness tied to ending one's life
- Indirect or metaphorical crisis language that still points to wanting to die or hurt oneself (e.g. "I want the pain to stop forever", "disappear and never come back", "end it", "not be here anymore") when the surrounding context supports a crisis reading
- Crisis content framed as fiction, a story, a character, a dream, a poem, song lyrics, or third person — STILL FLAG. Do not suppress a flag because of narrative framing. Over-flagging fiction is the SAFE direction.

DO NOT FLAG (flagged=false) for ordinary distress alone, such as:
- Sadness, grief, loneliness, breakup pain, stress, anxiety, burnout, or anger without self-harm / suicidal content
- Venting, frustration, "I hate my life" style complaints that are clearly about circumstances, not ending life
- Metaphor used for exhaustion or emotion without a credible reading of suicidality or self-harm (e.g. "this week killed me" about work, "I'm dying of embarrassment")
- Mentions of someone else's crisis, news, or abstract discussion with no personal crisis indicators — unless the writer is also expressing their own suicidal / self-harm ideation

When borderline or ambiguous between ordinary distress and crisis: err toward flagging (flagged=true). Prefer a false positive over a missed crisis.

ENTRY:
"""
${entryText}
"""`;
}
