import type {
  TemplateCatalogEntry,
  TemplateCatalogResult,
  TemplateDetail,
  TemplateDetailResult,
} from "../types/templates";

type BackendTemplateCatalogEntry = TemplateCatalogEntry;
type BackendTemplateDetail = TemplateDetail;

interface BackendTemplateCatalogResponse {
  kind: "template_catalog";
  message?: string;
  templates: BackendTemplateCatalogEntry[];
}

interface BackendTemplateDetailResponse {
  kind: "template_detail";
  message?: string;
  template: BackendTemplateDetail;
}

interface BackendTemplateNotFoundResponse {
  kind: "template_not_found";
  message?: string;
}

type BackendTemplateDetailResult =
  | BackendTemplateDetailResponse
  | BackendTemplateNotFoundResponse;

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

export const getTemplateCatalog = async (): Promise<TemplateCatalogResult> => {
  try {
    const response = await fetch("/templates/catalog", {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendTemplateCatalogResponse>(response);

    if (!response.ok || !payload || payload.kind !== "template_catalog") {
      return {
        kind: "catalog",
        message: "Template catalog is currently unavailable.",
        templates: [],
      };
    }

    return {
      kind: "catalog",
      message:
        payload.message ??
        "Static template metadata is available for planning and gallery browsing only.",
      templates: payload.templates,
    };
  } catch {
    return {
      kind: "catalog",
      message: "Template catalog is currently unavailable.",
      templates: [],
    };
  }
};

export const getTemplateDetail = async (
  templateId: string,
): Promise<TemplateDetailResult> => {
  try {
    const response = await fetch(`/templates/${encodeURIComponent(templateId)}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendTemplateDetailResult>(response);

    if (response.status === 404 || payload?.kind === "template_not_found") {
      return {
        kind: "not_found",
        message: payload?.message ?? "Template detail was not found.",
      };
    }

    if (!response.ok || !payload || payload.kind !== "template_detail") {
      return {
        kind: "unavailable",
        message: "Template detail is currently unavailable.",
      };
    }

    return {
      kind: "detail",
      message:
        payload.message ??
        "Template detail is available in planning-only form. Generation is not enabled yet.",
      template: payload.template,
    };
  } catch {
    return {
      kind: "unavailable",
      message: "Template detail is currently unavailable.",
    };
  }
};
