import { useEffect, useState } from "react";
import { ChevronDown, Menu, UserCircle, X } from "lucide-react";
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

const accountMenuTriggerLabel = (email?: string): string =>
  email ? `Account menu for ${email}` : "Account menu";

export function AppNavigation() {
  const currentRoute = useNavigationStore(selectCurrentRoute);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const mobileMenuOpen = useNavigationStore((state) => state.mobileMenuOpen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const toggleMobileMenu = useNavigationStore((state) => state.toggleMobileMenu);
  const closeMobileMenu = useNavigationStore((state) => state.closeMobileMenu);
  const authStatus = useAuthStore((state) => state.status);
  const identity = useAuthStore((state) => state.identity);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [currentRoute.path]);

  const closeAccountMenu = (): void => {
    setAccountMenuOpen(false);
  };

  const handleLogout = (): void => {
    closeAccountMenu();
    void logout().then(() => {
      if (useAuthStore.getState().status === "unauthenticated") {
        navigateTo("/login");
      }
    });
  };
  const navigateToAccountRoute = (path: string): void => {
    closeAccountMenu();
    navigateTo(path);
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
              <div className="account-menu" data-testid="account-menu">
                <button
                  type="button"
                  className="account-menu-trigger"
                  aria-label={accountMenuTriggerLabel(identity?.email)}
                  aria-expanded={accountMenuOpen}
                  data-testid="account-menu-trigger"
                  onClick={() => setAccountMenuOpen((isOpen) => !isOpen)}
                >
                  <UserCircle aria-hidden="true" size={18} />
                  <span className="account-menu-trigger-copy" data-testid="account-nav-identity">
                    {identity?.email ?? "Signed in"}
                  </span>
                  <ChevronDown aria-hidden="true" size={16} />
                </button>
                {accountMenuOpen ? (
                  <div className="account-menu-panel" data-testid="account-menu-panel">
                    {accountNavigationItems.map((route) => (
                      <button
                        key={`account-menu-${route.id}`}
                        type="button"
                        className={
                          isActivePath(currentRoute.path, route.path)
                            ? "account-menu-item account-menu-item-active"
                            : "account-menu-item"
                        }
                        onClick={() => navigateToAccountRoute(route.path)}
                      >
                        {route.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="account-menu-item account-menu-logout"
                      onClick={handleLogout}
                      disabled={pendingAction === "logout"}
                    >
                      {pendingAction === "logout" ? "Logging out..." : "Log out"}
                    </button>
                  </div>
                ) : null}
              </div>
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
                {authStatus === "authenticated" ? (
                  <>
                    <span className="nav-link" data-testid="mobile-account-nav-identity">
                      {identity?.email ?? "Signed in"}
                    </span>
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
