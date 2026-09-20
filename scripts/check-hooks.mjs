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

  // ── Hook PO EARLY-RETURNIE ────────────────────────────────────────────────
  // Drugi ksztalt tego samego bledu (zgloszenie Nat 2026-09-15): hook stoi w dobrej
  // funkcji, ale PONIZEJ `if (isLoading) return ...`. Skladnia poprawna, tsc i build
  // przechodza, a React przy pierwszym renderze liczy mniej hookow niz przy drugim
  // i wywala caly ekran ("Rendered fewer hooks than expected").
  const returnsEarly = (st) => {
    if (ts.isReturnStatement(st)) return true;
    if (ts.isIfStatement(st) && !st.elseStatement) {
      const th = st.thenStatement;
      if (ts.isReturnStatement(th)) return true;
      if (ts.isBlock(th) && th.statements.length && th.statements.every((x) => ts.isReturnStatement(x))) return true;
    }
    return false;
  };
  const scanBody = (fn) => {
    const name = ownerName(fn);
    if (!isComponentOrHook(name)) return;
    const body = fn.body;
    if (!body || !ts.isBlock(body)) return;
    let seenReturn = null;
    for (const st of body.statements) {
      if (seenReturn) {
        let hit = null;
        const look = (n) => {
          if (hit) return;
          // Hook w zagniezdzonej funkcji to JEJ sprawa - liczy sie tylko cialo tego komponentu.
          if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) return;
          if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^use[A-Z]/.test(n.expression.text)) { hit = n; return; }
          ts.forEachChild(n, look);
        };
        look(st);
        if (hit) {
          const { line } = src.getLineAndCharacterOfPosition(hit.getStart(src));
          const { line: rl } = src.getLineAndCharacterOfPosition(seenReturn.getStart(src));
          errors.push(`${rel}:${line + 1}: ${hit.expression.text}() PO wyjsciu z komponentu "${name}" (return w linii ${rl + 1})`);
        }
      } else if (returnsEarly(st)) {
        seenReturn = st;
      }
    }
  };
  const visitFns = (node) => {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) scanBody(node);
    ts.forEachChild(node, visitFns);
  };
  visitFns(src);
}

if (errors.length) {
  console.error(`\nhooki: ${errors.length} problemow\n`);
  for (const e of errors) console.error("  x " + e);
  console.error("\nHook wolamy TYLKO w ciele komponentu albo wlasnego hooka i ZAWSZE nad kazdym\n`return` - inaczej React wywala sie w locie (#321 / zmienna liczba hookow).");
  process.exit(1);
}
console.log("hooki: ok");
