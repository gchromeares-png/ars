import { ChallengeRequest, ChallengeResolution, IChallengeResolver } from "./types";

type DbcCaptcha = {
  captcha?: number;
  text?: string;
};

type DbcClient = {
  decode(
    payload: { extra: { type: number; turnstile_params: string } },
    callback: (captcha: DbcCaptcha | null | undefined) => void
  ): void;
};

type DbcModule = {
  HttpClient: new (username: string, password: string) => DbcClient;
};

export interface DeathByCaptchaResolverOptions {
  username: string;
  password: string;
  timeoutMs?: number;
}

export class DeathByCaptchaResolver implements IChallengeResolver {
  private readonly client: DbcClient;
  private readonly timeoutMs: number;

  constructor(options: DeathByCaptchaResolverOptions) {
    if (!options.username || !options.password) {
      throw new Error("DeathByCaptcha credentials are required");
    }

    const dbc = require("deathbycaptcha-lib") as DbcModule;
    this.client = new dbc.HttpClient(options.username, options.password);
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  supports(type: ChallengeRequest["type"]): boolean {
    return type === "turnstile";
  }

  async solve(
    request: ChallengeRequest,
    signal?: AbortSignal
  ): Promise<ChallengeResolution> {
    if (!this.supports(request.type)) {
      return {
        success: false,
        provider: "deathbycaptcha",
        error: `Unsupported challenge type: ${request.type}`
      };
    }

    if (!request.siteKey) {
      return {
        success: false,
        provider: "deathbycaptcha",
        error: "Turnstile siteKey is required"
      };
    }

    if (signal?.aborted) {
      return {
        success: false,
        provider: "deathbycaptcha",
        error: "Challenge resolution aborted"
      };
    }

    const turnstileParams: Record<string, string> = {
      sitekey: request.siteKey,
      pageurl: request.url
    };

    if (request.proxy) {
      turnstileParams.proxy = request.proxy;
      turnstileParams.proxytype = request.proxyType ?? "HTTP";
    }

    return new Promise<ChallengeResolution>((resolve) => {
      let settled = false;

      const finish = (result: ChallengeResolution): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        resolve(result);
      };

      const onAbort = (): void => {
        finish({
          success: false,
          provider: "deathbycaptcha",
          error: "Challenge resolution aborted"
        });
      };

      const timeout = setTimeout(() => {
        finish({
          success: false,
          provider: "deathbycaptcha",
          error: `Challenge resolution timed out after ${this.timeoutMs}ms`
        });
      }, this.timeoutMs);

      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        this.client.decode(
          {
            extra: {
              type: 12,
              turnstile_params: JSON.stringify(turnstileParams)
            }
          },
          (captcha) => {
            const token = captcha?.text?.trim();
            if (!captcha || !token) {
              finish({
                success: false,
                provider: "deathbycaptcha",
                error: "DeathByCaptcha returned no solution token"
              });
              return;
            }

            finish({
              success: true,
              provider: "deathbycaptcha",
              token,
              text: token,
              jobId: captcha.captcha
            });
          }
        );
      } catch (error) {
        finish({
          success: false,
          provider: "deathbycaptcha",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
}
