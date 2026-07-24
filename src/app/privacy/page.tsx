import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Unfold",
  description:
    "How Unfold collects, stores, and uses your journal data and account information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" active="privacy">
      <p>
        This Privacy Policy explains what information Unfold collects, how we
        use it, and who helps us process it. Unfold is built for private
        writing — this document matches how the product works today.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Unfold (“we”, “us”) operates the Unfold web app. For privacy questions or
        data requests, contact{" "}
        <a href="mailto:hello.unfoldapp@gmail.com">hello.unfoldapp@gmail.com</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Account information</h3>
      <p>
        When you sign up or sign in, our authentication provider (Clerk) may
        collect your email address, password (stored by Clerk), username, and —
        if you use Google — profile details Google shares for sign-in (such as
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
        If you use sealing, pattern, or insight features, we may store AI-generated
        titles, topics, pattern labels, short summaries, and short verbatim quotes
        pulled from your writing as “evidence,” plus related pattern-card copy.
        Some insight results may also be cached in your browser.
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
        <li>To keep the service reliable and secure</li>
        <li>To respond when you contact us</li>
      </ul>
      <p>We do not sell your personal writing or account data.</p>

      <h2>4. How AI uses your writing</h2>
      <p>
        Some features send limited portions of your journal text — or short quotes
        already extracted from it — to Anthropic’s Claude API to generate
        titles, patterns, and summaries. Prompts treat the text as a private
        journal. We send what the feature needs (not your entire account history
        in one request), subject to size limits in the product.
      </p>
      <p>
        If an AI feature cannot reach the provider, Unfold may fall back to
        local, non-AI behavior for that feature.
      </p>

      <h2>5. Who we share information with</h2>
      <p>
        We use service providers (“processors”) only to run Unfold. They receive
        what they need for their role:
      </p>
      <ul>
        <li>
          <strong>Clerk</strong> — authentication, sessions, and account
          credentials
        </li>
        <li>
          <strong>Our database host (PostgreSQL)</strong> — storing your entries,
          pattern data, and attachment metadata, scoped to your account
        </li>
        <li>
          <strong>Vercel Blob</strong> — hosting attached image files
        </li>
        <li>
          <strong>Anthropic</strong> — AI inference on text/quotes you trigger
          through product features
        </li>
        <li>
          <strong>Google</strong> — only if you choose Google sign-in (via Clerk),
          and for fonts loaded by the app
        </li>
      </ul>
      <p>
        We may disclose information if required by law, or to protect Unfold,
        our users, or others from harm or abuse.
      </p>

      <h2>6. Where data is stored</h2>
      <p>
        Account and journal data are stored with our cloud providers. Client
        drafts and caches may also live in your browser (local storage /
        session storage) on your device.
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
        To request account deletion or a copy of your data, email{" "}
        <a href="mailto:hello.unfoldapp@gmail.com">hello.unfoldapp@gmail.com</a>. We will respond
        and delete or anonymize personal data we control, unless we must retain
        something for legal or security reasons.
      </p>

      <h2>8. Children</h2>
      <p>
        Unfold is not directed to children under 13. We ask users to confirm they
        are 13 or older when creating an account. If you believe a child under 13
        has an account, contact us and we will take steps to delete it.
      </p>

      <h2>9. Your choices</h2>
      <ul>
        <li>You can edit or delete individual entries in the product</li>
        <li>You can stop using AI-triggered features by not using those flows</li>
        <li>You can sign out and stop using the service</li>
        <li>
          You can request account deletion or help with your data via email
        </li>
      </ul>

      <h2>10. Security</h2>
      <p>
        We use signed-in sessions, account scoping in our database, and
        industry-standard providers for auth and storage. No method of
        transmission or storage is 100% secure; please use a strong unique
        password.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update this Privacy Policy as Unfold evolves. We will change the
        “Last updated” date above. Continued use after an update means you accept
        the revised policy.
      </p>

      <h2>12. Related</h2>
      <p>
        Your use of Unfold is also covered by our{" "}
        <Link href="/terms">Terms and Conditions</Link>.
      </p>
    </LegalShell>
  );
}
