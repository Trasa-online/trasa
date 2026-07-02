import { chromium } from "playwright";
const ID="33d14f73-e8b8-42e7-a7bf-1f1c90424e93"; // reuse (may be consumed already; just diagnostics)
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.route(/maps\.(googleapis|gstatic)\.com/, r=>r.abort());
await ctx.addInitScript(()=>{ localStorage.setItem("trasa_cookie_consent_v2","granted"); localStorage.setItem("trasa_guest_welcome_dismissed_v1","1"); });
const p = await ctx.newPage();
p.on("framenavigated", f=>{ if(f===p.mainFrame()) console.log("NAV ->", f.url()); });
await p.goto("http://localhost:8080/#/auth",{waitUntil:"domcontentloaded",timeout:20000});
await p.waitForTimeout(4000);
console.log("url after wait:", p.url());
const r = await ctx.request.get("https://mcp.figma.com/mcp/html-to-design/capture.js");
const js = await r.text();
console.log("capture.js bytes:", js.length);
await p.evaluate((src)=>{ const el=document.createElement("script"); el.textContent=src; document.head.appendChild(el); }, js);
await p.waitForTimeout(800);
console.log("window.figma:", await p.evaluate(()=>typeof window.figma));
console.log("captureForDesign:", await p.evaluate(()=>window.figma && typeof window.figma.captureForDesign));
await b.close();
