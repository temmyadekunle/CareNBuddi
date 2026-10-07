export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mark.svg"
      alt="CareNBuddi logo"
      className={`shrink-0 object-contain ${className ?? ""}`}
      width={48}
      height={48}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-full.svg"
      alt="CareNBuddi — Your Health, Your Buddi."
      className={`h-auto w-auto ${className ?? ""}`}
      width={460}
      height={120}
    />
  );
}
