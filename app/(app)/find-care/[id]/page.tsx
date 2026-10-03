import { PROVIDERS } from "@/lib/content";
import ProviderProfilePage from "./client";

export function generateStaticParams() {
  return PROVIDERS.map((p) => ({ id: p.id }));
}

export default function Page() {
  return <ProviderProfilePage />;
}
