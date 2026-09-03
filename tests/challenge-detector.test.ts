import { ChallengeDetector } from "../src/challenges/challenge-detector";

describe("ChallengeDetector", () => {
  const detector = new ChallengeDetector();

  it("detects Cloudflare Turnstile and keeps task network context", () => {
    const result = detector.detect(
      {
        url: "https://lab.example.test/turnstile",
        title: "Lab challenge",
        html: `
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
          <div class="cf-turnstile" data-sitekey="turnstile-site-key"></div>
        `
      },
      {
        taskId: "task-1",
        proxy: "http://user:pass@127.0.0.1:8080",
        proxyType: "HTTP"
      }
    );

    expect(result).toEqual({
      taskId: "task-1",
      url: "https://lab.example.test/turnstile",
      type: "turnstile",
      siteKey: "turnstile-site-key",
      proxy: "http://user:pass@127.0.0.1:8080",
      proxyType: "HTTP"
    });
  });

  it("detects reCAPTCHA v2 enterprise before generic reCAPTCHA v2", () => {
    const result = detector.detect(
      {
        url: "https://lab.example.test/enterprise",
        html: `
          <script src="https://www.google.com/recaptcha/enterprise.js"></script>
          <div class="g-recaptcha" data-sitekey="enterprise-site-key"></div>
          <script>grecaptcha.enterprise.ready(function () {});</script>
        `
      },
      { taskId: "task-enterprise" }
    );

    expect(result?.type).toBe("recaptcha-v2-enterprise");
    expect(result?.siteKey).toBe("enterprise-site-key");
  });

  it("detects reCAPTCHA v3 render keys", () => {
    const result = detector.detect(
      {
        url: "https://lab.example.test/v3",
        html: `<script src="https://www.google.com/recaptcha/api.js?render=v3-site-key"></script>`
      },
      { taskId: "task-v3" }
    );

    expect(result).toMatchObject({
      taskId: "task-v3",
      url: "https://lab.example.test/v3",
      type: "recaptcha-v3",
      siteKey: "v3-site-key"
    });
  });

  it("detects signature-only providers without requiring a site key", () => {
    const result = detector.detect(
      {
        url: "https://lab.example.test/datadome",
        html: `<script src="https://geo.captcha-delivery.com/captcha.js"></script>`
      },
      { taskId: "task-datadome" }
    );

    expect(result).toMatchObject({
      taskId: "task-datadome",
      url: "https://lab.example.test/datadome",
      type: "datadome"
    });
    expect(result?.siteKey).toBeUndefined();
  });

  it("returns undefined for pages without known challenge signatures", () => {
    const result = detector.detect(
      {
        url: "https://lab.example.test/plain",
        title: "Plain lab page",
        html: "<main>No challenge here</main>"
      },
      { taskId: "task-plain" }
    );

    expect(result).toBeUndefined();
  });
});
