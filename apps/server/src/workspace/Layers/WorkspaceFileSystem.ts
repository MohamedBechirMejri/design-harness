import { Effect, FileSystem, Layer, Path } from "effect";

import type { DesignPreviewEntry } from "@t3tools/contracts";

import {
  WorkspaceFileSystem,
  WorkspaceFileSystemError,
  type WorkspaceFileSystemShape,
} from "../Services/WorkspaceFileSystem.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

const DESIGN_SUBDIR = ".t3code/design";
const DESIGN_MAX_FILE_BYTES = 2 * 1024 * 1024;

export const makeWorkspaceFileSystem = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;
  const workspaceEntries = yield* WorkspaceEntries;

  const writeFile: WorkspaceFileSystemShape["writeFile"] = Effect.fn(
    "WorkspaceFileSystem.writeFile",
  )(function* (input) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });

    yield* fileSystem.makeDirectory(path.dirname(target.absolutePath), { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.makeDirectory",
            detail: cause.message,
            cause,
          }),
      ),
    );
    yield* fileSystem.writeFileString(target.absolutePath, input.contents).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.writeFile",
            detail: cause.message,
            cause,
          }),
      ),
    );
    yield* workspaceEntries.invalidate(input.cwd);
    return { relativePath: target.relativePath };
  });

  const designDirFor = (cwd: string, threadId: string) =>
    Effect.map(
      workspacePaths.resolveRelativePathWithinRoot({
        workspaceRoot: cwd,
        relativePath: `${DESIGN_SUBDIR}/${threadId}`,
      }),
      (resolved) => resolved.absolutePath,
    );

  const listDesignFiles: WorkspaceFileSystemShape["listDesignFiles"] = Effect.fn(
    "WorkspaceFileSystem.listDesignFiles",
  )(function* (input) {
    const designRoot = yield* designDirFor(input.cwd, input.threadId).pipe(
      Effect.catchTag("WorkspacePathOutsideRootError", (cause) =>
        Effect.fail(
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            operation: "workspaceFileSystem.listDesignFiles.resolve",
            detail: cause.message,
            cause,
          }),
        ),
      ),
    );

    const exists = yield* fileSystem.exists(designRoot).pipe(
      Effect.catch((cause) =>
        Effect.fail(
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            operation: "workspaceFileSystem.listDesignFiles.exists",
            detail: cause.message,
            cause,
          }),
        ),
      ),
    );
    if (!exists) {
      return {
        entries: [] as ReadonlyArray<DesignPreviewEntry>,
        resolvedAbsolutePath: designRoot,
        rootExists: false,
      };
    }

    const walk = (dir: string): Effect.Effect<DesignPreviewEntry[], WorkspaceFileSystemError> =>
      Effect.gen(function* () {
        const children = yield* fileSystem.readDirectory(dir).pipe(
          Effect.catch((cause) =>
            Effect.fail(
              new WorkspaceFileSystemError({
                cwd: input.cwd,
                operation: "workspaceFileSystem.listDesignFiles.readDirectory",
                detail: cause.message,
                cause,
              }),
            ),
          ),
        );
        const collected: DesignPreviewEntry[] = [];
        for (const name of children) {
          if (name.startsWith(".")) continue;
          const absolute = path.join(dir, name);
          const info = yield* fileSystem.stat(absolute).pipe(
            Effect.catch((cause) =>
              Effect.fail(
                new WorkspaceFileSystemError({
                  cwd: input.cwd,
                  operation: "workspaceFileSystem.listDesignFiles.stat",
                  detail: cause.message,
                  cause,
                }),
              ),
            ),
          );
          if (info.type === "Directory") {
            const nested = yield* walk(absolute);
            collected.push(...nested);
            continue;
          }
          if (info.type !== "File") continue;
          const relativeToDesign = path.relative(designRoot, absolute);
          collected.push({
            relativePath: relativeToDesign,
            name,
            size: Number(info.size ?? 0),
            modifiedAtMs: info.mtime._tag === "Some" ? info.mtime.value.getTime() : 0,
          });
        }
        return collected;
      });

    const entries = yield* walk(designRoot);
    entries.sort((a, b) => {
      if (a.modifiedAtMs !== b.modifiedAtMs) return b.modifiedAtMs - a.modifiedAtMs;
      return a.relativePath.localeCompare(b.relativePath);
    });
    return {
      entries,
      resolvedAbsolutePath: designRoot,
      rootExists: true,
    };
  });

  const readDesignFile: WorkspaceFileSystemShape["readDesignFile"] = Effect.fn(
    "WorkspaceFileSystem.readDesignFile",
  )(function* (input) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: `${DESIGN_SUBDIR}/${input.threadId}/${input.relativePath}`,
    });
    const info = yield* fileSystem.stat(target.absolutePath).pipe(
      Effect.catch((cause) =>
        Effect.fail(
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.readDesignFile.stat",
            detail: cause.message,
            cause,
          }),
        ),
      ),
    );
    if (info.type !== "File") {
      return yield* Effect.fail(
        new WorkspaceFileSystemError({
          cwd: input.cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.readDesignFile",
          detail: "Requested path is not a file.",
        }),
      );
    }
    if (Number(info.size ?? 0) > DESIGN_MAX_FILE_BYTES) {
      return yield* Effect.fail(
        new WorkspaceFileSystemError({
          cwd: input.cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.readDesignFile",
          detail: `Design file exceeds ${DESIGN_MAX_FILE_BYTES} bytes.`,
        }),
      );
    }
    const contents = yield* fileSystem.readFileString(target.absolutePath).pipe(
      Effect.catch((cause) =>
        Effect.fail(
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.readDesignFile.readFileString",
            detail: cause.message,
            cause,
          }),
        ),
      ),
    );
    return {
      relativePath: target.relativePath.startsWith(`${DESIGN_SUBDIR}/${input.threadId}/`)
        ? target.relativePath.slice(`${DESIGN_SUBDIR}/${input.threadId}/`.length)
        : input.relativePath,
      contents,
      modifiedAtMs: info.mtime._tag === "Some" ? info.mtime.value.getTime() : 0,
    };
  });

  return { writeFile, listDesignFiles, readDesignFile } satisfies WorkspaceFileSystemShape;
});

export const WorkspaceFileSystemLive = Layer.effect(WorkspaceFileSystem, makeWorkspaceFileSystem);
