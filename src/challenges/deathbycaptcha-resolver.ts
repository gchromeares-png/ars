import {
  ChallengeParameters,
  ChallengeRequest,
  ChallengeResolution,
  ChallengeType,
  IChallengeResolver
} from "./types";

type DbcCaptcha = {
  captcha?: number;
  text?: string | Record<string, unknown> | null;
};

type DbcDecodePayload = {
  captcha?: string;
  extra?: Record<string, unknown>;
};

type DbcClient = {
  decode(
    payload: DbcDecodePayload,
    callback: (captcha: DbcCaptcha | null | undefined) => void
  ): void;
};

type DbcModule = {
  HttpClient: new (username: string, password: string) => DbcClient;
};

type MissingParameter = { missing: string };
type ProviderParameterValue = string | number | boolean | null | undefined | MissingParameter;
type ProviderParameters = Record<string, ProviderParameterValue>;

type ProviderPayloadResult =
  | { payload: DbcDecodePayload }
  | { error: string };

const SUPPORTED_TYPES: ChallengeType[] = [
  "image",
  "recaptcha-v2",
  "recaptcha-v3",
  "recaptcha-v2-enterprise",
  "geetest-v3",
  "geetest-v4",
  "text",
  "turnstile",
  "audio",
  "lemin",
  "capy",
  "amazon-waf",
  "siara",
  "mtcaptcha",
  "cutcaptcha",
  "friendly-captcha",
  "datadome",
  "tencent",
  "atb"
];

export interface DeathByCaptchaResolverOptions {
  username: string;
  password: string;
  timeoutMs?: number;
  client?: DbcClient;
}

export class DeathByCaptchaResolver implements IChallengeResolver {
  private readonly client: DbcClient;
  private readonly timeoutMs: number;

