import type { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  tone = "white",
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
  children: ReactNode;
  tone?: "white" | "tint" | "brand";
  className?: string;
}) {
  const tones = {
    white: "bg-white",
    tint: "bg-brand-50/40",
    brand: "bg-brand-900 text-white",
  } as const;

  return (
    <section
      id={id}
      className={`scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 ${tones[tone]} ${className ?? ""}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p
              className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                tone === "brand" ? "text-brand-200" : "text-brand-700"
              }`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${
              tone === "brand" ? "text-white" : "text-slate-900"
            }`}
          >
            {title}
          </h2>
          {lede ? (
            <p
              className={`mt-3 text-lg leading-relaxed ${
                tone === "brand" ? "text-brand-100" : "text-slate-600"
              }`}
            >
              {lede}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function CtaLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "onBrand";
}) {
  const styles = {
    primary:
      "bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:outline-brand-700",
    secondary:
      "border border-slate-300 bg-white text-slate-800 hover:border-brand-400 hover:text-brand-800",
    onBrand: "bg-white text-brand-900 hover:bg-brand-50",
  } as const;

  return (
    <a
      href={href}
      className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${styles[variant]}`}
    >
      {children}
    </a>
  );
}
