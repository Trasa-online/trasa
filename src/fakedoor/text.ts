// Polskie sieroty (typografia): pojedyncze litery a i o u w z oraz krotkie
// przyimki NIE moga konczyc linii - po nich twarda spacja (NBSP, U+00A0).
// Uzywane na CALYM copy fake doora. Uruchamiane dwukrotnie zeby zlapac
// sasiadujace sieroty (np. "i o poranku").
const ORPHANS = "a|i|o|u|w|z|do|na|po|za|ze|od|we|Do|Na|Po|Za|Ze|Od|We|A|I|O|U|W|Z";
const RE = new RegExp(` (${ORPHANS}) `, "g");
const NBSP = " ";

export function nbsp(input: string): string {
  const once = input.replace(RE, (_m, w) => ` ${w}${NBSP}`);
  return once.replace(RE, (_m, w) => ` ${w}${NBSP}`);
}
