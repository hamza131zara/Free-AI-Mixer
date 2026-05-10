import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { exportAgent, type ExportAgentStartResult } from "../agents/exportAgent";
import type {
  ExportArtifactRef,
  ExportFailure,
  ExportJobHandle,
  ExportJobStatus,
  ExportPollResult,
  ExportProgressSnapshot,
  ExportRenderSettings,
  ExportTerminalResult,
  TimelineExportRequest,
} from "../types/exportJob";
import type { TimelineId } from "../types/timeline";
import { useTimelineStore } from "./timelineStore";

const exportStorePersistKey = "free-ai-mixer-exports";
const emptyExportArtifacts: ExportArtifactRef[] = [];
const inFlightStatuses = new Set<ExportJobStatus>([
  "queued",
  "submitted",
  "rendering",
  "finalizing",
]);
const terminalStatuses = new Set<ExportJobStatus>([
  "success",
  "error",
  "canceled",
  "expired",
]);

export type ExportResumeState =
  | "none"
  | "resume_needed"
  | "expired"
  | "resume_unavailable";

export interface ExportTimelineState {
  timelineId: TimelineId;
  requestId: string;
  lifecycle: ExportJobStatus;
  handle?: ExportJobHandle;
  result?: ExportTerminalResult;
  failure?: ExportFailure;
  progress?: ExportProgressSnapshot;
  submittedAt?: string;
  lastPolledAt?: string;
  timeoutAt?: string;
  resumeState: ExportResumeState;
}

export interface ExportStoreState {
  hasHydrated: boolean;
  hydrationError?: string;
  jobsByTimelineId: Record<TimelineId, ExportTimelineState>;
  activeExportTimelineId?: TimelineId;
  isSubmittingByTimelineId: Record<TimelineId, boolean>;
  isResolvingByTimelineId: Record<TimelineId, boolean>;
  setHydrationStatus: (hasHydrated: boolean, hydrationError?: string) => void;
  setActiveExportTimeline: (timelineId?: TimelineId) => void;
  requestExport: (
    timelineId: TimelineId,
    renderSettings: ExportRenderSettings,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ) => Promise<ExportTimelineState | undefined>;
  applyExportSubmissionResult: (
    timelineId: TimelineId,
    requestId: string,
    result: ExportAgentStartResult,
    timeoutMs?: number,
  ) => ExportTimelineState | undefined;
  applyExportPollEvent: (
    timelineId: TimelineId,
    pollResult: ExportPollResult,
  ) => void;
  markExportTimeout: (timelineId: TimelineId, timeoutMs?: number) => void;
  clearExportState: (timelineId: TimelineId) => void;
  classifyHydratedExportJobs: (nowIso?: string) => void;
}

type PersistedExportStoreState = Pick<
  ExportStoreState,
  "jobsByTimelineId" | "activeExportTimelineId"
>;

