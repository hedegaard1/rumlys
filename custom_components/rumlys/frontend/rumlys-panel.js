/*
  Rumlys i sidepanelet: al opsætning af et rum samlet ét sted, kun for administratorer.
  Oversigten viser alle rum og det, de gør lige nu; et rums side har lamper, sensorer,
  tidsplanen, tiderne, «hold lys», scenerne på kortet og de seneste hændelser.
*/

import {
  OPDATERET,
  STANDARDSCENER,
  VERSION,
  beskrivLys,
  h,
  haendelseTekst,
  hentScener,
  hsRgb,
  hueFarve,
  ikon,
  kategoriNavn,
  kelvinGraenser,
  klokken,
  lysvalgBaggrund,
  meldOpdateret,
  overgang,
  rummetsFarver,
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
.rumfelt .meta { font-size: 12px; color: var(--rl-daempet); margin-top: 6px; }
.rumfelt.nyt { border: 2px dashed var(--rl-linje); background: transparent; box-shadow: none; align-items: center; justify-content: center; min-height: 140px; color: var(--rl-p); font-weight: 600; gap: 6px; }

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
.flueben ha-icon { --mdc-icon-size: 16px; }
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

function kopi(v) {
  return JSON.parse(JSON.stringify(v));
}

// Ugedagene, mandag = 0, som Rumlys gemmer dem.
const ALLE_DAGE = [0, 1, 2, 3, 4, 5, 6];

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
  }

  disconnectedCallback() {
    clearInterval(this._ur);
    window.removeEventListener(OPDATERET, this._vedOpdatering);
  }

  t(noegle, vaerdier) {
    return tekst(this._hass, noegle, vaerdier);
  }

  async _start() {
    hentScener().then((k) => {
      this._katalog = k;
      if (this._aktiv && this._kladde) this._tegnRum();
    });
    await this._hentListe();
    this._visSide();
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
      return;
    }
    this._levende = [];
    this._tegnRamme(this._navnPaaAktivt(), h("div", { class: "besked" }, "…"), true);
    try {
      await Promise.all([this._hentRum(this._aktiv), this._hentOmraader()]);
      this._tegnRum();
    } catch (e) {
      this._tegnRamme("", h("div", { class: "besked" }, this.t("kan_ikke_hentes")));
    }
  }

  _navnPaaAktivt() {
    const rum = (this._liste || []).find((r) => r.id === this._aktiv);
    return rum ? rum.navn : "";
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
    this._kladde = { data: kopi(this._detalje.data), indstillinger: kopi(status.indstillinger) };
    this._original = JSON.stringify(this._kladde);
  }

  /* ---------- ramme ---------- */

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
  }

  _tilbage() {
    if (this._erAendret() && !window.confirm(this.t("ikke_gemt"))) return;
    naviger("/rumlys");
  }

  _toast(besked) {
    const el = h("div", { class: "toast" }, besked);
    this.shadowRoot.appendChild(el);
    setTimeout(() => el.remove(), 2400);
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
    const nyKnap = h("button", { class: "knap p", onclick: () => this._nytRum() }, ikon("mdi:plus"), this.t("nyt_rum"));
    indhold.appendChild(h("div", { class: "overskrift" }, h("h1", {}, this.t("titel")), this._fejl ? null : nyKnap));
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
    const felt = h(
      "button",
      { class: "rumfelt", onclick: () => naviger("/rumlys/" + rum.id) },
      farve,
      h("div", { class: "tekst" }, h("b", {}, rum.navn), status, h("div", { class: "meta" }, dele.join(" · ")))
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
        const raekke = h(
          "div",
          { class: "raekke", style: { opacity: optaget ? 0.5 : 1, cursor: optaget ? "default" : "pointer" } },
          h("span", { class: "flueben" + (valgt === o.id ? " til" : "") }, valgt === o.id ? ikon("mdi:check") : null),
          h("div", { class: "tx" }, h("b", {}, o.navn), h("small", {}, optaget ? this.t("har_rum") : [this.t("lamper_n", { n: o.lamper.length }), this.t("sensorer_n", { n: o.sensorer.length })].join(" · ")))
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
      ["lamper", () => this._sekLamper()],
      ["sensorer", () => this._sekSensorer()],
      ["tidsplan", () => this._sekTidsplan()],
      ["ingen", () => this._sekIngen()],
      ["hold", () => this._sekHold()],
      ["scener", () => this._sekScener()],
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
    return (this._omraader || []).find((o) => o.id === id) || { lamper: [], sensorer: [], navn: "" };
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
        this._genTegn("lamper");
      });
      let foelger = null;
      if (valgt) {
        const kontakt = h("button", { class: "kontakt" + (lampe.bevaegelse ? " til" : ""), type: "button", "aria-pressed": String(lampe.bevaegelse) });
        kontakt.addEventListener("click", () => {
          lampe.bevaegelse = !lampe.bevaegelse;
          this._genTegn("lamper");
        });
        foelger = h("label", { class: "kontaktfelt" }, this.t("taender_ved_bevaegelse"), kontakt);
      }
      return h("div", { class: "raekke" }, flueben, h("div", { class: "tx" }, h("b", {}, navn), under ? h("small", {}, under) : null), foelger);
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
    const vaerdi = h("output", {}, this.t("sek", { n: String(d.overgang || 0).replace(".", ",") }));
    const skyder = h("input", { type: "range", min: "0", max: "10", step: "0.5", value: String(d.overgang || 0), "aria-label": this.t("blod") });
    skyder.addEventListener("input", () => {
      d.overgang = Number(skyder.value);
      vaerdi.textContent = this.t("sek", { n: String(d.overgang).replace(".", ",") });
      this._aendret();
    });
    return this._sektion(
      "mdi:lightbulb-group-outline",
      this.t("lamper"),
      this.t("lamper_hint"),
      liste,
      andre,
      h("div", { class: "felt", style: { marginTop: "14px" } }, h("label", {}, this.t("blod")), h("div", { class: "skyder" }, skyder, vaerdi))
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
      knapper: [{ tekst: this.t("faerdig"), primaer: true, handling: () => this._genTegn("lamper") }],
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
        this._genTegn("sensorer");
      });
      const pille = h("span", { class: "pille", style: { display: "none" } }, h("i", {}), this.t("ser_nogen"));
      this._levende.push((hass) => {
        const st = hass.states[entityId];
        pille.style.display = st && st.state === "on" ? "" : "none";
      });
      return h("div", { class: "raekke" }, flueben, h("div", { class: "tx" }, h("b", {}, navn), under ? h("small", {}, under) : null), pille);
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
    const auto = trinvalg([0, 10, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800], ind.sluk_efter_bevaegelse, (v) => this._sekunder(v), (v) => { ind.sluk_efter_bevaegelse = v; this._aendret(); });
    const valgt = trinvalg([0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120], ind.sluk_efter_tryk, (v) => (v === 0 ? this.t("aldrig") : v >= 60 && v % 60 === 0 ? this.t("timer", { n: v / 60 }) : this.t("min", { n: v })), (v) => { ind.sluk_efter_tryk = v; this._aendret(); });
    return this._sektion(
      "mdi:motion-sensor-off",
      this.t("ingen_i_rummet"),
      this.t("ingen_hint"),
      h("div", { class: "naar" }, h("div", { class: "tx" }, h("b", {}, this.t("auto_lys")), h("small", {}, this.t("auto_sub"))), auto),
      h("div", { class: "naar" }, h("div", { class: "tx" }, h("b", {}, this.t("valgt_lys")), h("small", {}, this.t("valgt_sub"))), valgt)
    );
  }

  _sekHold() {
    const ind = this._kladde.indstillinger;
    const e = this._detalje.entiteter;
    const status = h("small", {});
    const knap = h("button", { class: "knap" });
    knap.addEventListener("click", () => {
      const st = this._hass.states[e.hold];
      this._hass.callService("switch", st && st.state === "on" ? "turn_off" : "turn_on", { entity_id: e.hold });
    });
    this._levende.push((hass) => {
      const st = hass.states[e.hold];
      const til = st && st.state === "on";
      status.textContent = til && st.attributes.slutter ? this.t("hold_til", { kl: klokken(hass, st.attributes.slutter) }) : this.t("hold_fra_nu");
      knap.textContent = this.t(til ? "slaa_fra" : "hold_lys");
    });
    const tid = trinvalg([0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 24], ind.hold_tid, (v) => this.t("timer", { n: String(v).replace(".", ",") }), (v) => { ind.hold_tid = v; this._aendret(); });
    return this._sektion(
      "mdi:lock-clock",
      this.t("hold"),
      this.t("hold_hint"),
      h("div", { class: "naar" }, h("div", { class: "tx" }, h("b", {}, this.t("hold_i")), status), tid),
      knap
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

  _sekScener() {
    const d = this._kladde.data;
    const gitter = h("div", { class: "scenegitter" });
    d.scener.forEach((id, plads) => {
      const scene = this._katalog.efterId[id] || { id, navn: id, billede: null, punkter: [] };
      const felt = this._scenefelt(scene, true, () => {
        d.scener = d.scener.filter((s) => s !== id);
        this._genTegn("scener");
      });
      felt.dataset.plads = String(plads);
      gitter.appendChild(felt);
    });
    sorterbar(gitter, ".scenefelt", (orden) => {
      d.scener = orden.map((i) => d.scener[i]);
      this._genTegn("scener");
    });
    return this._sektion(
      "mdi:palette-outline",
      this.t("scener_paa_kortet"),
      this.t("scener_hint"),
      d.scener.length ? gitter : h("p", { class: "hint" }, this.t("ingen_scener")),
      h("button", { class: "knap t", onclick: () => this._tilfoejScener() }, ikon("mdi:plus"), this.t("tilfoej_scener"))
    );
  }

  _tilfoejScener() {
    const d = this._kladde.data;
    if (!d.scener.length && !this._katalog.scener.length) {
      this._toast(this.t("ingen_katalog"));
      return;
    }
    const valgte = new Set(d.scener);
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
            const nye = this._katalog.scener.map((s) => s.id).filter((id) => valgte.has(id) && d.scener.indexOf(id) < 0);
            d.scener = d.scener.filter((id) => valgte.has(id)).concat(nye);
            this._genTegn("scener");
          },
        },
      ],
    });
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
    [["scene", "scene"], ["farve", "farve"], ["hvid", "hvidt"], ["lysstyrke", "kun"]].forEach(([id, navn]) => {
      const knap = h("button", { type: "button", role: "tab" }, this.t(navn));
      knap.dataset.fane = id;
      knap.addEventListener("click", () => { fane = id; tegnFlade(); });
      faner.appendChild(knap);
    });
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

customElements.define("rumlys-panel", RumlysPanel);
console.info("%c RUMLYS %c " + VERSION + " ", "color:#fff;background:#F5A623;font-weight:700;border-radius:3px 0 0 3px", "color:#fff;background:#3373A3;font-weight:700;border-radius:0 3px 3px 0");
