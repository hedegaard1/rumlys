/*
  Rumlys i sidepanelet: al opsætning af et rum samlet ét sted, kun for administratorer.
  Oversigten viser alle rum og det, de gør lige nu; et rums side har lamper, sensorer,
  tidsplanen, tiderne, «hold lys», scenerne på kortet og de seneste hændelser.
*/

import {
  OPDATERET,
  RUMLYS_IKON,
  STANDARDSCENER,
  VERSION,
  beskrivLys,
  erRummetsKort,
  kortetsValg,
  h,
  haendelseTekst,
  hentScener,
  hsRgb,
  hueFarve,
  ikon,
  ikonStak,
  kanFarve,
  kanHvid,
  kategoriNavn,
  kelvinGraenser,
  klokken,
  kortNavn,
  lysvalgBaggrund,
  meldOpdateret,
  nytKortId,
  overgang,
  rummetsFarver,
  rummetsIkoner,
  sceneFarver,
  sceneNavn,
  sprog,
  statusTekst,
  tekst,
  css,
} from "./rumlys-faelles.js";

const STIL = `
:host {
  display: block; min-height: 100%;
  background: var(--primary-background-color);
  color: var(--primary-text-color);
  font-family: var(--ha-font-family-body, Roboto, sans-serif);
  --rl-p: var(--primary-color);
  --rl-paa-p: var(--text-primary-color, #fff);
  --rl-flade: var(--card-background-color, #fff);
  --rl-flade2: var(--secondary-background-color, #f3f3f3);
  --rl-linje: var(--divider-color, rgba(0,0,0,.12));
  --rl-daempet: var(--secondary-text-color, #666);
  --rl-radius: var(--ha-card-border-radius, 16px);
  --rl-skygge: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,.08));
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; }
.bjaelke { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; gap: 4px; height: 56px; padding: 0 8px;
  background: var(--app-header-background-color, var(--primary-background-color)); color: var(--app-header-text-color, var(--primary-text-color));
  border-bottom: 1px solid var(--app-header-border-bottom, var(--rl-linje)); }
.bjaelke .titel { font-size: 20px; font-weight: 500; margin-left: 8px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.indhold { max-width: 920px; margin: 0 auto; padding: 16px 16px 120px; }
.knap { border: 0; border-radius: 999px; padding: 9px 16px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; font-weight: 500; font-size: 14px; background: var(--rl-flade2); }
.knap.p { background: var(--rl-p); color: var(--rl-paa-p); }
.knap.t { background: transparent; color: var(--rl-p); padding: 9px 8px; }
.knap.farlig { background: transparent; color: var(--error-color, #db4437); padding: 9px 8px; }
.knap[disabled] { opacity: .45; cursor: default; }
.knap ha-icon { --mdc-icon-size: 18px; }
.ikonknap { border: 0; background: transparent; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: inherit; }
.ikonknap:hover { background: var(--rl-flade2); }
.hint { font-size: 13px; color: var(--rl-daempet); margin: 4px 0 10px; }
.fejl { color: var(--error-color, #db4437); font-size: 13px; }
.besked { padding: 24px; text-align: center; color: var(--rl-daempet); }

/* oversigt */
.overskrift { display: flex; align-items: center; gap: 12px; margin: 4px 0 16px; }
.overskrift h1 { font-size: 26px; margin: 0; flex: 1; font-weight: 600; }
.rumgitter { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.rumfelt { background: var(--rl-flade); border-radius: var(--rl-radius); box-shadow: var(--rl-skygge); overflow: hidden; cursor: pointer; border: 0; text-align: left; padding: 0; display: flex; flex-direction: column; }
.rumfelt .farve { height: 56px; background: var(--rl-flade2); transition: background .3s; }
.rumfelt .tekst { padding: 10px 12px 12px; }
.rumfelt b { display: block; font-size: 15px; font-weight: 600; }
.rumfelt .status { font-size: 13px; color: var(--rl-daempet); }
/* Den stiplede kant tegnes i temaets farve, ikke i stregfarven: i fx «Graphite Light» er stregfarven næsten hvid,
   og så forsvandt feltet. */
.rumfelt.nyt { border: 2px dashed color-mix(in srgb, var(--rl-p) 45%, transparent); background: transparent; box-shadow: none; align-items: center; justify-content: center; min-height: 140px; color: var(--rl-p); font-weight: 600; gap: 6px; }
.rumfelt .meta { font-size: 12px; color: var(--rl-daempet); margin-top: 6px; }

/* rummets side */
.hoved { background: var(--rl-flade); border-radius: var(--rl-radius); box-shadow: var(--rl-skygge); padding: 14px 16px; margin-bottom: 14px; }
.hoved .linje1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hoved h1 { font-size: 22px; margin: 0; flex: 1; font-weight: 600; }
.levende { display: flex; align-items: center; gap: 12px; margin-top: 10px; font-size: 14px; }
.glod { width: 36px; height: 36px; border-radius: 50%; background: var(--rl-flade2); flex: none; transition: background .3s; }
.levende small { display: block; color: var(--rl-daempet); font-size: 12px; }
.sek { background: var(--rl-flade); border-radius: var(--rl-radius); box-shadow: var(--rl-skygge); padding: 16px; margin-bottom: 14px; }
.sek > h2 { font-size: 16px; margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 600; }
.sek > h2 ha-icon { color: var(--rl-p); --mdc-icon-size: 20px; }
.felt { display: grid; gap: 4px; margin-bottom: 10px; }
.felt > label { font-size: 12px; color: var(--rl-daempet); font-weight: 600; }
select, input[type=text], input[type=time], input[type=search] {
  font: inherit; color: inherit; border: 1px solid var(--rl-linje); background: var(--rl-flade2); border-radius: 10px; padding: 9px 12px; min-height: 40px; width: 100%; }
.raekke { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-top: 1px solid var(--rl-linje); }
.raekke:first-child { border-top: 0; }
.raekke .tx { flex: 1; min-width: 0; }
.raekke .tx b { display: block; font-weight: 500; font-size: 14px; }
.raekke .tx small { color: var(--rl-daempet); font-size: 12px; }
.flueben { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--rl-daempet); display: grid; place-items: center; flex: none; cursor: pointer; background: transparent; padding: 0; color: var(--rl-paa-p); }
.flueben.til { background: var(--rl-p); border-color: var(--rl-p); }
.flueben[disabled] { opacity: .35; cursor: default; }
.flueben ha-icon { --mdc-icon-size: 16px; }
.lampeikon { width: 36px; height: 36px; border-radius: 50%; border: 0; padding: 0; flex: none; display: grid; place-items: center; background: var(--rl-flade2); color: inherit; cursor: pointer; --mdc-icon-size: 20px; }
.lampeikon:disabled { cursor: default; }
.lampeikon:not(:disabled):hover { box-shadow: inset 0 0 0 2px var(--rl-p); }
.kontakt { position: relative; width: 40px; height: 24px; flex: none; border: 0; border-radius: 999px; background: var(--rl-flade2); cursor: pointer; padding: 0; box-shadow: inset 0 0 0 1px var(--rl-linje); }
.kontakt::after { content: ""; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform .2s; }
.kontakt.til { background: var(--rl-p); box-shadow: none; }
.kontakt.til::after { transform: translateX(16px); }
.kontaktfelt { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--rl-daempet); }
.pille { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; background: var(--rl-flade2); white-space: nowrap; }
.pille i { width: 8px; height: 8px; border-radius: 50%; background: var(--success-color, #43a047); display: inline-block; }
.lysvalg { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; background: var(--rl-flade2); border: 1px solid var(--rl-linje); cursor: pointer; width: 100%; text-align: left; }
.lysvalg .farve { width: 44px; height: 44px; border-radius: 12px; flex: none; }
.lysvalg .tx { flex: 1; }
.lysvalg b { display: block; font-size: 14px; font-weight: 500; }
.skyder { display: flex; align-items: center; gap: 12px; }
.skyder input { flex: 1; accent-color: var(--rl-p); }
.skyder output { min-width: 64px; text-align: right; font-weight: 600; font-size: 14px; }
.trin { display: inline-flex; align-items: center; border: 1px solid var(--rl-linje); border-radius: 999px; overflow: hidden; background: var(--rl-flade2); flex: none; }
.trin button { border: 0; background: transparent; width: 38px; height: 36px; cursor: pointer; font-size: 18px; color: var(--rl-p); }
.trin button[disabled] { opacity: .3; cursor: default; }
.trin output { min-width: 76px; text-align: center; font-weight: 600; font-size: 14px; }
.naar { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--rl-linje); flex-wrap: wrap; }
.naar:first-of-type { border-top: 0; }
.naar .tx { flex: 1; min-width: 180px; }
.naar .tx b { display: block; font-size: 14px; font-weight: 500; }
.naar .tx small { color: var(--rl-daempet); font-size: 12px; }
/* En indstilling, der ikke bruges endnu — fx tiden for sensoren i et rum uden sensor. Den kan stadig sættes. */
.naar.ubrugt .tx b, .naar.ubrugt .tx small:not(.advarsel) { opacity: .55; }
.advarsel { color: var(--rl-p); }
.uge { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 10px; align-items: center; }
.uge .dag { font-size: 12px; color: var(--rl-daempet); }
.uge .dag.idag { color: var(--primary-text-color); font-weight: 700; }
.spor { position: relative; height: 26px; border-radius: 8px; overflow: hidden; cursor: pointer; box-shadow: inset 0 0 0 1px var(--rl-linje); }
.spor .blok { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; padding: 0 8px; font-size: 11px; font-weight: 700; color: #2a241e; border: 0; cursor: pointer; white-space: nowrap; overflow: hidden; }
.spor .nu { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--primary-text-color); pointer-events: none; }
.timer { display: flex; justify-content: space-between; font-size: 11px; color: var(--rl-daempet); margin: 4px 2px 8px; }
.dagvalg { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.dagknap { min-height: 36px; padding: 0; border: 1px solid var(--rl-linje); border-radius: 10px; background: var(--rl-flade2); color: var(--rl-daempet); font-size: 13px; cursor: pointer; }
.dagknap.til { background: var(--rl-p); border-color: var(--rl-p); color: var(--rl-paa-p); font-weight: 600; }
.ikonvalg { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
.ikoner { display: flex; align-items: center; }
.ikoner .ikon { width: 40px; height: 40px; border-radius: 50%; background: var(--rl-flade2); display: grid; place-items: center; --mdc-icon-size: 22px; box-sizing: border-box; }
.ikoner .ikon + .ikon { margin-left: -12px; box-shadow: -2px 0 0 0 var(--rl-flade); }
.ikoner .ikon.flere { font-size: 13px; font-weight: 600; }
.seg { display: inline-flex; flex: none; border: 1px solid var(--rl-linje); border-radius: 999px; overflow: hidden; }
.seg button { border: 0; background: transparent; padding: 6px 12px; font-size: 12px; color: var(--rl-daempet); cursor: pointer; }
.seg button.til { background: var(--rl-p); color: var(--rl-paa-p); font-weight: 600; }
.gruppe { padding-top: 14px; }
.gruppe + .gruppe { border-top: 1px solid var(--rl-linje); margin-top: 6px; }
.gruppe > .gtitel { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.gruppe > .gtitel ha-icon { color: var(--rl-p); --mdc-icon-size: 18px; }
.kortliste { display: grid; gap: 10px; }
.kortboks { border: 1px solid var(--rl-linje); border-radius: 12px; padding: 12px; display: grid; gap: 8px; justify-items: start; }
.kortboks .raekke { width: 100%; box-sizing: border-box; }
.kortboks .hint { margin: 0; }
.korthoved { display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.korthoved .kt { flex: 1; min-width: 0; display: grid; gap: 2px; }
.korthoved .kt1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.korthoved .hvad { color: var(--rl-daempet); font-size: 13px; }
.korthoved .hvad.advarsel { color: var(--rl-p); font-weight: 600; }
.korthoved small { color: var(--rl-daempet); font-size: 12px; }
.korthoved .chev { color: var(--rl-daempet); flex: none; transition: transform .15s ease; }
.korthoved[aria-expanded="true"] .chev { transform: rotate(90deg); }
.pille.ny { background: var(--rl-p); color: var(--rl-paa-p); }
.genveje { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 10px; }
.genveje .knap { padding: 6px 12px; font-size: 13px; }
.tidsraekke { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-top: 1px solid var(--rl-linje); cursor: pointer; background: var(--rl-flade); }
.greb { color: var(--rl-daempet); cursor: grab; touch-action: none; display: grid; place-items: center; width: 28px; }
.greb.laast { cursor: inherit; }
.tidsraekke .farve { width: 30px; height: 30px; border-radius: 9px; flex: none; }
.tidsraekke .tx { flex: 1; min-width: 0; }
.tidsraekke b { font-size: 14px; font-weight: 500; }
.tidsraekke small { display: block; color: var(--rl-daempet); font-size: 12px; }
.slaebes { opacity: .6; }
.scenegitter { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
.scenefelt { aspect-ratio: 1; border-radius: 12px; border: 0; cursor: pointer; position: relative; overflow: hidden; padding: 0; touch-action: none; }
.scenefelt span { position: absolute; left: 0; right: 0; bottom: 0; font-size: 10px; font-weight: 600; color: #fff; background: rgba(0,0,0,.35); padding: 2px 2px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scenefelt .fjern { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; border: 0; background: rgba(0,0,0,.45); color: #fff; display: grid; place-items: center; cursor: pointer; padding: 0; }
.scenefelt .fjern ha-icon { --mdc-icon-size: 14px; }
.scenefelt.valgt { outline: 3px solid var(--rl-p); outline-offset: 2px; }
.haendelse { display: grid; grid-template-columns: 70px 1fr; gap: 2px 10px; font-size: 13px; padding: 3px 0; }
.haendelse time { color: var(--rl-daempet); font-variant-numeric: tabular-nums; }
.fod { position: fixed; left: var(--mdc-drawer-width, 0px); right: 0; bottom: 0; z-index: 3; display: flex; align-items: center; gap: 10px; justify-content: flex-end; padding: 12px 16px;
  background: var(--rl-flade); border-top: 1px solid var(--rl-linje); box-shadow: 0 -2px 10px rgba(0,0,0,.05); }
.fod .besked2 { margin-right: auto; font-size: 13px; color: var(--rl-daempet); }

/* dialog */
.slor { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); padding: 16px; }
.dialog { background: var(--rl-flade); color: var(--primary-text-color); border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.35); width: min(540px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; }
.dialog.bred { width: min(760px, 100%); }
.dialog .dh { display: flex; align-items: center; gap: 10px; padding: 16px 18px 6px; }
.dialog .dh h3 { font-size: 19px; margin: 0; flex: 1; font-weight: 600; }
.dialog .db { padding: 6px 18px; overflow: auto; }
.dialog .df { display: flex; gap: 8px; align-items: center; padding: 14px 18px 18px; }
.dialog .df .venstre { margin-right: auto; }
.faner { display: flex; gap: 4px; background: var(--rl-flade2); border-radius: 999px; padding: 3px; margin: 10px 0; }
.faner button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 7px 4px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--rl-daempet); }
.faner button.valgt { background: var(--rl-flade); color: var(--primary-text-color); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.forhaand { height: 84px; border-radius: 14px; display: flex; align-items: flex-end; padding: 10px 12px; font-weight: 700; color: #2a241e; text-shadow: 0 0 6px rgba(255,255,255,.6); }
.hjul { width: 200px; height: 200px; border-radius: 50%; margin: 8px auto; cursor: crosshair; position: relative;
  background: radial-gradient(circle, #fff 0, rgba(255,255,255,0) 70%), conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
.hjul .prik { position: absolute; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); transform: translate(-50%, -50%); pointer-events: none; }
.hvid { position: relative; height: 40px; border-radius: 999px; }
.hvid input { width: 100%; height: 40px; margin: 0; opacity: .001; cursor: pointer; }
.hvid .knop { position: absolute; top: 4px; width: 32px; height: 32px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); pointer-events: none; transform: translateX(-50%); }
.skala { display: flex; justify-content: space-between; font-size: 12px; color: var(--rl-daempet); margin-top: 6px; }
.kategori { font-size: 12px; font-weight: 700; color: var(--rl-daempet); text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 6px; }
.toast { position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%); background: var(--primary-text-color); color: var(--rl-flade); padding: 10px 18px; border-radius: 999px; font-weight: 600; z-index: 20; }
@media (max-width: 600px) {
  .indhold { padding: 12px 12px 120px; }
  .fod { left: 0; }
}
`;

