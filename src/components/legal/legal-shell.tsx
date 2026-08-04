import Link from "next/link";
import { UnfoldBrand } from "@/components/brand/unfold-brand";
import "@/components/auth/auth-form.css";

type LegalShellProps = {
  title: string;
  active: "terms" | "privacy";
  children: React.ReactNode;
};

export function LegalShell({ title, active, children }: LegalShellProps) {
  return (
    <div className="auth-shell">
      <article className="auth-card legal-doc">
        <header className="legal-doc__header">
          <nav className="legal-doc__switch" aria-label="Legal documents">
            <UnfoldBrand className="legal-doc__brand" />

            <div className="legal-doc__switch-links">
              <Link
                href="/terms-and-conditions"
                className={`legal-doc__switch-link${active === "terms" ? " is-active" : ""}`}
                aria-current={active === "terms" ? "page" : undefined}
              >
                Terms and Conditions
              </Link>
              <span className="legal-doc__switch-sep" aria-hidden>
                ·
              </span>
              <Link
                href="/privacy"
                className={`legal-doc__switch-link${active === "privacy" ? " is-active" : ""}`}
                aria-current={active === "privacy" ? "page" : undefined}
              >
                Privacy Policy
              </Link>
            </div>
          </nav>
        </header>

        <div className="legal-doc__scroll">
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle legal-doc__updated">
            Last updated: August 4, 2026
          </p>

          <div className="legal-doc__body">{children}</div>

          <Link href="/sign-in" className="auth-ghost legal-doc__back">
            Back to sign in
          </Link>
        </div>
      </article>
    </div>
  );
}
