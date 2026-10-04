import { Nav } from "@/components/nav";
import { AppGuard } from "@/components/app-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="app-shell" className="flex min-h-[720px] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(23,43,77,0.18)]">
      <Nav />
      <div className="flex-1">
        <AppGuard>{children}</AppGuard>
      </div>
      <div className="h-20 md:hidden" />
    </div>
  );
}
