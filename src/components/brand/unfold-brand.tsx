import Link from "next/link";

type UnfoldBrandProps = {
  href?: string;
  className?: string;
};

/** Logo mark matching the landing header — not the dashboard sidebar title. */
export function UnfoldBrand({ href = "/", className }: UnfoldBrandProps) {
  return (
    <Link
      href={href}
      className={["unfold-brand", className].filter(Boolean).join(" ")}
    >
      <span className="mr-[0.03em]">U</span>NFOLD
    </Link>
  );
}
