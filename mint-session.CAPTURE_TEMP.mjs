import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SR = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "nat.maz98@gmail.com";
const admin = createClient(URL, SR, { auth:{ persistSession:false, autoRefreshToken:false } });
// non-destructive: generate a magiclink for existing user, then verify to mint a session
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type:"magiclink", email: EMAIL });
if (linkErr){ console.error("generateLink error:", linkErr.message); process.exit(1); }
const props = linkData.properties;
const token_hash = props.hashed_token;
const anon = createClient(URL, ANON, { auth:{ persistSession:false, autoRefreshToken:false } });
const { data: vData, error: vErr } = await anon.auth.verifyOtp({ token_hash, type:"magiclink" });
if (vErr){ console.error("verifyOtp error:", vErr.message); process.exit(1); }
const s = vData.session;
const sessionObj = {
  access_token: s.access_token, token_type: s.token_type, expires_in: s.expires_in,
  expires_at: s.expires_at, refresh_token: s.refresh_token, user: s.user
};
fs.writeFileSync("/tmp/trasa-session.json", JSON.stringify(sessionObj));
console.log("SESSION_OK user:", s.user.email, "id:", s.user.id, "expires_at:", s.expires_at);
