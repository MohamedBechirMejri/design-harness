import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { GitCreateWorktreeInput } from "./git.ts";

const decodeCreateWorktreeInput = Schema.decodeUnknownSync(GitCreateWorktreeInput);

describe("GitCreateWorktreeInput", () => {
  it("accepts omitted newBranch for existing-branch worktrees", () => {
    const parsed = decodeCreateWorktreeInput({
      cwd: "/repo",
      branch: "feature/existing",
      path: "/tmp/worktree",
    });

    expect(parsed.newBranch).toBeUndefined();
    expect(parsed.branch).toBe("feature/existing");
  });
});
