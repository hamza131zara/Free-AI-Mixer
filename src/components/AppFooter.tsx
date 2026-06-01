import {
  exploreFooterItems,
  legalNavigationItems,
  productFooterItems,
  resourceNavigationItems,
} from "../services/navigationService";
import { useNavigationStore } from "../store/navigationStore";

export function AppFooter() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <footer className="site-footer" data-testid="site-footer">
      <div className="site-footer-inner">
        <div className="footer-top-row">
          <button
            type="button"
            className="footer-wordmark"
            onClick={() => navigateTo("/")}
            aria-label="Go to Free AI Mixer home"
          >
            <span className="footer-wordmark-mark" aria-hidden="true">
              FM
            </span>
            <span className="footer-wordmark-copy">
              <span className="footer-wordmark-title">Free AI Mixer</span>
              <span className="footer-wordmark-subtitle">Static product shell, real boundaries.</span>
            </span>
          </button>

          <div className="footer-social-row" aria-label="Contact and social">
            <a
              className="footer-social-link footer-social-link-live"
              href="mailto:ameer131hd@gmail.com"
            >
              Email
            </a>
            <button type="button" className="footer-social-link" disabled aria-label="X coming soon">
              X
            </button>
            <button
              type="button"
              className="footer-social-link"
              disabled
              aria-label="Facebook coming soon"
            >
              Facebook
            </button>
            <button
              type="button"
              className="footer-social-link"
              disabled
              aria-label="YouTube coming soon"
            >
              YouTube
            </button>
          </div>
        </div>

        <div className="footer-grid">
          <div className="footer-section">
            <h3>Product</h3>
            {productFooterItems.map((route) => (
              <button
                key={route.id}
                type="button"
                className="footer-link"
                onClick={() => navigateTo(route.path)}
              >
                {route.label}
              </button>
            ))}
          </div>

          <div className="footer-section">
            <h3>Explore</h3>
            {exploreFooterItems.map((route) => (
              <button
                key={route.id}
                type="button"
                className="footer-link"
                onClick={() => navigateTo(route.path)}
              >
                {route.label}
              </button>
            ))}
          </div>

          <div className="footer-section">
            <h3>Resources</h3>
            {resourceNavigationItems.map((route) => (
              <button
                key={route.id}
                type="button"
                className="footer-link"
                onClick={() => navigateTo(route.path)}
              >
                {route.label}
              </button>
            ))}
          </div>

          <div className="footer-section">
            <h3>Legal</h3>
            {legalNavigationItems.map((route) => (
              <button
                key={route.id}
                type="button"
                className="footer-link"
                onClick={() => navigateTo(route.path)}
              >
                {route.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
