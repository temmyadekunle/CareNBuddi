import { Nav } from "@/components/nav";
import { AppGuard } from "@/components/app-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="app-shell" className="relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-[0_18px_50px_rgba(23,43,77,0.18)] md:h-[720px]">
      <Nav />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AppGuard>{children}</AppGuard>
        <div className="h-20" />
      </div>
    </div>
  );
}
