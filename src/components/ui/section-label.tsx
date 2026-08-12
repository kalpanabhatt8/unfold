export function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[0.6875rem] font-medium tracking-[0.01em] text-tertiary uppercase">
      {children}
    </p>
  );
}
