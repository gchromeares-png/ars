import { DeathByCaptchaResolver } from "../src/challenges/deathbycaptcha-resolver";
import { ChallengeRequest, ChallengeType } from "../src/challenges/types";

type DbcDecodePayload = {
  captcha?: string;
  extra?: Record<string, unknown>;
};

class FakeDbcClient {
  readonly calls: DbcDecodePayload[] = [];

  decode(
    payload: DbcDecodePayload,
    callback: (captcha: { captcha: number; text: string } | null) => void
  ): void {
    this.calls.push(payload);
    callback({ captcha: 42, text: "solved-token" });
  }
}

const baseRequest = (type: ChallengeType): ChallengeRequest => ({
  taskId: `task-${type}`,
  url: `https://lab.example.test/${type}`,
  type
});

const createResolver = (client: FakeDbcClient): DeathByCaptchaResolver =>
  new DeathByCaptchaResolver({
    username: "unit-test-user",
    password: "unit-test-password",
    client
  });

const extraParams = (payload: DbcDecodePayload, field: string): Record<string, unknown> => {
  expect(payload.extra).toBeDefined();
  const raw = payload.extra?.[field];
  expect(typeof raw).toBe("string");
  return JSON.parse(raw as string) as Record<string, unknown>;
};

describe("DeathByCaptchaResolver", () => {
  it("supports every currently modelled non-deprecated DeathByCaptcha type", () => {
    const resolver = createResolver(new FakeDbcClient());
    const supportedTypes: ChallengeType[] = [
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

    for (const type of supportedTypes) {
      expect(resolver.supports(type)).toBe(true);
    }
  });

  it("uses the standard image payload for image CAPTCHAs", async () => {
    const client = new FakeDbcClient();
    const resolver = createResolver(client);

    const result = await resolver.solve({
      ...baseRequest("image"),
      payload: "fixtures/captcha.jpg"
    });

    expect(result).toMatchObject({ success: true, token: "solved-token", jobId: 42 });
    expect(client.calls[0]).toEqual({ captcha: "fixtures/captcha.jpg" });
  });

  it("maps token and challenge providers to their official DBC type ids and parameter fields", async () => {
    const cases: Array<{
      request: ChallengeRequest;
      typeId: number;
      field: string;
      expected: Record<string, unknown>;
    }> = [
      {
        request: { ...baseRequest("recaptcha-v2"), siteKey: "recaptcha-v2-key" },
        typeId: 4,
        field: "token_params",
        expected: { googlekey: "recaptcha-v2-key" }
      },
      {
        request: {
          ...baseRequest("recaptcha-v3"),
          siteKey: "recaptcha-v3-key",
          parameters: { min_score: 0.3 }
        },
        typeId: 5,
        field: "token_params",
        expected: { googlekey: "recaptcha-v3-key", action: "verify", min_score: 0.3 }
      },
      {
        request: { ...baseRequest("recaptcha-v2-enterprise"), siteKey: "enterprise-key" },
        typeId: 25,
        field: "token_enterprise_params",
        expected: { googlekey: "enterprise-key" }
      },
      {
        request: {
          ...baseRequest("geetest-v3"),
          parameters: { gt: "gt-value", challenge: "challenge-value" }
        },
        typeId: 8,
        field: "geetest_params",
        expected: { gt: "gt-value", challenge: "challenge-value" }
      },
      {
        request: { ...baseRequest("geetest-v4"), siteKey: "captcha-id-value" },
        typeId: 9,
        field: "geetest_params",
        expected: { captcha_id: "captcha-id-value" }
      },
      {
        request: { ...baseRequest("turnstile"), siteKey: "turnstile-key" },
        typeId: 12,
        field: "turnstile_params",
        expected: { sitekey: "turnstile-key" }
      },
      {
        request: { ...baseRequest("lemin"), siteKey: "lemin-captcha-id" },
        typeId: 14,
        field: "lemin_params",
        expected: { captchaid: "lemin-captcha-id" }
      },
      {
        request: { ...baseRequest("capy"), siteKey: "capy-key" },
        typeId: 15,
        field: "capy_params",
        expected: { captchakey: "capy-key" }
      },
      {
        request: {
          ...baseRequest("amazon-waf"),
          siteKey: "waf-key",
          parameters: { iv: "iv-value", context: "context-value" }
        },
        typeId: 16,
        field: "waf_params",
        expected: { sitekey: "waf-key", iv: "iv-value", context: "context-value" }
      },
      {
        request: { ...baseRequest("siara"), parameters: { slideurlid: "slide-id" } },
        typeId: 17,
        field: "siara_params",
        expected: { slideurlid: "slide-id" }
      },
      {
        request: { ...baseRequest("mtcaptcha"), siteKey: "mtcaptcha-key" },
        typeId: 18,
        field: "mtcaptcha_params",
        expected: { sitekey: "mtcaptcha-key" }
      },
      {
        request: {
          ...baseRequest("cutcaptcha"),
          parameters: { apikey: "api-key", miserykey: "misery-key" }
        },
        typeId: 19,
        field: "cutcaptcha_params",
        expected: { apikey: "api-key", miserykey: "misery-key" }
      },
      {
        request: { ...baseRequest("friendly-captcha"), siteKey: "friendly-key" },
        typeId: 20,
        field: "friendly_params",
        expected: { sitekey: "friendly-key" }
      },
      {
        request: { ...baseRequest("datadome") },
        typeId: 21,
        field: "datadome_params",
        expected: { captcha_url: "https://lab.example.test/datadome" }
      },
      {
        request: { ...baseRequest("tencent"), parameters: { appid: "tencent-app" } },
        typeId: 23,
        field: "tencent_params",
        expected: { appid: "tencent-app" }
      },
      {
        request: { ...baseRequest("atb"), parameters: { appid: "atb-app" } },
        typeId: 24,
        field: "atb_params",
        expected: { appid: "atb-app" }
      }
    ];

    for (const testCase of cases) {
      const client = new FakeDbcClient();
      const resolver = createResolver(client);
      const result = await resolver.solve(testCase.request);
      const payload = client.calls[0];

      expect(result.success).toBe(true);
      expect(payload.extra?.type).toBe(testCase.typeId);
      expect(extraParams(payload, testCase.field)).toMatchObject({
        ...testCase.expected,
        pageurl: testCase.request.url
      });
    }
  });

  it("maps audio and text payloads without requiring browser context", async () => {
    const audioClient = new FakeDbcClient();
    const audioResolver = createResolver(audioClient);
    await audioResolver.solve({
      ...baseRequest("audio"),
      payload: "base64-audio",
      parameters: { language: "de" }
    });

    expect(audioClient.calls[0].extra).toEqual({
      type: 13,
      audio: "base64-audio",
      language: "de"
    });

    const textClient = new FakeDbcClient();
    const textResolver = createResolver(textClient);
    await textResolver.solve({
      ...baseRequest("text"),
      parameters: { question: "2 + 2?" }
    });

    expect(textClient.calls[0].extra).toEqual({
      type: 11,
      textcaptcha: "2 + 2?"
    });
  });

  it("keeps proxy context inside provider params", async () => {
    const client = new FakeDbcClient();
    const resolver = createResolver(client);

    await resolver.solve({
      ...baseRequest("turnstile"),
      siteKey: "turnstile-key",
      proxy: "http://user:pass@127.0.0.1:8080",
      proxyType: "HTTP"
    });

    expect(extraParams(client.calls[0], "turnstile_params")).toMatchObject({
      proxy: "http://user:pass@127.0.0.1:8080",
      proxytype: "HTTP"
    });
  });

  it("returns a clear error before calling DBC when required provider parameters are missing", async () => {
    const client = new FakeDbcClient();
    const resolver = createResolver(client);

    const result = await resolver.solve(baseRequest("amazon-waf"));

    expect(result).toMatchObject({
      success: false,
      provider: "deathbycaptcha",
      error: "Missing required challenge parameter: sitekey"
    });
    expect(client.calls).toHaveLength(0);
  });
});
