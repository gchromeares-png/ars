import { ChallengeType, IChallengeResolver } from "./types";

export class ChallengeResolverRegistry {
  private readonly resolvers: IChallengeResolver[] = [];

  register(resolver: IChallengeResolver): void {
    if (!this.resolvers.includes(resolver)) {
      this.resolvers.push(resolver);
    }
  }

  resolve(type: ChallengeType): IChallengeResolver | undefined {
    return this.resolvers.find((resolver) => resolver.supports(type));
  }
}
