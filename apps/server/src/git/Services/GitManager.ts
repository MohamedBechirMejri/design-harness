/**
 * GitManager - Effect service contract for repository status reading.
 *
 * @module GitManager
 */
import {
  GitStatusInput,
  GitStatusLocalResult,
  GitStatusRemoteResult,
  GitStatusResult,
} from "@dh/contracts";
import { Context } from "effect";
import type { Effect } from "effect";
import type { GitManagerServiceError } from "@dh/contracts";

export interface GitManagerShape {
  readonly status: (
    input: GitStatusInput,
  ) => Effect.Effect<GitStatusResult, GitManagerServiceError>;

  readonly localStatus: (
    input: GitStatusInput,
  ) => Effect.Effect<GitStatusLocalResult, GitManagerServiceError>;

  readonly remoteStatus: (
    input: GitStatusInput,
  ) => Effect.Effect<GitStatusRemoteResult | null, GitManagerServiceError>;

  readonly invalidateLocalStatus: (cwd: string) => Effect.Effect<void, never>;

  readonly invalidateRemoteStatus: (cwd: string) => Effect.Effect<void, never>;

  readonly invalidateStatus: (cwd: string) => Effect.Effect<void, never>;
}

export class GitManager extends Context.Service<GitManager, GitManagerShape>()(
  "dh/git/Services/GitManager",
) {}
