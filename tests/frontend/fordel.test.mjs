// Reglen for et korts lamper, scener og ikon — den samme, sidepanelet og kortene bruger:
//   node tests/frontend/fordel.test.mjs
// Uden browser: den fælles fil henter ikonsættet, som sætter sig på `window`.
//
// Fra 0.6.0 deler kortene ikke længere rummets lamper mellem sig. Et kort er en betjeningsflade,
// ikke en ejer, så to kort må gerne vise den samme lampe — og så er der ikke noget at fordele.
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
const { kortetsValg, fanensKort, erRummetsKort } = await import("../../custom_components/rumlys/frontend/rumlys-faelles.js");

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

proev("et kort uden valgte lamper viser hele rummet", () => {
  const v = kortetsValg(kort("a"), LAMPER, { a: { lamper: [], scener: [], ikon: null } });
  assert.deepEqual(v.lamper, LAMPER);
  assert.equal(v.hele, true);
  assert.equal(v.kendt, true);
});

proev("et kort for én lampe viser kun den", () => {
  const v = kortetsValg(kort("a"), LAMPER, { a: { lamper: [LOFT] } });
  assert.deepEqual(v.lamper, [LOFT]);
  assert.equal(v.hele, false);
});

proev("to kort må vise den samme lampe", () => {
  const valg = { a: { lamper: [LOFT] }, b: { lamper: [LOFT, BAAND] } };
  assert.deepEqual(kortetsValg(kort("a"), LAMPER, valg).lamper, [LOFT]);
  assert.deepEqual(kortetsValg(kort("b"), LAMPER, valg).lamper, LAMPER);
});

proev("lamperne står i rummets rækkefølge, ikke kortets", () => {
  const v = kortetsValg(kort("a"), LAMPER, { a: { lamper: [BAAND, LOFT] } });
  assert.deepEqual(v.lamper, LAMPER);
});

proev("lamper, der ikke er i rummet længere, giver hele rummet", () => {
  const v = kortetsValg(kort("a"), LAMPER, { a: { lamper: ["light.vaek"] } });
  assert.deepEqual(v.lamper, LAMPER);
  assert.equal(v.hele, true);
});

proev("et kort, Rumlys ikke kender, bruger sin egen opsætning", () => {
  const v = kortetsValg(kort(null, { lamper: [BAAND] }), LAMPER, {});
  assert.deepEqual(v.lamper, [BAAND]);
  assert.equal(v.kendt, false);
});

proev("et kort uden id og uden lamper viser hele rummet", () => {
  const v = kortetsValg(kort(null), LAMPER, {});
  assert.deepEqual(v.lamper, LAMPER);
  assert.equal(v.hele, true);
});

proev("scener og ikon kommer fra kortet, ikke fra rummet", () => {
  const v = kortetsValg(kort("a"), LAMPER, { a: { lamper: [], scener: ["s1"], ikon: "mdi:lamp" } }, ["rummets"]);
  assert.deepEqual(v.scener, ["s1"]);
  assert.equal(v.ikon, "mdi:lamp");
});

proev("et ukendt kort arver rummets gamle scener, til det er registreret", () => {
  const v = kortetsValg(kort("nyt"), LAMPER, {}, ["rummets"]);
  assert.deepEqual(v.scener, ["rummets"]);
  assert.equal(v.ikon, null);
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
