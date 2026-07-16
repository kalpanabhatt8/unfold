import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms and Conditions — Unfold",
  description: "Terms for using Unfold, a private journaling and pattern space.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms and Conditions" active="terms">
      <p>
        These Terms and Conditions (“Terms”) govern your use of Unfold — a private
        journaling product that helps you write, seal entries, and notice
        patterns in your own writing. By creating an account or using Unfold,
        you agree to these Terms.
      </p>

      <h2>1. Who can use Unfold</h2>
      <p>
        You must be at least 13 years old. If you are under the age required to
        consent to online services in your country, you may only use Unfold with
        a parent or guardian’s involvement as required by local law.
      </p>

      <h2>2. Your account</h2>
      <p>
        You sign in with email and password or Google through our authentication
        provider (Clerk). You are responsible for keeping your credentials
        secure and for activity under your account. Contact us if you believe
        your account was accessed without permission.
      </p>

      <h2>3. Your content</h2>
      <p>
        You own the writing, images, captions, and other materials you create in
        Unfold (“Your Content”). You grant us a limited license to store, sync,
        display, and process Your Content only as needed to operate Unfold for
        you — including backups, sync across devices, and optional AI features
        described in our Privacy Policy.
      </p>
      <p>
        Do not upload content you do not have the right to use, or content that
        is illegal or that violates someone else’s rights.
      </p>

      <h2>4. How Unfold works with your writing</h2>
      <p>
        When you write and sync, Your Content is stored in our database under
        your account. Images you attach may be stored with our file host. If you
        use pattern and analysis features, excerpts of your writing may be sent
        to our AI provider to generate titles, topics, patterns, and summaries —
        as described in the Privacy Policy.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        You agree not to misuse Unfold: no unauthorized access to other accounts
        or systems, no attempts to disrupt the service, no scraping or automated
        abuse, and no unlawful use of the product.
      </p>

      <h2>6. Service changes</h2>
      <p>
        We may update, pause, or discontinue features. We try to keep Unfold
        reliable, but we do not guarantee uninterrupted access. We are not
        liable for lost content beyond what applicable law requires — please keep
        your own copies of important writing if that matters to you.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may stop using Unfold at any time. To request account deletion,
        email us (see Contact). We may suspend or end access if you violate
        these Terms or if we must for security or legal reasons.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        Unfold is a journaling tool, not medical, therapeutic, or diagnostic
        advice. Pattern labels and insights are optional reflections on your own
        text, not clinical assessments. The service is provided “as is” to the
        fullest extent allowed by law.
      </p>

      <h2>9. Changes to these Terms</h2>
      <p>
        We may update these Terms. We will revise the “Last updated” date above.
        Continued use after changes means you accept the updated Terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:hello@unfold.app">hello@unfold.app</a>
      </p>
    </LegalShell>
  );
}
