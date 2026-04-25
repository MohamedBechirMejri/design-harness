import { describe, expect, it } from "vitest";
import type { ModelCapabilities } from "@dh/contracts";

import { providerModelsFromSettings } from "./providerSnapshot.ts";

const CLAUDE_CUSTOM_MODEL_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [{ value: "high", label: "High", isDefault: true }],
  supportsFastMode: false,
  supportsThinkingToggle: true,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

describe("providerModelsFromSettings", () => {
  it("applies the provided capabilities to custom models", () => {
    const models = providerModelsFromSettings(
      [],
      "claudeAgent",
      ["claude-sonnet-5-0"],
      CLAUDE_CUSTOM_MODEL_CAPABILITIES,
    );

    expect(models).toEqual([
      {
        slug: "claude-sonnet-5-0",
        name: "claude-sonnet-5-0",
        isCustom: true,
        capabilities: CLAUDE_CUSTOM_MODEL_CAPABILITIES,
      },
    ]);
  });
});
