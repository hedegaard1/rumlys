// Reglen for kortene på en fane — den samme, sidepanelet og kortene bruger:
//   node tests/frontend/fordel.test.mjs
// Uden browser: den fælles fil sætter kun et ikonsæt på `window`.
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
const { fordelLamper, fanensKort, erRummetsKort } = await import("../../custom_components/rumlys/frontend/rumlys-faelles.js");

const LOFT = "light.loft";
const BAAND = "light.baand";
const LAMPER = [LOFT, BAAND];
const kort = (id, ekstra) => Object.assign({ type: "custom:rumlys-card", omraade: "office" }, id ? { kort: id } : {}, ekstra || {});
let proever = 0;
function proev(navn, fn) {
  fn();
  proever++;
  console.log("ok  " + navn);
}

proev("et kort for hele rummet alene viser alle lamper", () => {
  const [a] = fordelLamper([kort("a")], LAMPER, { a: [] });
  assert.deepEqual(a.lamper, LAMPER);
  assert.equal(a.hele, true);
  assert.equal(a.spaerretAf, null);
});

proev("et nyt kort på en fane, hvor hele rummet står, kan ikke bruges — også når det står øverst", () => {
  const res = fordelLamper([kort("ny"), kort("a")], LAMPER, { a: [] });
  assert.deepEqual(res[0].lamper, []);
  assert.equal(res[0].spaerretAf, 1);
  assert.deepEqual(res[1].lamper, LAMPER);
});

proev("to nye kort: det øverste får hele rummet, det næste ingen", () => {
  const res = fordelLamper([kort("x"), kort("y")], LAMPER, {});
  assert.equal(res[0].hele, true);
  assert.equal(res[1].spaerretAf, 0);
});

proev("kort for hver sin lampe deler fanen", () => {
  const res = fordelLamper([kort("a"), kort("b")], LAMPER, { a: [LOFT], b: [BAAND] });
  assert.deepEqual(res[0].lamper, [LOFT]);
  assert.deepEqual(res[1].lamper, [BAAND]);
  assert.equal(res[0].hele || res[1].hele, false);
});

proev("et kort for hele rummet kan ikke stå ved siden af et lampekort", () => {
  const res = fordelLamper([kort("a"), kort("b")], LAMPER, { a: [LOFT], b: [] });
  assert.deepEqual(res[0].lamper, [LOFT]);
  assert.equal(res[1].spaerretAf, 0);
  assert.deepEqual(res[1].lamper, []);
});

proev("null er ingen lamper og optager ingen", () => {
  const res = fordelLamper([kort("a"), kort("b")], LAMPER, { a: null, b: [] });
  assert.equal(res[0].ingen, true);
  assert.deepEqual(res[0].optager, []);
  assert.equal(res[1].hele, true);
});

proev("alle lamper valgt er hele rummet", () => {
  const [a] = fordelLamper([kort("a")], LAMPER, { a: [BAAND, LOFT] });
  assert.equal(a.hele, true);
  assert.deepEqual(a.lamper, LAMPER);
});

proev("lamper, der ikke er i rummet længere, er ingen lamper — ikke hele rummet", () => {
  const [a] = fordelLamper([kort("a")], LAMPER, { a: ["light.fjernet"] });
  assert.equal(a.ingen, true);
  assert.deepEqual(a.lamper, []);
});

proev("samme kort to gange på fanen: ingen af gangene virker, men lamperne er optaget", () => {
  const res = fordelLamper([kort("a"), kort("a"), kort("ny")], LAMPER, { a: [] });
  assert.equal(res[0].dublet, true);
  assert.equal(res[1].dublet, true);
  assert.deepEqual(res[0].lamper, []);
  assert.deepEqual(res[0].optager, LAMPER);
  assert.equal(res[1].spaerretAf, null);
  assert.equal(res[2].spaerretAf, 0);
});

proev("et kort uden id viser hele rummet og går forud for et nyt kort", () => {
  const res = fordelLamper([kort("ny"), kort(null)], LAMPER, {});
  assert.equal(res[1].hele, true);
  assert.equal(res[0].spaerretAf, 1);
});

proev("et kort uden id med lamper fra 0.4.9 viser dem", () => {
  const res = fordelLamper([kort(null, { lamper: [BAAND] }), kort("b")], LAMPER, { b: [LOFT] });
  assert.deepEqual(res[0].lamper, [BAAND]);
  assert.deepEqual(res[1].lamper, [LOFT]);
});

proev("to kendte kort med samme lampe: det øverste vinder", () => {
  const res = fordelLamper([kort("a"), kort("b")], LAMPER, { a: [LOFT], b: [LOFT, BAAND] });
  assert.deepEqual(res[0].lamper, [LOFT]);
  assert.equal(res[1].spaerretAf, 0);
});

proev("fanensKort finder kort inde i andre kort, i rækkefølge", () => {
  const fane = { sections: [{ cards: [kort("a"), { type: "vertical-stack", cards: [kort("b")] }, { type: "conditional", card: kort("c") }] }] };
  assert.deepEqual(fanensKort(fane).map((x) => x.kort), ["a", "b", "c"]);
});

proev("erRummetsKort bruger området og ældre kort rummets id", () => {
  const rum = { id: "r1", omraade: "office" };
  assert.equal(erRummetsKort({ omraade: "office" }, rum), true);
  assert.equal(erRummetsKort({ omraade: "kitchen" }, rum), false);
  assert.equal(erRummetsKort({ rum: "r1" }, rum), true);
  assert.equal(erRummetsKort({}, rum), false);
});

console.log(proever + " prøver består");
