import { useImageGenerationHistoryStore } from "../store/imageGenerationHistoryStore";

export function PromptImageHistory() {
  const entries = useImageGenerationHistoryStore((state) => state.entries);

  return (
    <section className="prompt-image-history" aria-labelledby="prompt-image-history-title">
      <div className="prompt-image-header">
        <div>
          <p className="eyebrow">Local history</p>
          <h3 id="prompt-image-history-title">Saved image metadata</h3>
        </div>
        <span className="status-pill status-idle">Metadata only</span>
      </div>

      {entries.length === 0 ? (
        <p className="form-helper" data-testid="prompt-image-history-empty">
          Successful mock image generations will appear here as browser-local
          metadata records. Failed requests are not saved as successful history.
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
