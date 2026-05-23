import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { exportAgent, type ExportAgentStartResult } from "../agents/exportAgent";
import { getExportArtifactAccess, pollExportJob } from "../services/exportService";
import {
  getExportHandle,
  saveExportHandle,
  type PersistedExportHandle,
} from "../services/exportHandleStorage";
import {
  buildTimelineExportSnapshot,
  ExportSnapshotBuilderError,
} from "../services/exportSnapshotService";
import type {
  ExportArtifactAccessDescriptor,
  ExportArtifactRef,
  ExportFailure,
  ExportJobHandle,
  ExportJobStatus,
  ExportPollResult,
  ExportProgressSnapshot,
  ExportRenderSettings,
  ExportTerminalResult,
  TimelineExportRequest,
  ExportArtifactAccessResult,
} from "../types/exportJob";
import type { TimelineId } from "../types/timeline";
import { useTimelineStore } from "./timelineStore";
import { useSceneStore } from "./sceneStore";

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

export type ExportArtifactAccessState =
  | {
      status: "loading";
      jobId: string;
      artifactId: string;
    }
  | {
      status: "ready";
      jobId: string;
      artifactId: string;
      artifact: ExportArtifactRef;
      access: ExportArtifactAccessDescriptor;
    }
  | {
      status: "unavailable";
      jobId: string;
      artifactId: string;
      reason: Extract<ExportArtifactAccessResult, { kind: "unavailable" }>["reason"];
      message: string;
    }
  | {
      status: "error";
      jobId: string;
      artifactId: string;
      failure: ExportFailure;
    };

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
  artifactAccessByArtifactId?: Record<string, ExportArtifactAccessState>;
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
  resumeExport: (
    timelineId: TimelineId,
    options?: {
      signal?: AbortSignal;
      timeoutMs?: number;
      maxTransientFailures?: number;
      pollDelayMs?: number;
    },
  ) => Promise<ExportTimelineState | undefined>;
  refreshExportStatus: (
    timelineId: TimelineId,
    options?: { signal?: AbortSignal },
  ) => Promise<ExportTimelineState | undefined>;
  reconnectExport: (
    timelineId: TimelineId,
    options?: { signal?: AbortSignal },
  ) => Promise<ExportTimelineState | undefined>;
  requestExportArtifactAccess: (
    timelineId: TimelineId,
    artifactId: string,
    options?: { signal?: AbortSignal },
  ) => Promise<ExportArtifactAccessState | undefined>;
  clearExportArtifactAccess: (
    timelineId: TimelineId,
    artifactId?: string,
  ) => void;
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
          const snapshot = buildTimelineExportSnapshot(
            timeline,
            useSceneStore.getState().scenes,
          );
          const request: TimelineExportRequest = {
            requestId,
            timelineId,
            renderSettings,
            requestedAt,
            snapshot,
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

          const failureCode =
            error instanceof ExportSnapshotBuilderError
              ? error.code
              : "transport_exception";
          const failureMessage =
            error instanceof ExportSnapshotBuilderError
              ? error.message
              : "Export request failed.";

          const failureState = createFailureState(
            timelineId,
            failureMessage,
            failureCode,
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
              artifactAccessByArtifactId: undefined,
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
              artifactAccessByArtifactId: undefined,
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
              artifactAccessByArtifactId: undefined,
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
                  artifactAccessByArtifactId: undefined,
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
                  artifactAccessByArtifactId: undefined,
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
      resumeExport: async (timelineId, options) => {
        const state = get();
        const current =
          state.jobsByTimelineId[timelineId] ??
          readPersistedExportTimelineState(timelineId);
        if (!current || !timelineId) {
          return undefined;
        }

        if (!state.jobsByTimelineId[timelineId]) {
          set((s) => ({
            jobsByTimelineId: {
              ...s.jobsByTimelineId,
              [timelineId]: current,
            },
          }));
        }

        if (
          state.isSubmittingByTimelineId[timelineId] ||
          state.isResolvingByTimelineId[timelineId]
        ) {
          return current;
        }

        if (
          terminalStatuses.has(current.lifecycle) ||
          current.resumeState !== "resume_needed" ||
          !isValidHandle(current.handle)
        ) {
          return current;
        }

        set((s) => ({
          isResolvingByTimelineId: {
            ...s.isResolvingByTimelineId,
            [timelineId]: true,
          },
          jobsByTimelineId: {
            ...s.jobsByTimelineId,
            [timelineId]: {
              ...current,
              lifecycle:
                current.lifecycle === "queued" ? "rendering" : current.lifecycle,
            },
          },
        }));

        try {
          const resolved = await exportAgent.pollExportUntilTerminal(current.handle, {
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
            maxTransientFailures: options?.maxTransientFailures,
            pollDelayMs: options?.pollDelayMs,
          });
          const nowIso = new Date().toISOString();
          let nextState: ExportTimelineState | undefined;

          set((s) => {
            const latest = s.jobsByTimelineId[timelineId];
            if (!latest) {
              return s;
            }

            if (resolved.kind === "success") {
              nextState = {
                ...latest,
                lifecycle: "success",
                handle: undefined,
                failure: undefined,
                result: {
                  ...resolved.result,
                  artifacts: resolved.result.artifacts.map((artifact) => ({
                    ...artifact,
                  })),
                },
                lastPolledAt: nowIso,
                resumeState: "none",
                artifactAccessByArtifactId: undefined,
              };
            } else {
              const failureCode = resolved.failure.code;
              nextState = {
                ...latest,
                lifecycle:
                  failureCode === "export_poll_timeout" ||
                  failureCode === "export_job_expired"
                    ? "expired"
                    : failureCode === "export_job_canceled"
                      ? "canceled"
                      : "error",
                handle: undefined,
                result: undefined,
                failure: resolved.failure,
                lastPolledAt: nowIso,
                resumeState:
                  failureCode === "export_poll_timeout" ||
                  failureCode === "export_job_expired"
                    ? "expired"
                    : failureCode === "export_resume_unavailable"
                      ? "resume_unavailable"
                      : "none",
                artifactAccessByArtifactId: undefined,
              };
            }

            return {
              jobsByTimelineId: {
                ...s.jobsByTimelineId,
                [timelineId]: nextState!,
              },
            };
          });

          return nextState;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }

          const failureState: ExportTimelineState = {
            ...current,
            lifecycle: "error",
            handle: undefined,
            result: undefined,
            failure: {
              message: "Export resume polling failed.",
              code: "transport_exception",
              details:
                error instanceof Error
                  ? { name: error.name, message: error.message }
                  : error,
            },
            lastPolledAt: new Date().toISOString(),
            resumeState: "none",
            artifactAccessByArtifactId: undefined,
          };
          set((s) => ({
            jobsByTimelineId: {
              ...s.jobsByTimelineId,
              [timelineId]: failureState,
            },
          }));
          return failureState;
        } finally {
          set((s) => ({
            isResolvingByTimelineId: {
              ...s.isResolvingByTimelineId,
              [timelineId]: false,
            },
          }));
        }
      },
      refreshExportStatus: async (timelineId, options) => {
        const state = get();
        const current = state.jobsByTimelineId[timelineId];
        if (!current) {
          return undefined;
        }

        if (!isValidHandle(current.handle)) {
          return current;
        }

        const pollResult = await pollExportJob(current.handle, {
          signal: options?.signal,
        });

        // Apply the poll result to update state
        get().applyExportPollEvent(timelineId, pollResult);

        // Return updated state
        return get().jobsByTimelineId[timelineId];
      },
      reconnectExport: async (timelineId, options) => {
        // 1. Load persisted handle from localStorage
        const persisted = getExportHandle(timelineId);
        if (!persisted) {
          return undefined;
        }

        // 2. Seed minimal ExportTimelineState so refreshExportStatus can run
        const initialState: ExportTimelineState = {
          timelineId,
          requestId: persisted.requestId,
          lifecycle: "submitted",
          handle: {
            provider: "backend_render",
            requestId: persisted.requestId,
            jobId: persisted.jobId,
            status: "submitted",
          },
          submittedAt: persisted.submittedAt,
          lastPolledAt: new Date().toISOString(),
          resumeState: "none",
        };

        set((state) => ({
          jobsByTimelineId: {
            ...state.jobsByTimelineId,
            [timelineId]: initialState,
          },
        }));

        // 3. Call refreshExportStatus once (single poll, not polling loop)
        const result = await get().refreshExportStatus(timelineId, options);

        // 4. Update lastCheckedAt in localStorage if refresh succeeded
        if (result) {
          saveExportHandle({
            ...persisted,
            lastCheckedAt: new Date().toISOString(),
          });
        }

        return result;
      },
      requestExportArtifactAccess: async (timelineId, artifactId, options) => {
        const current = get().jobsByTimelineId[timelineId];
        if (!current?.result || current.lifecycle !== "success") {
          return undefined;
        }

        const artifact = current.result.artifacts.find(
          (candidate) => candidate.id === artifactId,
        );
        if (!artifact) {
          return undefined;
        }

        const jobId = current.result.jobId;
        const loadingState: ExportArtifactAccessState = {
          status: "loading",
          jobId,
          artifactId,
        };

        set((state) => ({
          jobsByTimelineId: {
            ...state.jobsByTimelineId,
            [timelineId]: {
              ...state.jobsByTimelineId[timelineId]!,
              artifactAccessByArtifactId: {
                ...state.jobsByTimelineId[timelineId]?.artifactAccessByArtifactId,
                [artifactId]: loadingState,
              },
            },
          },
        }));

        try {
          const result = await getExportArtifactAccess(jobId, artifactId, {
            signal: options?.signal,
          });

          let nextState: ExportArtifactAccessState;
          if (result.kind === "ready") {
            nextState = {
              status: "ready",
              jobId,
              artifactId,
              artifact: { ...result.artifact },
              access: { ...result.access },
            };
          } else if (result.kind === "unavailable") {
            nextState = {
              status: "unavailable",
              jobId,
              artifactId,
              reason: result.reason,
              message: result.message,
            };
          } else {
            nextState = {
              status: "error",
              jobId,
              artifactId,
              failure: result.failure,
            };
          }

          set((state) => {
            const latest = state.jobsByTimelineId[timelineId];
            if (!latest || latest.result?.jobId !== jobId) {
              return state;
            }

            return {
              jobsByTimelineId: {
                ...state.jobsByTimelineId,
                [timelineId]: {
                  ...latest,
                  artifactAccessByArtifactId: {
                    ...latest.artifactAccessByArtifactId,
                    [artifactId]: nextState,
                  },
                },
              },
            };
          });

          return nextState;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }

          const errorState: ExportArtifactAccessState = {
            status: "error",
            jobId,
            artifactId,
            failure: {
              message: "Export artifact access request failed.",
              code: "transport_exception",
              details:
                error instanceof Error
                  ? { name: error.name, message: error.message }
                  : error,
            },
          };

          set((state) => {
            const latest = state.jobsByTimelineId[timelineId];
            if (!latest || latest.result?.jobId !== jobId) {
              return state;
            }

            return {
              jobsByTimelineId: {
                ...state.jobsByTimelineId,
                [timelineId]: {
                  ...latest,
                  artifactAccessByArtifactId: {
                    ...latest.artifactAccessByArtifactId,
                    [artifactId]: errorState,
                  },
                },
              },
            };
          });

          return errorState;
        }
      },
      clearExportArtifactAccess: (timelineId, artifactId) => {
        set((state) => {
          const current = state.jobsByTimelineId[timelineId];
          if (!current?.artifactAccessByArtifactId) {
            return state;
          }

          if (!artifactId) {
            return {
              jobsByTimelineId: {
                ...state.jobsByTimelineId,
                [timelineId]: {
                  ...current,
                  artifactAccessByArtifactId: undefined,
                },
              },
            };
          }

          const nextArtifactAccess = { ...current.artifactAccessByArtifactId };
          delete nextArtifactAccess[artifactId];

          return {
            jobsByTimelineId: {
              ...state.jobsByTimelineId,
              [timelineId]: {
                ...current,
                artifactAccessByArtifactId:
                  Object.keys(nextArtifactAccess).length > 0
                    ? nextArtifactAccess
                    : undefined,
              },
            },
          };
        });
      },
    }),
    {
      name: exportStorePersistKey,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedExportStoreState => ({
        jobsByTimelineId: Object.fromEntries(
          Object.entries(state.jobsByTimelineId).map(([timelineId, job]) => [
            timelineId,
            sanitizeJob(job),
          ]),
        ) as Record<TimelineId, ExportTimelineState>,
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

export const selectExportArtifactAccess = (
  state: ExportStoreState,
  timelineId: TimelineId,
  artifactId: string,
): ExportArtifactAccessState | undefined =>
  state.jobsByTimelineId[timelineId]?.artifactAccessByArtifactId?.[artifactId];

export const selectExportArtifactAccessStatus = (
  state: ExportStoreState,
  timelineId: TimelineId,
  artifactId: string,
): ExportArtifactAccessState["status"] | "idle" =>
  selectExportArtifactAccess(state, timelineId, artifactId)?.status ?? "idle";

export const selectExportArtifactAccessError = (
  state: ExportStoreState,
  timelineId: TimelineId,
  artifactId: string,
): ExportFailure | undefined => {
  const artifactAccess = selectExportArtifactAccess(state, timelineId, artifactId);
  return artifactAccess?.status === "error" ? artifactAccess.failure : undefined;
};

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

export const selectHasPersistedHandle = (
  state: ExportStoreState,
  timelineId: TimelineId,
): boolean => {
  // Read from exportHandleStorage - no state mutation, no backend call
  const handle = getExportHandle(timelineId);
  return !!handle;
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
  artifactAccessByArtifactId: undefined,
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

const readPersistedExportTimelineState = (
  timelineId: TimelineId,
): ExportTimelineState | undefined => {
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
        jobsByTimelineId?: Record<string, ExportTimelineState>;
      };
    };

    const candidate = parsed.state?.jobsByTimelineId?.[timelineId];
    if (!candidate || typeof candidate !== "object") {
      return undefined;
    }

    return sanitizeJob(candidate);
  } catch {
    return undefined;
  }
};
