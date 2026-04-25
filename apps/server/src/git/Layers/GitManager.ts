import { realpathSync } from "node:fs";

import { Cache, Duration, Effect, Exit, Layer } from "effect";
import {
  GitCommandError,
  type GitStatusLocalResult,
  type GitStatusRemoteResult,
} from "@dh/contracts";
import { detectGitHostingProviderFromRemoteUrl, mergeGitStatusParts } from "@dh/shared/git";

import { GitManager, type GitManagerShape } from "../Services/GitManager.ts";
import { GitCore } from "../Services/GitCore.ts";
import type { GitStatusDetails } from "../Services/GitCore.ts";

const STATUS_RESULT_CACHE_TTL = Duration.seconds(1);
const STATUS_RESULT_CACHE_CAPACITY = 2_048;

function isNotGitRepositoryError(error: GitCommandError): boolean {
  return error.message.toLowerCase().includes("not a git repository");
}

function canonicalizeExistingPath(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return value;
  }
}

const nonRepositoryStatusDetails = {
  isRepo: false,
  hasOriginRemote: false,
  isDefaultBranch: false,
  branch: null,
  upstreamRef: null,
  hasWorkingTreeChanges: false,
  workingTree: { files: [], insertions: 0, deletions: 0 },
  hasUpstream: false,
  aheadCount: 0,
  behindCount: 0,
} satisfies GitStatusDetails;

export const makeGitManager = Effect.fn("makeGitManager")(function* () {
  const gitCore = yield* GitCore;

  const normalizeStatusCacheKey = (cwd: string) => canonicalizeExistingPath(cwd);

  const readConfigValueNullable = (cwd: string, key: string) =>
    gitCore.readConfigValue(cwd, key).pipe(Effect.catch(() => Effect.succeed(null)));

  const resolveHostingProvider = Effect.fn("resolveHostingProvider")(function* (
    cwd: string,
    branch: string | null,
  ) {
    const preferredRemoteName =
      branch === null
        ? "origin"
        : ((yield* readConfigValueNullable(cwd, `branch.${branch}.remote`)) ?? "origin");
    const remoteUrl =
      (yield* readConfigValueNullable(cwd, `remote.${preferredRemoteName}.url`)) ??
      (yield* readConfigValueNullable(cwd, "remote.origin.url"));

    return remoteUrl ? detectGitHostingProviderFromRemoteUrl(remoteUrl) : null;
  });

  const readLocalStatus = Effect.fn("readLocalStatus")(function* (cwd: string) {
    const details = yield* gitCore
      .statusDetailsLocal(cwd)
      .pipe(
        Effect.catchIf(isNotGitRepositoryError, () => Effect.succeed(nonRepositoryStatusDetails)),
      );
    const hostingProvider = details.isRepo
      ? yield* resolveHostingProvider(cwd, details.branch)
      : null;

    return {
      isRepo: details.isRepo,
      ...(hostingProvider ? { hostingProvider } : {}),
      hasOriginRemote: details.hasOriginRemote,
      isDefaultBranch: details.isDefaultBranch,
      branch: details.branch,
      hasWorkingTreeChanges: details.hasWorkingTreeChanges,
      workingTree: details.workingTree,
    } satisfies GitStatusLocalResult;
  });

  const localStatusResultCache = yield* Cache.makeWith(readLocalStatus, {
    capacity: STATUS_RESULT_CACHE_CAPACITY,
    timeToLive: (exit) => (Exit.isSuccess(exit) ? STATUS_RESULT_CACHE_TTL : Duration.zero),
  });

  const readRemoteStatus = Effect.fn("readRemoteStatus")(function* (cwd: string) {
    const details = yield* gitCore
      .statusDetails(cwd)
      .pipe(Effect.catchIf(isNotGitRepositoryError, () => Effect.succeed(null)));
    if (details === null || !details.isRepo) {
      return null;
    }

    return {
      hasUpstream: details.hasUpstream,
      aheadCount: details.aheadCount,
      behindCount: details.behindCount,
    } satisfies GitStatusRemoteResult;
  });

  const remoteStatusResultCache = yield* Cache.makeWith(readRemoteStatus, {
    capacity: STATUS_RESULT_CACHE_CAPACITY,
    timeToLive: (exit) => (Exit.isSuccess(exit) ? STATUS_RESULT_CACHE_TTL : Duration.zero),
  });

  const localStatus: GitManagerShape["localStatus"] = Effect.fn("localStatus")(function* (input) {
    return yield* Cache.get(localStatusResultCache, normalizeStatusCacheKey(input.cwd));
  });
  const remoteStatus: GitManagerShape["remoteStatus"] = Effect.fn("remoteStatus")(
    function* (input) {
      return yield* Cache.get(remoteStatusResultCache, normalizeStatusCacheKey(input.cwd));
    },
  );
  const status: GitManagerShape["status"] = Effect.fn("status")(function* (input) {
    const [local, remote] = yield* Effect.all([localStatus(input), remoteStatus(input)]);
    return mergeGitStatusParts(local, remote);
  });
  const invalidateLocalStatus: GitManagerShape["invalidateLocalStatus"] = Effect.fn(
    "invalidateLocalStatus",
  )(function* (cwd) {
    yield* Cache.invalidate(localStatusResultCache, normalizeStatusCacheKey(cwd));
  });
  const invalidateRemoteStatus: GitManagerShape["invalidateRemoteStatus"] = Effect.fn(
    "invalidateRemoteStatus",
  )(function* (cwd) {
    yield* Cache.invalidate(remoteStatusResultCache, normalizeStatusCacheKey(cwd));
  });
  const invalidateStatus: GitManagerShape["invalidateStatus"] = Effect.fn("invalidateStatus")(
    function* (cwd) {
      const key = normalizeStatusCacheKey(cwd);
      yield* Cache.invalidate(localStatusResultCache, key);
      yield* Cache.invalidate(remoteStatusResultCache, key);
    },
  );

  return {
    localStatus,
    remoteStatus,
    status,
    invalidateLocalStatus,
    invalidateRemoteStatus,
    invalidateStatus,
  } satisfies GitManagerShape;
});

export const GitManagerLive = Layer.effect(GitManager, makeGitManager());
