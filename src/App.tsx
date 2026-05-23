import { AppShell } from "./components/AppShell";
import { MixerPage } from "./pages/MixerPage";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProviderSettingsPage } from "./pages/ProviderSettingsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ExportHistoryPage } from "./pages/ExportHistoryPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PricingPage } from "./pages/PricingPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { CookiesPage } from "./pages/CookiesPage";
import { AcceptableUsePage } from "./pages/AcceptableUsePage";
import { DataRetentionPage } from "./pages/DataRetentionPage";
import { SeoMetadata } from "./components/SeoMetadata";
import { selectCurrentRoute, useNavigationStore } from "./store/navigationStore";

const renderRouteContent = (routeId: string) => {
  if (routeId === "home") {
    return <HomePage />;
  }

  if (routeId === "dashboard") {
    return <DashboardPage />;
  }

  if (routeId === "login") {
    return <LoginPage />;
  }

  if (routeId === "signup") {
    return <SignupPage />;
  }

  if (routeId === "mixer") {
    return <MixerPage />;
  }

  if (routeId === "templates") {
    return <TemplatesPage />;
  }

  if (routeId === "provider-settings") {
    return <ProviderSettingsPage />;
  }

  if (routeId === "projects") {
    return <ProjectsPage />;
  }

  if (routeId === "exports") {
    return <ExportHistoryPage />;
  }

  if (routeId === "credits") {
    return <CreditsPage />;
  }

  if (routeId === "pricing") {
    return <PricingPage />;
  }

  if (routeId === "onboarding") {
    return <OnboardingPage />;
  }

  if (routeId === "admin") {
    return <AdminPage />;
  }

  if (routeId === "help") {
    return <HelpPage />;
  }

  if (routeId === "privacy") {
    return <PrivacyPage />;
  }

  if (routeId === "terms") {
    return <TermsPage />;
  }

  if (routeId === "cookies") {
    return <CookiesPage />;
  }

  if (routeId === "acceptable-use") {
    return <AcceptableUsePage />;
  }

  if (routeId === "data-retention") {
    return <DataRetentionPage />;
  }

  return <PlaceholderPage />;
};

export function App() {
  const currentRoute = useNavigationStore(selectCurrentRoute);

  return (
    <AppShell>
      <SeoMetadata route={currentRoute} />
      {renderRouteContent(currentRoute.id)}
    </AppShell>
  );
}
