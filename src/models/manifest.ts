import { z } from "zod";

export const SkillManifestSchema = z.object({
  name: z.string(),
  display_name: z.string().optional(),
  source: z
    .object({
      type: z.enum(["local", "remote", "adapted"]),
      repo: z.string().optional(),
      ref: z.string().optional(),
      commit: z.string().optional(),
    })
    .optional(),
  status: z
    .object({
      stage: z.string().default("adapted"),
      quality: z.string().optional(),
    })
    .optional(),
  scope: z
    .object({
      recommended: z.string().optional(),
    })
    .optional(),
  capabilities: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
  dependencies: z
    .object({
      tools: z.array(z.string()).optional(),
    })
    .optional(),
  adapter: z
    .object({
      target: z.string().optional(),
      adapted_from: z.string().nullable().optional(),
    })
    .optional(),
  localization: z.record(z.string(), z.any()).optional(),
  conflicts_with: z.array(z.string()).optional(),
  entry: z
    .object({
      file: z.string().default("SKILL.md"),
    })
    .optional(),
  skip_vet: z.boolean().optional(),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;
