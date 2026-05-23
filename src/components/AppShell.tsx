import type { PropsWithChildren } from "react";
import { AppNavigation } from "./AppNavigation";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <AppNavigation />
      <div className="site-main">{children}</div>
    </div>
  );
}
