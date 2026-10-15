import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { RNPHealthBanner } from "@/components/rnp/RNPHealthBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="lg:pl-60">
        <Header />
        <RNPHealthBanner />
        <main className="mx-auto max-w-[1400px] px-4 py-5 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
