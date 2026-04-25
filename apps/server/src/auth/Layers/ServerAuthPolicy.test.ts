import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import type { ServerConfigShape } from "../../config.ts";
import { ServerConfig } from "../../config.ts";
import { ServerAuthPolicy } from "../Services/ServerAuthPolicy.ts";
import { ServerAuthPolicyLive } from "./ServerAuthPolicy.ts";

const makeServerAuthPolicyLayer = (overrides?: Partial<ServerConfigShape>) =>
  ServerAuthPolicyLive.pipe(
    Layer.provide(
      Layer.effect(
        ServerConfig,
        Effect.gen(function* () {
          const config = yield* ServerConfig;
          return {
            ...config,
            ...overrides,
          } satisfies ServerConfigShape;
        }),
      ).pipe(
        Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "dh-auth-policy-test-" })),
      ),
    ),
  );

it.layer(NodeServices.layer)("ServerAuthPolicyLive", (it) => {
  it.effect("uses loopback-browser policy for loopback hosts", () =>
    Effect.gen(function* () {
      const policy = yield* ServerAuthPolicy;
      const descriptor = yield* policy.getDescriptor();

      expect(descriptor.policy).toBe("loopback-browser");
      expect(descriptor.bootstrapMethods).toEqual(["one-time-token"]);
      expect(descriptor.sessionCookieName).toBe("dh_session");
    }).pipe(
      Effect.provide(
        makeServerAuthPolicyLayer({
          host: "127.0.0.1",
        }),
      ),
    ),
  );

  it.effect("uses remote-reachable policy for wildcard hosts", () =>
    Effect.gen(function* () {
      const policy = yield* ServerAuthPolicy;
      const descriptor = yield* policy.getDescriptor();

      expect(descriptor.policy).toBe("remote-reachable");
      expect(descriptor.bootstrapMethods).toEqual(["one-time-token"]);
    }).pipe(
      Effect.provide(
        makeServerAuthPolicyLayer({
          host: "0.0.0.0",
        }),
      ),
    ),
  );

  it.effect("uses remote-reachable policy for non-loopback hosts", () =>
    Effect.gen(function* () {
      const policy = yield* ServerAuthPolicy;
      const descriptor = yield* policy.getDescriptor();

      expect(descriptor.policy).toBe("remote-reachable");
    }).pipe(
      Effect.provide(
        makeServerAuthPolicyLayer({
          host: "192.168.1.50",
        }),
      ),
    ),
  );
});