export const useExportStore = create<ExportStoreState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      hydrationError: undefined,
      jobsByTimelineId: {},
      activeExportTimelineId: undefined,
      isSubmittingByTimelineId: {},
      isResolvingByTimelineId: {},
      setHydrationStatus: (hasHydrated, hydrationError) => {
        set({ hasHydrated, hydrationError });
      },
      setActiveExportTimeline: (timelineId) => {
        set({ activeExportTimelineId: timelineId });
      },
      requestExport: async (timelineId, renderSettings, options) => {
        const state = get();
        if (!state.hasHydrated || state.hydrationError || !timelineId) {
          return undefined;
        }

        const timeline = useTimelineStore
          .getState()
          .timelines.find((candidate) => candidate.id === timelineId);
        if (!timeline) {
          const failureState = createFailureState(
            timelineId,
            "Export timeline was not found.",
            "export_timeline_not_found",
          );
          set((current) => ({
            jobsByTimelineId: {
              ...current.jobsByTimelineId,
              [timelineId]: failureState,
            },
          }));
          return failureState;
        }

        if (timeline.clips.length === 0) {
          const failureState = createFailureState(
            timelineId,
            "Export timeline has no clips.",
            "export_timeline_empty",
          );
          set((current) => ({
            jobsByTimelineId: {
              ...current.jobsByTimelineId,
              [timelineId]: failureState,
            },
          }));
          return failureState;
        }

        const existing = state.jobsByTimelineId[timelineId];
        if (
          state.isSubmittingByTimelineId[timelineId] ||
          (existing && inFlightStatuses.has(existing.lifecycle))
        ) {
          return existing;
        }

        const requestId = createRequestId();
        const requestedAt = new Date().toISOString();
        set((current) => ({
          isSubmittingByTimelineId: {
            ...current.isSubmittingByTimelineId,
            [timelineId]: true,
          },
          jobsByTimelineId: {
            ...current.jobsByTimelineId,
            [timelineId]: {
              timelineId,
              requestId,
              lifecycle: "queued",
              submittedAt: requestedAt,
              resumeState: "none",
            },
          },
        }));

        try {
          const request: TimelineExportRequest = {
            requestId,
            timelineId,
            renderSettings,
            requestedAt,
          };

          const startResult = await exportAgent.startExport(request, {
            signal: options?.signal,
          });
          return get().applyExportSubmissionResult(
            timelineId,
            requestId,
            startResult,
            options?.timeoutMs,
          );
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }

          const failureState = createFailureState(
            timelineId,
            "Export request failed.",
            "transport_exception",
            {
              cause:
                error instanceof Error
                  ? { name: error.name, message: error.message }
                  : error,
            },
            requestId,
          );
          set((current) => ({
            jobsByTimelineId: {
              ...current.jobsByTimelineId,
              [timelineId]: failureState,
            },
          }));
          return failureState;
        } finally {
          set((current) => ({
            isSubmittingByTimelineId: {
              ...current.isSubmittingByTimelineId,
              [timelineId]: false,
            },
          }));
        }
      },
      applyExportSubmissionResult: (timelineId, requestId, result, timeoutMs) => {
        const nowIso = new Date().toISOString();
        const timeoutAt =
          timeoutMs && timeoutMs > 0
            ? new Date(Date.now() + timeoutMs).toISOString()
            : undefined;
        let nextState: ExportTimelineState | undefined;

        set((state) => {
          const previous = state.jobsByTimelineId[timelineId];

          if (result.kind === "failure") {
            nextState = {
              timelineId,
              requestId,
              lifecycle: "error",
              failure: result.failure,
              submittedAt: previous?.submittedAt ?? nowIso,
              lastPolledAt: nowIso,
              timeoutAt,
              resumeState: "none",
            };
          } else if (result.kind === "success") {
            nextState = {
              timelineId,
              requestId,
              lifecycle: "success",
              result: {
                ...result.result,
                artifacts: result.result.artifacts.map((artifact) => ({
                  ...artifact,
                })),
              },
              submittedAt: previous?.submittedAt ?? nowIso,
              lastPolledAt: nowIso,
              timeoutAt,
              resumeState: "none",
            };
          } else {
            nextState = {
              timelineId,
              requestId,
              lifecycle: result.handle.status,
              handle: {
                ...result.handle,
              },
              submittedAt: previous?.submittedAt ?? nowIso,
              lastPolledAt: nowIso,
              timeoutAt: result.handle.timeoutAt ?? timeoutAt,
              resumeState: "none",
            };
          }

          return {
            jobsByTimelineId: {
              ...state.jobsByTimelineId,
              [timelineId]: nextState!,
            },
          };
        });

        return nextState;
      },
      applyExportPollEvent: (timelineId, pollResult) => {
        const nowIso = new Date().toISOString();
        set((state) => {
          const current = state.jobsByTimelineId[timelineId];
          if (!current) {
            return state;
          }

          const nextBase: ExportTimelineState = {
            ...current,
            lastPolledAt: nowIso,
          };

          if (pollResult.kind === "pending") {
            return {
              jobsByTimelineId: {
                ...state.jobsByTimelineId,
                [timelineId]: {
                  ...nextBase,
                  lifecycle: pollResult.handle.status,
                  handle: { ...pollResult.handle },
                  progress: pollResult.progress
                    ? { ...pollResult.progress }
                    : nextBase.progress,
                },
              },
            };
          }

          if (pollResult.kind === "terminal_success") {
            return {
              jobsByTimelineId: {
                ...state.jobsByTimelineId,
                [timelineId]: {
                  ...nextBase,
                  lifecycle: "success",
                  handle: undefined,
                  failure: undefined,
                  resumeState: "none",
                  result: {
                    ...pollResult.result,
                    artifacts: pollResult.result.artifacts.map((artifact) => ({
                      ...artifact,
                    })),
                  },
                },
              },
            };
          }

          return {
            jobsByTimelineId: {
              ...state.jobsByTimelineId,
              [timelineId]: {
                ...nextBase,
                lifecycle:
                  pollResult.failure.code === "export_job_canceled"
                    ? "canceled"
                    : pollResult.failure.code === "export_job_expired"
                      ? "expired"
                      : "error",
                handle: undefined,
                resumeState: "none",
                failure: pollResult.failure,
              },
            },
          };
        });
      },
      markExportTimeout: (timelineId, timeoutMs) => {
        const nowIso = new Date().toISOString();
        set((state) => {
          const current = state.jobsByTimelineId[timelineId];
          if (!current) {
            return state;
          }

          return {
            jobsByTimelineId: {
              ...state.jobsByTimelineId,
              [timelineId]: {
                ...current,
                lifecycle: "expired",
                failure: {
                  message: "Export polling timed out.",
                  code: "export_poll_timeout",
                  details: timeoutMs ? { timeoutMs } : undefined,
                },
                lastPolledAt: nowIso,
                resumeState: "expired",
              },
            },
          };
        });
      },
      clearExportState: (timelineId) => {
        set((state) => {
          const next = { ...state.jobsByTimelineId };
          delete next[timelineId];
          return {
            jobsByTimelineId: next,
          };
        });
      },
      classifyHydratedExportJobs: (nowIso) => {
        const now = new Date(nowIso ?? new Date().toISOString()).getTime();
        set((state) => ({
          jobsByTimelineId: Object.fromEntries(
            Object.entries(state.jobsByTimelineId).map(([timelineId, job]) => {
              if (terminalStatuses.has(job.lifecycle)) {
                return [timelineId, { ...job, resumeState: "none" }];
              }

              if (!inFlightStatuses.has(job.lifecycle)) {
                return [timelineId, { ...job, resumeState: "none" }];
              }

              if (!isValidHandle(job.handle)) {
                return [
                  timelineId,
                  {
                    ...job,
                    lifecycle: "error",
                    resumeState: "resume_unavailable",
                    failure: {
                      message: "Export job resume metadata is unavailable.",
                      code: "export_resume_unavailable",
                    },
                  },
                ];
              }

              if (job.timeoutAt) {
                const timeoutAt = new Date(job.timeoutAt).getTime();
                if (!Number.isFinite(timeoutAt) || timeoutAt <= now) {
                  return [
                    timelineId,
                    {
                      ...job,
                      lifecycle: "expired",
                      resumeState: "expired",
                      failure: {
                        message: "Export job has expired.",
                        code: "export_job_expired",
                      },
                    },
                  ];
                }
              }

              return [timelineId, { ...job, resumeState: "resume_needed" }];
            }),
          ) as Record<TimelineId, ExportTimelineState>,
        }));
      },
    }),
    {
      name: exportStorePersistKey,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedExportStoreState => ({
        jobsByTimelineId: state.jobsByTimelineId,
        activeExportTimelineId: state.activeExportTimelineId,
      }),
      merge: (persistedState, currentState): ExportStoreState => {
        const persistedCandidate = persistedState as
          | Partial<PersistedExportStoreState>
          | { state?: Partial<PersistedExportStoreState> };
        const persisted =
          typeof persistedCandidate === "object" &&
          persistedCandidate !== null &&
          "state" in persistedCandidate &&
          typeof persistedCandidate.state === "object" &&
          persistedCandidate.state !== null
            ? persistedCandidate.state
            : (persistedCandidate as Partial<PersistedExportStoreState>);
        return {
          ...currentState,
          jobsByTimelineId:
            sanitizePersistedJobs(persisted.jobsByTimelineId) ??
            currentState.jobsByTimelineId,
          activeExportTimelineId:
            persisted.activeExportTimelineId ?? currentState.activeExportTimelineId,
          hasHydrated: false,
          hydrationError: undefined,
          isSubmittingByTimelineId: {},
          isResolvingByTimelineId: {},
        };
      },
    },
  ),
);

