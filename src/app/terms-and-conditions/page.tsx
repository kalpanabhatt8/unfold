import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms and Conditions - Unfold",
  description: "Terms for using Unfold, a private journaling and pattern space.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms and Conditions" active="terms">
      <p>
        These Terms and Conditions (“Terms”) govern your use of Unfold, a private
        journaling product that helps you write, seal entries, and notice
        patterns in your own writing. By creating an account or using Unfold,
        you agree to these Terms.
      </p>
      <p>
        This document was prepared with AI assistance and has not yet been
        reviewed by a lawyer. Given that Unfold includes automated
        crisis-detection features and serves users across multiple countries, we
        strongly recommend a legal review before relying on this document,
        particularly Sections 9 and 10.
      </p>

      <h2>1. Who can use Unfold</h2>
      <p>
        You must be at least 18 years old to use Unfold. By creating an account,
        you represent and confirm that you meet this requirement. Unfold is not
        directed to, and must not be used by, anyone under 18.
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
        you, including backups, sync across devices, and optional AI features
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
        to our AI provider to generate titles, topics, patterns, and summaries,
        as described in the Privacy Policy.
      </p>
      <p>
        Before pattern analysis runs, entries are also automatically screened for
        crisis or self-harm indicators and for whether they contain enough
        substantive content to analyze. This screening is automated, is not
        reviewed by a person in real time, is not guaranteed to catch every
        instance of crisis-related content, and is not a substitute for
        professional or emergency care.
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
        liable for lost content beyond what applicable law requires. Please keep
        your own copies of important writing if that matters to you.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may stop using Unfold at any time. To request account deletion,
        email us (see Contact). We may suspend or end access if you violate
        these Terms, if we believe you do not meet the age requirement, or if we
        must for security or legal reasons.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        Unfold is a journaling tool, not medical, therapeutic, or diagnostic
        advice. Pattern labels and insights are optional reflections on your own
        text, not clinical assessments. Automated crisis screening is a
        supplementary safety feature, not a monitoring service, a crisis hotline,
        or a substitute for professional or emergency help, and it is not
        guaranteed to detect every instance of crisis content. If you are in
        crisis, please contact a local emergency service or crisis line directly.
        The service is provided “as is” to the fullest extent allowed by law,
        without warranties of any kind.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Unfold and its operators are not
        liable for indirect, incidental, or consequential damages arising from
        your use of the service, including reliance on automated screening
        features. Nothing in these Terms limits liability where such limitation
        is not permitted by applicable law.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, without regard to conflict
        of law principles. Unfold is available to users worldwide; however, any
        dispute arising from these Terms or your use of Unfold will be subject to
        the exclusive jurisdiction of the courts located in India, unless
        applicable local law in your country grants you rights that cannot be
        waived by this clause.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms. We will revise the “Last updated” date above.
        Continued use after changes means you accept the updated Terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:hello.unfoldapp@gmail.com">hello.unfoldapp@gmail.com</a>
      </p>
    </LegalShell>
  );
}
