import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy - Unfold",
  description:
    "How Unfold collects, stores, and uses your journal data and account information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" active="privacy">
      <p>
        This Privacy Policy explains what information Unfold collects, how we
        use it, and who helps us process it. Unfold is built for private
        writing. This document matches how the product works today.
      </p>
      <p>
        This document was prepared with AI assistance and has not yet been
        reviewed by a lawyer. Given that Unfold includes automated
        crisis-detection features, we         strongly recommend a legal review of this
        document before relying on it, particularly regarding minor-protection
        law, cross-border data transfer, and jurisdiction-specific mental health
        app regulations.
      </p>

      <h2>Your Journal Is Private</h2>
      <p>
        Your journal entries are personal. Unfold is designed to help you
        reflect on your own writing, not to use your thoughts for advertising or
        unrelated purposes.
      </p>
      <p>
        We do not sell your journal entries, personal reflections, or private
        writing to third parties. Your writing is only processed when needed to
        provide Unfold features, such as saving your entries, syncing your data,
        generating patterns, creating insights, and maintaining the safety
        features of the product.
      </p>
      <p>
        We limit access to your journal data and only share information with
        service providers that help us operate Unfold, as described in this
        Privacy Policy.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Unfold (“we”, “us”) operates the Unfold web app from India. For privacy
        questions or data requests, contact{" "}
        <a href="mailto:hello.unfoldapp@gmail.com">hello.unfoldapp@gmail.com</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Account information</h3>
      <p>
        When you sign up or sign in, our authentication provider (Clerk) may
        collect your email address, password (stored by Clerk), username, and
        (if you use Google) profile details Google shares for sign-in (such as
        name and email). We store your Clerk user id in our database so your
        journal data stays tied to your account. We do not copy your password
        into our database.
      </p>
      <h3>Journal content you create</h3>
      <p>
        This includes entry titles, the text you write, seal dates, layout on the
        canvas, image captions, and search text derived from your writing. Drafts
        and entries may also be kept in your browser’s local storage so you can
        keep writing offline or between syncs.
      </p>
      <h3>Images you attach</h3>
      <p>
        When you add photos or images to an entry, we store the file with our
        file host (Vercel Blob) and keep a public URL, mime type, size, and
        optional caption in our database, linked to your account and entry.
        Anyone who has the URL can open the image file, so treat shared links
        carefully.
      </p>
      <h3>AI-derived artifacts</h3>
      <p>
        If you use sealing, pattern, or insight features, we may store
        AI-generated titles, topics, pattern labels, short summaries, and short
        verbatim quotes pulled from your writing as “evidence,” plus related
        pattern-card copy. Some insight results may also be cached in your
        browser.
      </p>
      <h3>Safety and quality screening results</h3>
      <p>
        Before an entry is analyzed for patterns, it is automatically screened by
        AI classifiers: one checks for indicators of crisis, self-harm, or
        suicidal ideation; another checks whether an entry has enough
        substantive, self-reflective content to be worth analyzing. For each of
        these checks, we store only a flag (yes/no) and a timestamp: never the
        classifier’s reasoning, never a description of what triggered it, and
        never any copy of the flagged text beyond the original entry you already
        control.
      </p>
      <h3>Feedback you provide</h3>
      <p>
        If you give feedback on a pattern (for example, a thumbs up or down, or a
        reason such as “too vague” or “doesn’t resonate”), we store that
        feedback linked to the relevant pattern so we can review and improve the
        product.
      </p>
      <h3>Technical data</h3>
      <p>
        We and our providers may process standard technical data needed to run
        the app (for example, session cookies from Clerk, and requests required
        to sync and save). We do not currently use a separate product analytics
        or advertising SDK in the app.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To create and secure your account, and keep you signed in</li>
        <li>To save, sync, and display your journal across devices</li>
        <li>To store and show images you attach to entries</li>
        <li>
          To power optional AI features (page titles, pattern detection,
          summaries, and related copy) from your writing
        </li>
        <li>
          To automatically screen entries for crisis/self-harm indicators and
          content substance, before any pattern analysis runs
        </li>
        <li>
          To review feedback you give us and improve pattern quality over time
        </li>
        <li>To keep the service reliable and secure</li>
        <li>To respond when you contact us</li>
      </ul>
      <p>We do not sell your personal writing or account data.</p>

      <h2>4. How AI uses your writing</h2>
      <p>
        Some features send limited portions of your journal text, or short quotes
        already extracted from it, to Anthropic’s Claude API to generate titles,
        patterns, and summaries. Prompts treat the text as a private journal. We
        send what the feature needs (not your entire account history in one
        request), subject to size limits in the product.
      </p>
      <p>
        <strong>Crisis and content screening.</strong> Before pattern analysis
        runs on an entry, it is automatically checked by AI for indicators of
        crisis, self-harm, or suicidal ideation, and separately for whether it
        has enough substantive content to analyze. If an entry is flagged for
        crisis indicators, Unfold does not generate pattern analysis for it, and
        instead shows a message encouraging you to reach out to someone: a
        person you trust, or a local crisis helpline or mental health service.
      </p>
      <p>
        This screening has real limits. It is automated, is not reviewed by a
        person in real time, and is not guaranteed to detect every instance of
        crisis content. Like any automated system, it can fail to flag content
        it should, or (less critically) flag content it shouldn’t. It is a
        supplementary safety feature only, never a monitoring service, a crisis
        line, or a substitute for professional or emergency care. If you are in
        crisis, please contact a local emergency number or crisis line directly
        rather than relying on this feature.
      </p>
      <p>
        If an AI feature cannot reach the provider, Unfold may fall back to
        local, non-AI behavior for that feature; in the case of the crisis and
        quality screening steps specifically, a provider failure does not block
        your ability to write or save, and the entry is treated as unflagged for
        that check.
      </p>

      <h2>How AI Providers Handle Your Writing</h2>
      <p>
        Some Unfold features use artificial intelligence to generate titles,
        summaries, patterns, and reflections from your writing.
      </p>
      <p>When you use these features:</p>
      <ul>
        <li>We send only the information needed for that specific feature.</li>
        <li>
          We do not send your entire journal history in a single request unless
          required for a specific feature.
        </li>
        <li>
          AI providers process your writing only to provide the requested
          functionality.
        </li>
      </ul>
      <p>
        AI-generated insights are created automatically and may not always
        perfectly represent your thoughts or experiences. They are intended as
        tools for reflection, not as definitive interpretations of your
        emotions, personality, or mental health.
      </p>

      <h2>5. Who we share information with</h2>
      <p>
        We use service providers (“processors”) only to run Unfold. They receive
        what they need for their role:
      </p>
      <ul>
        <li>
          <strong>Clerk</strong>: authentication, sessions, and account
          credentials
        </li>
        <li>
          <strong>Our database host (PostgreSQL)</strong>: storing your entries,
          pattern data, feedback, and attachment metadata, scoped to your account
        </li>
        <li>
          <strong>Vercel Blob</strong>: hosting attached image files
        </li>
        <li>
          <strong>Anthropic</strong>: AI inference on text/quotes you trigger
          through product features, including safety and quality screening
        </li>
        <li>
          <strong>Google</strong>: only if you choose Google sign-in (via Clerk),
          and for fonts loaded by the app
        </li>
      </ul>
      <p>
        We may disclose information if required by law, or to protect Unfold,
        our users, or others from harm or abuse.
      </p>

      <h2>6. Where data is stored and governing jurisdiction</h2>
      <p>
        Unfold is operated from India, and our data processors may store or
        process data in India or other countries where our providers operate. By
        using Unfold, you understand your information may be processed outside
        your own country, potentially under different data protection laws.
      </p>
      <p>
        If you are located outside India, you are still responsible for ensuring
        your use of Unfold complies with your local laws, and you accept that
        your data will be handled according to this Privacy Policy and applicable
        Indian law, to the extent applicable. Client drafts and caches may also
        live in your browser (local storage / session storage) on your device.
      </p>

      <h2>7. Retention, deletion, and entry removal</h2>
      <p>
        We keep your account and journal data while your account is active. When
        you delete an entry in Unfold, we soft-delete it and clear its stored
        writing in our database for sync purposes; some related files or derived
        records may take further cleanup. Automated full account wipe and data
        export are not built into the product today.
      </p>
      <p>
        To request account deletion, correction, or a copy of your data, email{" "}
        <a href="mailto:hello.unfoldapp@gmail.com">hello.unfoldapp@gmail.com</a>.
        We will respond and delete or anonymize personal data we control, unless
        we must retain something for legal or security reasons. Depending on where
        you live, you may have additional rights over your personal data under
        local law; contact us to make a request and we will respond as required by
        applicable law.
      </p>

      <h2>8. Age requirement</h2>
      <p>
        Unfold is only for users 18 years of age or older. By creating an account,
        you confirm you are at least 18. Unfold is not directed to, and should
        not be used by, anyone under 18. If we become aware that a user is under
        18, we will take steps to close the account and delete associated
        personal data.
      </p>

      <h2>9. Your choices</h2>
      <ul>
        <li>You can edit or delete individual entries in the product</li>
        <li>You can stop using AI-triggered features by not using those flows</li>
        <li>You can sign out and stop using the service</li>
        <li>
          You can request account deletion, correction, or help with your data
          via email
        </li>
      </ul>

      <h2>Security Measures</h2>
      <p>
        We use trusted infrastructure providers and security practices designed
        to protect your information.
      </p>
      <p>These include:</p>
      <ul>
        <li>Secure authentication through Clerk.</li>
        <li>
          Account-based access controls to ensure users can only access their
          own data.
        </li>
        <li>
          Encrypted connections when your data is transmitted between your
          device and our services.
        </li>
        <li>
          Restricted access to systems that store or process user information.
        </li>
      </ul>
      <p>
        No online service can guarantee complete security. We encourage you to
        use a strong, unique password and avoid sharing access to your account.
      </p>

      <h2>Incident Response</h2>
      <p>
        We take the security of your personal information seriously.
      </p>
      <p>
        If we become aware of a security incident that affects user data, we
        will investigate the issue, take steps to reduce any potential impact,
        and provide notifications when required by applicable laws.
      </p>

      <h2>11. A note on sensitive content</h2>
      <p>
        Unfold includes automated safety screening for crisis-related content,
        but this screening is not a mental health service, is not monitored by a
        human in real time, and cannot guarantee detection of every instance of
        crisis content. If you or someone you know is in crisis, please contact a
        local emergency number or crisis line directly rather than relying on
        this product.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update this Privacy Policy as Unfold evolves. We will change the
        “Last updated” date above. Continued use after an update means you accept
        the revised policy.
      </p>

      <h2>13. Related</h2>
      <p>
        Your use of Unfold is also covered by our{" "}
        <Link href="/terms-and-conditions">Terms and Conditions</Link>.
      </p>
    </LegalShell>
  );
}
