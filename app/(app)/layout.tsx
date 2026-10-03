import { Nav } from "@/components/nav";
import { AppGuard } from "@/components/app-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <AppGuard>{children}</AppGuard>
      <div className="h-20 md:hidden" />
    </>
  );
}
