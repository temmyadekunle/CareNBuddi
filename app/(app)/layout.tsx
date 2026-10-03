import { Nav } from "@/components/nav";
import { AppGuard } from "@/components/app-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50 shadow-xl md:my-6 md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[2rem] md:border md:border-slate-200">
      <Nav />
      <div className="flex-1">
        <AppGuard>{children}</AppGuard>
      </div>
      <div className="h-20 md:hidden" />
    </div>
  );
}
