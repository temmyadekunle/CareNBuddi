export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/symbol.png"
      alt="CareNBuddi logo"
      className={`block shrink-0 object-contain ${className ?? ""}`}
      width={512}
      height={512}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-lockup.png"
      alt="CareNBuddi — Your Health, Your Buddi."
      className={`block w-auto shrink-0 object-contain ${className ?? ""}`}
      width={2072}
      height={512}
    />
  );
}
