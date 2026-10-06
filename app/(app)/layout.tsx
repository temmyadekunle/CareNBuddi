import { Nav, BottomNav } from "@/components/nav";
import { AppGuard } from "@/components/app-guard";
import { ToastProvider } from "@/components/app-ui";
import { CloudProvider } from "@/lib/supabase/cloud";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas">
      <CloudProvider>
        <ToastProvider>
          <div id="app-shell">
            <Nav />
            <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 scroll-smooth">
              <AppGuard>{children}</AppGuard>
            </main>
            <BottomNav />
          </div>
        </ToastProvider>
      </CloudProvider>
    </div>
  );
}