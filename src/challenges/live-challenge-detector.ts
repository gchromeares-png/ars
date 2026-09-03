import type { Page } from "patchright";
import type { LiveChallengeDetection, LiveChallengeType } from "./types";

export class LiveChallengeDetector {
  /**
   * Inspects a live Patchright page to detect active challenges/checkpoints.
   */
  async detect(page: Page): Promise<LiveChallengeDetection> {
    if (page.isClosed()) {
      return { detected: false, url: "" };
    }

    const currentUrl = page.url();

    try {
      const evaluation = await page.evaluate(() => {
        const href = window.location.href;
        const title = document.title || "";
        const bodyText = document.body ? document.body.innerText || "" : "";

        // 1. Cloudflare Turnstile
        const turnstileIframe = !!document.querySelector(
          'iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"], iframe[title*="Turnstile" i], iframe[title*="Cloudflare" i]'
        );
        const turnstileElement = !!document.querySelector(
          '.cf-turnstile, [data-turnstile-sitekey], #challenge-stage, #turnstile-wrapper'
        );
        const turnstileInput = !!document.querySelector('input[name="cf-turnstile-response"]');
        if (turnstileIframe || turnstileElement || turnstileInput) {
          return {
            detected: true,
            type: "turnstile",
            title,
            details: "Cloudflare Turnstile Challenge aktiv"
          };
        }

        // 2. Google reCAPTCHA
        const recaptchaIframe = !!document.querySelector(
          'iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha/enterprise"]'
        );
        const recaptchaElement = !!document.querySelector('.g-recaptcha');
        const recaptchaResponse = !!document.querySelector('textarea[name="g-recaptcha-response"]');
        if (recaptchaIframe || recaptchaElement || recaptchaResponse) {
          return {
            detected: true,
            type: "recaptcha",
            title,
            details: "Google reCAPTCHA Challenge aktiv"
          };
        }

        // 3. hCaptcha
        const hcaptchaIframe = !!document.querySelector('iframe[src*="hcaptcha.com"]');
        const hcaptchaElement = !!document.querySelector('.h-captcha');
        const hcaptchaResponse = !!document.querySelector('textarea[name="h-captcha-response"]');
        if (hcaptchaIframe || hcaptchaElement || hcaptchaResponse) {
          return {
            detected: true,
            type: "hcaptcha",
            title,
            details: "hCaptcha Challenge aktiv"
          };
        }

        // 4. Shopify Queue / Waiting Room
        const isQueue =
          /queue|waiting for checkout|line to check out|warteschlange/i.test(bodyText) &&
          (href.includes("/checkpoint") ||
            href.includes("/throttle") ||
            !!document.querySelector('[data-poll-target], .queue, #queue-container'));
        if (isQueue) {
          return {
            detected: true,
            type: "shopify-queue",
            title,
            details: "Shopify Checkout Queue / Warteschlange aktiv"
          };
        }

        // 5. Shopify Checkpoint
        const isCheckpoint =
          href.includes("/checkpoint") ||
          href.includes("/challenge") ||
          !!document.querySelector('form[action*="/checkpoint"], form#checkpoint-form, div[data-shopify-captcha]');
        if (isCheckpoint) {
          return {
            detected: true,
            type: "shopify-checkpoint",
            title,
            details: "Shopify Checkpoint Seite aktiv"
          };
        }

        // 6. Generic Cloudflare Interstitial ("Just a moment...")
        if (
          /just a moment|checking your browser|security verification/i.test(title) ||
          /just a moment\.\.\./i.test(bodyText)
        ) {
          return {
            detected: true,
            type: "generic-interstitial",
            title,
            details: "Cloudflare Interstitial Screen aktiv"
          };
        }

        return { detected: false, title, details: "" };
      });

      if (evaluation.detected) {
        return {
          detected: true,
          type: evaluation.type as LiveChallengeType,
          url: currentUrl,
          title: evaluation.title,
          details: evaluation.details
        };
      }

      // Fallback check based on URL path
      if (currentUrl.includes("/checkpoint") || currentUrl.includes("/challenge")) {
        return {
          detected: true,
          type: "shopify-checkpoint",
          url: currentUrl,
          details: "URL enthält Checkpoint/Challenge-Pfad"
        };
      }

      return { detected: false, url: currentUrl };
    } catch {
      // In case evaluation fails (e.g. navigation in flight)
      if (currentUrl.includes("/checkpoint") || currentUrl.includes("/challenge")) {
        return {
          detected: true,
          type: "shopify-checkpoint",
          url: currentUrl,
          details: "Navigation im Checkpoint-Pfad"
        };
      }
      return { detected: false, url: currentUrl };
    }
  }

  /**
   * Deterministic snapshot detection for unit tests or HTML source inspection.
   */
  detectFromSnapshot(url: string, html: string, title: string = ""): LiveChallengeDetection {
    const combined = `${title}\n${url}\n${html}`;

    if (
      /cf-turnstile|challenges\.cloudflare\.com|data-turnstile-sitekey|name=["']cf-turnstile-response["']|turnstile\.render/i.test(
        combined
      )
    ) {
      return {
        detected: true,
        type: "turnstile",
        url,
        title,
        details: "Cloudflare Turnstile erkannt"
      };
    }

    if (
      /recaptcha\/api|google\.com\/recaptcha|recaptcha\/enterprise|g-recaptcha|name=["']g-recaptcha-response["']/i.test(
        combined
      )
    ) {
      return {
        detected: true,
        type: "recaptcha",
        url,
        title,
        details: "Google reCAPTCHA erkannt"
      };
    }

    if (/hcaptcha\.com|h-captcha|name=["']h-captcha-response["']/i.test(combined)) {
      return {
        detected: true,
        type: "hcaptcha",
        url,
        title,
        details: "hCaptcha erkannt"
      };
    }

    if (
      /queue|waiting for checkout|line to check out/i.test(combined) &&
      (url.includes("/checkpoint") || url.includes("/throttle") || /data-poll-target/i.test(combined))
    ) {
      return {
        detected: true,
        type: "shopify-queue",
        url,
        title,
        details: "Shopify Queue erkannt"
      };
    }

    if (
      url.includes("/checkpoint") ||
      url.includes("/challenge") ||
      /action=["'][^"']*\/checkpoint["']|id=["']checkpoint-form["']|data-shopify-captcha/i.test(combined)
    ) {
      return {
        detected: true,
        type: "shopify-checkpoint",
        url,
        title,
        details: "Shopify Checkpoint erkannt"
      };
    }

    if (/just a moment|checking your browser|security verification/i.test(title)) {
      return {
        detected: true,
        type: "generic-interstitial",
        url,
        title,
        details: "Cloudflare Interstitial erkannt"
      };
    }

    return { detected: false, url };
  }
}
