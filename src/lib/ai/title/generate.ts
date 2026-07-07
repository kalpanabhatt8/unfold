import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  TITLE_MAX_TOKENS,
  TITLE_MODEL,
  UNTITLED_ENTRY,
} from "@/lib/ai/title/constants";
import { fallbackTitle } from "@/lib/ai/title/fallback";
import { prepareTitleInput } from "@/lib/ai/title/input";
import {
  buildTitlePrompt,
  buildTitleRetryPrompt,
} from "@/lib/ai/title/prompt";
import { validateTitle } from "@/lib/ai/title/validation";

async function attemptTitle(
  apiKey: string,
  sourceText: string,
  buildPrompt: () => string,
): Promise<{ title: string | null; rejectedTitle?: string; reason?: string }> {
  const result = await callAnthropicMessages(apiKey, {
    model: TITLE_MODEL,
    prompt: buildPrompt(),
    maxTokens: TITLE_MAX_TOKENS,
  });

  if (!result.ok) {
    console.error("[title] upstream error", result.status, result.error);
    return { title: null };
  }

  const validation = validateTitle(result.text, sourceText, {
    fromModelResponse: true,
  });

  if (validation.ok) return { title: validation.title };

  return {
    title: null,
    rejectedTitle: validation.title,
    reason: validation.reason,
  };
}

/**
 * Title generation orchestration:
 * 1. Deliberation prompt → validate
 * 2. Stricter retry → validate
 * 3. Writer-voice fallback
 */
export async function generateTitle(
  apiKey: string,
  text: string,
): Promise<string> {
  const excerpt = prepareTitleInput(text);
  if (!excerpt) return UNTITLED_ENTRY;

  const first = await attemptTitle(apiKey, excerpt, () =>
    buildTitlePrompt(excerpt),
  );
  if (first.title) return first.title;

  if (first.reason) {
    const second = await attemptTitle(apiKey, excerpt, () =>
      buildTitleRetryPrompt(
        excerpt,
        first.reason!,
        first.rejectedTitle,
      ),
    );
    if (second.title) return second.title;
  }

  return fallbackTitle(excerpt);
}
