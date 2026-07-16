import "@/components/auth/auth-form.css";

/** Mimics the credentials card while Clerk / session state loads. */
export function AuthFormSkeleton() {
  return (
    <div className="auth-shell">
      <div className="auth-card" aria-busy="true" aria-label="Loading">
        <div className="auth-skeleton">
          <div className="auth-skeleton__header">
            <span className="auth-skeleton__bar auth-skeleton__bar--title" />
            <span className="auth-skeleton__bar auth-skeleton__bar--subtitle" />
          </div>

          <span className="auth-skeleton__pill auth-skeleton__pill--google" />
          <span className="auth-skeleton__divider" />

          <div className="auth-skeleton__field">
            <span className="auth-skeleton__bar auth-skeleton__bar--label" />
            <span className="auth-skeleton__pill" />
          </div>
          <div className="auth-skeleton__field">
            <span className="auth-skeleton__bar auth-skeleton__bar--label" />
            <span className="auth-skeleton__pill" />
          </div>

          <span className="auth-skeleton__bar auth-skeleton__bar--check" />
          <span className="auth-skeleton__pill auth-skeleton__pill--submit" />
        </div>
      </div>
    </div>
  );
}