export const selectExportStateByTimelineId = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportTimelineState | undefined => state.jobsByTimelineId[timelineId];

export const selectExportLifecycleByTimelineId = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportJobStatus | undefined => state.jobsByTimelineId[timelineId]?.lifecycle;

export const selectExportCanSubmit = (
  state: ExportStoreState,
  timelineId: TimelineId,
): boolean => {
  const exportState = state.jobsByTimelineId[timelineId];
  if (!exportState) {
    return true;
  }

  return (
    !state.isSubmittingByTimelineId[timelineId] &&
    !state.isResolvingByTimelineId[timelineId] &&
    !inFlightStatuses.has(exportState.lifecycle)
  );
};

export const selectExportIsInFlight = (
  state: ExportStoreState,
  timelineId: TimelineId,
): boolean => {
  const lifecycle = state.jobsByTimelineId[timelineId]?.lifecycle;
  return lifecycle ? inFlightStatuses.has(lifecycle) : false;
};

export const selectExportResultArtifacts = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportArtifactRef[] =>
  state.jobsByTimelineId[timelineId]?.result?.artifacts ?? emptyExportArtifacts;

export const selectExportFailure = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportFailure | undefined => state.jobsByTimelineId[timelineId]?.failure;

export const selectExportResumeState = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportResumeState => state.jobsByTimelineId[timelineId]?.resumeState ?? "none";

