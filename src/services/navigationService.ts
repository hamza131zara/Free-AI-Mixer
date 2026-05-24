import type { RouteSeoMetadata } from "../types/seo";

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
    | "onboarding"
    | "admin"
    | "help"
    | "privacy"
    | "terms"
    | "cookies"
    | "acceptable-use"
    | "data-retention"
    | "ai-tools"
    | "ai-tool-detail"
    | "compare"
    | "compare-detail"
    | "ai-news"
    | "ai-news-detail"
    | "cards"
    | "cards-birthday"
    | "cards-wedding"
    | "cards-invitation"
    | "cards-eid"
    | "cards-christmas"
    | "cards-holi"
    | "cards-halloween"
    | "cards-business"
    | "cards-visiting"
    | "cards-gift"
    | "cards-template-detail";
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
    | "provider-settings"
    | "templates"
    | "onboarding"
    | "admin"
    | "help"
    | "legal"
    | "editorial"
    | "cards";
  status: string;
  sections: NavigationSection[];
  seo: RouteSeoMetadata;
}

export const appRoutes: AppRouteDefinition[] = [
  {
    id: "home",
    path: "/",
    label: "Home",
    eyebrow: "Product Phase 1",
    title: "Free AI Mixer is moving from workbench to product shell",
    description:
      "The mixer workbench is live locally today. Account, templates, credits, billing, admin, and support operations are being added in later product phases.",
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
          "Dashboard, templates, project history, provider settings, credits, pricing, admin, support, and legal routes are now mapped into the shell, but many of those areas are still readiness-only pages in this product phase.",
      },
      {
        title: "Product notes",
        body:
          "Future BYOK users may later get 2500 daily Free AI Mixer platform credits. BYOK users still pay provider generation cost through their own API keys, multiple API keys do not multiply daily credits, and audio remains optional based on provider capability instead of being a separate early setup.",
      },
    ],
    seo: {
      title: "Free AI Mixer | Home",
      description:
        "Free AI Mixer product shell with truthful routes for templates, credits, onboarding, and the preserved mixer workbench.",
      canonicalPath: "/",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
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
    seo: {
      title: "Dashboard | Free AI Mixer",
      description:
        "Protected dashboard boundary for backend-verified session status only.",
      canonicalPath: "/dashboard",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
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
    seo: {
      title: "Log In | Free AI Mixer",
      description:
        "Backend-auth login boundary for Free AI Mixer.",
      canonicalPath: "/login",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
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
    seo: {
      title: "Sign Up | Free AI Mixer",
      description:
        "Backend-auth signup boundary for Free AI Mixer.",
      canonicalPath: "/signup",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
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
    seo: {
      title: "Mixer Workbench | Free AI Mixer",
      description:
        "Live local mixer workbench for scene generation, queueing, timeline editing, and export requests.",
      canonicalPath: "/mixer",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
  },
  {
    id: "templates",
    path: "/templates",
    label: "Templates",
    eyebrow: "Product Phase 9",
    title: "Templates gallery shell",
    description:
      "This route now shows a read-only template gallery shell with static planning metadata, input requirements, and draft estimates.",
    kind: "templates",
    status: "Gallery shell only",
    sections: [
      {
        title: "Credit model",
        body:
          "Templates will use the same global credit wallet as mixer generation, export flows, and approved download-related platform actions when credits are implemented later.",
      },
      {
        title: "Static sample content",
        body:
          "Template examples in this phase are clearly labeled as static sample content only. They are not generated output.",
      },
      {
        title: "Current limitation",
        body:
          "This phase does not implement template generation, template editing, fake ready-to-use outputs, downloads, or project saves.",
      },
    ],
    seo: {
      title: "Templates Gallery | Free AI Mixer",
      description:
        "Static template gallery shell with planning metadata, input requirements, and draft credit estimate ranges.",
      canonicalPath: "/templates",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "ai-tools",
    path: "/ai-tools",
    label: "AI Tools",
    eyebrow: "Product Phase 11",
    title: "AI tools directory shell",
    description:
      "This route shows a static editorial catalog of AI tools with source links, review dates, and honest integration status notes.",
    kind: "editorial",
    status: "Editorial catalog only",
    sections: [
      {
        title: "What exists here",
        body:
          "This directory can list source-linked editorial summaries of AI tools, capabilities, and limitations without claiming live provider integration or user reviews.",
      },
      {
        title: "Current limitation",
        body:
          "No fake rankings, fake ratings, fake popularity metrics, or runtime generation behavior are added in this phase.",
      },
    ],
    seo: {
      title: "AI Tools Directory | Free AI Mixer",
      description:
        "Static editorial AI tools directory with honest capability summaries, source links, and review-date metadata.",
      canonicalPath: "/ai-tools",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "ai-tool-detail",
    path: "/ai-tools/:slug",
    label: "AI Tool Detail",
    eyebrow: "Product Phase 11",
    title: "AI tool editorial detail",
    description:
      "This route shows source-linked editorial detail for a tool without fake ratings, fake reviews, or live provider execution.",
    kind: "editorial",
    status: "Editorial detail only",
    sections: [],
    seo: {
      title: "AI Tool Detail | Free AI Mixer",
      description:
        "Editorial AI tool detail page with source links, caveats, and truthful integration-status language.",
      canonicalPath: "/ai-tools",
      indexable: true,
      includeInSitemap: false,
      robots: "index,follow",
    },
  },
  {
    id: "compare",
    path: "/compare",
    label: "Compare",
    eyebrow: "Product Phase 11",
    title: "AI tools comparison shell",
    description:
      "This route shows editorial comparison summaries with caveats, source links, and no fake benchmark scores.",
    kind: "editorial",
    status: "Editorial comparison only",
    sections: [
      {
        title: "What exists here",
        body:
          "Comparison pages can summarize workflow differences and caveats between AI tools without inventing ratings, reviews, or popularity claims.",
      },
      {
        title: "Current limitation",
        body:
          "No comparison page in this phase triggers generation, provider execution, or pricing commitments.",
      },
    ],
    seo: {
      title: "AI Tools Compare | Free AI Mixer",
      description:
        "Editorial AI tools comparison index with source-linked caveats and truthful comparison summaries.",
      canonicalPath: "/compare",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "compare-detail",
    path: "/compare/:slug",
    label: "Comparison Detail",
    eyebrow: "Product Phase 11",
    title: "AI tools comparison detail",
    description:
      "This route shows editorial comparison detail without fake reviews, fake ratings, or fake best-of claims.",
    kind: "editorial",
    status: "Editorial comparison detail",
    sections: [],
    seo: {
      title: "AI Tools Comparison Detail | Free AI Mixer",
      description:
        "Editorial AI tools comparison detail page with caveats, sources, and truthful workflow framing.",
      canonicalPath: "/compare",
      indexable: true,
      includeInSitemap: false,
      robots: "index,follow",
    },
  },
  {
    id: "ai-news",
    path: "/ai-news",
    label: "AI News",
    eyebrow: "Product Phase 11",
    title: "AI news editorial shell",
    description:
      "This route shows a manual editorial AI news shell with source links and last-checked metadata instead of fake live freshness.",
    kind: "editorial",
    status: "Editorial feed shell only",
    sections: [
      {
        title: "What exists here",
        body:
          "This feed can show short editorial summaries with source attribution and last-checked dates.",
      },
      {
        title: "Current limitation",
        body:
          "No scraping, live ingestion, or fake latest-news claims are enabled in this phase.",
      },
    ],
    seo: {
      title: "AI News | Free AI Mixer",
      description:
        "Manual editorial AI news shell with source attribution and last-checked metadata.",
      canonicalPath: "/ai-news",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "ai-news-detail",
    path: "/ai-news/:slug",
    label: "AI News Detail",
    eyebrow: "Product Phase 11",
    title: "AI news editorial detail",
    description:
      "This route shows a short editorial news detail page with source attribution and no fake live-feed claims.",
    kind: "editorial",
    status: "Editorial detail only",
    sections: [],
    seo: {
      title: "AI News Detail | Free AI Mixer",
      description:
        "Editorial AI news detail page with visible source links, last-checked metadata, and truthful caveats.",
      canonicalPath: "/ai-news",
      indexable: true,
      includeInSitemap: false,
      robots: "index,follow",
    },
  },
  {
    id: "cards",
    path: "/cards",
    label: "Cards",
    eyebrow: "Product Phase 12",
    title: "Card Generator static template MVP",
    description:
      "This route shows static card templates with local editable preview only. Downloads, sharing, QR, AI generation, and project saving are not enabled yet.",
    kind: "cards",
    status: "Static local preview MVP",
    sections: [
      {
        title: "What exists here",
        body:
          "The cards module can show decorative static templates, local editable fields, and a live local preview without creating backend jobs or account-owned records.",
      },
      {
        title: "Current limitation",
        body:
          "No downloads, no share links, no QR codes, no hosted public pages, and no AI generation are enabled in this phase.",
      },
    ],
    seo: {
      title: "Card Generator | Free AI Mixer",
      description:
        "Static card template MVP with local preview only for greetings, invitations, and business-style cards.",
      canonicalPath: "/cards",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-birthday",
    path: "/cards/birthday",
    label: "Birthday Cards",
    eyebrow: "Product Phase 12",
    title: "Birthday card templates",
    description:
      "Static birthday card templates with local preview only and no download or sharing features enabled.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Birthday Cards | Free AI Mixer",
      description:
        "Static birthday card template gallery with local preview only.",
      canonicalPath: "/cards/birthday",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-wedding",
    path: "/cards/wedding",
    label: "Wedding Cards",
    eyebrow: "Product Phase 12",
    title: "Wedding card templates",
    description:
      "Static wedding and invitation card templates with local preview only.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Wedding Cards | Free AI Mixer",
      description:
        "Static wedding invitation card templates with local preview only.",
      canonicalPath: "/cards/wedding",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-invitation",
    path: "/cards/invitations",
    label: "Invitations",
    eyebrow: "Product Phase 12",
    title: "Invitation card templates",
    description:
      "Static invitation card templates with local preview only and no fake share or download behavior.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Invitation Cards | Free AI Mixer",
      description:
        "Static invitation card template gallery with local preview only.",
      canonicalPath: "/cards/invitations",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-eid",
    path: "/cards/eid",
    label: "Eid Cards",
    eyebrow: "Product Phase 12",
    title: "Eid card templates",
    description:
      "Static Eid greeting card templates with local preview only.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Eid Cards | Free AI Mixer",
      description:
        "Static Eid greeting card template gallery with local preview only.",
      canonicalPath: "/cards/eid",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-christmas",
    path: "/cards/christmas",
    label: "Christmas Cards",
    eyebrow: "Product Phase 12",
    title: "Christmas card templates",
    description:
      "Static Christmas greeting card templates with local preview only.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Christmas Cards | Free AI Mixer",
      description:
        "Static Christmas greeting card template gallery with local preview only.",
      canonicalPath: "/cards/christmas",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-holi",
    path: "/cards/holi",
    label: "Holi Cards",
    eyebrow: "Product Phase 12",
    title: "Holi card templates",
    description:
      "Static Holi greeting card templates with local preview only.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Holi Cards | Free AI Mixer",
      description:
        "Static Holi greeting card template gallery with local preview only.",
      canonicalPath: "/cards/holi",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-halloween",
    path: "/cards/halloween",
    label: "Halloween Cards",
    eyebrow: "Product Phase 12",
    title: "Halloween card templates",
    description:
      "Static Halloween card templates with local preview only.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Halloween Cards | Free AI Mixer",
      description:
        "Static Halloween card template gallery with local preview only.",
      canonicalPath: "/cards/halloween",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-business",
    path: "/cards/business",
    label: "Business Cards",
    eyebrow: "Product Phase 12",
    title: "Business card templates",
    description:
      "Static decorative business contact card templates with local preview only and no deceptive payment-card styling.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Business Cards | Free AI Mixer",
      description:
        "Static decorative business card template gallery with local preview only.",
      canonicalPath: "/cards/business",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-visiting",
    path: "/cards/visiting",
    label: "Visiting Cards",
    eyebrow: "Product Phase 12",
    title: "Visiting card templates",
    description:
      "Static visiting card templates with local preview only and no deceptive financial-card design.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Visiting Cards | Free AI Mixer",
      description:
        "Static visiting card template gallery with local preview only.",
      canonicalPath: "/cards/visiting",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-gift",
    path: "/cards/gift",
    label: "Gift Cards",
    eyebrow: "Product Phase 12",
    title: "Gift note card templates",
    description:
      "Static decorative gift note card templates with local preview only and no stored-value or redemption behavior.",
    kind: "cards",
    status: "Category shell only",
    sections: [],
    seo: {
      title: "Gift Cards | Free AI Mixer",
      description:
        "Static decorative gift-note card template gallery with local preview only.",
      canonicalPath: "/cards/gift",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cards-template-detail",
    path: "/cards/template/:slug",
    label: "Card Template Detail",
    eyebrow: "Product Phase 12",
    title: "Card editor local preview shell",
    description:
      "This route shows a static card template with local editable preview only. No download, QR, share, save, or AI generation exists here.",
    kind: "cards",
    status: "Editor shell only",
    sections: [],
    seo: {
      title: "Card Template | Free AI Mixer",
      description:
        "Static card template editor shell with local preview only.",
      canonicalPath: "/cards",
      indexable: true,
      includeInSitemap: false,
      robots: "index,follow",
    },
  },
  {
    id: "projects",
    path: "/projects",
    label: "Projects",
    eyebrow: "Product Phase 4",
    title: "Project library boundary",
    description:
      "This route now protects future account-owned saved projects without inventing cloud persistence from browser-local timelines.",
    kind: "dashboard",
    status: "Protected empty state",
    sections: [
      {
        title: "What this route shows",
        body:
          "Projects can appear here only after a verified backend session and real account-owned persistence exist. Browser-local timelines remain editor convenience only.",
      },
      {
        title: "Current limitation",
        body:
          "This page does not fake saved projects, cloud timestamps, collaboration, or ownership from localStorage.",
      },
    ],
    seo: {
      title: "Projects | Free AI Mixer",
      description:
        "Protected project library boundary with honest empty-state behavior.",
      canonicalPath: "/projects",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
  },
  {
    id: "exports",
    path: "/history",
    label: "History",
    eyebrow: "Product Phase 4",
    title: "Export history boundary",
    description:
      "This route now protects future account-owned export history without inventing completed videos, artifacts, or download rows.",
    kind: "dashboard",
    status: "Protected empty state",
    sections: [
      {
        title: "What exists today",
        body:
          "The Mixer workbench still owns current export requests and artifact descriptor checks. This route does not invent account history from browser-local export handles.",
      },
      {
        title: "What is deferred",
        body:
          "Real account-level export history, artifact rows, retention, and recovery tooling still depend on later persistence and production delivery phases.",
      },
    ],
    seo: {
      title: "History | Free AI Mixer",
      description:
        "Protected export history boundary without fabricated artifacts or downloads.",
      canonicalPath: "/history",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
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
    seo: {
      title: "Provider Settings | Free AI Mixer",
      description:
        "Read-only provider settings and routing foundation for BYOK planning.",
      canonicalPath: "/settings/providers",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
  },
  {
    id: "credits",
    path: "/credits",
    label: "Credits",
    eyebrow: "Product Phase 8",
    title: "Credits are not enabled yet",
    description:
      "This route now shows planned credit policy and ledger-readiness boundaries without fabricating a balance, purchase flow, or fake premium state.",
    kind: "placeholder",
    status: "Policy boundary only",
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
          "No live credit balance, ledger mutation, refill state, or fake remaining-credit value is shown in this phase.",
      },
    ],
    seo: {
      title: "Credits Policy | Free AI Mixer",
      description:
        "Draft credit policy page explaining BYOK platform credits, wallet rules, and truthful reservation planning.",
      canonicalPath: "/credits",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "pricing",
    path: "/pricing",
    label: "Pricing",
    eyebrow: "Product Phase 8",
    title: "Pricing is not enabled yet",
    description:
      "This route now shows draft pricing and billing-boundary policy only. Checkout, subscriptions, and payment processing stay disabled.",
    kind: "placeholder",
    status: "Draft policy only",
    sections: [
      {
        title: "What can be stated now",
        body:
          "BYOK users will still pay provider generation cost through their own API keys. Platform credits, subscriptions, and billing rules remain draft planning only in this phase.",
      },
      {
        title: "Current limitation",
        body:
          "This page does not show fake plans, fake checkout buttons, or fake entitlements.",
      },
    ],
    seo: {
      title: "Pricing Draft | Free AI Mixer",
      description:
        "Draft pricing and billing-readiness page with truthful BYOK cost separation and planning-only estimates.",
      canonicalPath: "/pricing",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "onboarding",
    path: "/onboarding",
    label: "Onboarding",
    eyebrow: "Product Phase 9",
    title: "First-run onboarding shell",
    description:
      "This route explains BYOK setup, platform credit policy, templates-to-mixer flow, and backend-gated downloads without inventing account completion or live providers.",
    kind: "onboarding",
    status: "Planning shell only",
    sections: [
      {
        title: "What it explains",
        body:
          "Onboarding can explain provider setup, platform credits versus provider cost, templates, mixer, exports, and history flow using honest product copy only.",
      },
      {
        title: "Current limitation",
        body:
          "This phase does not show fake connected providers, fake balances, fake account completion, or fake ready downloads.",
      },
    ],
    seo: {
      title: "Onboarding | Free AI Mixer",
      description:
        "First-run onboarding shell explaining BYOK provider setup, platform credits, templates, mixer, exports, and history.",
      canonicalPath: "/onboarding",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "admin",
    path: "/admin",
    label: "Admin",
    eyebrow: "Product Phase 10",
    title: "Admin readiness shell",
    description:
      "This route is reserved for future backend-verified platform admin tools and stays fail closed in this product phase.",
    kind: "admin",
    status: "Not enabled yet",
    sections: [
      {
        title: "Current limitation",
        body:
          "Admin and moderator tools are not enabled yet. This route does not show fake metrics, fake users, fake moderation queues, or fake revenue.",
      },
      {
        title: "Access model later",
        body:
          "Any platform admin or platform moderator access must be backend-verified later and must never rely on frontend-only role truth.",
      },
    ],
    seo: {
      title: "Admin Readiness | Free AI Mixer",
      description:
        "Fail-closed admin readiness shell for future backend-verified platform operations.",
      canonicalPath: "/admin",
      indexable: false,
      includeInSitemap: false,
      robots: "noindex,nofollow",
    },
  },
  {
    id: "help",
    path: "/help",
    label: "Help",
    eyebrow: "Product Phase 10",
    title: "Help and support shell",
    description:
      "This route now provides truthful setup guidance, troubleshooting notes, and support-readiness copy without fake ticket submission.",
    kind: "help",
    status: "Support shell only",
    sections: [
      {
        title: "What this shell can explain",
        body:
          "BYOK setup help, export and download readiness boundaries, credits and billing draft policy, and safe product troubleshooting can be documented here now.",
      },
      {
        title: "Current limitation",
        body:
          "This phase does not add live chat, ticketing, fake support forms, or fake SLA claims.",
      },
    ],
    seo: {
      title: "Help | Free AI Mixer",
      description:
        "Help and support shell with truthful guidance for BYOK setup, exports, credits, and downloads.",
      canonicalPath: "/help",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "privacy",
    path: "/privacy",
    label: "Privacy",
    eyebrow: "Product Phase 10",
    title: "Privacy policy draft",
    description:
      "This route provides draft privacy-readiness language only and does not pretend final legal review is complete.",
    kind: "legal",
    status: "Draft legal-readiness only",
    sections: [
      {
        title: "Current limitation",
        body:
          "This page is not a lawyer-approved privacy policy. It stays narrowly aligned to current product behavior and draft readiness topics only.",
      },
    ],
    seo: {
      title: "Privacy Draft | Free AI Mixer",
      description:
        "Draft privacy-readiness page covering current product boundaries, BYOK considerations, and future policy work.",
      canonicalPath: "/privacy",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "terms",
    path: "/terms",
    label: "Terms",
    eyebrow: "Product Phase 10",
    title: "Terms draft",
    description:
      "This route provides draft terms-readiness language only and does not present a final public contract.",
    kind: "legal",
    status: "Draft legal-readiness only",
    sections: [
      {
        title: "Current limitation",
        body:
          "This page does not present fake legal acceptance, final billing commitments, or launch-ready contractual claims.",
      },
    ],
    seo: {
      title: "Terms Draft | Free AI Mixer",
      description:
        "Draft terms-readiness page for Free AI Mixer with truthful BYOK, credit, and service-boundary language.",
      canonicalPath: "/terms",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "cookies",
    path: "/cookies",
    label: "Cookies",
    eyebrow: "Product Phase 10",
    title: "Cookies and local storage draft",
    description:
      "This route explains draft cookie and browser-storage behavior without overclaiming consent or compliance coverage.",
    kind: "legal",
    status: "Draft legal-readiness only",
    sections: [
      {
        title: "Current limitation",
        body:
          "This page is draft-only and does not claim a final consent-management or regional-compliance implementation already exists.",
      },
    ],
    seo: {
      title: "Cookies Draft | Free AI Mixer",
      description:
        "Draft cookies and browser-storage page for Free AI Mixer.",
      canonicalPath: "/cookies",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "acceptable-use",
    path: "/acceptable-use",
    label: "Acceptable Use",
    eyebrow: "Product Phase 10",
    title: "Acceptable use draft",
    description:
      "This route describes draft acceptable-use expectations for BYOK, uploads, and generated content without claiming final policy approval.",
    kind: "legal",
    status: "Draft legal-readiness only",
    sections: [
      {
        title: "Current limitation",
        body:
          "This page is not a final moderation or policy-enforcement program. It only documents draft expectations and future safety boundaries.",
      },
    ],
    seo: {
      title: "Acceptable Use Draft | Free AI Mixer",
      description:
        "Draft acceptable-use page for Free AI Mixer covering uploads, generated content, and BYOK responsibilities.",
      canonicalPath: "/acceptable-use",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
  {
    id: "data-retention",
    path: "/data-retention",
    label: "Data Retention",
    eyebrow: "Product Phase 10",
    title: "Data retention draft",
    description:
      "This route explains draft retention expectations for artifacts, metadata, and platform records without claiming final policy enforcement.",
    kind: "legal",
    status: "Draft legal-readiness only",
    sections: [
      {
        title: "Current limitation",
        body:
          "Retention details are still draft policy only. This page does not claim final automated cleanup or legal review is complete.",
      },
    ],
    seo: {
      title: "Data Retention Draft | Free AI Mixer",
      description:
        "Draft data-retention page for Free AI Mixer covering artifacts, metadata, and planned retention boundaries.",
      canonicalPath: "/data-retention",
      indexable: true,
      includeInSitemap: true,
      robots: "index,follow",
    },
  },
];

export const primaryNavigationItems = appRoutes.filter(
  (route) =>
    route.id !== "login" &&
    route.id !== "signup" &&
    route.id !== "onboarding" &&
    route.id !== "admin" &&
    route.id !== "privacy" &&
    route.id !== "terms" &&
    route.id !== "cookies" &&
    route.id !== "acceptable-use" &&
    route.id !== "data-retention" &&
    route.id !== "cards-birthday" &&
    route.id !== "cards-wedding" &&
    route.id !== "cards-invitation" &&
    route.id !== "cards-eid" &&
    route.id !== "cards-christmas" &&
    route.id !== "cards-holi" &&
    route.id !== "cards-halloween" &&
    route.id !== "cards-business" &&
    route.id !== "cards-visiting" &&
    route.id !== "cards-gift" &&
    route.id !== "cards-template-detail" &&
    route.id !== "ai-tools" &&
    route.id !== "ai-tool-detail" &&
    route.id !== "compare" &&
    route.id !== "compare-detail" &&
    route.id !== "ai-news" &&
    route.id !== "ai-news-detail",
);

export const secondaryNavigationItems = appRoutes.filter(
  (route) =>
    route.id === "privacy" ||
    route.id === "terms" ||
    route.id === "cookies" ||
    route.id === "acceptable-use" ||
    route.id === "data-retention",
);

export const authNavigationItems = appRoutes.filter(
  (route) => route.id === "login" || route.id === "signup",
);

const exactRouteMap = new Map(
  appRoutes
    .filter((route) => !route.path.includes(":"))
    .map((route) => [route.path, route]),
);

const dynamicRoutes = appRoutes
  .filter((route) => route.path.includes(":"))
  .map((route) => ({
    route,
    expression: new RegExp(
      `^${route.path.replace(/:[^/]+/g, "[^/]+")}$`,
    ),
  }));

export const normalizeAppPath = (pathname: string): string => {
  if (!pathname || pathname === "//") {
    return "/";
  }

  const sanitizedPath = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;

  if (exactRouteMap.has(sanitizedPath)) {
    return sanitizedPath;
  }

  if (dynamicRoutes.some((route) => route.expression.test(sanitizedPath))) {
    return sanitizedPath;
  }

  return "/";
};

export const getRouteByPath = (pathname: string): AppRouteDefinition =>
  exactRouteMap.get(normalizeAppPath(pathname)) ??
  dynamicRoutes.find((route) => route.expression.test(normalizeAppPath(pathname)))?.route ??
  appRoutes[0];
