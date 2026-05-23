import { Menu, X } from "lucide-react";
import {
  primaryNavigationItems,
  secondaryNavigationItems,
} from "../services/navigationService";
import { selectCurrentRoute, useNavigationStore } from "../store/navigationStore";

const isActivePath = (currentPath: string, targetPath: string): boolean =>
  currentPath === targetPath;

export function AppNavigation() {
  const currentRoute = useNavigationStore(selectCurrentRoute);
  const mobileMenuOpen = useNavigationStore((state) => state.mobileMenuOpen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const toggleMobileMenu = useNavigationStore((state) => state.toggleMobileMenu);
  const closeMobileMenu = useNavigationStore((state) => state.closeMobileMenu);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button
          type="button"
          className="brand-mark"
          onClick={() => navigateTo("/")}
          aria-label="Go to home"
        >
          <span className="brand-chip">Free AI Mixer</span>
          <span className="brand-subtitle">Product shell</span>
        </button>

        <button
          type="button"
          className="nav-toggle"
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
        </button>

        <nav
          className={mobileMenuOpen ? "site-nav site-nav-open" : "site-nav"}
          aria-label="Primary navigation"
        >
          <div className="nav-group">
            {primaryNavigationItems.map((route) => (
              <button
                key={route.id}
                type="button"
                className={
                  isActivePath(currentRoute.path, route.path)
                    ? "nav-link nav-link-active"
                    : "nav-link"
                }
                onClick={() => navigateTo(route.path)}
              >
                {route.label}
              </button>
            ))}
          </div>
          <div className="nav-group nav-group-secondary">
            {secondaryNavigationItems.map((route) => (
              <button
                key={route.id}
                type="button"
                className={
                  isActivePath(currentRoute.path, route.path)
                    ? "nav-link nav-link-active"
                    : "nav-link"
                }
                onClick={() => navigateTo(route.path)}
              >
                {route.label}
              </button>
            ))}
          </div>
          <button type="button" className="nav-dismiss" onClick={closeMobileMenu}>
            Close menu
          </button>
        </nav>
      </div>
    </header>
  );
}