// Et opslag uden én nøgle. Kladden får et nyt objekt, så «Gem rum» ser ændringen.
function uden(opslag, noegle) {
  const nyt = Object.assign({}, opslag);
  delete nyt[noegle];
  return nyt;
}

// Et nyt kort i Rumlys' lager: lamperne (tom = hele rummet), de ni standardscener og intet eget ikon.
function nytKort(lamper) {
  return { lamper: (lamper || []).slice(), scener: STANDARDSCENER.slice(), ikon: null };
}

function kopi(v) {
  return JSON.parse(JSON.stringify(v));
}

// Ugedagene, mandag = 0, som Rumlys gemmer dem.
const ALLE_DAGE = [0, 1, 2, 3, 4, 5, 6];

// Home Assistants LightEntityFeature.TRANSITION: lampen kan tænde og slukke blødt.
const LYS_OVERGANG = 32;

// Anbefalet tid for lys tændt af sensoren, i sekunder.
const ANBEFALET_BEVAEGELSE = 300;
const ANBEFALET_TILSTEDE = 30;

// Navne, der skal kunne sammenlignes på tværs af store bogstaver, æøå og bindestreger: «Træningsrum» og
// stien «traeningsrum» er den samme fane.
function enkeltNavn(tekst) {
  return String(tekst || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
}

function minut(klokkeslaet) {
  const [t, m] = String(klokkeslaet).split(":");
  return Number(t) * 60 + Number(m);
}

// Om et tidsrum gælder en ugedag og et minut — samme regel som Rumlys selv: over midnat hører
// til dagen, det begynder, og samme klokkeslæt i start og slut er et helt døgn.
function gaelder(tr, dag, m) {
  const start = minut(tr.start);
  const slut = minut(tr.slut);
  const dage = tr.dage || ALLE_DAGE;
  if (start < slut) return dage.includes(dag) && start <= m && m < slut;
  return (dage.includes(dag) && m >= start) || (dage.includes((dag + 6) % 7) && m < slut);
}

function naviger(sti) {
  history.pushState(null, "", sti);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

// Et trinvalg med − og +. Findes værdien ikke blandt trinene, sættes den ind på sin plads.
function trinvalg(vaerdier, vaerdi, formater, vedSkift) {
  const liste = vaerdier.slice();
  if (liste.indexOf(vaerdi) < 0) {
    liste.push(vaerdi);
    liste.sort((a, b) => a - b);
  }
  let i = liste.indexOf(vaerdi);
  const ud = h("output", {}, formater(liste[i]));
  const minus = h("button", { type: "button", "aria-label": "−" }, "−");
  const plus = h("button", { type: "button", "aria-label": "+" }, "+");
  const vis = () => {
    ud.textContent = formater(liste[i]);
    minus.disabled = i === 0;
    plus.disabled = i === liste.length - 1;
  };
  minus.addEventListener("click", () => { if (i > 0) { i -= 1; vis(); vedSkift(liste[i]); } });
  plus.addEventListener("click", () => { if (i < liste.length - 1) { i += 1; vis(); vedSkift(liste[i]); } });
  vis();
  return h("div", { class: "trin" }, minus, ud, plus);
}

// Træk i rækkefølge med mus og finger: elementerne i beholderen byttes, mens man trækker, og
// vedSlip får den nye rækkefølge som liste af de oprindelige pladser.
function sorterbar(beholder, grebVaelger, vedSlip) {
  let traek = null;
  beholder.addEventListener("pointerdown", (ev) => {
    const greb = ev.target.closest(grebVaelger);
    if (!greb || !beholder.contains(greb)) return;
    const el = [...beholder.children].find((b) => b.contains(greb));
    if (!el) return;
    ev.preventDefault();
    traek = { el, x: ev.clientX, y: ev.clientY, flyttet: false };
    greb.setPointerCapture(ev.pointerId);
  });
  beholder.addEventListener("pointermove", (ev) => {
    if (!traek) return;
    if (!traek.flyttet && Math.hypot(ev.clientX - traek.x, ev.clientY - traek.y) < 6) return;
    traek.flyttet = true;
    traek.el.classList.add("slaebes");
    const over = [...beholder.children].find((b) => {
      if (b === traek.el) return false;
      const r = b.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    });
    if (!over) return;
    const boern = [...beholder.children];
    if (boern.indexOf(over) > boern.indexOf(traek.el)) over.after(traek.el);
    else over.before(traek.el);
  });
  const slip = () => {
    if (!traek) return;
    const { el, flyttet } = traek;
    traek = null;
    el.classList.remove("slaebes");
    if (flyttet) {
      // Et klik lige efter et træk skal ikke åbne elementet.
      el.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
      vedSlip([...beholder.children].map((b) => Number(b.dataset.plads)));
    }
  };
  beholder.addEventListener("pointerup", slip);
  beholder.addEventListener("pointercancel", slip);
}

class RumlysPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._liste = null;
    this._fejl = null;
    this._aktiv = null;
    this._detalje = null;
    this._kladde = null;
    this._original = null;
    this._omraader = null;
    this._lamper = null;
    this._katalog = { scener: [], efterId: {}, kategorier: [] };
    this._levende = [];
    this._visAlle = false;
    // Rumlys-kortene på betjeningspanelerne, og kortene der var nye, da rummet blev åbnet.
    this._kortfund = null;
    this._nyeKort = new Set();
    // Hvilke kort der er foldet ud, og hvilke der har fået deres første stilling — foldet ud, hvis de skal ses efter.
    this._aabneKort = new Set();
    this._kendteKort = new Set();
    // Id'er foreslået til kort, Rumlys ikke kan skrive i, efter kortets plads: de samme, også efter en ny scanning.
    this._forslag = {};
    this._vedOpdatering = () => this._hentListe();
  }

  set hass(hass) {
    const foerste = !this._hass;
    this._hass = hass;
    if (this._menuknap) this._menuknap.hass = hass;
    if (foerste) this._start();
    else this._opdaterLevende();
  }

  set narrow(v) {
    this._narrow = v;
    if (this._menuknap) this._menuknap.narrow = v;
  }

  set route(route) {
    this._route = route;
    const id = String((route && route.path) || "").replace(/^\//, "").split("/")[0] || null;
    if (id !== this._aktiv) {
      this._aktiv = id;
      if (this._hass) this._visSide();
    }
  }

  set panel(p) {
    this._panel = p;
  }

  connectedCallback() {
    this._ur = setInterval(() => this._opdaterLevende(), 15000);
    window.addEventListener(OPDATERET, this._vedOpdatering);
    this._lytTilPaneler();
  }

  disconnectedCallback() {
    clearInterval(this._ur);
    window.removeEventListener(OPDATERET, this._vedOpdatering);
    if (this._afmeldPaneler) {
      this._afmeldPaneler.then((afmeld) => afmeld(), () => {});
      this._afmeldPaneler = null;
    }
  }

  t(noegle, vaerdier) {
    return tekst(this._hass, noegle, vaerdier);
  }

  async _start() {
    this._lytTilPaneler();
    hentScener().then((k) => {
      this._katalog = k;
      if (this._aktiv && this._kladde) this._tegnRum();
    });
    await this._hentListe();
    this._visSide();
  }

  // Kortene følger med, når et betjeningspanel gemmes — også i en anden fane eller på en anden skærm.
  _lytTilPaneler() {
    if (this._afmeldPaneler || !this._hass || !this.isConnected) return;
    this._afmeldPaneler = this._hass.connection.subscribeEvents(() => {
      clearTimeout(this._panelUr);
      this._panelUr = setTimeout(() => this._panelerAendret(), 500);
    }, "lovelace_updated");
  }

  async _panelerAendret() {
    if (!this._aktiv) {
      const fund = await this._findKort();
      this._kortfund = fund;
      if (!this._aktiv) this._tegnOversigt();
    } else if (this._kladde) {
      await this._hentKort();
      this._genTegn("kort");
    }
  }

  async _hentListe() {
    try {
      this._liste = await this._hass.callWS({ type: "rumlys/rum/liste" });
      this._fejl = null;
    } catch (e) {
      this._liste = [];
      this._fejl = e && e.code === "ikke_sat_op" ? this.t("ikke_sat_op") : String((e && e.message) || e);
    }
    if (!this._aktiv) this._tegnOversigt();
  }

  async _hentOmraader() {
    this._omraader = await this._hass.callWS({ type: "rumlys/omraader" });
  }

  async _visSide() {
    if (!this._aktiv) {
      this._detalje = null;
      this._kladde = null;
      this._tegnOversigt();
      // Antallet af kort pr. rum kommer, når betjeningspanelerne er læst.
      this._findKort().then((fund) => {
        this._kortfund = fund;
        if (!this._aktiv) this._tegnOversigt();
      });
      return;
    }
    this._levende = [];
    this._nyeKort = new Set();
    this._aabneKort = new Set();
    this._kendteKort = new Set();
    this._tegnRamme(this._navnPaaAktivt(), h("div", { class: "besked" }, "…"), true);
    try {
      await Promise.all([this._hentRum(this._aktiv), this._hentOmraader()]);
      await this._hentKort();
      this._tegnRum();
    } catch (e) {
      this._tegnRamme("", h("div", { class: "besked" }, this.t("kan_ikke_hentes")));
    }
  }

  _navnPaaAktivt() {
    const rum = (this._liste || []).find((r) => r.id === this._aktiv);
    return rum ? rum.navn : "";
  }

  /* ---------- kortene på betjeningspanelerne ---------- */

  // Alle Rumlys-kort på alle betjeningspaneler: hvor de står, og stien til dem i opsætningen. `fuld` er
  // falsk, hvis et betjeningspanel ikke kunne læses — så ved vi ikke, om et kort er væk. `faner` er alle
  // fanerne, Rumlys selv kan sætte et kort ind på.
  async _findKort() {
    const hass = this._hass;
    let fuld = true;
    let ekstra = [];
    const faner = [];
    try {
      ekstra = await hass.callWS({ type: "lovelace/dashboards/list" });
    } catch (e) {
      fuld = false;
    }
    const fundne = [];
    // Standardpanelet står på listen som «lovelace», og uden navn giver Home Assistant det samme panel.
    // Kun hvis det ikke står der, spørges der uden navn — ellers står hvert kort der to gange.
    const paneler = ekstra.some((p) => p.url_path === "lovelace") ? ekstra : [{ url_path: null, title: null }].concat(ekstra);
    for (const panel of paneler) {
      let config;
      try {
        config = await hass.callWS({ type: "lovelace/config", url_path: panel.url_path });
      } catch (e) {
        // Et betjeningspanel, Home Assistant selv bygger, har ingen opsætning og ingen kort.
        if (!e || e.code !== "config_not_found") fuld = false;
        continue;
      }
      const hassPanel = (hass.panels || {})[panel.url_path || "lovelace"] || {};
      const panelNavn = panel.title || hassPanel.title || this.t("standard_panel");
      // Et betjeningspanel i YAML kan Rumlys ikke skrive et id i.
      const skrivbar = ((hassPanel.config || {}).mode || panel.mode) !== "yaml";
      (config.views || []).forEach((fane, nr) => {
        const sted = panelNavn + " › " + (fane.title || fane.path || String(nr + 1));
        if (skrivbar) faner.push({ panel: panel.url_path, fane: nr, sted, titel: fane.title || fane.path || "" });
        // Også kort inde i andre kort: stakke, betingede kort, pop-ups.
        const gaa = (x, sti) => {
          if (Array.isArray(x)) x.forEach((y, i) => gaa(y, sti.concat(i)));
          else if (x && typeof x === "object") {
            if (x.type === "custom:rumlys-card") fundne.push({ panel: panel.url_path, fane: nr, sted, sti, skrivbar, config: x });
            else Object.keys(x).forEach((k) => gaa(x[k], sti.concat(k)));
          }
        };
        gaa(fane, ["views", nr]);
      });
    }
    return { fundne, fuld, faner };
  }

  /* ---------- Rumlys sætter selv kortene ind ---------- */

  // Kortet sættes nederst i fanens første sektion — eller i fanens kort, hvis den ikke har sektioner.
  _saetIndIFane(config, nr, kort) {
    const fane = (config.views || [])[nr];
    if (!fane) throw new Error(this.t("kort_aendret"));
    if (Array.isArray(fane.sections)) {
      if (!fane.sections.length) fane.sections.push({ type: "grid", cards: [] });
      const sektion = fane.sections[0];
      sektion.cards = (sektion.cards || []).concat([kort]);
    } else {
      fane.cards = (fane.cards || []).concat([kort]);
    }
  }

  // Kortet tages ud af opsætningen igen — kun hvis det står, hvor det stod, da siden blev læst.
  _tagUdAfFane(config, fund) {
    const sti = fund.sti;
    const liste = sti.slice(0, -1).reduce((x, k) => (x ? x[k] : undefined), config);
    const plads = sti[sti.length - 1];
    const kort = Array.isArray(liste) ? liste[plads] : undefined;
    if (!kort || kort.type !== "custom:rumlys-card" || (kort.kort || null) !== (fund.config.kort || null)) {
      throw new Error(this.t("kort_aendret"));
    }
    liste.splice(plads, 1);
    return kort;
  }

  async _gemPanel(urlPath, config) {
    await this._hass.callWS({ type: "lovelace/config/save", url_path: urlPath, config });
  }

  // Hvilken fane skal kortet stå på? Rumlys foreslår rummets egen fane — den, der hedder som rummet — og
  // skriver ud for de faner, hvor rummet allerede har et kort, så man kan se, at et kort mere bliver spærret.
  _vaelgFaneTilKort() {
    const faner = (this._kortfund && this._kortfund.faner) || [];
    if (!faner.length) return;
    const harKort = new Set(
      ((this._kortfund && this._kortfund.fundne) || [])
        .filter((f) => this._erRummets(f.config, this._detalje))
        .map((f) => (f.panel || "") + "/" + f.fane)
    );
    const rummets = faner.findIndex((m) => enkeltNavn(m.titel) === enkeltNavn(this._detalje.navn));
    const vaelger = h("select", {});
    faner.forEach((m, i) =>
      vaelger.appendChild(h("option", { value: String(i) }, m.sted + (harKort.has((m.panel || "") + "/" + m.fane) ? " · " + this.t("har_kort") : "")))
    );
    vaelger.value = String(Math.max(0, rummets));
    this._dialog({
      titel: this.t("tilfoej_kort"),
      indhold: h("div", {}, h("div", { class: "felt" }, h("label", {}, this.t("fane")), vaelger), h("p", { class: "hint" }, this.t("tilfoej_kort_hint"))),
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        { tekst: this.t("tilfoej"), primaer: true, handling: () => { this._nytKortPaaFane(faner[Number(vaelger.value)]); } },
      ],
    });
  }

  // Et nyt kort på en fane: Rumlys kender det fra første sekund, så det hverken står som nyt eller venter.
  // Det får det, fanens regel giver det — hele rummet, hvis rummet ikke har et kort der i forvejen.
  async _nytKortPaaFane(maal) {
    const rumId = this._aktiv;
    const id = nytKortId();
    const nyt = { type: "custom:rumlys-card", omraade: this._detalje.omraade, kort: id };
    try {
      const config = await this._hass.callWS({ type: "lovelace/config", url_path: maal.panel });
      this._saetIndIFane(config, maal.fane, nyt);
      // Et nyt kort viser hele rummet og starter med de ni standardscener.
      await this._registrerKort(rumId, { [id]: nytKort() }, false);
      await this._gemPanel(maal.panel, config);
    } catch (e) {
      this._toast(this.t("kort_ikke_skrevet", { fejl: String((e && e.message) || e) }));
      return;
    }
    this._toast(this.t("kort_sat_ind", { sted: maal.sted }));
    await this._hentKort();
    this._genTegn("kort");
  }

  // Kortet flyttes til en anden fane: det sættes ind det nye sted, før det tages ud af det gamle, så det
  // aldrig kan nå at forsvinde helt, hvis den anden gemning fejler.
  async _flytKort(fund, maal) {
    try {
      const ny = await this._hass.callWS({ type: "lovelace/config", url_path: maal.panel });
      if (maal.panel === fund.panel) {
        this._tagUdAfFane(ny, fund);
        this._saetIndIFane(ny, maal.fane, fund.config);
        await this._gemPanel(maal.panel, ny);
      } else {
        this._saetIndIFane(ny, maal.fane, fund.config);
        await this._gemPanel(maal.panel, ny);
        const gammel = await this._hass.callWS({ type: "lovelace/config", url_path: fund.panel });
        this._tagUdAfFane(gammel, fund);
        await this._gemPanel(fund.panel, gammel);
      }
    } catch (e) {
      this._toast(this.t("kort_ikke_skrevet", { fejl: String((e && e.message) || e) }));
    }
    await this._hentKort();
    this._genTegn("kort");
  }

  // Pærens navn uden rummets ord foran: «Kontor Loftspots» i Kontor bliver «Loftspots», som på kortet selv.
  _lampeNavn(entity_id) {
    const st = this._hass.states[entity_id];
    return kortNavn((st && st.attributes.friendly_name) || entity_id, this._detalje.navn);
  }

  // Flere lamper valgt ét sted — på et kort eller til en sensor. Fluebenene står i en dialog, så rummets egen
  // lampeliste er den eneste liste på siden.
  _vaelgLamper({ titel, lamper, valgte, optaget, gem, fortryd }) {
    const valg = new Set(valgte);
    const liste = h("div", { class: "liste" });
    const tegn = () => {
      liste.textContent = "";
      lamper.forEach((lampe) => {
        const valgt = valg.has(lampe);
        const andet = optaget ? optaget(lampe) : null;
        const flueben = h(
          "button",
          { class: "flueben" + (valgt ? " til" : ""), type: "button", disabled: !valgt && !!andet, "aria-pressed": String(valgt), "aria-label": this._lampeNavn(lampe) },
          valgt ? ikon("mdi:check") : null
        );
        flueben.addEventListener("click", () => {
          if (valgt) valg.delete(lampe);
          else valg.add(lampe);
          tegn();
        });
        const under = andet ? this.t(andet.hele ? "paa_hele_kort" : "paa_kort", { n: andet.nr }) : null;
        liste.appendChild(h("div", { class: "raekke" }, flueben, h("div", { class: "tx" }, h("b", {}, this._lampeNavn(lampe)), under ? h("small", {}, under) : null)));
      });
    };
    tegn();
    this._dialog({
      titel,
      indhold: liste,
      knapper: [
        { tekst: this.t("annuller"), handling: fortryd },
        { tekst: this.t("vaelg"), primaer: true, handling: () => gem(lamper.filter((l) => valg.has(l))) },
      ],
    });
  }

  // Kortet tages af betjeningspanelet. Rumlys husker dets lamper, hvis det kommer igen.
  _fjernKort(fund) {
    this._dialog({
      titel: this.t("fjern_kort"),
      indhold: h("p", {}, this.t("fjern_kort_spoergsmaal", { sted: fund.sted })),
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        {
          tekst: this.t("fjern"),
          primaer: true,
          handling: () => {
            (async () => {
              try {
                const config = await this._hass.callWS({ type: "lovelace/config", url_path: fund.panel });
                this._tagUdAfFane(config, fund);
                await this._gemPanel(fund.panel, config);
                this._toast(this.t("kort_fjernet", { sted: fund.sted }));
              } catch (e) {
                this._toast(this.t("kort_ikke_skrevet", { fejl: String((e && e.message) || e) }));
              }
              await this._hentKort();
              this._genTegn("kort");
            })();
          },
        },
      ],
    });
  }

  _erRummets(config, rum) {
    return erRummetsKort(config, rum);
  }

  // Rummets kort pr. fane, i den rækkefølge de står.
  _fanerne(fundne) {
    const faner = {};
    fundne.forEach((f) => {
      const n = (f.panel || "") + "/" + f.fane;
      (faner[n] = faner[n] || []).push(f);
    });
    return faner;
  }

  // Rummets kort. Et kort, rummet ikke kender, er nyt: Rumlys får det at vide med det samme, uden at rummet
  // står som ændret, og det står som «Nyt», så længe siden er åben. Det får det, det viser på betjeningspanelet nu:
  // hele rummet, hvis det er rummets eneste kort på fanen — ellers ingen lamper, til de vælges her. Det er samme
  // regel, som kortet selv bruger. Et kort fra 0.4.9–0.4.10 med `lamper` i sin egen opsætning beholder dem.
  // Kunne et betjeningspanel ikke læses, registreres intet: kortet kan stå dér med et andet kort for rummet.
  async _hentKort() {
    const rumId = this._aktiv;
    const fund = await this._findKort();
    // Er der skiftet rum imens, hører kortene ikke til det rum, der er åbent nu.
    if (this._aktiv !== rumId || !this._kladde) return;
    this._kortfund = fund;
    if (!fund.fuld) return;
    // Et kort, Rumlys møder for første gang, beholder de lamper, der står i dets egen opsætning,
    // og får ellers hele rummet. Der er ikke længere noget at fordele mellem kortene på en fane.
    const nye = {};
    fund.fundne.filter((f) => this._erRummets(f.config, this._detalje)).forEach((f) => {
      const id = f.config.kort;
      if (!id || id in this._kladde.kort || id in nye) return;
      nye[id] = nytKort(Array.isArray(f.config.lamper) ? f.config.lamper : []);
    });
    if (!Object.keys(nye).length) return;
    try {
      await this._registrerKort(rumId, nye);
    } catch (e) {
      // Kortene står som nye igen næste gang.
    }
  }

  // Rumlys får kortene at vide, uden at rummet står som ændret. Kort, Rumlys selv har sat ind, er ikke «nye»
  // for brugeren — han har lige lavet dem.
  async _registrerKort(rumId, nye, somNye = true) {
    const svar = await this._hass.callWS({ type: "rumlys/kort/nye", rum_id: rumId, kort: nye });
    // Oversigten skal ikke længere kalde kortene nye.
    meldOpdateret(rumId);
    if (this._aktiv !== rumId || !this._kladde) return;
    const original = JSON.parse(this._original);
    Object.keys(nye).forEach((id) => {
      // Er kortet kommet med imens, fx ved en scanning mere, er det valg, der står i kladden, det rigtige.
      if (id in this._kladde.kort) return;
      const vaerdi = id in svar.kort ? svar.kort[id] : nye[id];
      if (somNye) this._nyeKort.add(id);
      this._kladde.kort[id] = kopi(vaerdi);
      original.kort[id] = kopi(vaerdi);
    });
    this._original = JSON.stringify(original);
  }

  // Skriver et nyt id i ét korts opsætning på betjeningspanelet — kun hvis kortet står, som det stod, da
  // siden blev åbnet. Et kort uden id beholder sine gamle `lamper`; en kopi, der adskilles, starter forfra.
  async _nytIdTilKort(fund, adskil) {
    const hass = this._hass;
    try {
      const config = await hass.callWS({ type: "lovelace/config", url_path: fund.panel });
      const kort = fund.sti.reduce((x, k) => (x ? x[k] : undefined), config);
      if (!kort || kort.type !== "custom:rumlys-card" || (kort.kort || null) !== (fund.config.kort || null)) {
        throw new Error(this.t("kort_aendret"));
      }
      if (adskil) delete kort.lamper;
      kort.kort = nytKortId();
      await hass.callWS({ type: "lovelace/config/save", url_path: fund.panel, config });
    } catch (e) {
      this._toast(this.t("kort_ikke_skrevet", { fejl: String((e && e.message) || e) }));
      return;
    }
    this._toast(this.t("kort_skrevet"));
    await this._hentKort();
    this._genTegn("kort");
  }

  _sekKort() {
    const titel = ["mdi:view-dashboard-outline", this.t("kort_sektion"), this.t("kort_sektion_hint")];
    if (!this._kortfund) return this._sektion(...titel, h("p", { class: "hint" }, "…"));
    const d = this._kladde;
    const lamper = d.data.lamper.map((l) => l.entity_id);
    const fund = this._kortfund;
    const mine = fund.fundne.filter((f) => this._erRummets(f.config, this._detalje));
    // Kortene i den rækkefølge, de står; samme id flere steder er ét kort.
    const kort = [];
    mine.forEach((f) => {
      const samme = f.config.kort && kort.find((k) => k.id === f.config.kort);
      if (samme) samme.steder.push(f);
      else kort.push({ id: f.config.kort || null, steder: [f] });
    });
    const nr = (k) => kort.indexOf(k) + 1;
    const forslag = (f) => {
      const plads = [f.panel, ...f.sti].join("/");
      return (this._forslag[plads] = this._forslag[plads] || nytKortId());
    };
    const hint = (tekst) => h("p", { class: "hint" }, tekst);
    const lampeNavn = (entity_id) => this._lampeNavn(entity_id);

    const boks = (k) => {
      const f = k.steder[0];
      const stoerrelse = this.t({ small: "lille", medium: "mellem", large: "stor" }[f.config.size] || "automatisk");
      const steder = [...new Set(k.steder.map((s) => s.sted))].join(" · ");
      const dele = [];
      // Kortets eget valg i kladden. Et kort uden id har sit valg i sin egen opsætning.
      const gemt = k.id && k.id in d.kort ? d.kort[k.id] : null;
      const oenskede = gemt ? gemt.lamper : Array.isArray(f.config.lamper) ? f.config.lamper : [];
      const valgte = (oenskede || []).filter((l) => lamper.indexOf(l) >= 0);
      const hele = !valgte.length || valgte.length === lamper.length;
      const viser = hele ? this.t("hele_rummet") : valgte.map(lampeNavn).join(", ");
      // Et kort uden id skal ses efter: kun med et id kan Rumlys give det scener og lamper.
      const noegle = k.id || [f.panel, ...f.sti].join("/");
      if (!this._kendteKort.has(noegle)) {
        this._kendteKort.add(noegle);
        if (!k.id) this._aabneKort.add(noegle);
      }
      const aaben = this._aabneKort.has(noegle);
      const hoved = h(
        "button",
        {
          class: "korthoved",
          type: "button",
          "aria-expanded": String(aaben),
          onclick: () => {
            if (aaben) this._aabneKort.delete(noegle);
            else this._aabneKort.add(noegle);
            this._genTegn("kort");
          },
        },
        ikon("mdi:chevron-right", "chev"),
        h(
          "div",
          { class: "kt" },
          h(
            "div",
            { class: "kt1" },
            h("b", {}, this.t("kort_nr", { n: nr(k) })),
            k.id && this._nyeKort.has(k.id) ? h("span", { class: "pille ny" }, this.t("nyt")) : null,
            h("span", { class: "hvad" }, viser)
          ),
          h("small", {}, steder + " · " + stoerrelse)
        )
      );
      if (!aaben) return h("div", { class: "kortboks" }, hoved);
      // Kortet flyttes ved at vælge en anden fane. Står det flere steder, eller på et panel i YAML, kan Rumlys
      // ikke gøre det for dig.
      if (k.id && k.steder.length === 1 && f.skrivbar && fund.faner.length) {
        const vaelger = h("select", {});
        const noegleFor = (m) => (m.panel || "") + "/" + m.fane;
        fund.faner.forEach((m) => vaelger.appendChild(h("option", { value: noegleFor(m) }, m.sted)));
        vaelger.value = noegleFor(f);
        vaelger.addEventListener("change", () => {
          const maal = fund.faner.find((m) => noegleFor(m) === vaelger.value);
          if (maal && noegleFor(maal) !== noegleFor(f)) this._flytKort(f, maal);
        });
        dele.push(h("div", { class: "felt" }, h("label", {}, this.t("fane")), vaelger));
      }
      if (!k.id) {
        if (f.skrivbar) dele.push(hint(this.t("kort_uden_id")), h("button", { class: "knap", type: "button", onclick: () => this._nytIdTilKort(f, false) }, this.t("giv_id")));
        else dele.push(hint(this.t("kort_uden_id_yaml", { linje: "kort: " + forslag(f) })));
        return h("div", { class: "kortboks" }, hoved, dele);
      }
      // Står kortet flere steder, er det det samme kort — samme lamper, samme scener, samme ikon.
      if (k.steder.length > 1) dele.push(hint(this.t("flere_steder", { n: k.steder.length })));

      // Viser: hele rummet eller bestemte lamper. To kort må gerne vise den samme lampe.
      const vaelger = h("select", {});
      const tilfoejValg = (vaerdi, tekst) => vaelger.appendChild(h("option", { value: vaerdi }, tekst));
      if (!hele && valgte.length > 1) tilfoejValg("eget", valgte.map(lampeNavn).join(", "));
      tilfoejValg("hele", this.t("hele_rummet"));
      lamper.forEach((lampe) => tilfoejValg(lampe, lampeNavn(lampe)));
      if (lamper.length > 2) tilfoejValg("flere", this.t("vaelg_lamper") + " …");
      vaelger.value = !hele && valgte.length > 1 ? "eget" : hele ? "hele" : valgte[0];
      const saetLamper = (nye) => {
        d.kort[k.id] = Object.assign({}, d.kort[k.id], { lamper: nye });
        this._genTegn("kort");
      };
      vaelger.addEventListener("change", () => {
        const v = vaelger.value;
        if (v === "flere") {
          this._vaelgLamper({
            titel: this.t("vaelg_lamper"),
            lamper,
            valgte: hele ? lamper.slice() : valgte,
            gem: (nye) => saetLamper(nye.length === lamper.length ? [] : nye),
            fortryd: () => this._genTegn("kort"),
          });
          return;
        }
        if (v !== "eget") saetLamper(v === "hele" ? [] : [v]);
      });
      dele.push(h("div", { class: "felt" }, h("label", {}, this.t("viser")), vaelger));

      // Kortets eget ikon. «Automatisk» tegner kortets egne lampers ikoner.
      dele.push(this._kortIkon(k.id, hele ? lamper : valgte));
      // Kortets scener.
      dele.push(h("div", { class: "felt" }, h("label", {}, this.t("scener_paa_kortet"))), this._kortScener(k.id, hele ? lamper : valgte));

      if (k.steder.length === 1 && f.skrivbar) {
        dele.push(h("button", { class: "knap farlig", type: "button", onclick: () => this._fjernKort(f) }, ikon("mdi:close"), this.t("fjern_kort")));
      }
      return h("div", { class: "kortboks" }, hoved, dele);
    };

    // Et kort, der er fjernet fra betjeningspanelet, står ikke her. Dets valg bliver i Rumlys, så et kort, der
    // kommer igen — fortrudt, eller klippet og sat ind et andet sted — stadig viser sine lamper.
    const liste = h("div", { class: "kortliste" }, kort.map(boks));
    if (!liste.children.length) liste.appendChild(h("p", { class: "hint" }, this.t("ingen_kort")));
    // Rumlys sætter selv kortet ind på den fane, du vælger, så det kender kortet fra første sekund.
    const tilfoej = fund.faner.length
      ? h("button", { class: "knap t", type: "button", onclick: () => this._vaelgFaneTilKort() }, ikon("mdi:plus"), this.t("tilfoej_kort"))
      : h("p", { class: "hint" }, this.t("ingen_skrivbare_faner"));
    return this._sektion(...titel, fund.fuld ? null : h("p", { class: "hint" }, this.t("kort_ufuldstaendig")), liste, tilfoej);
  }

  // Kortets ikon: lampernes egne, eller et, du vælger.
  _kortIkon(kortId, kortetsLamper) {
    const d = this._kladde;
    const eget = (d.kort[kortId] || {}).ikon || "";
    const vist = eget ? [eget] : rummetsIkoner(this._hass, kortetsLamper, null);
    const saet = (ikonNavn) => {
      d.kort[kortId] = Object.assign({}, d.kort[kortId], { ikon: ikonNavn || null });
      this._genTegn("kort");
    };
    const knap = h("button", { class: "knap", type: "button", onclick: () => this._vaelgKortIkon(eget, saet) },
      this.t(eget ? "ikon_eget" : "ikon_auto"));
    return h("div", { class: "ikonvalg" },
      h("span", { class: "ikoner" }, ...vist.slice(0, 3).map((n) => h("span", { class: "ikon" }, ikon(n)))),
      h("div", { class: "tx", style: { flex: "1" } },
        h("b", {}, this.t("ikon_paa_kortet")),
        h("small", { class: "hint", style: { margin: "0" } }, this.t(eget ? "ikon_eget_hint" : "ikon_auto_hint"))),
      knap);
  }

  _vaelgKortIkon(nu, gem) {
    let valgt = nu;
    this._dialog({
      titel: this.t("ikon_paa_kortet"),
      indhold: [this._ikonVaelger(valgt, (v) => { valgt = v; })],
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        { tekst: this.t("ikon_auto"), handling: () => gem(null) },
        { tekst: this.t("gem"), primaer: true, handling: () => gem(valgt) },
      ],
    });
  }

  // Kortets scener. En scene kræver farve eller hvidt lys; kan kortets lamper ingen af delene, er der ingen.
  _kortScener(kortId, kortetsLamper) {
    const d = this._kladde;
    const valgte = (d.kort[kortId] || {}).scener || [];
    const saet = (nye) => {
      d.kort[kortId] = Object.assign({}, d.kort[kortId], { scener: nye });
      this._genTegn("kort");
    };
    const kan = kanHvid(this._hass, kortetsLamper);
    const gitter = h("div", { class: "scenegitter" });
    valgte.forEach((id, plads) => {
      const scene = this._katalog.efterId[id] || { id, navn: id, billede: null, punkter: [] };
      const felt = this._scenefelt(scene, true, () => saet(valgte.filter((x) => x !== id)));
      felt.dataset.plads = String(plads);
      gitter.appendChild(felt);
    });
    sorterbar(gitter, ".scenefelt", (orden) => saet(orden.map((i) => valgte[i])));
    if (!kan) return h("div", {}, h("p", { class: "hint" }, this.t("scener_ingen")), valgte.length ? gitter : null);
    return h("div", {},
      valgte.length ? gitter : h("p", { class: "hint" }, this.t("ingen_scener")),
      h("button", { class: "knap t", type: "button", onclick: () => this._tilfoejScener(valgte, saet) }, ikon("mdi:plus"), this.t("tilfoej_scener")));
  }

  async _hentRum(id, forsoeg = 1) {
    try {
      this._detalje = await this._hass.callWS({ type: "rumlys/rum/hent", rum_id: id });
    } catch (e) {
      // Lige efter oprettelse eller gem genindlæses Rumlys; prøv igen et par gange.
      if (forsoeg >= 10) throw e;
      await new Promise((r) => setTimeout(r, 400));
      return this._hentRum(id, forsoeg + 1);
    }
    const status = this._detalje.status;
    this._kladde = { data: kopi(this._detalje.data), indstillinger: kopi(status.indstillinger), kort: kopi(this._detalje.kort || {}) };
    this._original = JSON.stringify(this._kladde);
  }

  // Scenerne, der kan vælges til ét kort. Kortet ejer dem fra 0.6.0; før lå de på rummet.
  _tilfoejScener(valgteNu, gem) {
    if (!valgteNu.length && !this._katalog.scener.length) {
      this._toast(this.t("ingen_katalog"));
      return;
    }
    const valgte = new Set(valgteNu);
    const soeg = h("input", { type: "search", placeholder: this.t("soeg") });
    const liste = h("div", {});
    const tegn = () => {
      const q = soeg.value.trim().toLowerCase();
      liste.textContent = "";
      const grupper = new Map();
      const standard = this._katalog.scener.filter((s) => STANDARDSCENER.indexOf(s.id) >= 0).sort((a, b) => STANDARDSCENER.indexOf(a.id) - STANDARDSCENER.indexOf(b.id));
      const oevrige = this._katalog.scener.filter((s) => STANDARDSCENER.indexOf(s.id) < 0);
      [...standard, ...oevrige].forEach((s) => {
        const navn = sceneNavn(this._hass, s);
        if (q && (navn + " " + s.navn + " " + s.kategori + " " + kategoriNavn(this._hass, s.kategori)).toLowerCase().indexOf(q) < 0) return;
        if (!grupper.has(s.kategori)) grupper.set(s.kategori, []);
        grupper.get(s.kategori).push(s);
      });
      grupper.forEach((scener, kategori) => {
        liste.appendChild(h("div", { class: "kategori" }, kategoriNavn(this._hass, kategori)));
        const gitter = h("div", { class: "scenegitter" });
        scener.forEach((s) => {
          const felt = this._scenefelt(s, false);
          if (valgte.has(s.id)) felt.classList.add("valgt");
          felt.addEventListener("click", () => {
            if (valgte.has(s.id)) valgte.delete(s.id);
            else valgte.add(s.id);
            felt.classList.toggle("valgt", valgte.has(s.id));
          });
          gitter.appendChild(felt);
        });
        liste.appendChild(gitter);
      });
    };
    soeg.addEventListener("input", tegn);
    tegn();
    this._dialog({
      titel: this.t("tilfoej_scener"),
      bred: true,
      indhold: [soeg, liste],
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        {
          tekst: this.t("faerdig"),
          primaer: true,
          handling: () => {
            // De allerede valgte beholder deres plads; nye kommer bagerst i katalogets rækkefølge.
            const nye = this._katalog.scener.map((s) => s.id).filter((id) => valgte.has(id) && valgteNu.indexOf(id) < 0);
            gem(valgteNu.filter((id) => valgte.has(id)).concat(nye));
          },
        },
      ],
    });
  }

  _tegnRamme(titel, indhold, tilbage) {
    const rod = this.shadowRoot;
    rod.textContent = "";
    this._menuknap = document.createElement("ha-menu-button");
    this._menuknap.hass = this._hass;
    this._menuknap.narrow = this._narrow;
    const bjaelke = h(
      "div",
      { class: "bjaelke" },
      tilbage
        ? h("button", { class: "ikonknap", "aria-label": this.t("tilbage"), onclick: () => this._tilbage() }, ikon("mdi:arrow-left"))
        : this._menuknap,
      h("div", { class: "titel" }, titel || this.t("titel"))
    );
    rod.append(h("style", {}, STIL), bjaelke, h("div", { class: "indhold" }, indhold));
    // En besked overlever, at siden tegnes igen — fx når rummet hentes på ny lige efter «Gem rum».
    if (this._besked) rod.append(this._besked);
  }

  _tilbage() {
    if (this._erAendret() && !window.confirm(this.t("ikke_gemt"))) return;
    naviger("/rumlys");
  }

  _toast(besked) {
    if (this._besked) this._besked.remove();
    const el = h("div", { class: "toast" }, besked);
    this._besked = el;
    this.shadowRoot.appendChild(el);
    setTimeout(() => {
      el.remove();
      if (this._besked === el) this._besked = null;
    }, 5000);
  }

  _dialog({ titel, indhold, knapper, venstre, bred }) {
    const luk = () => {
      slor.remove();
      document.removeEventListener("keydown", esc);
    };
    const esc = (ev) => { if (ev.key === "Escape") luk(); };
    const fod = h("div", { class: "df" });
    if (venstre) fod.appendChild(h("span", { class: "venstre" }, venstre));
    (knapper || []).forEach((k) => {
      const knap = h("button", { class: "knap" + (k.primaer ? " p" : ""), type: "button", disabled: !!k.deaktiveret }, k.tekst);
      knap.addEventListener("click", () => { if (k.handling() !== false) luk(); });
      if (k.ref) k.ref(knap);
      fod.appendChild(knap);
    });
    const dialog = h(
      "div",
      { class: "dialog" + (bred ? " bred" : ""), role: "dialog", "aria-modal": "true" },
      h("div", { class: "dh" }, h("h3", {}, titel), h("button", { class: "ikonknap", "aria-label": "×", onclick: luk }, ikon("mdi:close"))),
      h("div", { class: "db" }, indhold),
      fod
    );
    const slor = h("div", { class: "slor", onclick: (ev) => { if (ev.target === slor) luk(); } }, dialog);
    document.addEventListener("keydown", esc);
    this.shadowRoot.appendChild(slor);
    return luk;
  }

  _opdaterLevende() {
    if (!this._hass) return;
    this._levende.forEach((fn) => fn(this._hass));
  }

  /* ---------- oversigten ---------- */

  _tegnOversigt() {
    if (!this._hass) return;
    this._levende = [];
    const indhold = h("div", {});
    indhold.appendChild(h("div", { class: "overskrift" }, h("h1", {}, this.t("titel"))));
    if (this._fejl) {
      indhold.appendChild(h("div", { class: "besked" }, this._fejl));
      this._tegnRamme(this.t("titel"), indhold);
      return;
    }
    const gitter = h("div", { class: "rumgitter" });
    (this._liste || []).forEach((rum) => gitter.appendChild(this._rumfelt(rum)));
    gitter.appendChild(h("button", { class: "rumfelt nyt", onclick: () => this._nytRum() }, ikon("mdi:plus"), this.t("nyt_rum")));
    indhold.appendChild(gitter);
    if (this._liste && !this._liste.length) indhold.appendChild(h("p", { class: "hint" }, this.t("ingen_rum")));
    this._tegnRamme(this.t("titel"), indhold);
    this._opdaterLevende();
  }

  _rumfelt(rum) {
    const farve = h("div", { class: "farve" });
    const status = h("div", { class: "status" });
    const lamper = rum.lamper.length === 1 ? this.t("lampe_1") : this.t("lamper_n", { n: rum.lamper.length });
    const sensorer = !rum.sensorer.length ? this.t("ingen_sensor") : rum.sensorer.length === 1 ? this.t("sensor_1") : this.t("sensorer_n", { n: rum.sensorer.length });
    const dele = [lamper, sensorer];
    if (rum.tidsrum.length) dele.push(rum.tidsrum.join(" og "));
    // Rummets kort på betjeningspanelerne, og hvor mange rummet ikke har set endnu.
    let nye = null;
    if (this._kortfund) {
      const mine = this._kortfund.fundne.filter((f) => this._erRummets(f.config, rum));
      const antal = new Set(mine.map((f) => f.config.kort || [f.panel, ...f.sti].join("/"))).size;
      if (antal) dele.push(antal === 1 ? this.t("kort_1") : this.t("kort_n", { n: antal }));
      const nyeIder = new Set(mine.map((f) => f.config.kort).filter((id) => id && !(id in (rum.kort || {}))));
      if (nyeIder.size) nye = h("span", { class: "pille ny" }, nyeIder.size === 1 ? this.t("nyt_kort_1") : this.t("nye_kort_n", { n: nyeIder.size }));
    }
    const felt = h(
      "button",
      { class: "rumfelt", onclick: () => naviger("/rumlys/" + rum.id) },
      farve,
      h("div", { class: "tekst" }, h("b", {}, rum.navn), status, h("div", { class: "meta" }, dele.join(" · ")), nye)
    );
    this._levende.push((hass) => {
      const farver = rummetsFarver(hass, rum.lamper.map((l) => l.entity_id));
      farve.style.background = farver.length ? overgang(farver, "135deg") : "";
      status.textContent = statusTekst(hass, rum.entiteter);
    });
    return felt;
  }

  async _nytRum() {
    await this._hentOmraader();
    let valgt = null;
    let opretKnap = null;
    const liste = h("div", {});
    const tegn = () => {
      liste.textContent = "";
      this._omraader.forEach((o) => {
        const optaget = !!o.rum;
        // Lamperne, rummet får valgt på forhånd: en gruppes pærer tæller ikke, gruppen gør.
        const medlemmer = new Set(o.lamper.flatMap((l) => l.gruppe));
        const antalLamper = o.lamper.filter((l) => l.gruppe.length || !medlemmer.has(l.entity_id)).length;
        const raekke = h(
          "div",
          { class: "raekke", style: { opacity: optaget ? 0.5 : 1, cursor: optaget ? "default" : "pointer" } },
          h("span", { class: "flueben" + (valgt === o.id ? " til" : "") }, valgt === o.id ? ikon("mdi:check") : null),
          h("div", { class: "tx" }, h("b", {}, o.navn), h("small", {}, optaget ? this.t("har_rum") : [
            antalLamper === 1 ? this.t("lampe_1") : this.t("lamper_n", { n: antalLamper }),
            o.sensorer.length === 1 ? this.t("sensor_1") : this.t("sensorer_n", { n: o.sensorer.length }),
          ].join(" · ")))
        );
        if (!optaget) raekke.addEventListener("click", () => { valgt = o.id; if (opretKnap) opretKnap.disabled = false; tegn(); });
        liste.appendChild(raekke);
      });
    };
    tegn();
    this._dialog({
      titel: this.t("nyt_rum"),
      indhold: [h("p", { class: "hint" }, this.t("nyt_rum_hint")), liste],
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        {
          tekst: this.t("opret"),
          primaer: true,
          deaktiveret: true,
          ref: (k) => { opretKnap = k; },
          handling: () => {
            if (!valgt) return false;
            this._hass.callWS({ type: "rumlys/rum/opret", omraade: valgt }).then(
              (svar) => { meldOpdateret(svar.id); naviger("/rumlys/" + svar.id); },
              (e) => this._toast(String((e && e.message) || e))
            );
            return true;
          },
        },
      ],
    });
  }

  /* ---------- rummets side ---------- */

  _erAendret() {
    return !!this._kladde && JSON.stringify(this._kladde) !== this._original;
  }

  _tegnRum() {
    if (!this._detalje || !this._kladde) return;
    this._levende = [];
    const indhold = h("div", {});
    this._sektioner = {};
    indhold.appendChild(this._hovedet());
    [
      ["rummet", () => this._sekRummet()],
      ["sensorer", () => this._sekSensorer()],
      ["automatik", () => this._sekAutomatik()],
      ["kort", () => this._sekKort()],
      ["knapper", () => this._sekKnapper()],
      ["haendelser", () => this._sekHaendelser()],
    ].forEach(([noegle, bygger]) => {
      const el = bygger();
      this._sektioner[noegle] = { el, bygger };
      indhold.appendChild(el);
    });
    this._tegnRamme(this._detalje.navn, indhold, true);
    this.shadowRoot.appendChild(this._fod());
    this._opdaterLevende();
  }

  _genTegn(...noegler) {
    // Lamperne, tidsplanen og tiderne er grupper inde i «Automatik», og scenerne hører til kortet.
    noegler = noegler.map((n) => (["lamper", "tidsplan", "ingen", "hold"].indexOf(n) >= 0 ? "automatik" : n === "scener" ? "kort" : n));
    // Knapperne viser kortenes navne, så de skal tegnes om, når kortene ændrer sig.
    if (noegler.indexOf("kort") >= 0) noegler = noegler.concat(["knapper"]);
    noegler = [...new Set(noegler)];
    noegler.forEach((noegle) => {
      const sek = this._sektioner[noegle];
      if (!sek) return;
      const antal = this._levende.length;
      const nyt = sek.bygger();
      sek.el.replaceWith(nyt);
      sek.el = nyt;
      this._levende.slice(antal).forEach((fn) => fn(this._hass));
    });
    this._aendret();
  }

  _aendret() {
    if (this._fodBesked) {
      const aendret = this._erAendret();
      this._fodBesked.textContent = this.t(aendret ? "ikke_gemt" : "alt_gemt");
      this._gemKnap.disabled = !aendret;
      this._fortrydKnap.disabled = !aendret;
    }
  }

  _fod() {
    this._fodBesked = h("span", { class: "besked2" });
    this._fortrydKnap = h("button", { class: "knap", onclick: () => { this._kladde = JSON.parse(this._original); this._tegnRum(); } }, this.t("fortryd"));
    this._gemKnap = h("button", { class: "knap p", onclick: () => this._gem() }, this.t("gem_rum"));
    const fod = h("div", { class: "fod" }, this._fodBesked, this._fortrydKnap, this._gemKnap);
    setTimeout(() => this._aendret());
    return fod;
  }

  async _gem() {
    this._gemKnap.disabled = true;
    try {
      await this._hass.callWS({
        type: "rumlys/rum/gem",
        rum_id: this._aktiv,
        data: this._kladde.data,
        indstillinger: this._kladde.indstillinger,
        kort: this._kladde.kort,
      });
    } catch (e) {
      this._toast(this.t("kan_ikke_gemmes", { fejl: String((e && e.message) || e) }));
      this._aendret();
      return;
    }
    this._toast(this.t("gemt"));
    meldOpdateret(this._aktiv);
    // Rumlys genindlæses efter en ændring; hent rummet igen, når det er oppe.
    await new Promise((r) => setTimeout(r, 600));
    try {
      await Promise.all([this._hentRum(this._aktiv), this._hentOmraader()]);
    } catch (e) {
      // beholder kladden
    }
    this._tegnRum();
  }

  _hovedet() {
    const e = this._detalje.entiteter;
    const glod = h("span", { class: "glod" });
    const status = h("b", {});
    const tidsrum = h("small", {});
    const holdKnap = h("button", { class: "knap" }, ikon("mdi:lock-clock"), this.t("hold_lys"));
    holdKnap.addEventListener("click", () => {
      const st = this._hass.states[e.hold];
      this._hass.callService("switch", st && st.state === "on" ? "turn_off" : "turn_on", { entity_id: e.hold });
    });
    const slukKnap = h("button", { class: "knap", onclick: () => this._hass.callService("rumlys", "daemp", { rum: this._aktiv, lysstyrke: 0 }) }, ikon("mdi:power"), this.t("sluk"));
    this._levende.push((hass) => {
      const farver = rummetsFarver(hass, this._kladde.data.lamper.map((l) => l.entity_id));
      glod.style.background = farver.length ? overgang(farver, "135deg") : "";
      status.textContent = statusTekst(hass, e);
      const hold = hass.states[e.hold];
      holdKnap.textContent = "";
      holdKnap.append(ikon("mdi:lock-clock"), this.t(hold && hold.state === "on" ? "slaa_fra" : "hold_lys"));
      tidsrum.textContent = this._detalje.status.tidsrum ? this.t("tidsrum") + ": " + this._detalje.status.tidsrum : "";
    });
    return h(
      "div",
      { class: "hoved" },
      h("div", { class: "linje1" }, h("h1", {}, this._detalje.navn), holdKnap, slukKnap),
      h("div", { class: "levende" }, glod, h("div", {}, status, tidsrum))
    );
  }

  _sektion(ikonNavn, titel, hint, ...indhold) {
    return h("section", { class: "sek" }, h("h2", {}, ikon(ikonNavn), titel), hint ? h("p", { class: "hint" }, hint) : null, ...indhold);
  }

  _omraade(id) {
    return (this._omraader || []).find((o) => o.id === id) || { lamper: [], sensorer: [], knapper: [], navn: "" };
  }

  // Automatikken: det, der sker af sig selv. Lamperne, tidsplanen og tiderne hører til den samme
  // ting, så de står i én sektion — kortene nedenfor er ren betjening.
  _sekAutomatik() {
    return this._sektion(
      "mdi:cog-outline",
      this.t("automatik"),
      this.t("automatik_hint"),
      this._somGruppe(this._sekLamper()),
      this._somGruppe(this._sekTidsplan()),
      this._somGruppe(this._sekIngen()),
      this._somGruppe(this._sekHold())
    );
  }

  // Et afsnit, der før var sin egen boks, vist som en gruppe inde i en anden.
  _somGruppe(sek) {
    const boern = [...sek.childNodes];
    const overskrift = boern.shift();
    return h("div", { class: "gruppe" }, h("div", { class: "gtitel" }, ...overskrift.childNodes), ...boern);
  }

  _sekRummet() {
    const d = this._kladde.data;
    const vaelger = h("select", {});
    (this._omraader || []).forEach((o) => {
      if (o.rum && o.rum !== this._aktiv) return;
      vaelger.appendChild(h("option", { value: o.id, selected: o.id === d.omraade }, o.navn));
    });
    vaelger.value = d.omraade;
    vaelger.addEventListener("change", () => {
      d.omraade = vaelger.value;
      this._genTegn("lamper", "sensorer");
    });
    const slet = h("button", { class: "knap farlig", onclick: () => this._sletRum() }, ikon("mdi:delete-outline"), this.t("slet_rum"));
    return this._sektion(
      "mdi:home-outline",
      this.t("rummet"),
      null,
      h("div", { class: "felt", style: { marginTop: "10px" } }, h("label", {}, this.t("omraade")), vaelger),
      h("p", { class: "hint" }, this.t("omraade_hint")),
      slet
    );
  }

  _ikonVaelger(vaerdi, vedValg) {
    const navn = ["ha-selector", "ha-icon-picker"].find((n) => customElements.get(n));
    if (navn) {
      const el = document.createElement(navn);
      el.hass = this._hass;
      if (navn === "ha-selector") el.selector = { icon: {} };
      el.value = vaerdi;
      el.label = this.t("ikon");
      el.addEventListener("value-changed", (ev) => vedValg(ev.detail.value));
      return el;
    }
    if (!this._henterIkonvaelger) {
      this._henterIkonvaelger = true;
      Promise.race([customElements.whenDefined("ha-selector"), customElements.whenDefined("ha-icon-picker")]).then(() => {
        if (this._kladde) this._genTegn("rummet");
      });
      if (window.loadCardHelpers) {
        window.loadCardHelpers()
          .then((hjaelp) => hjaelp.createCardElement({ type: "button", entity: "sun.sun" }))
          .then((kort) => kort && kort.constructor.getConfigElement && kort.constructor.getConfigElement())
          .catch(() => {});
      }
    }
    const felt = h("input", { type: "text", value: vaerdi, placeholder: "mdi:lightbulb" });
    felt.addEventListener("change", () => vedValg(felt.value.trim()));
    return felt;
  }

  // Rummets lamper er ændret: ikonerne og scenerne afhænger også af dem.
  _lamperAendret() {
    this._genTegn("lamper", "rummet", "scener", "kort");
  }

  _sletRum() {
    this._dialog({
      titel: this.t("slet_rum"),
      indhold: h("p", {}, this.t("slet_spoergsmaal", { navn: this._detalje.navn })),
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        {
          tekst: this.t("slet"),
          primaer: true,
          handling: () => {
            this._hass.callWS({ type: "rumlys/rum/slet", rum_id: this._aktiv }).then(() => {
              this._kladde = null;
              meldOpdateret(null);
              naviger("/rumlys");
            });
          },
        },
      ],
    });
  }

  _sekLamper() {
    const d = this._kladde.data;
    const udenSensor = !d.sensorer.length;
    const omraade = this._omraade(d.omraade);
    const valgte = new Map(d.lamper.map((l) => [l.entity_id, l]));
    const kendte = new Map(omraade.lamper.map((l) => [l.entity_id, l]));
    const medlemmer = new Set();
    d.lamper.forEach((l) => {
      const kendt = kendte.get(l.entity_id);
      const st = this._hass.states[l.entity_id];
      const gruppe = (kendt && kendt.gruppe) || (st && [].concat(st.attributes.group_entities || [], st.attributes.entity_id || [])) || [];
      gruppe.forEach((m) => medlemmer.add(m));
    });
    const liste = h("div", {});
    const raekke = (entityId, navn, under) => {
      const lampe = valgte.get(entityId);
      const valgt = !!lampe;
      const flueben = h("button", { class: "flueben" + (valgt ? " til" : ""), "aria-pressed": String(valgt), type: "button" }, valgt ? ikon("mdi:check") : null);
      flueben.addEventListener("click", () => {
        if (valgt) d.lamper = d.lamper.filter((l) => l.entity_id !== entityId);
        else d.lamper.push({ entity_id: entityId, bevaegelse: true });
        this._lamperAendret();
      });
      let foelger = null;
      if (valgt) {
        const kontakt = h("button", { class: "kontakt" + (lampe.bevaegelse ? " til" : ""), type: "button", "aria-pressed": String(lampe.bevaegelse) });
        kontakt.addEventListener("click", () => {
          lampe.bevaegelse = !lampe.bevaegelse;
          this._genTegn("lamper");
        });
        // Uden en sensor er der intet, der tænder ved bevægelse, så kontakten står der ikke. Valget er gemt og
        // kommer frem igen, den dag rummet får en sensor — vi slår det ikke fra, for så tændte lyset ikke.
        foelger = udenSensor ? null : h("label", { class: "kontaktfelt" }, this.t("taender_ved_bevaegelse"), kontakt);
      }
      // Lampens eget ikon. Tryk skifter det i Home Assistant — kun for lamper i entitetsregistret.
      let vist = rummetsIkoner(this._hass, [entityId], null)[0];
      const ikonEl = ikon(vist);
      const kanSkifte = !!(this._hass.entities && this._hass.entities[entityId]);
      const ikonKnap = h("button", { class: "lampeikon", type: "button", disabled: !kanSkifte, title: kanSkifte ? this.t("skift_ikon") : null, "aria-label": this.t("skift_ikon") }, ikonEl);
      if (kanSkifte) ikonKnap.addEventListener("click", () => this._lampeIkon(entityId, navn));
      this._levende.push((hass) => {
        const nyt = rummetsIkoner(hass, [entityId], null)[0];
        if (nyt === vist) return;
        vist = nyt;
        ikonEl.setAttribute("icon", nyt);
        // Rummets ikon under «Rummet» viser lampernes egne ikoner.
        setTimeout(() => this._genTegn("rummet"));
      });
      return h("div", { class: "raekke" }, flueben, ikonKnap, h("div", { class: "tx" }, h("b", {}, navn), under ? h("small", {}, under) : null), foelger);
    };
    omraade.lamper.forEach((l) => {
      if (medlemmer.has(l.entity_id) && !valgte.has(l.entity_id)) return;
      liste.appendChild(raekke(l.entity_id, l.navn, l.gruppe.length ? this.t("gruppe_med", { n: l.gruppe.length }) : ""));
    });
    d.lamper.forEach((l) => {
      if (kendte.has(l.entity_id)) return;
      const st = this._hass.states[l.entity_id];
      const andre = (this._lamper || []).find((a) => a.entity_id === l.entity_id);
      const omr = andre && andre.omraade ? this.t("fra_omraade", { omraade: andre.omraade }) : this.t("uden_omraade");
      liste.appendChild(raekke(l.entity_id, st ? st.attributes.friendly_name || l.entity_id : l.entity_id, omr));
    });
    if (!liste.children.length) liste.appendChild(h("p", { class: "hint" }, this.t("ingen_lamper")));
    const andre = h("button", { class: "knap t", onclick: () => this._andreLamper() }, ikon("mdi:plus"), this.t("vis_andre"));
    const udenSensorHint = udenSensor && d.lamper.length ? h("p", { class: "hint advarsel" }, this.t("bevaegelse_uden_sensor")) : null;
    return this._sektion(RUMLYS_IKON, this.t("lamper"), this.t("lamper_hint"), liste, udenSensorHint, andre, this._blodFelt());
  }

  // Lampens ikon hører til lampen, ikke til rummet: det gemmes med det samme i Home Assistants
  // entitetsregister og gælder overalt, også på kortene, når rummet viser lampernes egne ikoner.
  _lampeIkon(entityId, navn) {
    let valgt = (this._hass.entities[entityId] || {}).icon || "";
    const gem = (icon) => {
      this._hass.callWS({ type: "config/entity_registry/update", entity_id: entityId, icon: icon || null }).then(
        () => this._toast(this.t("ikon_gemt")),
        (e) => this._toast(this.t("ikon_ikke_gemt", { fejl: String((e && e.message) || e) }))
      );
    };
    this._dialog({
      titel: this.t("ikon_for", { navn }),
      indhold: [h("p", { class: "hint" }, this.t("ikon_lampe_hint")), this._ikonVaelger(valgt, (vaerdi) => { valgt = vaerdi; })],
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        { tekst: this.t("standard_ikon"), handling: () => gem(null) },
        { tekst: this.t("gem"), primaer: true, handling: () => gem(valgt) },
      ],
    });
  }

  // Blød tænd og sluk virker kun på lamper, der selv melder, at de kan (Home Assistant springer det
  // over for resten). Kan ingen af rummets lamper, er der ingen skyder.
  _blodFelt() {
    const d = this._kladde.data;
    if (!d.lamper.length) return null;
    const ikkeBlod = d.lamper
      .map((l) => this._hass.states[l.entity_id])
      .filter((st) => !st || !((st.attributes.supported_features || 0) & LYS_OVERGANG));
    if (ikkeBlod.length === d.lamper.length) {
      return h("div", { class: "felt", style: { marginTop: "14px" } }, h("label", {}, this.t("blod")), h("p", { class: "hint", style: { margin: "0" } }, this.t("blod_ingen")));
    }
    const vaerdi = h("output", {}, this.t("sek", { n: String(d.overgang || 0).replace(".", ",") }));
    const skyder = h("input", { type: "range", min: "0", max: "10", step: "0.5", value: String(d.overgang || 0), "aria-label": this.t("blod") });
    skyder.addEventListener("input", () => {
      d.overgang = Number(skyder.value);
      vaerdi.textContent = this.t("sek", { n: String(d.overgang).replace(".", ",") });
      this._aendret();
    });
    const navne = ikkeBlod.filter(Boolean).map((st) => st.attributes.friendly_name || st.entity_id);
    return h(
      "div",
      { class: "felt", style: { marginTop: "14px" } },
      h("label", {}, this.t("blod")),
      h("div", { class: "skyder" }, skyder, vaerdi),
      navne.length ? h("p", { class: "hint", style: { margin: "0" } }, this.t("virker_ikke", { lamper: navne.join(", ") })) : null
    );
  }

  async _andreLamper() {
    if (!this._lamper) this._lamper = await this._hass.callWS({ type: "rumlys/lamper" });
    const d = this._kladde.data;
    const iOmraadet = new Set(this._omraade(d.omraade).lamper.map((l) => l.entity_id));
    const soeg = h("input", { type: "search", placeholder: this.t("soeg") });
    const liste = h("div", { style: { marginTop: "8px" } });
    const tegn = () => {
      const q = soeg.value.trim().toLowerCase();
      liste.textContent = "";
      this._lamper
        .filter((l) => !iOmraadet.has(l.entity_id))
        .filter((l) => !q || (l.navn + " " + (l.omraade || "") + " " + l.entity_id).toLowerCase().indexOf(q) >= 0)
        .slice(0, 150)
        .forEach((l) => {
          const valgt = d.lamper.some((v) => v.entity_id === l.entity_id);
          const flueben = h("span", { class: "flueben" + (valgt ? " til" : "") }, valgt ? ikon("mdi:check") : null);
          const raekke = h("div", { class: "raekke", style: { cursor: "pointer" } }, flueben, h("div", { class: "tx" }, h("b", {}, l.navn), h("small", {}, l.omraade || this.t("uden_omraade"))));
          raekke.addEventListener("click", () => {
            if (valgt) d.lamper = d.lamper.filter((v) => v.entity_id !== l.entity_id);
            else d.lamper.push({ entity_id: l.entity_id, bevaegelse: true });
            tegn();
          });
          liste.appendChild(raekke);
        });
    };
    soeg.addEventListener("input", tegn);
    tegn();
    this._dialog({
      titel: this.t("lamper_andre"),
      indhold: [soeg, liste],
      knapper: [{ tekst: this.t("faerdig"), primaer: true, handling: () => this._lamperAendret() }],
    });
  }

  // Vægknapperne. En knap følger et af rummets kort og styrer præcis de lamper, kortet viser —
  // eller hele rummet, som er standarden. Hvad et tryk gør, er det samme for alle knapper.
  _sekKnapper() {
    const d = this._kladde.data;
    const knapper = d.knapper || [];
    const maal = d.knap_maal || {};
    const omraadets = this._omraade(d.omraade).knapper || [];
    // Kortene, en knap kan følge. Et kort for hele rummet er det samme som intet valg, og et
    // kort uden lamper er der intet at styre i.
    const kortene = this._kladde.kort || {};
    const kort = Object.keys(kortene).filter((id) => (kortene[id] || []).length);
    const liste = h("div", {});
    const raekke = (entityId, navn, under) => {
      const valgt = knapper.indexOf(entityId) >= 0;
      const flueben = h("button", { class: "flueben" + (valgt ? " til" : ""), type: "button", "aria-pressed": String(valgt), "aria-label": navn }, valgt ? ikon("mdi:check") : null);
      flueben.addEventListener("click", () => {
        if (valgt) {
          d.knapper = knapper.filter((k) => k !== entityId);
          d.knap_maal = uden(maal, entityId);
        } else d.knapper = knapper.concat([entityId]);
        this._genTegn("knapper");
      });
      // Tryk på knappen i rummet for at se, hvilken række den er. Navnene siger det sjældent selv.
      const pille = h("span", { class: "pille", style: { display: "none" } }, h("i", {}), this.t("knap_nede"));
      this._levende.push((hass) => {
        const st = hass.states[entityId];
        pille.style.display = st && st.state === "on" ? "" : "none";
      });
      let styrer = null;
      const egne = maal[entityId] && maal[entityId].lamper;
      if (valgt && (kort.length || egne)) {
        const vaelger = h("select", {});
        const tilfoejValg = (vaerdi, tekst) => vaelger.appendChild(h("option", { value: vaerdi }, tekst));
        tilfoejValg("", this.t("hele_rummet"));
        kort.forEach((id) => tilfoejValg(id, kortene[id].map((l) => this._lampeNavn(l)).join(", ")));
        // Kortet, knappen fulgte, er fjernet, og knappen har overtaget dets lamper.
        if (egne) tilfoejValg("egne", egne.map((l) => this._lampeNavn(l)).join(", "));
        vaelger.value = egne ? "egne" : (maal[entityId] && maal[entityId].kort) || "";
        vaelger.addEventListener("change", () => {
          if (!vaelger.value) d.knap_maal = uden(maal, entityId);
          else if (vaelger.value !== "egne") d.knap_maal = Object.assign({}, maal, { [entityId]: { kort: vaelger.value } });
          this._genTegn("knapper");
        });
        styrer = h("div", { class: "felt", style: { marginTop: "4px", width: "100%" } }, h("label", {}, this.t("styrer")), vaelger);
      }
      return h("div", { class: "raekke", style: { flexWrap: "wrap" } }, flueben, h("div", { class: "tx", style: { minWidth: "140px" } }, h("b", {}, navn), under ? h("small", {}, under) : null), pille, styrer);
    };
    omraadets.forEach((k) => liste.appendChild(raekke(k.entity_id, k.navn)));
    knapper.forEach((k) => {
      if (omraadets.some((o) => o.entity_id === k)) return;
      const st = this._hass.states[k];
      liste.appendChild(raekke(k, st ? st.attributes.friendly_name || k : k, this.t("uden_omraade")));
    });
    if (!liste.children.length) liste.appendChild(h("p", { class: "hint" }, this.t("ingen_knapper")));
    const advarsel = knapper.length ? h("p", { class: "hint advarsel" }, this.t("knap_overtaget")) : null;
    const andre = h("button", { class: "knap t", onclick: () => this._andreKnapper() }, ikon("mdi:plus"), this.t("vis_andre_knapper"));
    return this._sektion("mdi:gesture-tap-button", this.t("knapper"), this.t("knapper_hint"), liste, advarsel, andre);
  }

  async _andreKnapper() {
    if (!this._knapper) this._knapper = await this._hass.callWS({ type: "rumlys/knapper" });
    const d = this._kladde.data;
    const iOmraadet = new Set((this._omraade(d.omraade).knapper || []).map((k) => k.entity_id));
    const soeg = h("input", { type: "search", placeholder: this.t("soeg") });
    const liste = h("div", { style: { marginTop: "8px" } });
    const tegn = () => {
      const q = soeg.value.trim().toLowerCase();
      liste.textContent = "";
      this._knapper
        .filter((k) => !iOmraadet.has(k.entity_id))
        .filter((k) => !q || (k.navn + " " + (k.omraade || "") + " " + k.entity_id).toLowerCase().indexOf(q) >= 0)
        .slice(0, 150)
        .forEach((k) => {
          const valgt = (d.knapper || []).indexOf(k.entity_id) >= 0;
          const flueben = h("span", { class: "flueben" + (valgt ? " til" : "") }, valgt ? ikon("mdi:check") : null);
          const raekke = h("div", { class: "raekke", style: { cursor: "pointer" } }, flueben, h("div", { class: "tx" }, h("b", {}, k.navn), h("small", {}, k.omraade || this.t("uden_omraade"))));
          raekke.addEventListener("click", () => {
            if (valgt) {
              d.knapper = (d.knapper || []).filter((v) => v !== k.entity_id);
              d.knap_maal = uden(d.knap_maal || {}, k.entity_id);
            } else d.knapper = (d.knapper || []).concat([k.entity_id]);
            tegn();
          });
          liste.appendChild(raekke);
        });
    };
    soeg.addEventListener("input", tegn);
    tegn();
    this._dialog({
      titel: this.t("knapper_andre"),
      indhold: [soeg, liste],
      knapper: [{ tekst: this.t("faerdig"), primaer: true, handling: () => { this._genTegn("knapper"); this._aendret(); } }],
    });
  }

  _sekSensorer() {
    const d = this._kladde.data;
    const omraade = this._omraade(d.omraade);
    const liste = h("div", {});
    const raekke = (entityId, navn, under) => {
      const valgt = d.sensorer.indexOf(entityId) >= 0;
      const flueben = h("button", { class: "flueben" + (valgt ? " til" : ""), type: "button", "aria-pressed": String(valgt) }, valgt ? ikon("mdi:check") : null);
      flueben.addEventListener("click", () => {
        d.sensorer = valgt ? d.sensorer.filter((s) => s !== entityId) : d.sensorer.concat([entityId]);
        if (valgt) d.tilstede = (d.tilstede || []).filter((s) => s !== entityId);
        // Lamperne og tidsplanen viser også, om rummet har en sensor, så de skal med.
        this._genTegn("lamper", "sensorer", "tidsplan", "ingen");
      });
      const pille = h("span", { class: "pille", style: { display: "none" } }, h("i", {}), this.t("ser_nogen"));
      this._levende.push((hass) => {
        const st = hass.states[entityId];
        pille.style.display = st && st.state === "on" ? "" : "none";
      });
      let type = null;
      if (valgt) {
        const tilstede = (d.tilstede || []).indexOf(entityId) >= 0;
        type = h(
          "div",
          { class: "seg", role: "group", "aria-label": this.t("sensortype") },
          [[false, "bevaegelse_type"], [true, "tilstede_type"]].map(([vaerdi, noegle]) =>
            h("button", { type: "button", class: vaerdi === tilstede ? "til" : "", "aria-pressed": String(vaerdi === tilstede), onclick: () => this._saetSensortype(entityId, vaerdi) }, this.t(noegle))
          )
        );
      }
      // Sensorens egne lamper: uden valg tænder den alle, der tænder ved bevægelse. Vælges kun, når der er
      // mere end én at vælge imellem.
      let taender = null;
      const bevaegelsesLamper = d.lamper.filter((l) => l.bevaegelse !== false).map((l) => l.entity_id);
      if (valgt && bevaegelsesLamper.length > 1) {
        const egne = ((d.sensor_lamper || {})[entityId] || []).filter((l) => bevaegelsesLamper.indexOf(l) >= 0);
        const vaelger = h("select", {});
        const tilfoejValg = (vaerdi, tekst) => vaelger.appendChild(h("option", { value: vaerdi }, tekst));
        if (egne.length > 1) tilfoejValg("eget", egne.map((l) => this._lampeNavn(l)).join(", "));
        tilfoejValg("alle", this.t("alle_bevaegelseslamper"));
        bevaegelsesLamper.forEach((l) => tilfoejValg(l, this._lampeNavn(l)));
        if (bevaegelsesLamper.length > 2) tilfoejValg("flere", this.t("vaelg_lamper") + " …");
        vaelger.value = egne.length > 1 ? "eget" : egne.length === 1 ? egne[0] : "alle";
        const saet = (nye) => {
          const alle = Object.assign({}, d.sensor_lamper || {});
          if (!nye.length || nye.length === bevaegelsesLamper.length) delete alle[entityId];
          else alle[entityId] = nye;
          d.sensor_lamper = alle;
          this._genTegn("sensorer");
        };
        vaelger.addEventListener("change", () => {
          const v = vaelger.value;
          if (v === "flere") {
            this._vaelgLamper({
              titel: this.t("taender"),
              lamper: bevaegelsesLamper,
              valgte: egne.length ? egne : bevaegelsesLamper,
              gem: saet,
              fortryd: () => this._genTegn("sensorer"),
            });
            return;
          }
          saet(v === "alle" ? [] : [v]);
        });
        taender = h("div", { class: "felt", style: { marginTop: "4px", width: "100%" } }, h("label", {}, this.t("taender")), vaelger);
      }
      return h("div", { class: "raekke", style: { flexWrap: "wrap" } }, flueben, h("div", { class: "tx", style: { minWidth: "140px" } }, h("b", {}, navn), under ? h("small", {}, under) : null), pille, type, taender);
    };
    omraade.sensorer.forEach((s) => liste.appendChild(raekke(s.entity_id, s.navn)));
    d.sensorer.forEach((s) => {
      if (omraade.sensorer.some((o) => o.entity_id === s)) return;
      const st = this._hass.states[s];
      liste.appendChild(raekke(s, st ? st.attributes.friendly_name || s : s, this.t("uden_omraade")));
    });
    if (!liste.children.length) liste.appendChild(h("p", { class: "hint" }, this.t("ingen_sensorer")));
    return this._sektion("mdi:motion-sensor", this.t("sensorer"), this.t("sensorer_hint"), liste);
  }

  // Sensorens type giver den anbefalede tid, og tiden springer dertil. Den kan stadig sættes frit bagefter.
  _saetSensortype(entityId, tilstede) {
    const d = this._kladde.data;
    const andre = (d.tilstede || []).filter((s) => s !== entityId);
    d.tilstede = tilstede ? andre.concat([entityId]) : andre;
    this._kladde.indstillinger.sluk_efter_bevaegelse = this._anbefaletTid();
    this._genTegn("sensorer", "ingen");
  }

  // En tilstedeværelsessensor ser også den, der står stille, så lyset kan slukke kort efter, at rummet er tomt.
  _anbefaletTid() {
    const d = this._kladde.data;
    return d.sensorer.some((s) => (d.tilstede || []).indexOf(s) >= 0) ? ANBEFALET_TILSTEDE : ANBEFALET_BEVAEGELSE;
  }

  _lysknap(lys, vedValg) {
    const knap = h(
      "button",
      { class: "lysvalg", type: "button" },
      h("span", { class: "farve", style: { background: lysvalgBaggrund(lys, this._katalog) } }),
      h("span", { class: "tx" }, h("b", {}, beskrivLys(this._hass, lys, this._katalog))),
      ikon("mdi:chevron-right")
    );
    knap.addEventListener("click", () => this._vaelgLys(lys, vedValg));
    return knap;
  }

  _sekTidsplan() {
    const d = this._kladde.data;
    const vaelgHeleDoegnet = () => this._vaelgLys(d.lys, (lys) => { d.lys = lys; this._genTegn("tidsplan"); });
    const heleDoegnet = lysvalgBaggrund(d.lys, this._katalog);
    // Grænserne, hvor et andet tidsrum kan tage over. Imellem dem gælder det samme hele vejen.
    const graenser = [...new Set([0, 1440, ...d.tidsrum.flatMap((tr) => [minut(tr.start), minut(tr.slut)])])].sort((a, b) => a - b);
    const idag = (new Date().getDay() + 6) % 7;
    const uge = h("div", { class: "uge" });
    let nu = null;
    ALLE_DAGE.forEach((dag) => {
      const spor = h("div", { class: "spor", style: { background: heleDoegnet } });
      spor.addEventListener("click", (ev) => { if (ev.target === spor) vaelgHeleDoegnet(); });
      let plads = -1;
      let fra = 0;
      const blok = (til) => {
        if (plads < 0) return;
        const p = plads;
        const tr = d.tidsrum[p];
        const knap = h("button", { class: "blok", type: "button", style: { left: fra / 14.4 + "%", width: (til - fra) / 14.4 + "%", background: lysvalgBaggrund(tr.lys, this._katalog) } }, tr.navn);
        knap.addEventListener("click", () => this._retTidsrum(p));
        spor.appendChild(knap);
      };
      graenser.slice(0, -1).forEach((m) => {
        const hvem = d.tidsrum.findIndex((tr) => gaelder(tr, dag, m));
        if (hvem === plads) return;
        blok(m);
        plads = hvem;
        fra = m;
      });
      blok(1440);
      if (dag === idag) {
        nu = h("span", { class: "nu" });
        spor.appendChild(nu);
      }
      uge.append(h("span", { class: "dag" + (dag === idag ? " idag" : "") }, this.t("dag_" + dag)), spor);
    });
    // Klokkeslættene i samme gitter som dagene, så de står under sporene, uanset hvor lange navnene er.
    uge.append(h("span", {}), h("div", { class: "timer" }, ...["00", "06", "12", "18", "24"].map((t) => h("span", {}, t))));
    this._levende.push(() => {
      const n = new Date();
      nu.style.left = (n.getHours() * 60 + n.getMinutes()) / 14.4 + "%";
    });
    const liste = h("div", {});
    d.tidsrum.forEach((tr, plads) => {
      const raekke = h(
        "div",
        { class: "tidsraekke", "data-plads": String(plads) },
        h("span", { class: "greb", "aria-label": "⋮⋮" }, ikon("mdi:drag")),
        h("span", { class: "farve", style: { background: lysvalgBaggrund(tr.lys, this._katalog) } }),
        h("div", { class: "tx" }, h("b", {}, tr.navn), h("small", {}, [this._tider(tr), this._dageTekst(tr.dage), beskrivLys(this._hass, tr.lys, this._katalog)].join(" · "))),
        ikon("mdi:chevron-right")
      );
      raekke.addEventListener("click", (ev) => { if (!ev.target.closest(".greb")) this._retTidsrum(plads); });
      liste.appendChild(raekke);
    });
    sorterbar(liste, ".greb", (orden) => {
      d.tidsrum = orden.map((i) => d.tidsrum[i]);
      this._genTegn("tidsplan");
    });
    // Hele døgnet ligger altid nederst: det kan hverken slettes eller flyttes.
    const under = beskrivLys(this._hass, d.lys, this._katalog);
    const fast = h(
      "div",
      { class: "tidsraekke" },
      h("span", { class: "greb laast" }, ikon("mdi:lock-outline")),
      h("span", { class: "farve", style: { background: heleDoegnet } }),
      h("div", { class: "tx" }, h("b", {}, this.t("hele_doegnet")), h("small", {}, d.tidsrum.length ? this.t("naar_intet") + " · " + under : under)),
      ikon("mdi:chevron-right")
    );
    fast.addEventListener("click", vaelgHeleDoegnet);
    return this._sektion(
      "mdi:calendar-clock",
      this.t("tidsplan"),
      this.t("tidsplan_hint"),
      // Tidsrummets lys er det, en sensor tænder med. Uden sensor sker det aldrig, og så siger vi det.
      d.sensorer.length ? null : h("p", { class: "hint advarsel" }, this.t("tidsplan_uden_sensor")),
      uge,
      liste,
      fast,
      h("button", { class: "knap t", onclick: () => this._retTidsrum(null) }, ikon("mdi:plus"), this.t("tilfoej_tidsrum"))
    );
  }

  _tider(tr) {
    if (tr.start !== tr.slut) return tr.start.slice(0, 5) + "–" + tr.slut.slice(0, 5);
    return minut(tr.start) === 0 ? "00:00–24:00" : this.t("et_doegn_fra", { kl: tr.start.slice(0, 5) });
  }

  _dageTekst(dage) {
    const valgt = [...new Set(dage || ALLE_DAGE)].sort((a, b) => a - b);
    const noegle = valgt.join("");
    if (noegle === "0123456") return this.t("alle_dage");
    if (noegle === "01234") return this.t("hverdage");
    if (noegle === "56") return this.t("weekend");
    // På dansk skrives ugedage med lille inde i teksten: Mandag, onsdag og fredag.
    const navn = (dag) => (sprog(this._hass) === "da" ? this.t("dag_" + dag).toLowerCase() : this.t("dag_" + dag));
    // Tre dage eller flere i træk skrives som et spænd, fx mandag–onsdag.
    const dele = [];
    for (let i = 0; i < valgt.length; ) {
      let j = i;
      while (j + 1 < valgt.length && valgt[j + 1] === valgt[j] + 1) j++;
      if (j - i >= 2) dele.push(navn(valgt[i]) + "–" + navn(valgt[j]));
      else valgt.slice(i, j + 1).forEach((dag) => dele.push(navn(dag)));
      i = j + 1;
    }
    const tekst = dele.join(", ");
    return tekst.charAt(0).toUpperCase() + tekst.slice(1);
  }

  _retTidsrum(plads) {
    const d = this._kladde.data;
    const ny = plads === null;
    const tr = ny
      ? { navn: "", start: "22:00:00", slut: "06:30:00", lys: Object.assign(kopi(d.lys), { lysstyrke: 20 }) }
      : kopi(d.tidsrum[plads]);
    const navn = h("input", { type: "text", value: tr.navn, placeholder: this.t("navn_hint") });
    const fra = h("input", { type: "time", value: tr.start.slice(0, 5) });
    const til = h("input", { type: "time", value: tr.slut.slice(0, 5) });
    const midnat = h("p", { class: "hint" });
    const fejl = h("p", { class: "fejl" });
    const visMidnat = () => {
      if (!fra.value || !til.value) midnat.textContent = "";
      else if (til.value === fra.value) midnat.textContent = this.t("et_doegn");
      else midnat.textContent = til.value < fra.value ? this.t("over_midnat") : "";
    };
    fra.addEventListener("input", visMidnat);
    til.addEventListener("input", visMidnat);
    visMidnat();
    let dage = (tr.dage || ALLE_DAGE).slice();
    const dagvalg = h("div", { class: "dagvalg" });
    const tegnDage = () => {
      dagvalg.textContent = "";
      ALLE_DAGE.forEach((dag) => {
        const valgt = dage.includes(dag);
        const knap = h("button", { class: "dagknap" + (valgt ? " til" : ""), type: "button", "aria-pressed": String(valgt), title: this.t("dag_" + dag) }, this.t("kort_dag_" + dag));
        knap.addEventListener("click", () => {
          dage = valgt ? dage.filter((v) => v !== dag) : dage.concat([dag]);
          tegnDage();
        });
        dagvalg.appendChild(knap);
      });
    };
    tegnDage();
    const genveje = h(
      "div",
      { class: "genveje" },
      [["alle_dage", ALLE_DAGE], ["hverdage", [0, 1, 2, 3, 4]], ["weekend", [5, 6]]].map(([noegle, valg]) =>
        h("button", { class: "knap", type: "button", onclick: () => { dage = valg.slice(); tegnDage(); } }, this.t(noegle))
      )
    );
    const lysPlads = h("div", {});
    const tegnLys = () => {
      lysPlads.textContent = "";
      lysPlads.appendChild(this._lysknap(tr.lys, (lys) => { tr.lys = lys; tegnLys(); }));
    };
    tegnLys();
    let egen = tr.sluk_efter !== undefined && tr.sluk_efter !== null;
    let slukEfter = egen ? tr.sluk_efter : 60;
    const trinPlads = h("div", {});
    const kontakt = h("button", { class: "kontakt" + (egen ? " til" : ""), type: "button" });
    const tegnTrin = () => {
      trinPlads.textContent = "";
      kontakt.className = "kontakt" + (egen ? " til" : "");
      if (egen) trinPlads.appendChild(trinvalg([10, 20, 30, 45, 60, 90, 120, 300, 600, 900, 1800], slukEfter, (v) => this._sekunder(v), (v) => { slukEfter = v; }));
    };
    kontakt.addEventListener("click", () => { egen = !egen; tegnTrin(); });
    tegnTrin();
    const indhold = [
      h("div", { class: "felt" }, h("label", {}, this.t("navn")), navn),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
        h("div", { class: "felt" }, h("label", {}, this.t("fra")), fra),
        h("div", { class: "felt" }, h("label", {}, this.t("til")), til)),
      midnat,
      h("div", { class: "felt", style: { marginBottom: "0" } }, h("label", {}, this.t("dage")), dagvalg),
      genveje,
      h("div", { class: "felt" }, h("label", {}, this.t("lys")), lysPlads),
      h("div", { class: "naar", style: { borderTop: "0" } },
        h("div", { class: "tx" }, h("b", {}, this.t("egen_slukketid")), h("small", {}, this.t("egen_slukketid_hint"))),
        trinPlads, kontakt),
      fejl,
    ];
    const slet = ny ? null : h("button", {
      class: "knap farlig",
      onclick: () => {
        d.tidsrum.splice(plads, 1);
        this._genTegn("tidsplan");
        luk();
      },
    }, this.t("slet"));
    const luk = this._dialog({
      titel: this.t("tidsrum"),
      indhold,
      venstre: slet,
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        {
          tekst: this.t("gem"),
          primaer: true,
          handling: () => {
            if (!navn.value.trim()) { fejl.textContent = this.t("mangler_navn"); return false; }
            if (!fra.value || !til.value) { fejl.textContent = this.t("mangler_tid"); return false; }
            if (!dage.length) { fejl.textContent = this.t("mangler_dage"); return false; }
            const nyt = { navn: navn.value.trim(), start: fra.value + ":00", slut: til.value + ":00", dage: dage.sort((a, b) => a - b), lys: tr.lys };
            if (egen) nyt.sluk_efter = slukEfter;
            if (ny) d.tidsrum.push(nyt);
            else d.tidsrum[plads] = nyt;
            this._genTegn("tidsplan");
            return true;
          },
        },
      ],
    });
  }

  _sekunder(v) {
    if (v >= 60 && v % 60 === 0) return this.t("min", { n: v / 60 });
    if (v >= 60) return this.t("min", { n: String(Math.round((v / 60) * 10) / 10).replace(".", ",") });
    return this.t("sek", { n: v });
  }

  _sekIngen() {
    const ind = this._kladde.indstillinger;
    const anbefalet = this._anbefaletTid();
    // Uden sensor er der intet, der tænder lyset, så tiden for automatisk lys står der ikke. Den er gemt og
    // kommer frem igen med sin værdi, den dag rummet får en sensor.
    const udenSensor = !this._kladde.data.sensorer.length;
    const anbefaling = h("small", { style: { display: "block" } }, this.t(anbefalet === ANBEFALET_TILSTEDE ? "anb_tilstede" : "anb_bevaegelse", { tid: this._sekunder(anbefalet) }));
    const auto = trinvalg([0, 10, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800], ind.sluk_efter_bevaegelse, (v) => this._sekunder(v), (v) => { ind.sluk_efter_bevaegelse = v; this._aendret(); });
    const valgt = trinvalg([0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120], ind.sluk_efter_tryk, (v) => (v === 0 ? this.t("aldrig") : v >= 60 && v % 60 === 0 ? this.t("timer", { n: v / 60 }) : this.t("min", { n: v })), (v) => { ind.sluk_efter_tryk = v; this._aendret(); });
    return this._sektion(
      "mdi:motion-sensor-off",
      this.t("ingen_i_rummet"),
      this.t(udenSensor ? "ingen_hint_uden_sensor" : "ingen_hint"),
      udenSensor ? null : h("div", { class: "naar" }, h("div", { class: "tx" }, h("b", {}, this.t("auto_lys")), h("small", {}, this.t("auto_sub")), anbefaling), auto),
      h("div", { class: "naar" }, h("div", { class: "tx" }, h("b", {}, this.t("valgt_lys")), h("small", {}, this.t("valgt_sub"))), valgt)
    );
  }

  _sekHold() {
    const ind = this._kladde.indstillinger;
    const tid = trinvalg([0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 24], ind.hold_tid, (v) => this.t("timer", { n: String(v).replace(".", ",") }), (v) => { ind.hold_tid = v; this._aendret(); });
    return this._sektion(
      "mdi:lock-clock",
      this.t("hold"),
      this.t("hold_hint"),
      h("div", { class: "naar" }, h("div", { class: "tx" }, h("b", {}, this.t("hold_i"))), tid)
    );
  }

  _scenefelt(scene, medFjern, vedFjern) {
    const felt = h("div", { class: "scenefelt", role: "img", "aria-label": sceneNavn(this._hass, scene) });
    felt.style.background = scene.billede ? "center / cover no-repeat url('" + scene.billede + "')" : overgang(sceneFarver(scene), "135deg");
    felt.appendChild(h("span", {}, sceneNavn(this._hass, scene)));
    if (medFjern) {
      felt.appendChild(h("button", { class: "fjern", type: "button", "aria-label": this.t("slet"), onclick: (ev) => { ev.stopPropagation(); vedFjern(); } }, ikon("mdi:close")));
    }
    return felt;
  }

  _sekHaendelser() {
    const alle = (this._detalje.status.haendelser || []).slice().reverse();
    const vis = this._visAlle ? alle : alle.slice(0, 8);
    const liste = h("div", {});
    vis.forEach((hd) => {
      liste.appendChild(h("div", { class: "haendelse" }, h("time", {}, klokken(this._hass, hd.tid, true)), h("span", {}, haendelseTekst(this._hass, hd))));
    });
    const flere = alle.length > vis.length
      ? h("button", { class: "knap t", onclick: () => { this._visAlle = true; this._genTegn("haendelser"); } }, this.t("vis_alle"))
      : null;
    return this._sektion(
      "mdi:history",
      this.t("haendelser"),
      this.t("haendelser_hint"),
      alle.length ? liste : h("p", { class: "hint" }, this.t("ingen_haendelser")),
      flere
    );
  }

  /* ---------- lysvælgeren ---------- */

  _vaelgLys(lys, vedValg) {
    const d = this._kladde.data;
    const lamper = d.lamper.map((l) => l.entity_id);
    const [kMin, kMax] = kelvinGraenser(this._hass, lamper);
    const vaerdi = kopi(lys || { type: "hvid", lysstyrke: 100, kelvin: 3000 });
    if (!vaerdi.lysstyrke) vaerdi.lysstyrke = 100;
    let fane = vaerdi.type;
    const forhaand = h("div", { class: "forhaand" });
    const faner = h("div", { class: "faner", role: "tablist" });
    const flade = h("div", {});
    const lysstyrkeUd = h("output", {});
    const lysstyrke = h("input", { type: "range", min: "1", max: "100", value: String(vaerdi.lysstyrke), "aria-label": this.t("lysstyrke") });
    const opdater = () => {
      vaerdi.lysstyrke = Number(lysstyrke.value);
      lysstyrkeUd.textContent = vaerdi.lysstyrke + " %";
      forhaand.style.background = lysvalgBaggrund(vaerdi, this._katalog);
      forhaand.style.filter = "brightness(" + (0.55 + vaerdi.lysstyrke / 222) + ")";
      forhaand.textContent = beskrivLys(this._hass, vaerdi, this._katalog);
    };
    lysstyrke.addEventListener("input", opdater);
    const tegnFlade = () => {
      flade.textContent = "";
      [...faner.children].forEach((b) => b.classList.toggle("valgt", b.dataset.fane === fane));
      if (fane === "scene") {
        if (!this._katalog.scener.length) {
          flade.appendChild(h("p", { class: "hint" }, this.t("ingen_katalog")));
        } else {
          const soeg = h("input", { type: "search", placeholder: this.t("soeg") });
          const gitterPlads = h("div", {});
          const tegnScener = () => {
            const q = soeg.value.trim().toLowerCase();
            gitterPlads.textContent = "";
            const gitter = h("div", { class: "scenegitter", style: { marginTop: "8px" } });
            const standard = this._katalog.scener.filter((s) => STANDARDSCENER.indexOf(s.id) >= 0).sort((a, b) => STANDARDSCENER.indexOf(a.id) - STANDARDSCENER.indexOf(b.id));
            const oevrige = this._katalog.scener.filter((s) => STANDARDSCENER.indexOf(s.id) < 0);
            [...standard, ...oevrige]
              .filter((s) => !q || (sceneNavn(this._hass, s) + " " + s.navn + " " + s.kategori + " " + kategoriNavn(this._hass, s.kategori)).toLowerCase().indexOf(q) >= 0)
              .forEach((s) => {
                const felt = this._scenefelt(s, false);
                if (vaerdi.type === "scene" && vaerdi.scene === s.id) felt.classList.add("valgt");
                felt.addEventListener("click", () => {
                  vaerdi.type = "scene";
                  vaerdi.scene = s.id;
                  delete vaerdi.kelvin;
                  delete vaerdi.farve;
                  lysstyrke.value = String(Math.max(1, Math.round((s.bri / 255) * 100)));
                  opdater();
                  gitter.querySelectorAll(".scenefelt").forEach((f) => f.classList.remove("valgt"));
                  felt.classList.add("valgt");
                });
                gitter.appendChild(felt);
              });
            gitterPlads.appendChild(gitter);
          };
          soeg.addEventListener("input", tegnScener);
          tegnScener();
          flade.append(soeg, gitterPlads);
        }
      } else if (fane === "farve") {
        if (vaerdi.type !== "farve" || !Array.isArray(vaerdi.farve)) {
          // Fanen viser straks en farve, så «Vælg» aldrig vælger det, der stod før.
          vaerdi.type = "farve";
          vaerdi.farve = [30, 70];
          delete vaerdi.kelvin;
          delete vaerdi.scene;
        }
        const hjul = h("div", { class: "hjul", role: "img", "aria-label": this.t("farve") });
        const prik = h("span", { class: "prik" });
        hjul.appendChild(prik);
        const placer = () => {
          if (!Array.isArray(vaerdi.farve)) { prik.style.display = "none"; return; }
          prik.style.display = "";
          const vinkel = (vaerdi.farve[0] * Math.PI) / 180;
          const r = (vaerdi.farve[1] / 100) * 100;
          prik.style.left = 100 + Math.sin(vinkel) * r + "px";
          prik.style.top = 100 - Math.cos(vinkel) * r + "px";
          prik.style.background = css(hsRgb(vaerdi.farve[0], vaerdi.farve[1]));
        };
        const vaelg = (ev) => {
          const r = hjul.getBoundingClientRect();
          const dx = ev.clientX - (r.left + r.width / 2);
          const dy = ev.clientY - (r.top + r.height / 2);
          const nuanceGrad = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
          const maetning = Math.min(100, Math.round((Math.hypot(dx, dy) / (r.width / 2)) * 100));
          vaerdi.type = "farve";
          vaerdi.farve = [nuanceGrad, maetning];
          delete vaerdi.kelvin;
          delete vaerdi.scene;
          placer();
          opdater();
        };
        hjul.addEventListener("pointerdown", (ev) => { hjul.setPointerCapture(ev.pointerId); vaelg(ev); });
        hjul.addEventListener("pointermove", (ev) => { if (ev.buttons) vaelg(ev); });
        placer();
        flade.append(hjul, h("p", { class: "hint", style: { textAlign: "center" } }, this.t("tryk_hjul")));
      } else if (fane === "hvid") {
        const trin = [];
        for (let i = 0; i <= 6; i++) trin.push(css(hueFarve(kMin + ((kMax - kMin) * i) / 6)) + " " + Math.round((i * 100) / 6) + "%");
        const knop = h("span", { class: "knop" });
        const k = h("input", { type: "range", min: String(kMin), max: String(kMax), step: "50", value: String(vaerdi.kelvin || 3000), "aria-label": this.t("hvidt") });
        const kUd = h("span", {});
        const placer = () => {
          const kelvin = Number(k.value);
          knop.style.left = ((kelvin - kMin) / (kMax - kMin)) * 100 + "%";
          knop.style.background = css(hueFarve(kelvin));
          kUd.textContent = kelvin + " K";
        };
        k.addEventListener("input", () => {
          vaerdi.type = "hvid";
          vaerdi.kelvin = Number(k.value);
          delete vaerdi.farve;
          delete vaerdi.scene;
          placer();
          opdater();
        });
        if (vaerdi.type !== "hvid") {
          vaerdi.type = "hvid";
          vaerdi.kelvin = Number(k.value);
          delete vaerdi.farve;
          delete vaerdi.scene;
        }
        placer();
        flade.append(h("div", { class: "hvid", style: { background: "linear-gradient(90deg, " + trin.join(", ") + ")" } }, k, knop), h("div", { class: "skala" }, h("span", {}, this.t("varm")), kUd, h("span", {}, this.t("kold"))));
      } else {
        vaerdi.type = "lysstyrke";
        delete vaerdi.kelvin;
        delete vaerdi.farve;
        delete vaerdi.scene;
        flade.appendChild(h("p", { class: "hint" }, this.t("kun_hint")));
      }
      opdater();
    };
    // Kun det, rummets lamper kan — samme regel som kortet. Lysstyrke er der altid.
    const hvid = kanHvid(this._hass, lamper);
    const kan = { scene: hvid, farve: kanFarve(this._hass, lamper), hvid, lysstyrke: true };
    [["scene", "scene"], ["farve", "farve"], ["hvid", "hvidt"], ["lysstyrke", "kun"]].forEach(([id, navn]) => {
      if (!kan[id]) return;
      const knap = h("button", { type: "button", role: "tab" }, this.t(navn));
      knap.dataset.fane = id;
      knap.addEventListener("click", () => { fane = id; tegnFlade(); });
      faner.appendChild(knap);
    });
    if (!kan[fane]) fane = "lysstyrke";
    tegnFlade();
    this._dialog({
      titel: this.t("vaelg_lys"),
      bred: true,
      indhold: [
        forhaand,
        faner,
        flade,
        h("div", { class: "felt", style: { marginTop: "14px" } }, h("label", {}, this.t("lysstyrke")), h("div", { class: "skyder" }, lysstyrke, lysstyrkeUd)),
      ],
      knapper: [
        { tekst: this.t("annuller"), handling: () => {} },
        {
          tekst: this.t("vaelg"),
          primaer: true,
          handling: () => {
            if (vaerdi.type === "farve" && !Array.isArray(vaerdi.farve)) return false;
            if (vaerdi.type === "scene" && !vaerdi.scene) return false;
            vedValg(vaerdi);
            return true;
          },
        },
      ],
    });
  }
}

// En side, der står åben under en opdatering, indlæser den nye fil oven i den gamle. Uden vagten her kaster
// `define` en fejl, og siden går i stå — nu bliver den bare stående på forrige version, til den genindlæses.
if (!customElements.get("rumlys-panel")) customElements.define("rumlys-panel", RumlysPanel);
console.info("%c RUMLYS %c " + VERSION + " ", "color:#fff;background:#F5A623;font-weight:700;border-radius:3px 0 0 3px", "color:#fff;background:#3373A3;font-weight:700;border-radius:0 3px 3px 0");