  constructor(options: DeathByCaptchaResolverOptions) {
    if (!options.username || !options.password) {
      throw new Error("DeathByCaptcha credentials are required");
    }

    if (options.client) {
      this.client = options.client;
    } else {
      const dbc = require("deathbycaptcha-lib") as DbcModule;
      this.client = new dbc.HttpClient(options.username, options.password);
    }

    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  supports(type: ChallengeRequest["type"]): boolean {
    return SUPPORTED_TYPES.includes(type);
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

    if (signal?.aborted) {
      return {
        success: false,
        provider: "deathbycaptcha",
        error: "Challenge resolution aborted"
      };
    }

    const providerPayload = this.buildProviderPayload(request);
    if ("error" in providerPayload) {
      return {
        success: false,
        provider: "deathbycaptcha",
        error: providerPayload.error
      };
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
        this.client.decode(providerPayload.payload, (captcha) => {
          const solutionText = this.stringifySolution(captcha?.text);
          if (!captcha || !solutionText) {
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
            token: solutionText,
            text: solutionText,
            jobId: captcha.captcha
          });
        });
      } catch (error) {
        finish({
          success: false,
          provider: "deathbycaptcha",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  private buildProviderPayload(request: ChallengeRequest): ProviderPayloadResult {
    switch (request.type) {
      case "image":
        return this.buildImagePayload(request);
      case "audio":
        return this.buildAudioPayload(request);
      case "text":
        return this.buildTextPayload(request);
      case "recaptcha-v2":
        return this.buildJsonExtraPayload(request, 4, "token_params", {
          googlekey: this.requireParameter(request, "googlekey", ["googlekey", "googleKey"], request.siteKey)
        });
      case "recaptcha-v3":
        return this.buildJsonExtraPayload(request, 5, "token_params", {
          googlekey: this.requireParameter(request, "googlekey", ["googlekey", "googleKey"], request.siteKey),
          action: this.readStringParameter(request, ["action"]) ?? "verify",
          min_score: this.requireParameter(request, "min_score", ["min_score", "minScore"])
        });
      case "recaptcha-v2-enterprise":
        return this.buildJsonExtraPayload(request, 25, "token_enterprise_params", {
          googlekey: this.requireParameter(request, "googlekey", ["googlekey", "googleKey"], request.siteKey)
        });
      case "geetest-v3":
        return this.buildJsonExtraPayload(request, 8, "geetest_params", {
          gt: this.requireParameter(request, "gt", ["gt"]),
          challenge: this.requireParameter(request, "challenge", ["challenge"])
        });
      case "geetest-v4":
        return this.buildJsonExtraPayload(request, 9, "geetest_params", {
          captcha_id: this.requireParameter(request, "captcha_id", ["captcha_id", "captchaId"], request.siteKey)
        });
      case "turnstile":
        return this.buildJsonExtraPayload(request, 12, "turnstile_params", {
          sitekey: this.requireParameter(request, "sitekey", ["sitekey", "siteKey"], request.siteKey)
        });
      case "lemin":
        return this.buildJsonExtraPayload(request, 14, "lemin_params", {
          captchaid: this.requireParameter(request, "captchaid", ["captchaid", "captchaId"], request.siteKey)
        });
      case "capy":
        return this.buildJsonExtraPayload(request, 15, "capy_params", {
          captchakey: this.requireParameter(request, "captchakey", ["captchakey", "captchaKey"], request.siteKey),
          api_server: this.readStringParameter(request, ["api_server", "apiServer"])
        });
      case "amazon-waf":
        return this.buildJsonExtraPayload(request, 16, "waf_params", {
          sitekey: this.requireParameter(request, "sitekey", ["sitekey", "siteKey"], request.siteKey),
          iv: this.requireParameter(request, "iv", ["iv"]),
          context: this.requireParameter(request, "context", ["context"]),
          challengejs: this.readStringParameter(request, ["challengejs", "challengeJs"]),
          captchajs: this.readStringParameter(request, ["captchajs", "captchaJs"])
        });
      case "siara":
        return this.buildJsonExtraPayload(request, 17, "siara_params", {
          slideurlid: this.requireParameter(request, "slideurlid", ["slideurlid", "slideUrlId"]),
          useragent: this.readStringParameter(request, ["useragent", "userAgent"])
        });
      case "mtcaptcha":
        return this.buildJsonExtraPayload(request, 18, "mtcaptcha_params", {
          sitekey: this.requireParameter(request, "sitekey", ["sitekey", "siteKey"], request.siteKey)
        });
      case "cutcaptcha":
        return this.buildJsonExtraPayload(request, 19, "cutcaptcha_params", {
          apikey: this.requireParameter(request, "apikey", ["apikey", "apiKey"]),
          miserykey: this.requireParameter(request, "miserykey", ["miserykey", "miseryKey"])
        });
      case "friendly-captcha":
        return this.buildJsonExtraPayload(request, 20, "friendly_params", {
          sitekey: this.requireParameter(request, "sitekey", ["sitekey", "siteKey"], request.siteKey)
        });
      case "datadome":
        return this.buildJsonExtraPayload(request, 21, "datadome_params", {
          captcha_url: this.readStringParameter(request, ["captcha_url", "captchaUrl"]) ?? request.url
        });
      case "tencent":
        return this.buildJsonExtraPayload(request, 23, "tencent_params", {
          appid: this.requireParameter(request, "appid", ["appid", "appId"])
        });
      case "atb":
        return this.buildJsonExtraPayload(request, 24, "atb_params", {
          appid: this.requireParameter(request, "appid", ["appid", "appId"]),
          apiserver: this.readStringParameter(request, ["apiserver", "apiServer"])
        });
      default:
        return { error: `Unsupported challenge type: ${request.type}` };
    }
  }

  private buildImagePayload(request: ChallengeRequest): ProviderPayloadResult {
    const captcha = this.readStringParameter(request, ["captcha"]) ?? request.payload;
    if (!captcha) {
      return { error: "Missing required challenge parameter: captcha" };
    }

    return { payload: { captcha } };
  }

  private buildAudioPayload(request: ChallengeRequest): ProviderPayloadResult {
    const audio = this.readStringParameter(request, ["audio"]) ?? request.payload;
    if (!audio) {
      return { error: "Missing required challenge parameter: audio" };
    }

    return {
      payload: {
        extra: {
          type: 13,
          audio,
          language: this.readStringParameter(request, ["language"]) ?? "en"
        }
      }
    };
  }

  private buildTextPayload(request: ChallengeRequest): ProviderPayloadResult {
    const textcaptcha =
      this.readStringParameter(request, ["textcaptcha", "question", "text"]) ??
      request.payload;

    if (!textcaptcha) {
      return { error: "Missing required challenge parameter: textcaptcha" };
    }

    return {
      payload: {
        extra: {
          type: 11,
          textcaptcha
        }
      }
    };
  }

  private buildJsonExtraPayload(
    request: ChallengeRequest,
    typeId: number,
    parameterFieldName: string,
    mappedParameters: ProviderParameters
  ): ProviderPayloadResult {
    const missing = Object.entries(mappedParameters).find(
      ([, value]) =>
        value === null || value === undefined || value === "" || this.isMissingMarker(value)
    );

    if (missing) {
      const [, value] = missing;
      return {
        error: `Missing required challenge parameter: ${
          this.isMissingMarker(value) ? value.missing : missing[0]
        }`
      };
    }

    const params = this.cleanParameters({
      ...(request.parameters ?? {}),
      ...mappedParameters,
      pageurl: request.url
    });

    if (request.proxy) {
      params.proxy = request.proxy;
      params.proxytype = request.proxyType ?? "HTTP";
    }

    return {
      payload: {
        extra: {
          type: typeId,
          [parameterFieldName]: JSON.stringify(params)
        }
      }
    };
  }

  private requireParameter(
    request: ChallengeRequest,
    publicName: string,
    aliases: string[],
    fallback?: string
  ): string | MissingParameter {
    const value = this.readStringParameter(request, aliases) ?? fallback;
    return value ?? { missing: publicName };
  }

  private readStringParameter(
    request: ChallengeRequest,
    names: string[]
  ): string | undefined {
    for (const name of names) {
      const value = request.parameters?.[name];
      if (value === null || value === undefined || value === "") continue;
      return String(value);
    }
    return undefined;
  }

  private cleanParameters(parameters: ProviderParameters): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(parameters)) {
      if (value === null || value === undefined || value === "") continue;
      if (this.isMissingMarker(value)) continue;
      result[key] = value;
    }

    return result;
  }

  private stringifySolution(
    value: string | Record<string, unknown> | null | undefined
  ): string | undefined {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }

    return undefined;
  }

  private isMissingMarker(value: unknown): value is MissingParameter {
    return typeof value === "object" && value !== null && "missing" in value;
  }
}
