export type ChallengeType =
  | "image"
  | "recaptcha-v2"
  | "recaptcha-v3"
  | "recaptcha-v2-enterprise"
  | "geetest-v3"
  | "geetest-v4"
  | "text"
  | "turnstile"
  | "audio"
  | "lemin"
  | "capy"
  | "amazon-waf"
  | "siara"
  | "mtcaptcha"
  | "cutcaptcha"
  | "friendly-captcha"
  | "datadome"
  | "tencent"
  | "atb";

export type ChallengeProxyType = "HTTP" | "HTTPS" | "SOCKS4" | "SOCKS5";

export type ChallengeParameters = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface ChallengeRequest {
  taskId: string;
  url: string;
  type: ChallengeType;
  siteKey?: string;
  proxy?: string;
  proxyType?: ChallengeProxyType;
  payload?: string;
  parameters?: ChallengeParameters;
}

export interface ChallengeResolution {
  success: boolean;
  provider: string;
  token?: string;
  text?: string;
  jobId?: number;
  error?: string;
}

export interface IChallengeResolver {
  supports(type: ChallengeType): boolean;
  solve(request: ChallengeRequest, signal?: AbortSignal): Promise<ChallengeResolution>;
}