const selectPersistedFallbackByTimelineId = (
  timelineId: TimelineId,
): { lifecycle?: string; resumeState?: string } | undefined =>
  readPersistedExportJob(timelineId);

export const selectEffectiveExportLifecycleByTimelineId = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportJobStatus | undefined => {
  const live = state.jobsByTimelineId[timelineId];
  if (live) {
    return live.lifecycle;
  }

  const persisted = selectPersistedFallbackByTimelineId(timelineId);
  return persisted?.lifecycle as ExportJobStatus | undefined;
};

export const selectEffectiveExportResumeStateByTimelineId = (
  state: ExportStoreState,
  timelineId: TimelineId,
): ExportResumeState => {
  const live = state.jobsByTimelineId[timelineId];
  if (live) {
    return live.resumeState ?? "none";
  }

  const persisted = selectPersistedFallbackByTimelineId(timelineId);
  return (persisted?.resumeState as ExportResumeState | undefined) ?? "none";
};

useExportStore.persist.onFinishHydration(() => {
  useExportStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
});

if (useExportStore.persist.hasHydrated()) {
  useExportStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
} else if (
  typeof window !== "undefined" &&
  window.localStorage.getItem(exportStorePersistKey) === null
) {
  useExportStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
} else {
  const rehydrateResult = useExportStore.persist.rehydrate();
  if (rehydrateResult instanceof Promise) {
    void rehydrateResult.catch((error: unknown) => {
      useExportStore.setState({
        hasHydrated: false,
        hydrationError: error instanceof Error ? error.message : undefined,
      });
    });
  }
}

const sanitizePersistedJobs = (
  jobsByTimelineId: unknown,
): Record<TimelineId, ExportTimelineState> | undefined => {
  if (typeof jobsByTimelineId !== "object" || jobsByTimelineId === null) {
    return undefined;
  }

  const entries = Object.entries(jobsByTimelineId as Record<string, unknown>)
    .filter(([, value]) => typeof value === "object" && value !== null)
    .map(([key, value]) => [key, sanitizeJob(value as ExportTimelineState)] as const);

  return Object.fromEntries(entries) as Record<TimelineId, ExportTimelineState>;
};

const sanitizeJob = (job: ExportTimelineState): ExportTimelineState => ({
  timelineId: job.timelineId,
  requestId: job.requestId,
  lifecycle: job.lifecycle,
  handle: isValidHandle(job.handle) ? job.handle : undefined,
  result: job.result,
  failure: job.failure,
  progress: job.progress,
  submittedAt: job.submittedAt,
  lastPolledAt: job.lastPolledAt,
  timeoutAt: job.timeoutAt,
  resumeState: job.resumeState ?? "none",
});

const isValidHandle = (handle: ExportJobHandle | undefined): handle is ExportJobHandle =>
  !!handle &&
  typeof handle.provider === "string" &&
  typeof handle.requestId === "string" &&
  typeof handle.jobId === "string" &&
  (handle.status === "submitted" ||
    handle.status === "rendering" ||
    handle.status === "finalizing");

const createRequestId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `export-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createFailureState = (
  timelineId: TimelineId,
  message: string,
  code: string,
  details?: unknown,
  requestId = createRequestId(),
): ExportTimelineState => ({
  timelineId,
  requestId,
  lifecycle: "error",
  failure: {
    message,
    code,
    details,
  },
  submittedAt: new Date().toISOString(),
  lastPolledAt: new Date().toISOString(),
  resumeState: "none",
});

const readPersistedExportJob = (
  timelineId: TimelineId,
): { lifecycle?: string; resumeState?: string } | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(exportStorePersistKey);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as {
      state?: {
        jobsByTimelineId?: Record<
          string,
          {
            lifecycle?: string;
            resumeState?: string;
          }
        >;
      };
    };

    const job = parsed.state?.jobsByTimelineId?.[timelineId];
    if (!job || typeof job !== "object") {
      return undefined;
    }

    return {
      lifecycle: typeof job.lifecycle === "string" ? job.lifecycle : undefined,
      resumeState: typeof job.resumeState === "string" ? job.resumeState : undefined,
    };
  } catch {
    return undefined;
  }
};
