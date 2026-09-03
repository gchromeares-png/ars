import { ChallengeRequest, ChallengeType } from "./types";

export interface ChallengePageSnapshot {
  url: string;
  html: string;
  title?: string;
}

export interface ChallengeDetectionContext {
  taskId: string;
  proxy?: string;
  proxyType?: ChallengeRequest["proxyType"];
}

interface ChallengeSignature {
  type: ChallengeType;
  patterns: RegExp[];
  siteKeyPatterns?: RegExp[];
}

const SIGNATURES: ChallengeSignature[] = [
  {
    type: "turnstile",
    patterns: [
      /cf-turnstile/i,
      /challenges\.cloudflare\.com\/turnstile/i,
      /turnstile\.render/i
    ],
    siteKeyPatterns: [
      /data-sitekey=["']([^"']+)["']/i,
      /sitekey\s*[:=]\s*["']([^"']+)["']/i
    ]
  },
  {
    type: "recaptcha-v2-enterprise",
    patterns: [
      /recaptcha\/enterprise/i,
      /grecaptcha\.enterprise/i
    ],
    siteKeyPatterns: [
      /data-sitekey=["']([^"']+)["']/i,
      /[?&]k=([^&"']+)/i
    ]
  },
  {
    type: "recaptcha-v3",
    patterns: [
      /grecaptcha\.execute/i,
      /recaptcha\/api\.js[^"']*render=/i
    ],
    siteKeyPatterns: [
      /render=([^&"']+)/i,
      /grecaptcha\.execute\(["']([^"']+)["']/i
    ]
  },
  {
    type: "recaptcha-v2",
    patterns: [
      /g-recaptcha/i,
      /google\.com\/recaptcha\/api2\/anchor/i,
      /recaptcha\/api\.js/i
    ],
    siteKeyPatterns: [
      /data-sitekey=["']([^"']+)["']/i,
      /[?&]k=([^&"']+)/i
    ]
  },
  {
    type: "geetest-v4",
    patterns: [/geetest.*captcha_id/i, /captcha_id.*geetest/i],
    siteKeyPatterns: [/captcha[_-]?id\s*[:=]\s*["']([^"']+)["']/i]
  },
  {
    type: "geetest-v3",
    patterns: [/geetest/i, /gt\s*[:=].*challenge\s*[:=]/i]
  },
  {
    type: "amazon-waf",
    patterns: [/awswaf/i, /amazon.*waf.*captcha/i, /captcha-sdk\.aws/i]
  },
  {
    type: "friendly-captcha",
    patterns: [/frc-captcha/i, /friendlycaptcha/i, /friendly-captcha/i],
    siteKeyPatterns: [/data-sitekey=["']([^"']+)["']/i]
  },
  {
    type: "mtcaptcha",
    patterns: [/mtcaptcha/i],
    siteKeyPatterns: [/sitekey\s*[:=]\s*["']([^"']+)["']/i]
  },
  {
    type: "datadome",
    patterns: [/datadome/i, /geo\.captcha-delivery\.com/i]
  },
  {
    type: "tencent",
    patterns: [/tencentcaptcha/i, /tcaptcha/i, /captcha\.qq\.com/i]
  },
  {
    type: "lemin",
    patterns: [/lemin-cropped-captcha/i, /lemin\.now/i]
  },
  {
    type: "capy",
    patterns: [/capy-captcha/i, /captcha\.capy\.me/i]
  },
  {
    type: "cutcaptcha",
    patterns: [/cutcaptcha/i]
  },
  {
    type: "siara",
    patterns: [/siara/i]
  },
  {
    type: "atb",
    patterns: [/atb.*captcha/i, /captcha.*atb/i]
  }
];

export class ChallengeDetector {
  detect(
    snapshot: ChallengePageSnapshot,
    context: ChallengeDetectionContext
  ): ChallengeRequest | undefined {
    const source = `${snapshot.title ?? ""}\n${snapshot.html}`;

    for (const signature of SIGNATURES) {
      if (!signature.patterns.some(pattern => pattern.test(source))) continue;

      const siteKey = this.extractFirst(source, signature.siteKeyPatterns ?? []);
      return {
        taskId: context.taskId,
        url: snapshot.url,
        type: signature.type,
        siteKey,
        proxy: context.proxy,
        proxyType: context.proxyType
      };
    }

    return undefined;
  }

  private extractFirst(source: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      const value = match?.[1]?.trim();
      if (value) return value;
    }
    return undefined;
  }
}
