#!/usr/bin/env node
// Generator sekretu klienta dla Sign in with Apple.
//
// Po co osobny skrypt: Apple nie daje "sekretu" do skopiowania - trzeba go PODPISAC samemu
// kluczem .p8 jako JWT (ES256). Ten JWT wygasa **maksymalnie po 6 miesiacach** (Apple odrzuca
// dluzszy `exp`), wiec logowanie przez Apple psuje sie samo, po cichu, mniej wiecej dwa razy
// w roku. Data waznosci jest wypisywana ponizej - wpisz ja sobie w kalendarz.
//
// Uzycie:
//   node scripts/apple-client-secret.mjs --p8 AuthKey_XXXXXXXXXX.p8 \
//        --key-id XXXXXXXXXX --team-id J33M8H3SGZ --client-id travel.trasa.signin
//
// Gdzie co znalezc w Apple Developer:
//   --p8       Keys -> klucz z wlaczonym "Sign in with Apple" (plik pobierasz RAZ przy tworzeniu)
//   --key-id   Keys -> identyfikator tego klucza (10 znakow)
//   --team-id  prawy gorny rog portalu, obok nazwy konta
//   --client-id  Identifiers -> Services IDs (NIE bundle id aplikacji)
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const p8 = arg("p8"), keyId = arg("key-id"), teamId = arg("team-id"), clientId = arg("client-id");
const months = Number(arg("months") ?? 6);

if (!p8 || !keyId || !teamId || !clientId) {
  console.error("brakuje argumentu - uzycie:\n  node scripts/apple-client-secret.mjs --p8 <plik.p8> --key-id <10 znakow> --team-id <10 znakow> --client-id <services id>");
  process.exit(2);
}
if (months > 6) { console.error("Apple odrzuca sekret wazny dluzej niz 6 miesiecy"); process.exit(2); }

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o))
  .toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const exp = now + months * 30 * 24 * 60 * 60;
const header = { alg: "ES256", kid: keyId };
const payload = { iss: teamId, iat: now, exp, aud: "https://appleid.apple.com", sub: clientId };
const signingInput = `${b64(header)}.${b64(payload)}`;

const signer = createSign("SHA256");
signer.update(signingInput);
signer.end();
// JOSE wymaga podpisu w postaci surowej R||S, a nie domyslnego DER-a Node'a.
const sig = signer.sign({ key: readFileSync(p8), dsaEncoding: "ieee-p1363" })
  .toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

console.log(`${signingInput}.${sig}`);
console.error(`\n[apple] sekret wazny do ${new Date(exp * 1000).toISOString().slice(0, 10)} - wpisz te date w kalendarz.`);
console.error(`[apple] wklej go w Supabase: Authentication -> Providers -> Apple -> Secret Key,\n        albo PATCH-em na /v1/projects/<ref>/config/auth (pole external_apple_secret).`);
