export interface NavigationSection {
  title: string;
  body: string;
}

export interface AppRouteDefinition {
  id:
    | "home"
    | "dashboard"
    | "login"
    | "signup"
    | "mixer"
    | "templates"
    | "projects"
    | "exports"
    | "provider-settings"
    | "credits"
    | "pricing"
    | "help"
    | "privacy"
    | "terms";
  path: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  kind:
    | "home"
    | "workbench"
    | "placeholder"
    | "auth"
    | "dashboard"
    | "provider-settings";
  status: string;
  sections: NavigationSection[];
}

export const appRoutes: AppRouteDefinition[] = [
  {
    id: "home",
    path: "/",
    label: "Home",
    eyebrow: "Product Phase 1",
    title: "Free AI Mixer is moving from workbench to product shell",
    description:
      "The mixer workbench is live locally today. Account, templates, credits, billing, and support surfaces are being added in later product phases.",
    kind: "home",
    status: "Workbench live locally",
    sections: [
      {
        title: "What is available right now",
        body:
          "The Mixer route preserves the current scene generation and timeline workbench. Export, download, and provider boundaries remain honest and fail closed when configuration is missing.",
      },
      {
        title: "What is not enabled yet",
        body:
          "Dashboard, templates, project history, provider settings, credits, pricing, support, privacy, and terms are now routed into the shell, but most of those areas are still placeholder pages in this product phase.",
      },
      {
        title: "Product notes",
        body:
          "Future BYOK users may later get 2500 daily Free AI Mixer platform credits. BYOK users still pay provider generation cost through their own API keys, multiple API keys do not multiply daily credits, and audio remains optional based on provider capability instead of being a separate early setup.",
      },
    ],
  },
  {
    id: "dashboard",
    path: "/dashboard",
    label: "Dashboard",
    eyebrow: "Product Phase 2",
    title: "Account dashboard boundary",
    description:
      "This dashboard now checks backend session truth. It stays limited until real auth, persistence, and workspace features are fully enabled in later product phases.",
    kind: "dashboard",
    status: "Auth boundary only",
    sections: [
      {
        title: "What lands here in this phase",
        body:
          "The dashboard can show backend-verified session status and account identity only when a real authenticated session exists. It does not fabricate projects, credits, or provider setup.",
      },
      {
        title: "What still waits for later phases",
        body:
          "Workspace switching, durable project history, export history, provider settings, and credits remain separate product phases and stay clearly marked as not enabled yet.",
      },
    ],
  },
  {
    id: "login",
    path: "/login",
    label: "Log in",
    eyebrow: "Product Phase 2",
    title: "Log in route",
    description:
      "This route asks the backend auth boundary for real session support. If auth is not configured, the page stays honest and unavailable instead of faking a login.",
    kind: "auth",
    status: "Auth boundary only",
    sections: [
      {
        title: "What this route does",
        body:
          "Login requests are sent to the backend auth boundary only. No demo session, local fake user, or trusted-header shortcut is allowed here.",
      },
      {
        title: "What this route does not do",
        body:
          "This phase does not add provider key setup, billing, credits, workspace switching, or public launch auth flows.",
      },
    ],
  },
  {
    id: "signup",
    path: "/signup",
    label: "Sign up",
    eyebrow: "Product Phase 2",
    title: "Sign up route",
    description:
      "This route keeps signup fail closed unless a real backend auth provider is configured. It does not fabricate an account or session locally.",
    kind: "auth",
    status: "Auth boundary only",
    sections: [
      {
        title: "What this route does",
        body:
          "Signup requests go through the backend auth boundary only. Account identity can be shown later only if the backend verifies it.",
      },
      {
        title: "What this route does not do",
        body:
          "No fake onboarding state, fake workspace creation, or fake welcome dashboard is created in this product phase.",
      },
    ],
  },
  {
    id: "mixer",
    path: "/mixer",
    label: "Mixer",
    eyebrow: "Workbench",
    title: "Mixer workbench",
    description:
      "This route preserves the current scene generation, queue, timeline, and export workbench behavior.",
    kind: "workbench",
    status: "Available now",
    sections: [],
  },
  {
    id: "templates",
    path: "/templates",
    label: "Templates",
    eyebrow: "Coming later",
    title: "Templates are not enabled yet",
    description:
      "Template browsing, starter packs, and template creation are coming in a later product phase.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "Credit model",
        body:
          "Templates will use the same global credit wallet as mixer generation, export flows, and approved download-related platform actions when credits are implemented later.",
      },
      {
        title: "Current limitation",
        body:
          "This phase does not implement template generation, template editing, or fake ready-to-use template catalogs.",
      },
    ],
  },
  {
    id: "projects",
    path: "/projects",
    label: "Projects",
    eyebrow: "Coming later",
    title: "Projects are not enabled yet",
    description:
      "A durable project library, history, and multi-session project management are coming in a later product phase.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "What will land here",
        body:
          "Projects will eventually show saved work, reusable timelines, and durable account-linked history instead of the current browser-local workbench persistence only.",
      },
      {
        title: "Current limitation",
        body:
          "This shell page does not fake project history, project collaboration, or cloud persistence.",
      },
    ],
  },
  {
    id: "exports",
    path: "/history",
    label: "Exports",
    eyebrow: "Coming later",
    title: "Export history is not enabled yet",
    description:
      "Durable export history, account-linked artifact history, and user-facing recovery flows are coming in a later product phase.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "What exists today",
        body:
          "The Mixer workbench still owns the current request-export and artifact descriptor flow. This route does not invent completed exports or public artifact history.",
      },
      {
        title: "What is deferred",
        body:
          "Real account-level export history, download history, and recovery tooling depend on later auth, persistence, and production artifact delivery phases.",
      },
    ],
  },
  {
    id: "provider-settings",
    path: "/settings/providers",
    label: "Provider Settings",
    eyebrow: "Product Phase 3",
    title: "Provider settings and routing foundation",
    description:
      "This route now shows provider catalog and routing metadata through protected backend-owned state. Secure key connection and live validation remain disabled.",
    kind: "provider-settings",
    status: "Read-only foundation",
    sections: [
      {
        title: "BYOK model",
        body:
          "In BYOK mode, users pay provider generation cost through their own API keys. Free AI Mixer platform credits, when added later, are separate from provider billing.",
      },
      {
        title: "Important limits",
        body:
          "Future BYOK users may later get 2500 daily Free AI Mixer platform credits, but multiple API keys do not multiply those daily credits. Audio is optional and provider-capability based, not a separate early setup screen.",
      },
      {
        title: "Current limitation",
        body:
          "No provider keys can be connected, stored, validated, or shown as active in this product phase.",
      },
    ],
  },
  {
    id: "credits",
    path: "/credits",
    label: "Credits",
    eyebrow: "Coming later",
    title: "Credits are not enabled yet",
    description:
      "A real platform credit wallet, ledger, and usage history are coming in a later product phase.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "Planned platform model",
        body:
          "Free BYOK users may later get 2500 daily Free AI Mixer platform credits. Those credits are platform credits only and do not cover provider generation charges charged through user-owned API keys.",
      },
      {
        title: "Shared wallet rules",
        body:
          "Templates will use the same global credit wallet as mixer, export, and approved download flows. Multiple API keys do not multiply daily platform credits.",
      },
      {
        title: "Current limitation",
        body:
          "No live credit balance, ledger, refill state, or fake remaining-credit value is shown in this phase.",
      },
    ],
  },
  {
    id: "pricing",
    path: "/pricing",
    label: "Pricing",
    eyebrow: "Coming later",
    title: "Pricing is not enabled yet",
    description:
      "Commercial plans, subscriptions, and billing decisions are coming in a later product phase.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "What can be stated now",
        body:
          "BYOK users will still pay provider generation cost through their own API keys. Platform credits, subscriptions, and billing rules are not finalized in this phase.",
      },
      {
        title: "Current limitation",
        body:
          "This page does not show fake plans, fake checkout buttons, or fake entitlements.",
      },
    ],
  },
  {
    id: "help",
    path: "/help",
    label: "Help",
    eyebrow: "Coming later",
    title: "Help and support are not enabled yet",
    description:
      "A public support path, product guidance, and launch-ready help content are coming in a later product phase.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "What will land here",
        body:
          "Later phases should add setup guidance, known limitations, support/contact paths, and user-safe troubleshooting for BYOK, exports, and credits.",
      },
      {
        title: "Current limitation",
        body:
          "This phase does not add live chat, ticketing, fake support forms, or fake SLA claims.",
      },
    ],
  },
  {
    id: "privacy",
    path: "/privacy",
    label: "Privacy",
    eyebrow: "Coming later",
    title: "Privacy page is not enabled yet",
    description:
      "A production privacy policy will be added in a later product phase alongside auth, billing, and public launch preparation.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "Current limitation",
        body:
          "This placeholder does not pretend a final privacy policy already exists. Legal review and production policy text are still pending.",
      },
    ],
  },
  {
    id: "terms",
    path: "/terms",
    label: "Terms",
    eyebrow: "Coming later",
    title: "Terms page is not enabled yet",
    description:
      "Production terms of service will be added in a later product phase alongside launch and billing preparation.",
    kind: "placeholder",
    status: "Not enabled yet",
    sections: [
      {
        title: "Current limitation",
        body:
          "This placeholder does not present fake legal acceptance or a final public contract. That work belongs to a later product phase.",
      },
    ],
  },
];

export const primaryNavigationItems = appRoutes.filter(
  (route) =>
    route.id !== "login" &&
    route.id !== "signup" &&
    route.id !== "privacy" &&
    route.id !== "terms",
);

export const secondaryNavigationItems = appRoutes.filter(
  (route) => route.id === "privacy" || route.id === "terms",
);

export const authNavigationItems = appRoutes.filter(
  (route) => route.id === "login" || route.id === "signup",
);

const routeMap = new Map(appRoutes.map((route) => [route.path, route]));

export const normalizeAppPath = (pathname: string): string => {
  if (!pathname || pathname === "//") {
    return "/";
  }

  const sanitizedPath = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;

  return routeMap.has(sanitizedPath) ? sanitizedPath : "/";
};

export const getRouteByPath = (pathname: string): AppRouteDefinition =>
  routeMap.get(normalizeAppPath(pathname)) ?? appRoutes[0];
