export type ChallengeType = "turnstile";

export interface ChallengeRequest {
  taskId: string;
  url: string;
  type: ChallengeType;
  siteKey: string;
  proxy?: string;
}

export interface ChallengeResolution {
  success: boolean;
  provider: string;
  token?: string;
  jobId?: number;
  error?: string;
}

export interface IChallengeResolver {
  supports(type: ChallengeType): boolean;
  solve(request: ChallengeRequest, signal?: AbortSignal): Promise<ChallengeResolution>;
}
