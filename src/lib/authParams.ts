// Czyta parametry auth callbacku (code, token_hash, type, recovery, access_token...)
// z OBU miejsc: query stringa URL-a ORAZ query-fragmentu w hashu.
//
// Powod: aplikacja uzywa HashRouter, a Supabase/GoTrue dokleja `?code=...` na koniec
// redirectTo. Dla `https://trasa.travel/#/set-password-biznes` wynik to
// `https://trasa.travel/#/set-password-biznes?code=...` - czyli kod ląduje w hashu,
// gdzie `window.location.search` jest PUSTY. Czytanie tylko `search` gubi kod i cały
// flow (reset hasla / invite) sie zawiesza. Ten helper zbiera parametry z:
//  1. window.location.search              (np. "?code=..#/set-password-biznes")
//  2. query po '?' w hashu                (np. "#/set-password-biznes?code=..")
//  3. implicit flow tuz po '#'            (np. "#access_token=..&type=recovery")
export function readAuthParams(): URLSearchParams {
  const parts: string[] = [];

  const search = window.location.search.replace(/^\?/, "");
  if (search) parts.push(search);

  const hash = window.location.hash || "";
  const qIdx = hash.indexOf("?");
  if (qIdx >= 0) {
    // Hash zawiera route + query: "#/route?code=.." -> bierzemy czesc po '?'.
    parts.push(hash.slice(qIdx + 1));
  } else if (hash && !hash.startsWith("#/")) {
    // Implicit flow (legacy): tokeny tuz po '#', bez route -> "#access_token=..".
    parts.push(hash.replace(/^#/, ""));
  }

  return new URLSearchParams(parts.join("&"));
}
