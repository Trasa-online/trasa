// Reusable Figma capture harness for Trasa native views.
// Usage: node capture-run.mjs '<json config>'
// config = { concurrency?: number, session?: {...}|null, screens: [{id, route, label, needsAuth, blockMaps, delayMs, prep}] }
// Each screen: id=captureId (from generate_figma_design), route=hash route e.g. "/auth",
//   needsAuth=bool (inject supabase session), blockMaps=bool, delayMs=extra wait, prep=optional string of extra localStorage json
import { chromium } from "playwright";

const CFG = JSON.parse(process.argv[2]);
const BASE = "http://localhost:8080";
const CAPTURE_JS = "https://mcp.figma.com/mcp/html-to-design/capture.js";
const AUTH_KEY = "sb-api-auth-token"; // Supabase session localStorage key

const results = [];

async function captureOne(browser, s) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  // Block maps to avoid AuthFailure crashes (referrer-restricted key on localhost)
  if (s.blockMaps) {
    await ctx.route(/maps\.(googleapis|gstatic)\.com/, (r) => r.abort());
  }
  // Seed localStorage before app boot
  const seed = {
    trasa_cookie_consent_v2: "granted",
    trasa_guest_welcome_dismissed_v1: "1",
    ...(s.extraLS || {}),
  };
  if (s.needsAuth && CFG.session) {
    seed[AUTH_KEY] = JSON.stringify(CFG.session);
  }
  await ctx.addInitScript((seedObj) => {
    for (const [k, v] of Object.entries(seedObj)) {
      try { localStorage.setItem(k, v); } catch (e) {}
    }
  }, seed);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  try {
    await page.goto(`${BASE}/#${s.route}`, { waitUntil: "networkidle", timeout: 45000 });
  } catch (e) {
    // networkidle can time out on pages with long-poll; fall back to domcontentloaded wait
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(s.delayMs ?? 3500);

  // Hide background swiper cards so text doesn't bleed through captured DOM
  await page.evaluate(() => {
    document.querySelectorAll('[style*="scale"]').forEach((el) => {
      const t = getComputedStyle(el).transform;
      if (t && t !== "none" && /matrix/.test(t)) {
        // leave as-is; only hide obvious stacked background cards marked by data attr if present
      }
    });
  }).catch(() => {});

  // Inject capture.js (CSP-safe: fetch text + inject)
  const r = await ctx.request.get(CAPTURE_JS);
  const js = await r.text();
  await page.evaluate((src) => {
    const el = document.createElement("script");
    el.textContent = src;
    document.head.appendChild(el);
  }, js);
  await page.waitForTimeout(600);

  const endpoint = `https://mcp.figma.com/mcp/capture/${s.id}/submit`;
  // Kick off capture, then WAIT for the submit POST to finish (200) before closing
  const respPromise = page.waitForResponse(
    (resp) => resp.url().includes(`/mcp/capture/${s.id}/`),
    { timeout: 90000 }
  );
  await page.evaluate(({ id, endpoint }) => {
    return window.figma.captureForDesign({ captureId: id, endpoint, selector: "body" });
  }, { id: s.id, endpoint });

  let status = "unknown";
  try {
    const resp = await respPromise;
    status = resp.status();
  } catch (e) {
    status = "no-response:" + String(e).slice(0, 80);
  }
  results.push({ label: s.label, id: s.id, submit: status, errors: errors.slice(0, 3) });
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
const conc = CFG.concurrency ?? 3;
const queue = [...CFG.screens];
async function worker() {
  while (queue.length) {
    const s = queue.shift();
    try { await captureOne(browser, s); }
    catch (e) { results.push({ label: s.label, id: s.id, submit: "ERROR", err: String(e).slice(0, 200) }); }
  }
}
await Promise.all(Array.from({ length: conc }, worker));
await browser.close();
console.log(JSON.stringify(results, null, 2));
