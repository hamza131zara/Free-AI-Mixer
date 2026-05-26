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
import { CardsPage } from "./pages/CardsPage";
import { CardCategoryPage } from "./pages/CardCategoryPage";
import { CardTemplateEditorPage } from "./pages/CardTemplateEditorPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { CookiesPage } from "./pages/CookiesPage";
import { AcceptableUsePage } from "./pages/AcceptableUsePage";
import { DataRetentionPage } from "./pages/DataRetentionPage";
import { AiToolsPage } from "./pages/AiToolsPage";
import { AiToolDetailPage } from "./pages/AiToolDetailPage";
import { AiToolComparePage } from "./pages/AiToolComparePage";
import { AiToolComparisonDetailPage } from "./pages/AiToolComparisonDetailPage";
import { AiNewsPage } from "./pages/AiNewsPage";
import { AiNewsDetailPage } from "./pages/AiNewsDetailPage";
import { SeoMetadata } from "./components/SeoMetadata";
import { ProtectedRouteShell } from "./components/ProtectedRouteShell";
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

  if (routeId === "cards") {
    return <CardsPage />;
  }

  if (
    routeId === "cards-birthday" ||
    routeId === "cards-wedding" ||
    routeId === "cards-invitation" ||
    routeId === "cards-eid" ||
    routeId === "cards-christmas" ||
    routeId === "cards-holi" ||
    routeId === "cards-halloween" ||
    routeId === "cards-business" ||
    routeId === "cards-visiting" ||
    routeId === "cards-gift"
  ) {
    return <CardCategoryPage />;
  }

  if (routeId === "cards-template-detail") {
    return <CardTemplateEditorPage />;
  }

  if (routeId === "ai-tools") {
    return <AiToolsPage />;
  }

  if (routeId === "ai-tool-detail") {
    return <AiToolDetailPage />;
  }

  if (routeId === "compare") {
    return <AiToolComparePage />;
  }

  if (routeId === "compare-detail") {
    return <AiToolComparisonDetailPage />;
  }

  if (routeId === "ai-news") {
    return <AiNewsPage />;
  }

  if (routeId === "ai-news-detail") {
    return <AiNewsDetailPage />;
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

const protectedRouteLabels: Partial<Record<string, string>> = {
  dashboard: "Dashboard",
  projects: "Projects",
  "provider-settings": "Provider Settings",
  credits: "Credits",
};

const renderRouteWithShell = (routeId: string) => {
  const content = renderRouteContent(routeId);
  const routeLabel = protectedRouteLabels[routeId];

  if (!routeLabel) {
    return content;
  }

  return <ProtectedRouteShell routeLabel={routeLabel}>{content}</ProtectedRouteShell>;
};

export function App() {
  const currentRoute = useNavigationStore(selectCurrentRoute);

  return (
    <AppShell>
      <SeoMetadata route={currentRoute} />
      {renderRouteWithShell(currentRoute.id)}
    </AppShell>
  );
}
