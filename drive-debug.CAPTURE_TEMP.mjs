import { chromium } from "playwright";
import fs from "fs";
const S = JSON.parse(fs.readFileSync("/tmp/trasa-session.json","utf8"));
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
await ctx.route(/maps\.(googleapis|gstatic)\.com/, r=>r.abort());
await ctx.addInitScript((s)=>{ localStorage.setItem("trasa_cookie_consent_v2","granted"); localStorage.setItem("trasa_onboarding_done_v1","1"); localStorage.setItem("sb-api-auth-token", JSON.stringify(s)); }, S);
const p = await ctx.newPage();
async function st(t){ console.log(t+":",(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g," ").slice(0,150)); }
await p.goto("http://localhost:8080/#/plan",{waitUntil:"domcontentloaded",timeout:20000}); await p.waitForTimeout(3000);
await p.getByText("Warszawa",{exact:true}).first().click(); await p.waitForTimeout(700);
await p.getByRole("button",{name:/Dalej/i}).first().click(); await p.waitForTimeout(2200);
for (const db of await p.locator("button").filter({hasText:/^\d{1,2}$/}).all()){ const dis=await db.isDisabled().catch(()=>true); const t=(await db.innerText()).trim(); if(!dis&&/^(1[0-9]|2[0-5])$/.test(t)){ await db.click(); break; } }
await p.waitForTimeout(1000);
await p.getByRole("button",{name:/Dalej/i}).first().click(); await p.waitForTimeout(2500);
await p.getByText(/Tak, jestem/i).first().click().catch(()=>{}); await p.waitForTimeout(2500);
await p.getByRole("button",{name:/Pomiń/i}).first().click().catch(()=>{}); await p.waitForTimeout(4500);
await st("SWIPER");
await p.screenshot({path:"/tmp/drive-swiper.png"});
// tabs + filter
const tabs = await p.getByRole("tab").allInnerTexts().catch(()=>[]);
console.log("tabs:", JSON.stringify(tabs));
const hasFilter = await p.getByRole("button",{name:/filtr|sortuj/i}).count().catch(()=>0);
console.log("filter-ish buttons:", hasFilter);
await b.close();
