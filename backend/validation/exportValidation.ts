import { z } from "zod";
import type { ExportSubmitRequestBody } from "../contracts/exportHttpTypes";

const renderSettingsSchema = z
  .object({
    format: z.enum(["mp4", "webm"]),
    resolution: z.enum(["720p", "1080p", "1440p", "2160p"]),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    quality: z.enum(["draft", "standard", "high"]),
  })
  .strict();

export const exportSubmitRequestSchema = z
  .object({
    requestId: z.string().trim().min(1),
    timelineId: z.string().trim().min(1),
    renderSettings: renderSettingsSchema,
    requestedAt: z.string().trim().min(1),
    metadata: z.unknown().optional(),
  })
  .strict();

export const exportJobParamsSchema = z
  .object({
    jobId: z.string().trim().min(1),
  })
  .strict();

export const parseSubmitBody = (value: unknown): ExportSubmitRequestBody =>
  exportSubmitRequestSchema.parse(value);

export const parseJobIdParams = (value: unknown): { jobId: string } =>
  exportJobParamsSchema.parse(value);
