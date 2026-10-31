import { AppNav } from "@/components/app-nav";

// Signed-in area. Session and eligibility checks arrive with BEL-0301/0302;
// until then these routes render no user data.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AppNav />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-10"
      >
        {children}
      </main>
    </div>
  );
}
