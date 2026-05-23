import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initializeAuthStore } from "./store/authStore";
import { initializeNavigationStore } from "./store/navigationStore";
import "./styles.css";

initializeNavigationStore();
initializeAuthStore();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
