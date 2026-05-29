import { Menu, X } from "lucide-react";
import {
  accountNavigationItems,
  authNavigationItems,
  primaryNavigationItems,
  legalNavigationItems,
  resourceNavigationItems,
} from "../services/navigationService";
import { useAuthStore } from "../store/authStore";
import { selectCurrentRoute, useNavigationStore } from "../store/navigationStore";

const isActivePath = (currentPath: string, targetPath: string): boolean =>
  currentPath === targetPath;

export function AppNavigation() {
  const currentRoute = useNavigationStore(selectCurrentRoute);
  const mobileMenuOpen = useNavigationStore((state) => state.mobileMenuOpen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const toggleMobileMenu = useNavigationStore((state) => state.toggleMobileMenu);
  const closeMobileMenu = useNavigationStore((state) => state.closeMobileMenu);
  const authStatus = useAuthStore((state) => state.status);
  const identity = useAuthStore((state) => state.identity);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const logout = useAuthStore((state) => state.logout);
  const handleLogout = (): void => {
    void logout().then(() => {
      if (useAuthStore.getState().status === "unauthenticated") {
        navigateTo("/login");
      }
    });
  };

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
          <div className="nav-group nav-group-primary">
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
          <div className="nav-group nav-group-auth nav-group-desktop-auth">
            {authStatus === "authenticated" ? (
              <>
                <span className="nav-link" data-testid="account-nav-identity">
                  {identity?.email ?? "Signed in"}
                </span>
                <button
                  type="button"
                  className={
                    isActivePath(currentRoute.path, "/dashboard")
                      ? "nav-link nav-link-active"
                      : "nav-link"
                  }
                  onClick={() => navigateTo("/dashboard")}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  className={
                    isActivePath(currentRoute.path, "/settings/providers")
                      ? "nav-link nav-link-active"
                      : "nav-link"
                  }
                  onClick={() => navigateTo("/settings/providers")}
                >
                  Provider Settings
                </button>
                <button
                  type="button"
                  className={
                    isActivePath(currentRoute.path, "/credits")
                      ? "nav-link nav-link-active"
                      : "nav-link"
                  }
                  onClick={() => navigateTo("/credits")}
                >
                  Credits
                </button>
                <button
                  type="button"
                  className={
                    isActivePath(currentRoute.path, "/help")
                      ? "nav-link nav-link-active"
                      : "nav-link"
                  }
                  onClick={() => navigateTo("/help")}
                >
                  Help
                </button>
                <button
                  type="button"
                  className="nav-link"
                  onClick={handleLogout}
                  disabled={pendingAction === "logout"}
                >
                  {pendingAction === "logout" ? "Logging out..." : "Log out"}
                </button>
              </>
            ) : (
              authNavigationItems.map((route) => (
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
              ))
            )}
          </div>
          <div className="mobile-nav-groups" data-testid="mobile-nav-groups">
            <section className="mobile-nav-section">
              <p className="mobile-nav-heading">Product</p>
              <div className="nav-group">
                {primaryNavigationItems.map((route) => (
                  <button
                    key={`mobile-product-${route.id}`}
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
            </section>

            <section className="mobile-nav-section">
              <p className="mobile-nav-heading">Account</p>
              <div className="nav-group">
                {accountNavigationItems.map((route) => (
                  <button
                    key={`mobile-account-${route.id}`}
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
                {authStatus === "authenticated" ? (
                  <>
                    <span className="nav-link" data-testid="mobile-account-nav-identity">
                      {identity?.email ?? "Signed in"}
                    </span>
                    <button
                      type="button"
                      className="nav-link"
                      onClick={handleLogout}
                      disabled={pendingAction === "logout"}
                    >
                      {pendingAction === "logout" ? "Logging out..." : "Log out"}
                    </button>
                  </>
                ) : (
                  authNavigationItems.map((route) => (
                    <button
                      key={`mobile-auth-${route.id}`}
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
                  ))
                )}
              </div>
            </section>

            <section className="mobile-nav-section">
              <p className="mobile-nav-heading">Resources</p>
              <div className="nav-group">
                {resourceNavigationItems.map((route) => (
                  <button
                    key={`mobile-resource-${route.id}`}
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
            </section>

            <section className="mobile-nav-section">
              <p className="mobile-nav-heading">Legal</p>
              <div className="nav-group">
                {legalNavigationItems.map((route) => (
                  <button
                    key={`mobile-legal-${route.id}`}
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
            </section>
          </div>
          <button type="button" className="nav-dismiss" onClick={closeMobileMenu}>
            Close menu
          </button>
        </nav>
      </div>
    </header>
  );
}
