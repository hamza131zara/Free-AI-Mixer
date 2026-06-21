import { Image } from "lucide-react";
import { useEffect, useState } from "react";
import { platformGenerationPolicyCopy } from "../services/providerCapabilityPolicyService";
import { fetchGeneratedImagePreviewBlob } from "../services/imageGenerationService";
import { useImageGenerationStore } from "../store/imageGenerationStore";
import type { ProjectSummary } from "../types/projectLibrary";

export function PromptImageGenerator({ project }: { project?: ProjectSummary }) {
  const artifact = useImageGenerationStore((state) => state.artifact);
  const error = useImageGenerationStore((state) => state.error);
  const lifecycle = useImageGenerationStore((state) => state.lifecycle);
  const prompt = useImageGenerationStore((state) => state.prompt);
  const statusMessage = useImageGenerationStore((state) => state.statusMessage);
  const generateImageMetadata = useImageGenerationStore(
    (state) => state.generateImageMetadata,
  );
  const updatePrompt = useImageGenerationStore((state) => state.updatePrompt);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | undefined>();
  const [previewMessage, setPreviewMessage] = useState(
    "Preview waits for authenticated backend metadata.",
  );

  const isSubmitting = lifecycle === "submitting";
  const canSubmit = Boolean(project) && prompt.trim().length > 0 && !isSubmitting;

  useEffect(() => {
    let objectUrl: string | undefined;
    const controller = new AbortController();

    setPreviewObjectUrl(undefined);

    if (!artifact?.previewPath) {
      setPreviewMessage("Preview waits for authenticated backend metadata.");
      return () => {
        controller.abort();
      };
    }

    setPreviewMessage("Loading private backend-mediated preview.");

    void fetchGeneratedImagePreviewBlob(artifact.previewPath, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPreviewObjectUrl(objectUrl);
        setPreviewMessage("Private backend-mediated preview loaded.");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreviewMessage("Private preview is unavailable.");
        }
      });

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [artifact?.previewPath]);

  return (
    <section className="prompt-image-generator" aria-labelledby="prompt-image-title">
      <div className="prompt-image-header">
        <div>
          <p className="eyebrow">Image lane</p>
          <h3 id="prompt-image-title">Prompt to verified image metadata</h3>
        </div>
        <span className="status-pill status-success">Mock storage</span>
      </div>

      <form
        className="prompt-image-form"
        onSubmit={(event) => {
          event.preventDefault();
          void generateImageMetadata(project?.projectId);
        }}
      >
        <label className="field field-wide">
          <span>Image prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => updatePrompt(event.target.value)}
            placeholder="A simple flat red square app icon on a plain white background"
            rows={4}
          />
        </label>

        <p className="form-helper field-wide">
          This calls the backend mock image route and displays verified artifact
          metadata. When available, preview is served only through the backend
          generation route. Storage details, image bytes, and browser downloads are
          not exposed.
        </p>
        <p className="form-helper field-wide" data-testid="prompt-image-project-state">
          {project
            ? `Project-scoped generation is enabled for ${project.title}.`
            : "Select a verified project before generating hosted mock image metadata."}
        </p>
        <p className="form-helper field-wide">
          {platformGenerationPolicyCopy.mockGenerationCopy} Real provider image
          generation requires approved BYOK or future platform credits.
        </p>

        <div className="actions">
          <button type="submit" disabled={!canSubmit}>
            <Image aria-hidden="true" size={18} />
            {isSubmitting ? "Generating metadata..." : "Generate Image"}
          </button>
        </div>
      </form>

      <div className="prompt-image-result" aria-live="polite">
        <p className="prompt-image-status" data-testid="prompt-image-status">
          {statusMessage ?? "Ready. Enter a prompt to request safe backend metadata."}
        </p>

        {error ? (
          <p className="error-message" data-testid="prompt-image-error">
            {error.message}
          </p>
        ) : null}

        {artifact ? (
          <>
            {artifact.previewPath ? (
              <figure
                className="prompt-image-preview"
                data-testid="prompt-image-preview"
              >
                {previewObjectUrl ? (
                  <img
                    alt="Backend-mediated generated image preview"
                    src={previewObjectUrl}
                  />
                ) : null}
                <figcaption>
                  {previewMessage}
                </figcaption>
              </figure>
            ) : null}

            <dl className="prompt-image-metadata" data-testid="prompt-image-metadata">
              <div>
                <dt>Provider</dt>
                <dd>{artifact.providerId}</dd>
              </div>
              <div>
                <dt>Content type</dt>
                <dd>{artifact.contentType}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{artifact.sizeBytes} bytes</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{artifact.createdAt}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{artifact.deliveryStatus}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd>{artifact.sha256 ? "present" : "not returned"}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
    </section>
  );
}
