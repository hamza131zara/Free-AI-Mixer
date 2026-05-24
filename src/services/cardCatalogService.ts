import type {
  CardCategory,
  CardTemplateCatalogEntry,
  CardTemplateDetail,
  CardTemplateDetailResult,
  CardsCatalogResult,
} from "../types/cards";

type BackendCardTemplateCatalogEntry = CardTemplateCatalogEntry;
type BackendCardTemplateDetail = CardTemplateDetail;

interface BackendCardsCatalogResponse {
  kind: "cards_catalog";
  message?: string;
  templates: BackendCardTemplateCatalogEntry[];
}

interface BackendCardTemplateDetailPayload {
  kind: "card_template_detail";
  message?: string;
  template: BackendCardTemplateDetail;
}

interface BackendCardTemplateNotFoundPayload {
  kind: "card_template_not_found";
  message?: string;
}

type BackendCardTemplateDetailResponse =
  | BackendCardTemplateDetailPayload
  | BackendCardTemplateNotFoundPayload;

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

export const getCardCategoryFromPath = (pathname: string): CardCategory | undefined => {
  const invitationRouteMatch = pathname.match(/^\/cards\/invitations$/);

  if (invitationRouteMatch) {
    return "invitation";
  }

  const match = pathname.match(
    /^\/cards\/(birthday|wedding|invitation|eid|christmas|holi|halloween|business|visiting|gift)$/,
  );

  return match?.[1] as CardCategory | undefined;
};

export const getCardTemplateSlugFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/cards\/template\/([^/]+)$/);
  return match?.[1];
};

export const getCardsCatalog = async (): Promise<CardsCatalogResult> => {
  try {
    const response = await fetch("/cards/catalog", {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendCardsCatalogResponse>(response);

    if (!response.ok || !payload || payload.kind !== "cards_catalog") {
      return {
        kind: "catalog",
        message: "Card template catalog is currently unavailable.",
        templates: [],
      };
    }

    return {
      kind: "catalog",
      message:
        payload.message ??
        "Card templates are available for static local preview only.",
      templates: payload.templates,
    };
  } catch {
    return {
      kind: "catalog",
      message: "Card template catalog is currently unavailable.",
      templates: [],
    };
  }
};

export const getCardTemplateDetail = async (
  cardTemplateId: string,
): Promise<CardTemplateDetailResult> => {
  try {
    const response = await fetch(`/cards/${encodeURIComponent(cardTemplateId)}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendCardTemplateDetailResponse>(response);

    if (response.status === 404 || payload?.kind === "card_template_not_found") {
      return {
        kind: "not_found",
        message: payload?.message ?? "Card template detail was not found.",
      };
    }

    if (!response.ok || !payload || payload.kind !== "card_template_detail") {
      return {
        kind: "unavailable",
        message: "Card template detail is currently unavailable.",
      };
    }

    return {
      kind: "detail",
      message:
        payload.message ??
        "Card template detail is available for local preview only.",
      template: payload.template,
    };
  } catch {
    return {
      kind: "unavailable",
      message: "Card template detail is currently unavailable.",
    };
  }
};

export const getCardTemplateDetailBySlug = async (
  slug: string,
): Promise<CardTemplateDetailResult> => {
  const catalog = await getCardsCatalog();
  const match = catalog.templates.find((template) => template.slug === slug);

  if (!match) {
    return {
      kind: "not_found",
      message: "Card template detail was not found.",
    };
  }

  return getCardTemplateDetail(match.cardTemplateId);
};
