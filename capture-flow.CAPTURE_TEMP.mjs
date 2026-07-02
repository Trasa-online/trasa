// Flow-capture: drives PlanWizard to a target state, then captures to Figma.
// config = { sessionFile, screens:[{id,target,label,delayMs}] } target in
//   calendar|location|swiper|filtry|szczegol|dopasowania
import { chromium } from "playwright";
import fs from "fs";
const CFG = JSON.parse(process.argv[2]);
const S = JSON.parse(fs.readFileSync(CFG.sessionFile, "utf8"));
const CAPTURE_JS = "https://mcp.figma.com/mcp/html-to-design/capture.js";
const results = [];

async function newCtx(b) {
  const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await ctx.route(/maps\.(googleapis|gstatic)\.com/, r=>r.abort());
  await ctx.addInitScript((s)=>{
    localStorage.setItem("trasa_cookie_consent_v2","granted");
    localStorage.setItem("trasa_onboarding_done_v1","1");
    localStorage.setItem("sb-api-auth-token", JSON.stringify(s));
  }, S);
  return ctx;
}

async function toCalendar(p){
  await p.goto("http://localhost:8080/#/plan",{waitUntil:"domcontentloaded",timeout:20000}); await p.waitForTimeout(3000);
  await p.getByText("Warszawa",{exact:true}).first().click(); await p.waitForTimeout(700);
  await p.getByRole("button",{name:/Dalej/i}).first().click(); await p.waitForTimeout(2200);
}
async function pickDate(p){
  for (const db of await p.locator("button").filter({hasText:/^\d{1,2}$/}).all()){
    const dis=await db.isDisabled().catch(()=>true); const t=(await db.innerText()).trim();
    if(!dis&&/^(1[0-9]|2[0-5])$/.test(t)){ await db.click(); break; }
  }
  await p.waitForTimeout(1000);
}
async function toLocation(p){ await toCalendar(p); await pickDate(p); await p.getByRole("button",{name:/Dalej/i}).first().click(); await p.waitForTimeout(2800); }
async function toSwiper(p){
  await toLocation(p);
  await p.getByText(/Tak, jestem/i).first().click().catch(()=>{}); await p.waitForTimeout(2500);
  await p.getByRole("button",{name:/Pomiń/i}).first().click().catch(()=>{}); await p.waitForTimeout(4500);
}
async function driveTo(p, target){
  if (target==="calendar"){ await toCalendar(p); return; }
  if (target==="location"){ await toLocation(p); return; }
  if (target==="swiper"){ await toSwiper(p); return; }
  if (target==="filtry"){ await toSwiper(p); await p.getByRole("button",{name:/Filtry/i}).first().click(); await p.waitForTimeout(1500); return; }
  if (target==="szczegol"){
    await toSwiper(p);
    // click the place name/image to open detail drawer
    await p.getByText(/coffee|place|Muzeum|Restauracja|Bar|Kawiarnia/i).first().click().catch(async()=>{
      await p.locator("img").first().click().catch(()=>{});
    });
    await p.waitForTimeout(3500); return;
  }
  if (target==="dopasowania"){
    await toSwiper(p);
    for (let i=0;i<4;i++){ await p.getByRole("button",{name:/^Dodaj$/i}).first().click().catch(()=>{}); await p.waitForTimeout(1200); }
    await p.getByText(/Dopasowania/i).first().click().catch(()=>{}); await p.waitForTimeout(2500); return;
  }
}

async function captureOne(b, s){
  const ctx = await newCtx(b);
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,120)));
  try { await driveTo(p, s.target); }
  catch(e){ results.push({label:s.label, target:s.target, submit:"DRIVE_ERR", err:String(e).slice(0,160)}); await ctx.close(); return; }
  await p.waitForTimeout(s.delayMs ?? 1500);
  const stateText = (await p.evaluate(()=>document.body.innerText).catch(()=>"")).replace(/\s+/g," ").slice(0,80);
  const r = await ctx.request.get(CAPTURE_JS); const js = await r.text();
  await p.evaluate((src)=>{ const el=document.createElement("script"); el.textContent=src; document.head.appendChild(el); }, js);
  await p.waitForTimeout(700);
  const endpoint = `https://mcp.figma.com/mcp/capture/${s.id}/submit`;
  const respP = p.waitForResponse(resp=>resp.url().includes(`/mcp/capture/${s.id}/`),{timeout:120000});
  await p.evaluate(({id,endpoint})=>{ try{ window.figma.captureForDesign({captureId:id,endpoint,selector:"body"}); }catch(e){} },{id:s.id,endpoint}).catch(()=>{});
  let status="unknown";
  try{ const resp=await respP; status=resp.status(); await p.waitForTimeout(1500).catch(()=>{}); }catch(e){ status="no-response"; }
  results.push({label:s.label, target:s.target, submit:status, state:stateText, errors:errs.slice(0,2)});
  await ctx.close();
}

const b = await chromium.launch({ headless:true });
// sequential to keep drives stable
for (const s of CFG.screens){ try{ await captureOne(b,s); }catch(e){ results.push({label:s.label, submit:"ERR", err:String(e).slice(0,160)}); } }
await b.close();
console.log(JSON.stringify(results,null,2));
