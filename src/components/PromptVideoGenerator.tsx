import { Film } from "lucide-react";
import { platformGenerationPolicyCopy } from "../services/providerCapabilityPolicyService";
import { useVideoGenerationStore } from "../store/videoGenerationStore";

export function PromptVideoGenerator() {
  const error = useVideoGenerationStore((state) => state.error);
  const lifecycle = useVideoGenerationStore((state) => state.lifecycle);
  const lifecycleTrace = useVideoGenerationStore((state) => state.lifecycleTrace);
  const prompt = useVideoGenerationStore((state) => state.prompt);
  const providerId = useVideoGenerationStore((state) => state.providerId);
  const status = useVideoGenerationStore((state) => state.status);
  const statusMessage = useVideoGenerationStore((state) => state.statusMessage);
  const vendorCallsEnabled = useVideoGenerationStore(
    (state) => state.vendorCallsEnabled,
  );
  const generateVideoMetadata = useVideoGenerationStore(
    (state) => state.generateVideoMetadata,
  );
  const updatePrompt = useVideoGenerationStore((state) => state.updatePrompt);

  const isSubmitting = lifecycle === "submitting" || lifecycle === "processing";
  const canSubmit = prompt.trim().length > 0 && !isSubmitting;

  return (
    <section className="prompt-video-generator" aria-labelledby="prompt-video-title">
      <div className="prompt-image-header">
        <div>
          <p className="eyebrow">Video lane</p>
          <h3 id="prompt-video-title">Prompt to video boundary check</h3>
        </div>
        <span className="status-pill status-error">Fail closed</span>
      </div>

      <form
        className="prompt-image-form"
        onSubmit={(event) => {
          event.preventDefault();
          void generateVideoMetadata();
        }}
      >
        <label className="field field-wide">
          <span>Video prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => updatePrompt(event.target.value)}
            placeholder="A calm camera pan across a paper city at sunrise"
            rows={4}
          />
        </label>

        <p className="form-helper field-wide">
          This calls the backend mock video boundary. Video artifact verification
          and storage are not ready yet, so the expected result is a safe
          unavailable lifecycle with no preview or download.
        </p>
        <p className="form-helper field-wide">
          {platformGenerationPolicyCopy.providerBillingCopy} Real video providers
          remain a future audited launch block.
        </p>

        <div className="actions">
          <button type="submit" disabled={!canSubmit}>
            <Film aria-hidden="true" size={18} />
            {isSubmitting ? "Submitting video..." : "Generate Video"}
          </button>
        </div>
      </form>

      <div className="prompt-image-result" aria-live="polite">
        <p className="prompt-image-status" data-testid="prompt-video-status">
          {statusMessage ??
            "Ready. Enter a prompt to check the mock video lifecycle boundary."}
        </p>

        {error ? (
          <p className="error-message" data-testid="prompt-video-error">
            {error.message}
          </p>
        ) : null}

        <dl className="prompt-image-metadata" data-testid="prompt-video-lifecycle">
          <div>
            <dt>Lifecycle</dt>
            <dd>{lifecycle}</dd>
          </div>
          {status ? (
            <div>
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
          ) : null}
          {providerId ? (
            <div>
              <dt>Provider</dt>
              <dd>{providerId}</dd>
            </div>
          ) : null}
          {typeof vendorCallsEnabled === "boolean" ? (
            <div>
              <dt>Vendor calls</dt>
              <dd>{vendorCallsEnabled ? "enabled" : "false"}</dd>
            </div>
          ) : null}
          {lifecycleTrace.length > 0 ? (
            <div className="field-wide">
              <dt>Lifecycle trace</dt>
              <dd>{lifecycleTrace.join(" → ")}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
