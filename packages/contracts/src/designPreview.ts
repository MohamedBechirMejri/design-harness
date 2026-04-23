import { Schema } from "effect";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

const DESIGN_PREVIEW_PATH_MAX_LENGTH = 512;

const DesignPreviewRelativePath = TrimmedNonEmptyString.check(
  Schema.isMaxLength(DESIGN_PREVIEW_PATH_MAX_LENGTH),
);

export const DesignPreviewListInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  threadId: ThreadId,
});
export type DesignPreviewListInput = typeof DesignPreviewListInput.Type;

export const DesignPreviewEntry = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  size: Schema.Number,
  modifiedAtMs: Schema.Number,
});
export type DesignPreviewEntry = typeof DesignPreviewEntry.Type;

export const DesignPreviewListResult = Schema.Struct({
  entries: Schema.Array(DesignPreviewEntry),
  resolvedAbsolutePath: Schema.optional(Schema.String),
  rootExists: Schema.optional(Schema.Boolean),
});
export type DesignPreviewListResult = typeof DesignPreviewListResult.Type;

export const DesignPreviewReadInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  threadId: ThreadId,
  relativePath: DesignPreviewRelativePath,
});
export type DesignPreviewReadInput = typeof DesignPreviewReadInput.Type;

export const DesignPreviewReadResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  contents: Schema.String,
  modifiedAtMs: Schema.Number,
});
export type DesignPreviewReadResult = typeof DesignPreviewReadResult.Type;

export class DesignPreviewError extends Schema.TaggedErrorClass<DesignPreviewError>()(
  "DesignPreviewError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}
