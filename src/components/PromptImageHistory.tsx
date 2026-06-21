import { useEffect, useState } from "react";
import { fetchGeneratedImagePreviewBlob } from "../services/imageGenerationService";
import { useImageGenerationHistoryStore } from "../store/imageGenerationHistoryStore";
import type { ProjectSummary } from "../types/projectLibrary";

export function PromptImageHistory({ project }: { project?: ProjectSummary }) {
  const entries = useImageGenerationHistoryStore((state) => state.entries);
  const historyMessage = useImageGenerationHistoryStore(
    (state) => state.historyMessage,
  );
  const historyStatus = useImageGenerationHistoryStore((state) => state.historyStatus);
  const loadProjectHistory = useImageGenerationHistoryStore(
    (state) => state.loadProjectHistory,
  );

  useEffect(() => {
    if (project) {
      void loadProjectHistory(project.projectId);
    }
  }, [loadProjectHistory, project]);

  return (
    <section className="prompt-image-history" aria-labelledby="prompt-image-history-title">
      <div className="prompt-image-header">
        <div>
          <p className="eyebrow">
            {project ? "Project history" : "Local history"}
          </p>
          <h3 id="prompt-image-history-title">Saved image metadata</h3>
        </div>
        <span className="status-pill status-idle">Metadata only</span>
      </div>
      <p className="form-helper" data-testid="prompt-image-history-status">
        {historyMessage ??
          (project
            ? "Project-scoped durable image history is ready to load."
            : "Select a verified project to load durable hosted image history.")}
      </p>

      {entries.length === 0 ? (
        <p className="form-helper" data-testid="prompt-image-history-empty">
          {historyStatus === "loading"
            ? "Loading durable project image history."
            : project
              ? "No durable image metadata exists for this project yet."
              : "Successful mock image generations can appear as browser-local metadata only until a project is selected."}
        </p>
      ) : (
        <div className="prompt-image-history-list" data-testid="prompt-image-history">
          {entries.map((entry) => (
            <article
              className="prompt-image-history-card"
              data-testid="prompt-image-history-entry"
              key={entry.generationId}
            >
              <p className="prompt-image-history-prompt">{entry.prompt}</p>
              {entry.previewPath ? (
                <ProjectHistoryPreview previewPath={entry.previewPath} />
              ) : null}
              <dl className="prompt-image-metadata">
                <div>
                  <dt>Status</dt>
                  <dd>{entry.status}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{entry.providerId}</dd>
                </div>
                <div>
                  <dt>Content type</dt>
                  <dd>{entry.contentType}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{entry.sizeBytes} bytes</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{entry.createdAt}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{entry.deliveryStatus}</dd>
                </div>
                <div>
                  <dt>SHA-256</dt>
                  <dd>{entry.sha256 ? "present" : "not returned"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectHistoryPreview({ previewPath }: { previewPath: string }) {
  const [objectUrl, setObjectUrl] = useState<string | undefined>();
  const [message, setMessage] = useState("Loading private preview.");

  useEffect(() => {
    let createdObjectUrl: string | undefined;
    const controller = new AbortController();

    void fetchGeneratedImagePreviewBlob(previewPath, controller.signal)
      .then((blob) => {
        createdObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(createdObjectUrl);
        setMessage("Private backend-mediated preview loaded.");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMessage("Private preview is unavailable.");
        }
      });

    return () => {
      controller.abort();

      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [previewPath]);

  return (
    <figure className="prompt-image-preview">
      {objectUrl ? (
        <img
          alt="Backend-mediated generated image history preview"
          src={objectUrl}
        />
      ) : null}
      <figcaption>{message}</figcaption>
    </figure>
  );
}
