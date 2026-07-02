import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const uid="e8e691a5-e622-437a-add6-7974b9634c8b";
const { data: mems } = await admin.from("group_session_members").select("session_id,categories_done").eq("user_id",uid);
for (const m of (mems||[])){
  const { data: s } = await admin.from("group_sessions").select("id,join_code,city,status,created_by,categories,current_category_index,match_count").eq("id",m.session_id).maybeSingle();
  if(!s){ console.log("  (session not found for",m.session_id,")"); continue; }
  const { data: allMems } = await admin.from("group_session_members").select("user_id,categories_done").eq("session_id",s.id);
  const { count: rx } = await admin.from("group_session_reactions").select("*",{count:"exact",head:true}).eq("session_id",s.id);
  const others = (allMems||[]).filter(x=>x.user_id!==uid);
  console.log(`code=${s.join_code} city=${s.city} status=${s.status} host=${s.created_by===uid?"ME":"other"} members=${allMems?.length} cats=${JSON.stringify(s.categories)} catIdx=${s.current_category_index} matchCount=${s.match_count} myCats=${JSON.stringify(m.categories_done)} otherCatsDone=${JSON.stringify(others.map(o=>o.categories_done))} rx=${rx}`);
}
