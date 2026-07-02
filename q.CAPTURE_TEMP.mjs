import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const uid="e8e691a5-e622-437a-add6-7974b9634c8b";
const { data, error } = await admin.from("routes").select("id,city,trip_type,status,start_date,group_session_id,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(12);
if(error){ console.log("ERR",error.message); process.exit(1);}
for(const r of data) console.log(r.trip_type, r.status, r.city, r.start_date, (r.group_session_id?"GRP":"solo"), r.id);
