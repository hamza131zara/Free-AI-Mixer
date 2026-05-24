import type { PropsWithChildren } from "react";
import { AppNavigation } from "./AppNavigation";
import { AppFooter } from "./AppFooter";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <AppNavigation />
      <div className="site-main">{children}</div>
      <AppFooter />
    </div>
  );
}
