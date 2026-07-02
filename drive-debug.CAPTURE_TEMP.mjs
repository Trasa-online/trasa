import { chromium } from "playwright";
import fs from "fs";
const S = JSON.parse(fs.readFileSync("/tmp/trasa-session.json","utf8"));
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
await ctx.route(/maps\.(googleapis|gstatic)\.com/, r=>r.abort());
await ctx.addInitScript((s)=>{ localStorage.setItem("trasa_cookie_consent_v2","granted"); localStorage.setItem("trasa_onboarding_done_v1","1"); localStorage.setItem("sb-api-auth-token", JSON.stringify(s)); }, S);
const p = await ctx.newPage();
await p.goto("http://localhost:8080/#/plan",{waitUntil:"domcontentloaded",timeout:20000}); await p.waitForTimeout(3000);
await p.getByText("Warszawa",{exact:true}).first().click(); await p.waitForTimeout(700);
await p.getByRole("button",{name:/Dalej/i}).first().click(); await p.waitForTimeout(2200);
for (const db of await p.locator("button").filter({hasText:/^\d{1,2}$/}).all()){ const dis=await db.isDisabled().catch(()=>true); const t=(await db.innerText()).trim(); if(!dis&&/^(1[0-9]|2[0-5])$/.test(t)){ await db.click(); break; } }
await p.waitForTimeout(900);
await p.getByRole("button",{name:/Dalej/i}).first().click(); await p.waitForTimeout(2500);
await p.getByText(/Tak, jestem/i).first().click().catch(()=>{}); await p.waitForTimeout(2200);
await p.getByRole("button",{name:/Pomiń/i}).first().click().catch(()=>{}); await p.waitForTimeout(4500);
// dispatch pointer tap on the front-most swipe card
const res = await p.evaluate(()=>{
  const cards=[...document.querySelectorAll("div")].filter(el=>{ const c=(el.className||"").toString(); const r=el.getBoundingClientRect(); return c.includes("absolute")&&c.includes("inset-0")&&c.includes("rounded")&&r.height>300; });
  if(!cards.length) return "no-card";
  const el=cards[cards.length-1]; const r=el.getBoundingClientRect();
  const x=r.left+r.width/2, y=r.top+r.height/2;
  const opt={bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:"touch",isPrimary:true};
  el.dispatchEvent(new PointerEvent("pointerdown",opt));
  el.dispatchEvent(new PointerEvent("pointerup",opt));
  el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:x,clientY:y}));
  return "dispatched@"+Math.round(x)+","+Math.round(y);
});
console.log("dispatch:",res);
await p.waitForTimeout(3800);
console.log("AFTER:", (await p.evaluate(()=>document.body.innerText)).replace(/\s+/g," ").slice(0,240));
await p.screenshot({path:"/tmp/drive-detail.png"});
await b.close();
