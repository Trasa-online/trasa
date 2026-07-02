import { chromium } from "playwright";
const routes = ["/home","/eksploruj","/dziennik","/moj-profil","/plan","/sesja/nowa","/profil/nyszje"];
const b = await chromium.launch({ headless: true });
for (const route of routes){
  const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  await ctx.route(/maps\.(googleapis|gstatic)\.com/, r=>r.abort());
  await ctx.addInitScript(()=>{ localStorage.setItem("trasa_cookie_consent_v2","granted"); localStorage.setItem("trasa_guest_welcome_dismissed_v1","1"); });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,120)));
  try{ await p.goto("http://localhost:8080/#"+route,{waitUntil:"domcontentloaded",timeout:20000}); }catch(e){}
  await p.waitForTimeout(3500);
  const url=p.url().replace("http://localhost:8080/#","");
  const txt=(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g," ").slice(0,110);
  console.log(`[${route}] -> now:${url} | ${txt} | err:${errs.length}`);
  await ctx.close();
}
await b.close();
