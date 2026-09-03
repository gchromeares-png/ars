import { ChallengeRequest, ChallengeResolution } from "./types";
import { ChallengeResolverRegistry } from "./resolver-registry";

export class ChallengeCoordinator {
  constructor(private readonly registry: ChallengeResolverRegistry) {}

  async resolve(
    request: ChallengeRequest,
    signal?: AbortSignal
  ): Promise<ChallengeResolution> {
    if (signal?.aborted) {
      return {
        success: false,
        provider: "none",
        error: "Challenge resolution aborted"
      };
    }

    const resolver = this.registry.resolve(request.type);
    if (!resolver) {
      return {
        success: false,
        provider: "none",
        error: `No resolver available for challenge type ${request.type}`
      };
    }

    return resolver.solve(request, signal);
  }
}
