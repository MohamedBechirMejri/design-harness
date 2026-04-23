import { Effect, Layer } from "effect";

import {
  type ProjectSetupScriptRunnerShape,
  ProjectSetupScriptRunner,
} from "../Services/ProjectSetupScriptRunner.ts";

// Design-only build: worktree setup scripts are no longer wired up (no
// terminal to run them in and no worktree-creation flow). Keep the
// service around so any legacy callsite compiles.
const makeProjectSetupScriptRunner = Effect.gen(function* () {
  const runForThread: ProjectSetupScriptRunnerShape["runForThread"] = () =>
    Effect.succeed({ status: "no-script" } as const);

  return {
    runForThread,
  } satisfies ProjectSetupScriptRunnerShape;
});

export const ProjectSetupScriptRunnerLive = Layer.effect(
  ProjectSetupScriptRunner,
  makeProjectSetupScriptRunner,
);
