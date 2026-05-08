import type { SceneLifecycle, SceneRecord } from "../types/scene";

const lifecycleTransitions: Record<SceneLifecycle, SceneLifecycle[]> = {
  idle: ["queued"],
  queued: ["generating"],
  generating: ["success", "error"],
  success: ["queued"],
  error: ["queued"],
};

export const isActiveLifecycle = (lifecycle: SceneLifecycle): boolean =>
  lifecycle === "queued" || lifecycle === "generating";

export const isGeneratingScene = (scene: SceneRecord): boolean =>
  scene.lifecycle === "queued" || scene.lifecycle === "generating";

export const canTransitionLifecycle = (
  from: SceneLifecycle,
  to: SceneLifecycle,
): boolean => lifecycleTransitions[from].includes(to);

export const assertLifecycleTransition = (
  from: SceneLifecycle,
  to: SceneLifecycle,
): void => {
  if (!canTransitionLifecycle(from, to)) {
    throw new Error(`Invalid scene lifecycle transition: ${from} -> ${to}`);
  }
};
