#!/usr/bin/env node
// Bramka "hook w zlym miejscu" (2026-09-07). Skrypty, ktore hurtowo wstawialy
// `const { t } = useTranslation(...)`, potrafily trafic w srodek callbacku (`.map((m) => {`)
// albo za ostatnia klamre pliku. Skladnia jest poprawna, wiec tsc i build przechodza,
// a apka wywala sie w locie na React #321 "Invalid hook call" - bialy ekran awarii.
// Idziemy po AST: kazde wywolanie use* musi stac w komponencie (PascalCase) albo we
// wlasnym hooku (useCoś). Callback przekazany do funkcji i kod modulu = blad.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const errors = [];

const walkDir = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
};

// Nazwa, pod ktora funkcja jest widoczna: deklaracja, przypisanie do zmiennej albo propercji.
function ownerName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  const p = node.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text;
  // forwardRef/memo(function Nazwa(){}) - nazwa siedzi w samej funkcji
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  return null;
}

const isComponentOrHook = (name) => !!name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name));

for (const file of walkDir(path.join(ROOT, "src"))) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = path.relative(ROOT, file);

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^use[A-Z]/.test(node.expression.text)) {
      // najblizsza funkcja opakowujaca
      let fn = node.parent;
      while (fn && !ts.isFunctionDeclaration(fn) && !ts.isFunctionExpression(fn) && !ts.isArrowFunction(fn) && !ts.isMethodDeclaration(fn)) fn = fn.parent;
      const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
      const where = `${rel}:${line + 1}`;
      if (!fn) {
        errors.push(`${where}: ${node.expression.text}() w kodzie modulu, poza komponentem`);
        return;
      }
      const name = ownerName(fn);
      // Funkcja bez nazwy przekazana jako ARGUMENT (callback .map/.filter/useEffect) nigdy
      // nie jest komponentem. Wyjatkiem forwardRef/memo - te opakowuja komponent.
      const asArg = fn.parent && ts.isCallExpression(fn.parent) && fn.parent.arguments.includes(fn);
      const wrapper = asArg && ts.isCallExpression(fn.parent) ? fn.parent.expression.getText(src) : "";
      const wrapsComponent = /forwardRef|memo|observer/.test(wrapper);
      if (asArg && !wrapsComponent) {
        errors.push(`${where}: ${node.expression.text}() w callbacku przekazanym do ${wrapper || "funkcji"}`);
      } else if (!asArg && !isComponentOrHook(name)) {
        errors.push(`${where}: ${node.expression.text}() w funkcji "${name ?? "anonimowej"}" - to nie komponent ani hook`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

if (errors.length) {
  console.error(`\nhooki: ${errors.length} problemow\n`);
  for (const e of errors) console.error("  x " + e);
  console.error("\nHook wolamy TYLKO w ciele komponentu albo wlasnego hooka - inaczej React #321 w locie.");
  process.exit(1);
}
console.log("hooki: ok");
