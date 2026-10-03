import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
