/**
 * Lighthouse audit runner.
 * Launches headless Chrome, runs a Lighthouse audit, and returns
 * structured scores + metrics suitable for DB insertion.
 *
 * Supports an optional Shopify platform mode: when platform='shopify' and a
 * password is provided, puppeteer handles the storefront password form before
 * Lighthouse audits the authenticated page.
 */
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer, { executablePath } from 'puppeteer';

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
 * @param {{ device?: 'desktop'|'mobile', saveRaw?: boolean, platform?: string, password?: string }} options
 * @returns {Promise<{
 *   scores: { performance: number, accessibility: number, bestPractices: number, seo: number },
 *   metrics: { lcp: number|null, fcp: number|null, fid: number|null, cls: number|null,
 *               tti: number|null, tbt: number|null, speedIndex: number|null },
 *   rawJson: string|null
 * }>}
 */
export async function runAudit(url, { device = 'desktop', saveRaw = false, platform, password } = {}) {
  if (platform === 'shopify' && password) {
    return runAuditWithShopifyAuth(url, { device, saveRaw, password });
  }
  let chrome;

  try {
    chrome = await launch({
      chromePath: executablePath(),
      chromeFlags: [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
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

// ─── Shopify password-protected storefront ────────────────────────────────────

/**
 * Verify that a Shopify storefront password is valid by navigating the password
 * gate and checking whether we land on the store. Throws if auth fails.
 * Does NOT run a Lighthouse audit — used as a pre-flight check.
 *
 * @param {string} url
 * @param {string} password
 */
export async function runShopifyAuthCheck(url, password) {
  const browser = await puppeteer.launch({
    executablePath: executablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

    const passwordForm = await page.$('form[action="/password"]');
    if (!passwordForm) {
      // Store is already accessible — no gate to pass
      return;
    }

    await page.type('form[action="/password"] input[type="password"]', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }),
      page.click('form[action="/password"] button[type="submit"]'),
    ]);

    const stillLocked = await page.$('form[action="/password"]');
    if (stillLocked) {
      throw new Error('Incorrect password — still on the password page.');
    }
  } finally {
    await browser.close();
  }
}

/**
 * Authenticate through a Shopify storefront password page, then run Lighthouse
 * using the same Chrome session so the audit sees the unlocked store.
 *
 * Flow:
 *  1. Launch Chrome via puppeteer (so we control the session/cookies).
 *  2. Navigate to the target URL — Shopify redirects to /password if locked.
 *  3. Find form[action="/password"], fill input[type=password], submit.
 *  4. Wait for post-login navigation to complete.
 *  5. Extract the Chrome debugging port from puppeteer's WS endpoint.
 *  6. Run Lighthouse on that port — it inherits the authenticated session.
 *  7. Tear down the browser.
 *
 * @param {string} url
 * @param {{ device: string, saveRaw: boolean, password: string }} opts
 */
async function runAuditWithShopifyAuth(url, { device, saveRaw, password }) {
  const browser = await puppeteer.launch({
    executablePath: executablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Auth is already validated by runShopifyAuthCheck pre-flight.
    // Still handle the gate here in case runAudit is called directly.
    const passwordForm = await page.$('form[action="/password"]');
    if (passwordForm) {
      await page.type('form[action="/password"] input[type="password"]', password);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }),
        page.click('form[action="/password"] button[type="submit"]'),
      ]);

      const stillLocked = await page.$('form[action="/password"]');
      if (stillLocked) {
        throw new Error('Shopify authentication failed — incorrect password.');
      }
    }

    // Extract debugging port from puppeteer's WS endpoint
    // Format: ws://127.0.0.1:<port>/devtools/browser/<id>
    const wsEndpoint = browser.wsEndpoint();
    const port = parseInt(new URL(wsEndpoint).port, 10);

    const flags = { port, output: 'json', logLevel: 'error' };
    const config = device === 'mobile' ? undefined : DESKTOP_CONFIG;

    const runnerResult = await lighthouse(url, flags, config);

    if (!runnerResult?.lhr) {
      throw new Error('Lighthouse returned no report data.');
    }

    const lhr = runnerResult.lhr;

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
      fid: audits['max-potential-fid']?.numericValue ?? null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      tti: audits['interactive']?.numericValue ?? null,
      tbt: audits['total-blocking-time']?.numericValue ?? null,
      speedIndex: audits['speed-index']?.numericValue ?? null,
    };

    return { scores, metrics, rawJson: saveRaw ? JSON.stringify(lhr) : null };
  } finally {
    await browser.close();
  }
}
