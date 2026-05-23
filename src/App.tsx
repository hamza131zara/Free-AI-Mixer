import { AppShell } from "./components/AppShell";
import { MixerPage } from "./pages/MixerPage";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
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

  return <PlaceholderPage />;
};

export function App() {
  const currentRoute = useNavigationStore(selectCurrentRoute);

  return <AppShell>{renderRouteContent(currentRoute.id)}</AppShell>;
}
