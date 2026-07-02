import { chromium } from "playwright";
import fs from "fs";
const S = JSON.parse(fs.readFileSync("/tmp/trasa-session.json","utf8"));
const routes = ["/home","/eksploruj","/dziennik","/moj-profil","/settings","/moje-trasy"];
const b = await chromium.launch({ headless: true });
for (const route of routes){
  const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  await ctx.route(/maps\.(googleapis|gstatic)\.com/, r=>r.abort());
  await ctx.addInitScript((s)=>{ localStorage.setItem("trasa_cookie_consent_v2","granted"); localStorage.setItem("trasa_onboarding_done_v1","1"); localStorage.setItem("sb-api-auth-token", JSON.stringify(s)); }, S);
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,100)));
  try{ await p.goto("http://localhost:8080/#"+route,{waitUntil:"domcontentloaded",timeout:20000}); }catch(e){}
  await p.waitForTimeout(4000);
  const url=p.url().replace("http://localhost:8080/#","");
  const txt=(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g," ").slice(0,120);
  console.log(`[${route}] -> ${url} | ${txt} | err:${errs.length}`);
  await ctx.close();
}
await b.close();
