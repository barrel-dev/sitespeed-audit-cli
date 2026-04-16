/**
 * Lighthouse audit runner.
 * Launches headless Chrome, runs a Lighthouse audit, and returns
 * structured scores + metrics suitable for DB insertion.
 */
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

// ─── Desktop config ────────────────────────────────────────────────────────────
// Mimics the preset Lighthouse uses for desktop audits (high bandwidth, no throttling).
const DESKTOP_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

/**
 * Run a Lighthouse audit on the given URL.
 *
 * @param {string} url         Full URL to audit.
 * @param {{ device?: 'desktop'|'mobile', saveRaw?: boolean }} options
 * @returns {Promise<{
 *   scores: { performance: number, accessibility: number, bestPractices: number, seo: number },
 *   metrics: { lcp: number|null, fcp: number|null, fid: number|null, cls: number|null,
 *               tti: number|null, tbt: number|null, speedIndex: number|null },
 *   rawJson: string|null
 * }>}
 */
export async function runAudit(url, { device = 'desktop', saveRaw = false } = {}) {
  let chrome;

  try {
    chrome = await launch({
      chromeFlags: [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  } catch (err) {
    throw new Error(
      `Failed to launch Chrome: ${err.message}\n` +
        'Make sure Google Chrome is installed and accessible in your PATH.',
    );
  }

  try {
    const flags = {
      port: chrome.port,
      output: 'json',
      logLevel: 'error', // suppress Lighthouse verbose output
    };

    // Mobile is Lighthouse's default config; desktop needs explicit overrides.
    const config = device === 'mobile' ? undefined : DESKTOP_CONFIG;

    const runnerResult = await lighthouse(url, flags, config);

    if (!runnerResult?.lhr) {
      throw new Error('Lighthouse returned no report data.');
    }

    const lhr = runnerResult.lhr;

    // Scores are 0–1 floats in LHR; convert to 0–100 integers
    const scores = {
      performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories?.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories?.['best-practices']?.score ?? 0) * 100),
      seo: Math.round((lhr.categories?.seo?.score ?? 0) * 100),
    };

    const audits = lhr.audits ?? {};

    const metrics = {
      lcp: audits['largest-contentful-paint']?.numericValue ?? null,
      fcp: audits['first-contentful-paint']?.numericValue ?? null,
      // FID is not measurable in lab; max-potential-fid is the closest lab proxy
      fid: audits['max-potential-fid']?.numericValue ?? null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      tti: audits['interactive']?.numericValue ?? null,
      tbt: audits['total-blocking-time']?.numericValue ?? null,
      speedIndex: audits['speed-index']?.numericValue ?? null,
    };

    return {
      scores,
      metrics,
      rawJson: saveRaw ? JSON.stringify(lhr) : null,
    };
  } finally {
    await chrome.kill();
  }
}
