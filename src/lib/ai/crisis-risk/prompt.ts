/**
 * Crisis-risk classification prompt.
 * TODO: replace with the final crisis-detection prompt before launch.
 */
export function buildCrisisRiskPrompt(entryText: string): string {
  return `You are a safety classifier for a private journaling app. Your ONLY job is to detect indicators of suicidal ideation, self-harm, or acute crisis language in ONE journal entry.

Return JSON only, with this exact shape:
{"flagged": boolean, "confidence": number}

Rules:
- flagged=true only when the entry clearly indicates suicidal ideation, self-harm intent/behavior, or acute crisis (e.g. wanting to die, plans to hurt oneself, not wanting to be alive).
- Do NOT flag ordinary sadness, grief, stress, venting, metaphor, or fiction without clear self-harm/suicidality intent.
- confidence is a number from 0 to 1.
- Do not explain. Do not quote the entry. Do not give advice.

ENTRY:
"""
${entryText}
"""`;
}
