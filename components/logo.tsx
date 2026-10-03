export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.jpeg"
      alt="HealthLink logo"
      className={`shrink-0 rounded-lg bg-white object-contain ring-1 ring-slate-200 ${className ?? ""}`}
      width={48}
      height={48}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="h-12 w-12" />
      <span className="whitespace-nowrap text-xl font-semibold tracking-tight text-slate-900">
        HealthLink
      </span>
    </span>
  );
}