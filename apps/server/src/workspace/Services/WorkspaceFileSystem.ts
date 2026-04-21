/**
 * WorkspaceFileSystem - Effect service contract for workspace file mutations.
 *
 * Owns workspace-root-relative file write operations and their associated
 * safety checks and cache invalidation hooks.
 *
 * @module WorkspaceFileSystem
 */
import { Schema, Context } from "effect";
import type { Effect } from "effect";

import type {
  DesignPreviewEntry,
  DesignPreviewListInput,
  DesignPreviewReadInput,
  DesignPreviewReadResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "@t3tools/contracts";
import { WorkspacePathOutsideRootError } from "./WorkspacePaths.ts";

export class WorkspaceFileSystemError extends Schema.TaggedErrorClass<WorkspaceFileSystemError>()(
  "WorkspaceFileSystemError",
  {
    cwd: Schema.String,
    relativePath: Schema.optional(Schema.String),
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

/**
 * WorkspaceFileSystemShape - Service API for workspace-relative file operations.
 */
export interface WorkspaceFileSystemShape {
  /**
   * Write a file relative to the workspace root.
   *
   * Creates parent directories as needed and rejects paths that escape the
   * workspace root.
   */
  readonly writeFile: (
    input: ProjectWriteFileInput,
  ) => Effect.Effect<
    ProjectWriteFileResult,
    WorkspaceFileSystemError | WorkspacePathOutsideRootError
  >;

  /**
   * List files written under `.t3code/design/<threadId>/` in the given workspace.
   *
   * Returns an empty list if the directory does not exist yet.
   */
  readonly listDesignFiles: (
    input: DesignPreviewListInput,
  ) => Effect.Effect<ReadonlyArray<DesignPreviewEntry>, WorkspaceFileSystemError>;

  /**
   * Read a single file under `.t3code/design/<threadId>/` as text.
   *
   * Rejects relative paths that escape the design directory.
   */
  readonly readDesignFile: (
    input: DesignPreviewReadInput,
  ) => Effect.Effect<
    DesignPreviewReadResult,
    WorkspaceFileSystemError | WorkspacePathOutsideRootError
  >;
}

/**
 * WorkspaceFileSystem - Service tag for workspace file operations.
 */
export class WorkspaceFileSystem extends Context.Service<
  WorkspaceFileSystem,
  WorkspaceFileSystemShape
>()("t3/workspace/Services/WorkspaceFileSystem") {}
