/*
  Rumlys-kortet: lyset i ét rum til hverdag. Baggrunden viser lampernes farver, skyderen dæmper
  alle rummets lamper i samme forhold, knappen holder lyset tændt med nedtælling, og rummets
  scener står i bunden. Tryk på kortet åbner menuen med lysstyrke, hvidt lys, farve, scener og
  hver lampe for sig. Kortets opsætning er kun rummet og udseendet; resten — også ikonet — hentes
  fra Rumlys.
  Bygget på Room Light Card 2.3.0.
*/

import {
  OPDATERET,
  RUMLYS_IKON,
  VERSION,
  css,
  erRummetsKort,
  fanensKort,
  fordelLamper,
  h,
  hentScener,
  hueFarve,
  ikonStak,
  kanFarve,
  kanHvid,
  kelvinGraenser,
  kortNavn,
  luminans,
  lysFarve,
  meldOpdateret,
  nytKortId,
  overgang,
  paerer,
  restTekst,
  rummetsFarver,
  rummetsIkoner,
  sceneFarver,
  sceneNavn,
  tekst,
} from "./rumlys-faelles.js";

const NAVN = "rumlys-card";
// Så bred skal skyderen mindst kunne være mellem ikonerne og knapperne; ellers kommer den under.
const SKYDER_MIN = 100;
const FARVE_TILSTANDE = ["xy", "hs", "rgb", "rgbw"];

/* ---------- rummene ---------- */

let rumLoefte = null;

// Rummene fra Rumlys. Hentes én gang pr. side og igen, når sidepanelet har gemt et rum.
function hentRum(hass) {
  if (!rumLoefte) {
    rumLoefte = hass.callWS({ type: "rumlys/rum/liste" }).catch((e) => {
      rumLoefte = null;
      throw e;
    });
  }
  return rumLoefte;
}

window.addEventListener(OPDATERET, () => { rumLoefte = null; });

// Hvornår hvert rums kort sidst er ændret, som tilstandssensoren viser det. Ændres det — fx fra sidepanelet på
// en anden skærm — hentes rummene igen, én gang for alle kort på siden.
const kortTider = {};

function tjekKortTid(hass, rum) {
  const st = hass.states[rum.entiteter.tilstand];
  const tid = st ? st.attributes.kort_opdateret : undefined;
  if (tid === undefined) return;
  if (rum.id in kortTider && kortTider[rum.id] !== tid) meldOpdateret(rum.id);
  kortTider[rum.id] = tid;
}

/* ---------- fanen, kortet står på ---------- */

// Kortet ser selv efter, om rummet har andre kort på fanen, så et kort, der er sat ind direkte på
// betjeningspanelet, aldrig styrer de samme lamper som et andet — også før nogen har åbnet Rumlys.
const PANEL_GEMT = "rumlys-panel-gemt";
let panelLoefter = {};
let lytterPaaPaneler = false;
let lytterPaaForbindelse = false;

function glemPaneler() {
  panelLoefter = {};
  window.dispatchEvent(new CustomEvent(PANEL_GEMT));
}

// Betjeningspanelets opsætning: én gang pr. side for alle kort, og igen når et panel gemmes.
function hentPanel(hass, urlPath) {
  if (!lytterPaaPaneler && hass.connection) {
    lytterPaaPaneler = true;
    hass.connection.subscribeEvents(glemPaneler, "lovelace_updated").catch(() => { lytterPaaPaneler = false; });
  }
  // Efter en afbrudt forbindelse — fx en genstart — kan et panel være gemt imens, eller et tjek være mislykket.
  if (!lytterPaaForbindelse && hass.connection) {
    lytterPaaForbindelse = true;
    hass.connection.addEventListener("ready", glemPaneler);
  }
  const noegle = urlPath || "";
  if (!panelLoefter[noegle]) {
    panelLoefter[noegle] = hass.callWS({ type: "lovelace/config", url_path: urlPath }).catch((e) => {
      delete panelLoefter[noegle];
      throw e;
    });
  }
  return panelLoefter[noegle];
}

// Betjeningspanelet og fanen, siden står på. Standardpanelet hedder «lovelace», og uden navn giver Home Assistant
// det samme panel — også i ældre udgaver, hvor det ikke står på listen.
function sidensFane() {
  const dele = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return { urlPath: !dele[0] || dele[0] === "lovelace" ? null : dele[0], fane: dele[1] };
}

// Fanen, som Home Assistant vælger den: den første med stien eller nummeret, og ellers den første fane.
function findFane(config, fane) {
  const views = (config && config.views) || [];
  const nr = Number(fane);
  const i = fane === undefined ? 0 : views.findIndex((v, j) => v.path === fane || j === nr);
  return views[Math.max(0, i)] || null;
}

function pct(st) {
  return Math.max(1, Math.round((Number(st.attributes.brightness) || 0) / 2.55));
}

function daempbar(st) {
  return !!st && (st.attributes.supported_color_modes || []).some((m) => m !== "onoff");
}

function lampeStatus(hass, st) {
  if (!st) return tekst(hass, "findes_ikke");
  if (st.state === "unavailable" || st.state === "unknown") return tekst(hass, "utilgaengelig");
  if (st.state !== "on") return tekst(hass, "slukket");
  return daempbar(st) ? tekst(hass, "taendt") + " · " + pct(st) + " %" : tekst(hass, "taendt");
}

function kelvinOmraade(a) {
  const min = Number(a.min_color_temp_kelvin) > 0 ? Number(a.min_color_temp_kelvin) : 2000;
  const max = Number(a.max_color_temp_kelvin) > min ? Number(a.max_color_temp_kelvin) : 6500;
  return [min, max];
}

function hvidOvergang(min, max) {
  const trin = [];
  for (let i = 0; i <= 6; i++) trin.push(css(hueFarve(min + ((max - min) * i) / 6)) + " " + Math.round((i * 100) / 6) + "%");
  return "linear-gradient(to top, " + trin.join(", ") + ")";
}

function sceneKnap(hass, scene, vedTryk) {
  const navn = sceneNavn(hass, scene);
  const knap = h("button", { class: "scene", type: "button", title: navn, "aria-label": navn }, h("span", { class: "n" }, navn));
  knap.style.background = scene.billede ? "left center / cover no-repeat url('" + scene.billede + "')" : overgang(sceneFarver(scene), "135deg");
  knap.addEventListener("click", () => vedTryk(knap));
  return knap;
}

// Kontakt, vandret skyder og scenefelt ser ens ud på kortet og i menuen.
const KONTROL_STYLE = `
  button { font:inherit; color:inherit; -webkit-tap-highlight-color:transparent; }
  button:disabled, input:disabled { opacity:0.35; cursor:default; }
  .kontakt {
    flex:none; position:relative; width:var(--rl-kontakt-b); height:var(--rl-kontakt-h); padding:0; border:none;
    border-radius:calc(var(--rl-kontakt-h) / 2); cursor:pointer; background:var(--rl-spor); transition:background .2s ease;
  }
  .kontakt .knop {
    position:absolute; top:3px; left:3px; width:var(--rl-knop); height:var(--rl-knop); border-radius:50%;
    background:#fff; box-shadow:0 1px 3px rgba(0, 0, 0, 0.35); transition:transform .2s ease;
  }
  .kontakt.til { background:var(--rl-fyld); }
  .kontakt.til .knop { transform:translateX(calc(var(--rl-kontakt-b) - var(--rl-knop) - 6px)); background:var(--rl-paa-fyld); }
  .skyder { display:block; height:var(--rl-skyder-h); margin:0; padding:0; cursor:pointer; background:transparent; -webkit-appearance:none; appearance:none; }
  .skyder.skjult { display:none; }
  .skyder::-webkit-slider-runnable-track {
    height:var(--rl-spor-h); border-radius:calc(var(--rl-spor-h) / 2);
    background:linear-gradient(to right, var(--rl-fyld) 0 var(--rl-pct, 0%), var(--rl-spor) var(--rl-pct, 0%) 100%);
  }
  .skyder::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; width:var(--rl-tommel); height:var(--rl-tommel);
    margin-top:calc((var(--rl-spor-h) - var(--rl-tommel)) / 2);
    border-radius:50%; background:var(--rl-fyld); border:2px solid #fff; box-shadow:0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .skyder::-moz-range-track { height:var(--rl-spor-h); border-radius:calc(var(--rl-spor-h) / 2); background:var(--rl-spor); }
  .skyder::-moz-range-progress { height:var(--rl-spor-h); border-radius:calc(var(--rl-spor-h) / 2); background:var(--rl-fyld); }
  .skyder::-moz-range-thumb {
    width:calc(var(--rl-tommel) - 4px); height:calc(var(--rl-tommel) - 4px); border-radius:50%; background:var(--rl-fyld);
    border:2px solid #fff; box-shadow:0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .scene {
    position:relative; display:block; width:100%; aspect-ratio:1 / 1; box-sizing:border-box;
    margin:0; padding:0; border:none; cursor:pointer; overflow:hidden; border-radius:var(--rl-scene-radius);
    background-color:rgba(127, 127, 127, 0.2); box-shadow:0 1px 2px rgba(0, 0, 0, 0.18);
    -webkit-appearance:none; appearance:none; transition:transform .12s ease;
  }
  .scener.fyldt .scene { aspect-ratio:auto; height:var(--rl-scene-hoejde); }
  .scene:active { transform:scale(.94); }
  .scene.blink { animation:rl-blink .6s ease; }
  @keyframes rl-blink { 0% { filter:brightness(1.35); } 100% { filter:brightness(1); } }
  .scene .n {
    position:absolute; left:0; right:0; bottom:0; box-sizing:border-box;
    border-radius:0 0 var(--rl-scene-radius) var(--rl-scene-radius);
    padding:2px 2px 3px; line-height:1; text-align:center;
    font-weight:var(--ha-font-weight-medium, 500); font-size:var(--rl-scene-fs, 9px); color:#fff;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    background-color:rgba(40, 42, 46, 0.35);
    -webkit-backdrop-filter:blur(6px) saturate(140%); backdrop-filter:blur(6px) saturate(140%);
    border-top:1px solid rgba(255, 255, 255, 0.3); text-shadow:0 1px 2px rgba(0, 0, 0, 0.35);
  }
`;

const STYLE = KONTROL_STYLE + `
  :host { display:block; }
  ha-card {
    --rl-pad:12px 16px; --rl-gap:12px; --rl-ikon:40px; --rl-ikon-str:24px;
    --rl-navn:16px; --rl-status:13px; --rl-knap:36px; --rl-knap-ikon:20px;
    --rl-kontakt-b:46px; --rl-kontakt-h:26px; --rl-knop:20px;
    --rl-skyder-h:28px; --rl-spor-h:6px; --rl-tommel:18px;
    --rl-scene:48px; --rl-scene-min:36px; --rl-scene-maks:56px;
    --rl-scene-gap:6px; --rl-scene-top:10px; --rl-scene-radius:8px;
    display:block; position:relative; box-sizing:border-box; overflow:hidden; cursor:pointer;
    padding:var(--rl-pad);
    border-radius:var(--ha-card-border-radius, 12px);
    border-width:var(--ha-card-border-width, 1px); border-style:solid;
    border-color:var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    background:var(--ha-card-background, var(--card-background-color, #fff));
    box-shadow:var(--ha-card-box-shadow, none);
    color:var(--primary-text-color);
    font-family:var(--ha-font-family-body, Roboto, Noto, sans-serif);
    --rl-fyld:var(--primary-color); --rl-spor:rgba(127, 127, 127, 0.3); --rl-paa-fyld:var(--text-primary-color, #fff);
    -webkit-tap-highlight-color:transparent; transition:background .4s ease, color .4s ease;
  }
  ha-card.lille {
    --rl-pad:8px 12px; --rl-gap:8px; --rl-ikon:32px; --rl-ikon-str:20px;
    --rl-navn:14px; --rl-status:12px; --rl-knap:30px; --rl-knap-ikon:16px;
    --rl-kontakt-b:38px; --rl-kontakt-h:22px; --rl-knop:16px;
    --rl-skyder-h:22px; --rl-spor-h:4px; --rl-tommel:14px;
    --rl-scene:40px; --rl-scene-min:30px; --rl-scene-maks:46px;
    --rl-scene-gap:5px; --rl-scene-top:8px; --rl-scene-radius:6px;
  }
  ha-card.stor {
    --rl-pad:16px 20px; --rl-gap:14px; --rl-ikon:52px; --rl-ikon-str:30px;
    --rl-navn:19px; --rl-status:14px; --rl-knap:44px; --rl-knap-ikon:24px;
    --rl-kontakt-b:56px; --rl-kontakt-h:32px; --rl-knop:26px;
    --rl-skyder-h:36px; --rl-spor-h:12px; --rl-tommel:26px;
    --rl-scene:58px; --rl-scene-min:56px; --rl-scene-maks:68px;
    --rl-scene-gap:8px; --rl-scene-top:14px; --rl-scene-radius:10px;
  }
  ha-card.taendt { background:var(--rl-baggrund); color:var(--rl-tekst); border-color:transparent; }
  .inhold { container-type:inline-size; }
  .top { display:flex; align-items:center; gap:var(--rl-gap); min-height:calc(var(--rl-ikon) + 8px); }
  .ikoner { flex:none; display:flex; align-items:center; }
  .ikon {
    flex:none; width:var(--rl-ikon); height:var(--rl-ikon); border-radius:50%; box-sizing:border-box;
    display:flex; align-items:center; justify-content:center; background:rgba(127, 127, 127, 0.12); --mdc-icon-size:var(--rl-ikon-str);
  }
  .ikoner .ikon + .ikon { margin-left:calc(var(--rl-ikon) * -0.3); box-shadow:-2px 0 0 0 var(--ha-card-background, var(--card-background-color, #fff)); }
  .ikon.flere { font-size:calc(var(--rl-ikon-str) * 0.6); font-weight:var(--ha-font-weight-medium, 500); }
  ha-card.taendt .ikon { background:rgba(255, 255, 255, 0.3); }
  ha-card.taendt .ikoner .ikon + .ikon { box-shadow:-2px 0 0 0 rgba(255, 255, 255, 0.45); }
  .tekst { flex:0 1 auto; min-width:0; max-width:42%; }
  .top.uden-skyder .tekst { flex:1 1 0; max-width:none; }
  .navn { font-size:var(--rl-navn); line-height:calc(var(--rl-navn) + 4px); font-weight:var(--ha-font-weight-medium, 500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .status { font-size:var(--rl-status); line-height:calc(var(--rl-status) + 5px); opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .hold {
    flex:none; width:var(--rl-knap); height:var(--rl-knap); padding:0; border-radius:50%; cursor:pointer;
    display:flex; align-items:center; justify-content:center; --mdc-icon-size:var(--rl-knap-ikon);
    background:transparent; border:2px solid currentColor; opacity:0.5; transition:background .2s ease, opacity .2s ease;
  }
  .hold.aktiv { opacity:1; background:var(--rl-fyld); border-color:var(--rl-fyld); color:var(--rl-paa-fyld); }
  .top .skyder { flex:1 1 0; min-width:60px; }
  /* Skyderen står mellem ikonerne og knapperne, når den får plads nok dér; ellers på sin egen linje. */
  .top.skyder-under { flex-wrap:wrap; row-gap:0; }
  .top.skyder-under .tekst { flex:1 1 0; max-width:none; }
  .top.skyder-under .skyder { order:1; flex:1 1 100%; }
  .scener { display:grid; grid-template-columns:repeat(auto-fill, minmax(var(--rl-scene), 1fr)); justify-content:start; gap:var(--rl-scene-gap); margin-top:var(--rl-scene-top); cursor:default; }
  .scener.skjult { display:none; }
  .scener:not(.med-navne) .scene .n { display:none; }
  .scener.med-navne .scene .n { padding:3px 4px 4px; }
  /* Uden et rum i Rumlys er der intet at styre — kun knappen, der sætter rummet op. */
  ha-card.uden-rum { cursor:default; }
  ha-card.uden-rum .skyder, ha-card.uden-rum .hold, ha-card.uden-rum .kontakt, ha-card.uden-rum .scener { display:none; }
  /* «Hold lys» hører til hele rummet og står ikke på et kort for nogle af lamperne. */
  ha-card.delvis .hold { display:none; }
  .saet-op {
    flex:none; height:var(--rl-knap); padding:0 16px; border:none; border-radius:calc(var(--rl-knap) / 2); cursor:pointer;
    background:var(--rl-fyld); color:var(--rl-paa-fyld); font-size:var(--rl-status); font-weight:var(--ha-font-weight-medium, 500); white-space:nowrap;
  }
  .saet-op[hidden] { display:none; }
`;

class RumlysCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._traekker = false;
    this._ventTil = 0;
    this._ur = null;
    this._navne = [];
    this._rummene = null;
    this._katalog = null;
    // Kortets lamper efter fanens regel. Kan fanen ikke læses, gælder Rumlys' valg for et kort, Rumlys kender, og et
    // nyt kort venter.
    this._fordeling = null;
    this._faneTjek = 0;
    this._vedOpdatering = () => this._hentRum(800);
    this._vedPanel = () => this._tjekFane();
  }

  static getConfigElement() {
    return document.createElement(NAVN + "-editor");
  }

  setConfig(config) {
    const foer = this._config;
    this._config = Object.assign({}, config);
    // Et andet rum eller et andet kort: fanens fordeling for det gamle gælder ikke, til fanen er tjekket igen.
    const hvem = (x) => JSON.stringify(x ? [x.omraade, x.rum, x.kort, x.lamper] : null);
    if (hvem(foer) !== hvem(this._config)) this._fordeling = null;
    if (!this._el) this._byg();
    this._tegnScener();
    this._tjekFane();
    this._opdater();
    if (this._menu) this._menu.opdater();
  }

  set hass(hass) {
    const foerste = !this._hass;
    this._hass = hass;
    if (foerste) {
      this._hentRum(0);
      hentScener().then((k) => {
        this._katalog = k;
        this._tegnScener();
        this._opdater();
      });
    }
    const rum = this._rum();
    if (rum) tjekKortTid(hass, rum);
    this._opdater();
    if (this._menu) this._menu.opdater();
  }

  connectedCallback() {
    window.addEventListener(OPDATERET, this._vedOpdatering);
    window.addEventListener(PANEL_GEMT, this._vedPanel);
    if (window.ResizeObserver && !this._ro) {
      this._ro = new ResizeObserver(() => {
        this._placerSkyder();
        this._tilpasScener();
      });
      this._ro.observe(this);
    }
    // Kortet kan have været væk fra siden — på en anden fane eller et andet panel — mens rummene eller betjeningspanelet
    // blev ændret, og fanen tjekkes kun, mens kortet står på siden.
    if (this._rummene) this._hentRum(0);
    this._tjekFane();
    this._opdater();
  }

  disconnectedCallback() {
    window.removeEventListener(OPDATERET, this._vedOpdatering);
    window.removeEventListener(PANEL_GEMT, this._vedPanel);
    this._stopUr();
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this._menu) this._menu.luk();
  }

  getCardSize() {
    return (this._config && this._config.size === "large" ? 2 : 1) + 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: this._config && this._config.size === "small" ? 4 : 6 };
  }

  t(noegle, vaerdier) {
    return tekst(this._hass, noegle, vaerdier);
  }

  // Sidepanelet genindlæser Rumlys efter et gem, så efter et gem ventes der et øjeblik (`vent` ms), før rummene hentes
  // igen. Er Rumlys ikke klar, prøves der igen lidt efter; imens gælder de rum, kortet allerede har.
  _hentRum(vent, forsoeg = 1) {
    if (!this._hass) return;
    setTimeout(() => {
      hentRum(this._hass).then(
        (rummene) => {
          this._rummene = rummene;
          this._tegnScener();
          this._tjekFane();
          this._opdater();
        },
        () => {
          if (forsoeg < 5) this._hentRum(1000, forsoeg + 1);
          else if (!this._rummene) {
            this._rummene = [];
            this._opdater();
          }
        }
      );
    }, vent);
  }

  // Kortet peger på rummets område, så det kan stå, før rummet er sat op. Ældre kort har rummets id i `rum`.
  _rum() {
    const c = this._config || {};
    return (this._rummene || []).find((r) => erRummetsKort(c, r)) || null;
  }

  // Rummets kort på fanen, siden står på, og hvilke lamper dette kort får efter fanens regel. Kortet selv findes
  // på sit id; står det der ikke — et nyt kort i forhåndsvisningen, før det er gemt — regnes det sidst på fanen.
  // Adressen viser kun kortets fane, mens kortet står på siden; et kort, der ikke gør, tjekkes, når det kommer igen.
  async _tjekFane() {
    const hass = this._hass;
    const c = this._config;
    const rum = this._rum();
    const tjek = ++this._faneTjek;
    if (!hass || !c || !rum || !this.isConnected) return;
    let fordeling = null;
    try {
      const { urlPath, fane } = sidensFane();
      const view = findFane(await hentPanel(hass, urlPath), fane);
      if (view) {
        const kortListe = fanensKort(view).filter((x) => erRummetsKort(x, rum));
        let nr = c.kort ? kortListe.findIndex((x) => x.kort === c.kort) : kortListe.findIndex((x) => JSON.stringify(x) === JSON.stringify(c));
        if (nr < 0) {
          kortListe.push(c);
          nr = kortListe.length - 1;
        }
        fordeling = fordelLamper(kortListe, rum.lamper.map((l) => l.entity_id), rum.kort || {})[nr];
      }
    } catch (e) {
      // Ikke på et betjeningspanel, eller panelet kunne ikke læses: se `_kortStatus`.
    }
    if (tjek !== this._faneTjek) return;
    this._fordeling = fordeling;
    // Scenerne afhænger af kortets lamper, så de tegnes igen, når de kendes.
    this._tegnScener();
    this._opdater();
    if (this._menu) this._menu.opdater();
  }

  // Kortets lamper: {lamper, hele, ingen, spaerretAf, dublet}, eller {venter}. Før fanen er tjekket — og hvis den ikke
  // kan læses — gælder Rumlys' valg for et kort, Rumlys kender. Et nyt kort venter, for kun fanen kan vise, om rummet
  // har et andet kort dér.
  _kortStatus() {
    const rum = this._rum();
    if (!rum) return null;
    if (this._fordeling) return this._fordeling;
    const c = this._config || {};
    const valg = rum.kort || {};
    if (!c.kort || !Object.prototype.hasOwnProperty.call(valg, c.kort)) return { venter: true, lamper: [], hele: false };
    return fordelLamper([c], rum.lamper.map((l) => l.entity_id), valg)[0];
  }

  // Kortet kan ikke bruges lige nu: ingen lamper, lamperne står på et andet kort, eller kortet står to gange.
  _spaerret() {
    const k = this._kortStatus();
    return !!k && (!!k.venter || k.ingen || k.spaerretAf !== null || k.dublet);
  }

  // Et kort for nogle af rummets lamper. Rumlys' tjenester styrer så kun dem, og «Hold lys» står ikke på kortet.
  _delvis() {
    const k = this._kortStatus();
    return !!k && !k.hele;
  }

  _lamper() {
    const k = this._kortStatus();
    return k ? k.lamper : [];
  }

  // Rumlys' tjenester styrer kun kortets lamper, når kortet ikke viser hele rummet.
  _valg() {
    return this._delvis() ? { lamper: this._lamper() } : {};
  }

  // Et kort for én lampe hedder som lampen, uden rummets navn foran.
  _navn() {
    const rum = this._rum();
    if (this._config.name) return this._config.name;
    const lamper = this._lamper();
    if (this._delvis() && lamper.length === 1) {
      const st = this._hass && this._hass.states[lamper[0]];
      return kortNavn((st && st.attributes.friendly_name) || lamper[0], rum.navn);
    }
    return rum.navn;
  }

  // Ikonerne tegnes kun forfra, når de har ændret sig.
  _visIkoner(ikoner) {
    const noegle = ikoner.join("|");
    if (noegle === this._ikonNoegle) return;
    this._ikonNoegle = noegle;
    this._el.ikoner.replaceChildren(...[...ikonStak(ikoner).children]);
  }

  _byg() {
    const r = this.shadowRoot;
    r.textContent = "";
    this._ikonNoegle = null;
    const e = {};
    e.ikoner = h("div", { class: "ikoner" });
    e.navn = h("div", { class: "navn" });
    e.status = h("div", { class: "status" });
    e.skyder = h("input", { class: "skyder", type: "range", min: "0", max: "100", step: "1" });
    e.hold = h("button", { class: "hold", type: "button" }, h("ha-icon", { icon: "mdi:lock-clock" }));
    e.kontakt = h("button", { class: "kontakt", type: "button", role: "switch" }, h("span", { class: "knop" }));
    e.tekst = h("div", { class: "tekst" }, e.navn, e.status);
    e.saetOp = h("button", { class: "saet-op", type: "button" });
    e.saetOp.hidden = true;
    e.top = h("div", { class: "top" }, e.ikoner, e.tekst, e.saetOp, e.skyder, e.hold, e.kontakt);
    e.scener = h("div", { class: "scener skjult" });
    e.kort = h("ha-card", {}, h("div", { class: "inhold" }, e.top, e.scener));
    r.append(h("style", {}, STYLE), e.kort);
    this._el = e;
    e.kort.addEventListener("click", () => this._aabnMenu());
    e.hold.addEventListener("click", (ev) => { ev.stopPropagation(); this._skiftHold(); });
    e.kontakt.addEventListener("click", (ev) => { ev.stopPropagation(); this._skiftLys(); });
    e.saetOp.addEventListener("click", (ev) => { ev.stopPropagation(); this._saetOp(); });
    e.scener.addEventListener("click", (ev) => ev.stopPropagation());
    ["click", "pointerdown", "touchstart"].forEach((t) => {
      e.skyder.addEventListener(t, (ev) => ev.stopPropagation(), { passive: true });
    });
    e.skyder.addEventListener("input", () => {
      this._traekker = true;
      const vaerdi = Number(e.skyder.value);
      e.skyder.style.setProperty("--rl-pct", vaerdi + "%");
      e.status.textContent = this.t("lysstyrke") + " " + vaerdi + " %";
    });
    e.skyder.addEventListener("change", () => {
      this._traekker = false;
      this._daemp(Number(e.skyder.value));
    });
  }

  _rummetsScener() {
    const rum = this._rum();
    if (!rum || !this._katalog || this._spaerret()) return [];
    // En scene kræver hvidt lys eller farve — det kan kortets lamper ikke nødvendigvis, selvom rummets kan.
    if (this._delvis() && !kanHvid(this._hass, this._lamper())) return [];
    return rum.scener.map((id) => this._katalog.efterId[id]).filter(Boolean);
  }

  _tegnScener() {
    const e = this._el;
    if (!e || !this._hass) return;
    e.scener.textContent = "";
    const scener = this._rummetsScener();
    this._navne = scener.map((s) => sceneNavn(this._hass, s));
    scener.forEach((s) => e.scener.appendChild(sceneKnap(this._hass, s, (knap) => this._anvendScene(s.id, knap))));
    e.scener.classList.toggle("skjult", !scener.length);
    this._tilpasScener();
  }

  // Skyderen står mellem ikonerne og knapperne, hvis den dér kan blive mindst SKYDER_MIN bred, mens navn og
  // status kan læses helt; ellers får den sin egen linje. Det afhænger af kortets bredde, antallet af ikoner
  // og teksternes længde, så det måles i stedet for at bruge en fast bredde.
  _placerSkyder() {
    const e = this._el;
    if (!e || !e.top.isConnected) return;
    const bredde = e.top.clientWidth;
    // Et kort uden rum, eller som ikke kan bruges, har ingen skyder — kun navn, status og knappen.
    if (!bredde || e.skyder.classList.contains("skjult") || !this._rum() || this._spaerret()) {
      e.top.classList.remove("skyder-under");
      e.tekst.style.flex = e.tekst.style.maxWidth = "";
      return;
    }
    if (!this._canvas) this._canvas = document.createElement("canvas");
    const ctx = this._canvas.getContext("2d");
    const maal = (tekst, el) => {
      const cs = getComputedStyle(el);
      ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      return ctx.measureText(tekst).width;
    };
    // Statussen skal kunne læses helt, også med den længste nedtælling. Den måles med de længste tekster,
    // den kan få, så skyderen ikke flytter sig, når lyset tændes, dæmpes eller tæller ned.
    const status = this._rum()
      ? [
          this.t("taendt") + " · 100 % · " + this.t("holdes_i", { tid: this.t("timer", { n: 23 }) + " " + this.t("min", { n: 59 }) }),
          this.t("taendt") + " · 100 % · " + this.t("slukker_om", { tid: this.t("timer", { n: 1 }) + " " + this.t("min", { n: 59 }) }),
          this.t("slukket"),
          this.t("utilgaengelig"),
        ]
      : [e.status.textContent];
    const tekst = Math.ceil(Math.max(maal(e.navn.textContent, e.navn), ...status.map((s) => maal(s, e.status))));
    const gap = parseFloat(getComputedStyle(e.top).columnGap) || 0;
    const plads = bredde - (e.ikoner.offsetWidth + tekst + e.hold.offsetWidth + e.kontakt.offsetWidth + 4 * gap);
    const under = plads < SKYDER_MIN;
    e.top.classList.toggle("skyder-under", under);
    // Mellem ikonerne og knapperne får teksten den målte bredde, så den står helt og ikke flytter skyderen.
    e.tekst.style.flex = under ? "" : "0 0 " + tekst + "px";
    e.tekst.style.maxWidth = under ? "" : "none";
  }

  // Scenerne skal gøre kortet så lidt højere som muligt: kan alle stå på én række i felter på mindst
  // --rl-scene-min, gør de det; ellers deles de på så få, lige lange rækker som muligt. Felterne fylder
  // hele bredden, men bliver ikke højere end --rl-scene-maks — på et bredt kort bliver de aflange.
  _tilpasScener() {
    const e = this._el;
    const n = this._navne.length;
    if (!e || !n) return;
    const w = e.scener.getBoundingClientRect().width;
    if (!w) return;
    const cs = getComputedStyle(e.kort);
    const maal = (navn) => parseFloat(cs.getPropertyValue(navn)) || 0;
    const stor = this._config.scene_size === "large";
    const x = stor ? 2 : 1;
    const gap = maal("--rl-scene-gap");
    let kol = n;
    let felt = (w - (n - 1) * gap) / n;
    if (felt < maal("--rl-scene-min") * x) {
      const plads = Math.max(1, Math.floor((w + gap) / (maal("--rl-scene") * x + gap)));
      kol = Math.ceil(n / Math.ceil(n / plads));
      felt = (w - (kol - 1) * gap) / kol;
    }
    e.scener.style.gridTemplateColumns = "repeat(" + kol + ", minmax(0, 1fr))";
    e.scener.style.setProperty("--rl-scene-hoejde", Math.min(felt, maal("--rl-scene-maks") * x).toFixed(2) + "px");
    e.scener.classList.add("fyldt");
    e.scener.classList.toggle("med-navne", stor);
    e.scener.style.setProperty("--rl-scene-radius", stor ? maal("--rl-scene-radius") * 1.5 + "px" : "");
    if (!stor) return;
    const label = e.scener.querySelector(".n");
    if (!label) return;
    if (!this._canvas) this._canvas = document.createElement("canvas");
    const ctx = this._canvas.getContext("2d");
    const ls = getComputedStyle(label);
    ctx.font = ls.fontWeight + " 100px " + ls.fontFamily;
    let bredest = 0;
    this._navne.forEach((t) => { bredest = Math.max(bredest, ctx.measureText(t).width / 100); });
    if (!bredest) return;
    e.scener.style.setProperty("--rl-scene-fs", Math.max(9, Math.min(13, (felt - 8) / (bredest * 1.04))).toFixed(2) + "px");
  }

  _startUr() {
    if (!this._ur) {
      this._ur = setInterval(() => {
        this._opdater();
        if (this._menu) this._menu.opdater();
      }, 15000);
    }
  }

  _stopUr() {
    if (this._ur) {
      clearInterval(this._ur);
      this._ur = null;
    }
  }

  // Nedtællingen: hvor længe lyset holdes tændt, eller hvornår det slukker, hvis ingen er der.
  _nedtaelling() {
    const rum = this._rum();
    const hass = this._hass;
    if (!rum) return "";
    const hold = hass.states[rum.entiteter.hold];
    if (hold && hold.state === "on" && hold.attributes.slutter) {
      return this.t("holdes_i", { tid: restTekst(hass, new Date(hold.attributes.slutter) - Date.now()) });
    }
    const tilstand = hass.states[rum.entiteter.tilstand];
    if (tilstand && tilstand.attributes.slukker) {
      return this.t("slukker_om", { tid: restTekst(hass, new Date(tilstand.attributes.slukker) - Date.now()) });
    }
    return "";
  }

  _opdater() {
    const hass = this._hass;
    const c = this._config;
    const e = this._el;
    if (!hass || !c || !e) return;
    e.kort.classList.toggle("lille", c.size === "small");
    e.kort.classList.toggle("stor", c.size === "large");
    const rum = this._rum();
    const k = this._kortStatus();
    const spaerret = this._spaerret();
    e.kort.classList.toggle("uden-rum", !rum || spaerret);
    if (!rum || spaerret) {
      this._stopUr();
      // Er kortet blevet spærret, mens menuen stod åben, lukkes den: den ville styre lamper, kortet ikke har.
      if (this._menu) this._menu.luk();
      this._visIkoner([RUMLYS_IKON]);
      const omraade = c.omraade ? (hass.areas || {})[c.omraade] : null;
      let status = "…";
      if (rum) {
        e.navn.textContent = c.name || rum.navn;
        if (!k.venter) status = this.t(k.dublet ? "kort_dublet" : k.ingen ? "kort_ingen_lamper" : "kort_spaerret");
      } else {
        e.navn.textContent = c.name || (omraade ? omraade.name : this.t("kort_navn"));
        if (!c.omraade && !c.rum) status = this.t("vaelg_rum_hint");
        else if (this._rummene) status = omraade ? this.t("kort_ikke_sat_op") : this.t("rum_findes_ikke");
      }
      e.status.textContent = status;
      // Sidepanelet er kun for administratorer. I forhåndsvisningen ville knappen forlade kortets opsætning.
      const admin = !!(hass.user && hass.user.is_admin) && !this.preview;
      e.saetOp.hidden = !(admin && (rum ? !k.venter : omraade && this._rummene));
      // Knappen er slået fra, mens «Sæt op i Rumlys» opretter rummet; når rummet findes, åbner den det.
      if (rum) e.saetOp.disabled = false;
      e.saetOp.textContent = this.t(!rum ? "saet_op" : k.dublet ? "adskil_i_rumlys" : "vaelg_i_rumlys");
      e.top.classList.add("uden-skyder");
      e.kort.classList.remove("taendt");
      this._placerSkyder();
      return;
    }
    e.saetOp.hidden = true;
    e.saetOp.disabled = false;
    const lamper = this._lamper();
    const tilstande = lamper.map((id) => hass.states[id]).filter(Boolean);
    const kendte = tilstande.filter((st) => st.state !== "unavailable" && st.state !== "unknown");
    const taendte = kendte.filter((st) => st.state === "on");
    const tilgaengelig = kendte.length > 0;
    const taendt = taendte.length > 0;
    const kanDaempe = tilstande.some(daempbar);
    const hold = hass.states[rum.entiteter.hold];
    const holdAktiv = !!hold && hold.state === "on";

    const delvis = this._delvis();
    e.kort.classList.toggle("delvis", delvis);
    e.navn.textContent = this._navn();
    // Rummets eget ikon gælder hele rummet; et kort for nogle af lamperne viser deres.
    this._visIkoner(rummetsIkoner(hass, lamper, delvis ? null : rum.ikon));
    e.kontakt.disabled = e.skyder.disabled = !tilgaengelig;
    e.hold.disabled = !hold;
    e.skyder.classList.toggle("skjult", !kanDaempe);
    e.top.classList.toggle("uden-skyder", !kanDaempe);
    this._placerSkyder();

    const farver = rummetsFarver(hass, lamper, this._katalog, () => this._opdater());
    if (farver.length) {
      const lys = farver.reduce((s, f) => s + luminans(f), 0) / farver.length > 0.179;
      e.kort.style.setProperty("--rl-baggrund", overgang(farver, "90deg"));
      e.kort.style.setProperty("--rl-tekst", lys ? "rgba(0, 0, 0, 0.87)" : "#fff");
      e.kort.style.setProperty("--rl-fyld", lys ? "rgba(0, 0, 0, 0.75)" : "#fff");
      e.kort.style.setProperty("--rl-spor", lys ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.4)");
      e.kort.style.setProperty("--rl-paa-fyld", lys ? "#fff" : "rgba(0, 0, 0, 0.87)");
      e.kort.classList.add("taendt");
    } else {
      ["--rl-baggrund", "--rl-tekst", "--rl-fyld", "--rl-spor", "--rl-paa-fyld"].forEach((p) => e.kort.style.removeProperty(p));
      e.kort.classList.remove("taendt");
    }

    const nedtaelling = this._nedtaelling();
    if (nedtaelling) this._startUr();
    else this._stopUr();

    e.kontakt.classList.toggle("til", taendt);
    e.kontakt.setAttribute("aria-checked", taendt ? "true" : "false");
    e.kontakt.setAttribute("aria-label", this.t("taend_sluk"));
    e.hold.classList.toggle("aktiv", holdAktiv);
    e.hold.title = holdAktiv ? nedtaelling : this.t("hold_lyset");
    e.hold.setAttribute("aria-pressed", holdAktiv ? "true" : "false");
    e.skyder.setAttribute("aria-label", this.t("lysstyrke"));

    const lysstyrke = taendt ? Math.max(...taendte.map(pct)) : 0;
    if (this._traekker) return;
    const vis = this._ventTil > Date.now() && lysstyrke !== this._ventVaerdi ? this._ventVaerdi : lysstyrke;
    if (vis === lysstyrke) this._ventTil = 0;
    e.skyder.value = String(vis);
    e.skyder.style.setProperty("--rl-pct", vis + "%");

    let status = this.t("slukket");
    if (!tilgaengelig) status = this.t("utilgaengelig");
    else if (taendt) status = this.t("taendt") + (kanDaempe ? " · " + lysstyrke + " %" : "") + (nedtaelling ? " · " + nedtaelling : "");
    e.status.textContent = status;
  }

  _aabnMenu() {
    if (!this._hass || !this._rum() || this._spaerret()) return;
    if (!this._menu) this._menu = document.createElement(NAVN + "-menu");
    this._menu.aabn(this);
  }

  // Et kort uden rum: opretter rummet med områdets lamper og sensorer valgt, som «Nyt rum» i sidepanelet, og åbner
  // det dér. Et kort, der ikke kan bruges: åbner rummet i Rumlys, hvor kortets lamper vælges.
  _saetOp() {
    const c = this._config;
    const rum = this._rum();
    if (rum) {
      history.pushState(null, "", "/rumlys/" + rum.id);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      return;
    }
    if (!this._hass || !c || !c.omraade) return;
    this._el.saetOp.disabled = true;
    this._hass.callWS({ type: "rumlys/rum/opret", omraade: c.omraade }).then(
      (svar) => {
        meldOpdateret(svar.id);
        history.pushState(null, "", "/rumlys/" + svar.id);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      },
      (fejl) => {
        this._el.saetOp.disabled = false;
        const besked = String((fejl && fejl.message) || fejl);
        this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: besked }, bubbles: true, composed: true }));
      }
    );
  }

  _merInfo(id) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  // Et kort, der ikke kan bruges, styrer ingenting — heller ikke hvis en knap alligevel nås.
  _skiftLys() {
    const lamper = this._lamper();
    if (!this._hass || !lamper.length || this._spaerret()) return;
    const taendt = lamper.some((id) => this._hass.states[id] && this._hass.states[id].state === "on");
    this._hass.callService("light", taendt ? "turn_off" : "turn_on", { entity_id: lamper });
  }

  _skiftHold() {
    const rum = this._rum();
    if (!this._hass || !rum || this._spaerret() || this._delvis()) return;
    const hold = this._hass.states[rum.entiteter.hold];
    this._hass.callService("switch", hold && hold.state === "on" ? "turn_off" : "turn_on", { entity_id: rum.entiteter.hold });
  }

  _daemp(vaerdi) {
    const rum = this._rum();
    if (!this._hass || !rum || this._spaerret()) return;
    this._ventVaerdi = vaerdi;
    this._ventTil = Date.now() + 3000;
    this._hass.callService("rumlys", "daemp", Object.assign({ rum: rum.id, lysstyrke: vaerdi }, this._valg()));
  }

  _anvendScene(id, knap) {
    const rum = this._rum();
    if (!this._hass || !rum || this._spaerret()) return;
    this._hass.callService("rumlys", "anvend_scene", Object.assign({ rum: rum.id, scene: id }, this._valg()));
    if (knap) {
      knap.classList.remove("blink");
      void knap.offsetWidth;
      knap.classList.add("blink");
    }
  }
}

// Menuen, når man trykker på kortet: en <dialog> på document.body, åbnet modalt, så den står over
// hele siden og arver temaets farver. På en telefon fylder den hele skærmen.
const MENU_STYLE = KONTROL_STYLE + `
  :host { display:contents; }
  dialog {
    --rl-kontakt-b:44px; --rl-kontakt-h:26px; --rl-knop:20px;
    --rl-skyder-h:28px; --rl-spor-h:6px; --rl-tommel:18px;
    --rl-fyld:var(--primary-color); --rl-spor:rgba(127, 127, 127, 0.3); --rl-paa-fyld:var(--text-primary-color, #fff);
    --rl-scene-radius:10px; --rl-scene-fs:11px;
    box-sizing:border-box; padding:0; margin:auto; border:none; overflow:hidden;
    width:min(440px, calc(100vw - 32px)); max-height:min(92vh, 920px); border-radius:28px;
    background:var(--ha-card-background, var(--card-background-color, #fff)); color:var(--primary-text-color);
    font-family:var(--ha-font-family-body, Roboto, Noto, sans-serif); box-shadow:0 16px 48px rgba(0, 0, 0, 0.35);
  }
  dialog::backdrop { background:rgba(0, 0, 0, 0.45); }
  .ramme { display:flex; flex-direction:column; max-height:inherit; }
  header { display:flex; align-items:center; gap:4px; padding:12px 12px 0; }
  .titel { flex:1 1 auto; min-width:0; padding:0 4px; }
  .navn { font-size:20px; line-height:26px; font-weight:var(--ha-font-weight-medium, 500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .status { font-size:13px; line-height:18px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ikonknap { flex:none; width:44px; height:44px; padding:0; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; background:transparent; --mdc-icon-size:24px; }
  .ikonknap:hover { background:rgba(127, 127, 127, 0.14); }
  .skjult { display:none !important; }
  .indhold { overflow-y:auto; padding:8px 24px 24px; display:flex; flex-direction:column; align-items:center; gap:18px; outline:none; }
  .vaerdi { font-size:40px; line-height:44px; min-height:44px; text-align:center; }
  .styring { display:flex; align-items:center; justify-content:center; }
  .lodret { position:relative; width:120px; height:300px; border-radius:36px; overflow:hidden; cursor:pointer; background:rgba(127, 127, 127, 0.18); touch-action:none; outline:none; }
  .lodret .fyld { position:absolute; left:0; right:0; bottom:0; height:0; background:var(--rm-fyld, var(--primary-color)); }
  .lodret .greb { position:absolute; left:50%; width:44px; height:6px; margin:0 0 -3px -22px; border-radius:3px; pointer-events:none; background:#fff; box-shadow:0 0 0 1px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.35); }
  .hjul {
    position:relative; width:280px; height:280px; border-radius:50%; cursor:crosshair; touch-action:none; outline:none;
    background:radial-gradient(circle closest-side, #fff 0%, rgba(255, 255, 255, 0) 100%), conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    box-shadow:inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  }
  .lodret:focus-visible, .hjul:focus-visible { box-shadow:0 0 0 3px var(--primary-color); }
  .markoer { position:absolute; width:30px; height:30px; margin:-15px 0 0 -15px; border-radius:50%; pointer-events:none; border:3px solid #fff; box-sizing:border-box; box-shadow:0 1px 4px rgba(0, 0, 0, 0.5); }
  .tilstande { display:flex; align-items:center; gap:8px; padding:6px; border-radius:32px; background:rgba(127, 127, 127, 0.12); }
  .rund { width:48px; height:48px; padding:0; border:none; border-radius:50%; cursor:pointer; background:transparent; display:flex; align-items:center; justify-content:center; --mdc-icon-size:24px; }
  .rund.aktiv { background:var(--primary-text-color); color:var(--ha-card-background, var(--card-background-color, #fff)); }
  .rund.taend.til { background:var(--rm-taend, var(--primary-color)); color:var(--rm-taend-tekst, #fff); }
  .prik { display:block; width:26px; height:26px; border-radius:50%; box-shadow:inset 0 0 0 1px rgba(0, 0, 0, 0.12); }
  .hvidprik { background:linear-gradient(180deg, rgb(190, 228, 243), #fff 50%, rgb(255, 180, 55)); }
  .farveprik { background:conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
  .adskil { width:1px; height:32px; background:var(--divider-color, rgba(0, 0, 0, 0.12)); }
  .hold {
    display:flex; align-items:center; gap:12px; width:100%; box-sizing:border-box; padding:12px 16px; cursor:pointer;
    border-radius:16px; border:1px solid var(--divider-color, rgba(0, 0, 0, 0.12)); background:transparent;
    font-size:14px; text-align:left; --mdc-icon-size:22px;
  }
  .hold.aktiv { background:var(--primary-color); border-color:var(--primary-color); color:var(--text-primary-color, #fff); }
  .sektion { width:100%; }
  .overskrift { font-size:14px; font-weight:var(--ha-font-weight-medium, 500); color:var(--secondary-text-color); margin:0 0 8px; }
  .scener { display:grid; grid-template-columns:repeat(auto-fill, minmax(60px, 1fr)); gap:8px; }
  .paerer { display:flex; flex-direction:column; gap:8px; }
  .paere { display:flex; align-items:center; gap:12px; padding:8px 12px; border-radius:16px; cursor:pointer; background:rgba(127, 127, 127, 0.08); }
  .paere .prik { flex:none; width:30px; height:30px; }
  .paere .ptekst { flex:1 1 auto; min-width:0; }
  .paere .pnavn { font-size:14px; line-height:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .paere .pstatus { font-size:12px; line-height:16px; color:var(--secondary-text-color); }
  .paere .skyder { flex:0 1 120px; min-width:60px; }
  .indstillinger { display:flex; align-items:center; gap:8px; justify-content:center; width:100%; box-sizing:border-box; padding:10px; border:0; border-radius:14px; cursor:pointer; background:rgba(127, 127, 127, 0.08); color:var(--primary-color); font-weight:var(--ha-font-weight-medium, 500); font-size:14px; --mdc-icon-size:20px; }
  @media (max-width: 600px) {
    dialog { width:100vw; max-width:100vw; height:100%; max-height:100%; border-radius:0; }
    header { padding-top:calc(12px + env(safe-area-inset-top, 0px)); }
    .indhold { padding-bottom:calc(24px + env(safe-area-inset-bottom, 0px)); }
    .lodret { height:260px; }
    .hjul { width:250px; height:250px; }
  }
`;

class RumlysMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._lampe = null;
    this._tilstand = "lysstyrke";
    this._traek = null;
    this._vent = null;
    this._sendt = 0;
    this._vist = { lysstyrke: 0, hvid: 0 };
  }

  aabn(kort) {
    this._kort = kort;
    this._lampe = null;
    this._tilstand = "lysstyrke";
    if (!this._el) this._byg();
    if (!this.isConnected) document.body.appendChild(this);
    this._sceneNoegle = null;
    this._lampeNoegle = null;
    this.opdater();
    if (!this._el.d.open) this._el.d.showModal();
    this._el.indhold.scrollTop = 0;
  }

  luk() {
    const d = this._el && this._el.d;
    if (d && d.open) d.close();
    this._ryd();
  }

  _ryd() {
    this._traek = null;
    if (this.isConnected) this.remove();
  }

  get _hass() {
    return this._kort._hass;
  }

  t(noegle, vaerdier) {
    return tekst(this._hass, noegle, vaerdier);
  }

  // Det menuen styrer: én lampe, eller hele rummet.
  _lamper() {
    return this._lampe ? [this._lampe] : this._kort._lamper();
  }

  _byg() {
    const r = this.shadowRoot;
    const e = {};
    e.tilbage = h("button", { class: "ikonknap skjult", type: "button" }, h("ha-icon", { icon: "mdi:arrow-left" }));
    e.luk = h("button", { class: "ikonknap", type: "button" }, h("ha-icon", { icon: "mdi:close" }));
    e.navn = h("div", { class: "navn" });
    e.status = h("div", { class: "status" });
    e.detaljer = h("button", { class: "ikonknap", type: "button" }, h("ha-icon", { icon: "mdi:cog-outline" }));
    e.vaerdi = h("div", { class: "vaerdi" });
    e.lysFyld = h("div", { class: "fyld" });
    e.lysGreb = h("div", { class: "greb" });
    e.lys = h("div", { class: "lodret", tabindex: "0", role: "slider" }, e.lysFyld, e.lysGreb);
    e.hvidGreb = h("div", { class: "greb" });
    e.hvid = h("div", { class: "lodret", tabindex: "0", role: "slider" }, e.hvidGreb);
    e.markoer = h("div", { class: "markoer" });
    e.hjul = h("div", { class: "hjul", tabindex: "0", role: "slider" }, e.markoer);
    e.styring = h("div", { class: "styring" }, e.lys, e.hvid, e.hjul);
    e.taend = h("button", { class: "rund taend", type: "button" }, h("ha-icon", { icon: "mdi:power" }));
    e.adskil = h("div", { class: "adskil" });
    e.valg = [
      h("button", { class: "rund valg", type: "button", "data-t": "lysstyrke" }, h("ha-icon", { icon: "mdi:brightness-6" })),
      h("button", { class: "rund valg", type: "button", "data-t": "hvid" }, h("span", { class: "prik hvidprik" })),
      h("button", { class: "rund valg", type: "button", "data-t": "farve" }, h("span", { class: "prik farveprik" })),
    ];
    e.tilstande = h("div", { class: "tilstande" }, e.taend, e.adskil, ...e.valg);
    e.holdtekst = h("span", {});
    e.hold = h("button", { class: "hold", type: "button" }, h("ha-icon", { icon: "mdi:lock-clock" }), e.holdtekst);
    e.sceneOverskrift = h("div", { class: "overskrift" });
    e.scener = h("div", { class: "scener" });
    e.scenesektion = h("div", { class: "sektion" }, e.sceneOverskrift, e.scener);
    e.lampeOverskrift = h("div", { class: "overskrift" });
    e.paerer = h("div", { class: "paerer" });
    e.lampesektion = h("div", { class: "sektion" }, e.lampeOverskrift, e.paerer);
    e.indstillinger = h("button", { class: "indstillinger", type: "button" }, h("ha-icon", { icon: "mdi:cog-outline" }), h("span", {}));
    e.indhold = h("div", { class: "indhold", tabindex: "-1", autofocus: true }, e.vaerdi, e.styring, e.tilstande, e.hold, e.scenesektion, e.lampesektion, e.indstillinger);
    e.d = h("dialog", {}, h("div", { class: "ramme" }, h("header", {}, e.tilbage, e.luk, h("div", { class: "titel" }, e.navn, e.status), e.detaljer), e.indhold));
    r.append(h("style", {}, MENU_STYLE), e.d);
    this._el = e;

    e.d.addEventListener("close", () => this._ryd());
    e.d.addEventListener("click", (ev) => { if (ev.target === e.d) this.luk(); });
    e.luk.addEventListener("click", () => this.luk());
    e.tilbage.addEventListener("click", () => {
      this._lampe = null;
      this._tilstand = "lysstyrke";
      this.opdater();
      e.indhold.scrollTop = 0;
    });
    e.detaljer.addEventListener("click", () => {
      const lampe = this._lampe;
      this.luk();
      this._kort._merInfo(lampe || this._kort._lamper()[0]);
    });
    e.indstillinger.addEventListener("click", () => {
      const rum = this._kort._rum();
      this.luk();
      history.pushState(null, "", "/rumlys/" + rum.id);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    });
    e.valg.forEach((b) => b.addEventListener("click", () => {
      this._tilstand = b.dataset.t;
      this.opdater();
    }));
    e.taend.addEventListener("click", () => this._skift());
    e.hold.addEventListener("click", () => this._kort._skiftHold());
    this._lodret(e.lys, "lysstyrke");
    this._lodret(e.hvid, "hvid");
    this._farvehjul(e.hjul);
  }

  _skift(lamper) {
    const ids = lamper || this._lamper();
    const taendt = ids.some((id) => this._hass.states[id] && this._hass.states[id].state === "on");
    this._hass.callService("light", taendt ? "turn_off" : "turn_on", { entity_id: ids });
  }

  // Lodret skyder: tryk eller træk. Lampen får besked, når man slipper, og højst hvert 400. ms
  // undervejs, så Zigbee-nettet ikke drukner i kommandoer.
  _lodret(el, type) {
    const andel = (ev) => {
      const r = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, (r.bottom - ev.clientY) / r.height));
    };
    el.addEventListener("pointerdown", (ev) => {
      el.setPointerCapture(ev.pointerId);
      this._traek = type;
      this._saet(type, andel(ev), false);
    });
    el.addEventListener("pointermove", (ev) => {
      if (this._traek === type) this._saet(type, andel(ev), false);
    });
    const slip = (ev) => {
      if (this._traek !== type) return;
      this._traek = null;
      this._saet(type, andel(ev), true);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => el.addEventListener(t, slip));
    el.addEventListener("keydown", (ev) => {
      const trin = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[ev.key];
      if (trin === undefined) return;
      ev.preventDefault();
      this._saet(type, Math.min(1, Math.max(0, this._vist[type] + trin)), true);
    });
  }

  // Farvehjulet: vinklen er nuancen (rød øverst, med uret), afstanden fra midten mætningen.
  _farvehjul(el) {
    const hs = (ev) => {
      const r = el.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      return [Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360), Math.round(Math.min(1, Math.hypot(dx, dy) / (r.width / 2)) * 100)];
    };
    el.addEventListener("pointerdown", (ev) => {
      el.setPointerCapture(ev.pointerId);
      this._traek = "farve";
      this._saetFarve(hs(ev), false);
    });
    el.addEventListener("pointermove", (ev) => {
      if (this._traek === "farve") this._saetFarve(hs(ev), false);
    });
    const slip = (ev) => {
      if (this._traek !== "farve") return;
      this._traek = null;
      this._saetFarve(hs(ev), true);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => el.addEventListener(t, slip));
  }

  // Hele rummet går gennem Rumlys, så lamperne følger med i samme forhold og det huskes som valgt
  // lys; en enkelt lampe styres direkte.
  _saet(type, andel, slut) {
    const rum = this._kort._rum();
    if (type === "lysstyrke") {
      const vaerdi = Math.round(andel * 100);
      this._visLysstyrke(vaerdi);
      if (vaerdi <= 0 && !slut) return;
      if (this._lampe) this._send(slut, ["light", vaerdi <= 0 ? "turn_off" : "turn_on", vaerdi <= 0 ? { entity_id: this._lampe } : { entity_id: this._lampe, brightness_pct: vaerdi }], { type, vaerdi });
      else this._send(slut, ["rumlys", "daemp", Object.assign({ rum: rum.id, lysstyrke: vaerdi }, this._kort._valg())], { type, vaerdi });
    } else {
      const [min, max] = this._kelvinOmraade();
      const kelvin = Math.round(min + andel * (max - min));
      this._visHvid(kelvin, min, max);
      if (this._lampe) this._send(slut, ["light", "turn_on", { entity_id: this._lampe, color_temp_kelvin: kelvin }], { type, vaerdi: kelvin });
      else this._send(slut, ["rumlys", "anvend_lys", Object.assign({ rum: rum.id, lys: { type: "hvid", kelvin } }, this._kort._valg())], { type, vaerdi: kelvin });
    }
  }

  _saetFarve(hs, slut) {
    const rum = this._kort._rum();
    this._visFarve(hs);
    if (this._lampe) this._send(slut, ["light", "turn_on", { entity_id: this._lampe, hs_color: hs }], { type: "farve", vaerdi: hs });
    else this._send(slut, ["rumlys", "anvend_lys", Object.assign({ rum: rum.id, lys: { type: "farve", farve: hs } }, this._kort._valg())], { type: "farve", vaerdi: hs });
  }

  // Efter en kommando viser menuen den valgte værdi i 2,5 sekunder, så skyderen ikke hopper
  // tilbage, mens lamperne endnu ikke har meldt den nye tilstand.
  _send(slut, kald, vent) {
    const nu = Date.now();
    this._vent = Object.assign({ til: nu + 2500, maal: this._lampe }, vent);
    if (!slut && nu - this._sendt < 400) return;
    const noegle = JSON.stringify(kald);
    if (noegle === this._sidsteKald && nu - this._sendt < 2500) return;
    this._sendt = nu;
    this._sidsteKald = noegle;
    this._hass.callService(kald[0], kald[1], kald[2]);
  }

  _kelvinOmraade() {
    if (this._lampe) {
      const st = this._hass.states[this._lampe];
      return kelvinOmraade((st && st.attributes) || {});
    }
    return kelvinGraenser(this._hass, this._kort._lamper());
  }

  _visLysstyrke(vaerdi) {
    const e = this._el;
    e.lysFyld.style.height = vaerdi + "%";
    e.lysGreb.style.bottom = "clamp(14px, calc(" + vaerdi + "% - 14px), calc(100% - 14px))";
    e.vaerdi.textContent = vaerdi > 0 ? vaerdi + " %" : this.t("slukket");
    this._vist.lysstyrke = vaerdi / 100;
  }

  _visHvid(kelvin, min, max) {
    const e = this._el;
    const andel = Math.min(1, Math.max(0, (kelvin - min) / (max - min)));
    e.hvidGreb.classList.remove("skjult");
    e.hvidGreb.style.bottom = "clamp(14px, " + (andel * 100).toFixed(1) + "%, calc(100% - 14px))";
    e.vaerdi.textContent = Math.round(kelvin) + " K";
    this._vist.hvid = andel;
  }

  _visFarve(hs) {
    const e = this._el;
    const r = 50 * (hs[1] / 100);
    const v = (hs[0] * Math.PI) / 180;
    e.markoer.classList.remove("skjult");
    e.markoer.style.left = (50 + Math.sin(v) * r).toFixed(2) + "%";
    e.markoer.style.top = (50 - Math.cos(v) * r).toFixed(2) + "%";
    e.markoer.style.background = "hsl(" + hs[0] + ", 100%, " + (100 - hs[1] / 2) + "%)";
    e.vaerdi.textContent = "";
  }

  opdater() {
    const k = this._kort;
    const e = this._el;
    if (!k || !e || !this.isConnected) return;
    const hass = this._hass;
    const rum = k._rum();
    if (!hass || !rum) return;
    const rummet = !this._lampe;
    const lamper = this._lamper();
    const tilstande = lamper.map((id) => hass.states[id]).filter(Boolean);
    const taendte = tilstande.filter((st) => st.state === "on");
    const taendt = taendte.length > 0;
    const kan = {
      lysstyrke: tilstande.some(daempbar),
      farve: kanFarve(hass, lamper),
    };
    kan.hvid = paerer(hass, lamper).some((id) => ((hass.states[id] && hass.states[id].attributes.supported_color_modes) || []).indexOf("color_temp") >= 0) || kan.farve;
    if (!kan[this._tilstand]) this._tilstand = kan.lysstyrke ? "lysstyrke" : null;

    e.tilbage.classList.toggle("skjult", rummet);
    e.luk.classList.toggle("skjult", !rummet);
    e.tilbage.setAttribute("aria-label", this.t("tilbage"));
    e.luk.setAttribute("aria-label", this.t("luk"));
    e.detaljer.setAttribute("aria-label", this.t("detaljer"));
    e.detaljer.title = this.t("detaljer");
    e.detaljer.classList.toggle("skjult", rummet);
    const lampeTilstand = rummet ? null : hass.states[this._lampe];
    e.navn.textContent = rummet ? k._navn() : (lampeTilstand && lampeTilstand.attributes.friendly_name) || this._lampe;
    e.status.textContent = rummet ? k._el.status.textContent : lampeStatus(hass, lampeTilstand);

    const farver = rummetsFarver(hass, lamper, k._katalog, () => this.opdater());
    const lyst = farver.length > 0 && farver.reduce((s, f) => s + luminans(f), 0) / farver.length > 0.179;
    e.d.style.setProperty("--rm-fyld", overgang(farver, "0deg") || "var(--primary-color)");
    e.d.style.setProperty("--rm-taend", overgang(farver, "135deg") || "var(--primary-color)");
    e.d.style.setProperty("--rm-taend-tekst", lyst ? "rgba(0, 0, 0, 0.87)" : "#fff");
    e.taend.classList.toggle("til", taendt);
    e.taend.setAttribute("aria-label", this.t("taend_sluk"));
    e.taend.disabled = !tilstande.some((st) => st.state !== "unavailable" && st.state !== "unknown");

    let valgbare = 0;
    e.valg.forEach((b) => {
      b.classList.toggle("skjult", !kan[b.dataset.t]);
      b.classList.toggle("aktiv", b.dataset.t === this._tilstand);
      b.setAttribute("aria-label", this.t({ lysstyrke: "lysstyrke", hvid: "hvidt", farve: "farve" }[b.dataset.t]));
      if (kan[b.dataset.t]) valgbare += 1;
    });
    e.adskil.classList.toggle("skjult", !valgbare);
    e.styring.classList.toggle("skjult", !this._tilstand);
    e.vaerdi.classList.toggle("skjult", !this._tilstand);
    e.lys.classList.toggle("skjult", this._tilstand !== "lysstyrke");
    e.hvid.classList.toggle("skjult", this._tilstand !== "hvid");
    e.hjul.classList.toggle("skjult", this._tilstand !== "farve");

    const vent = this._vent && this._vent.til > Date.now() && this._vent.maal === this._lampe ? this._vent : null;
    const venter = (type) => this._traek === type || (vent && vent.type === type);
    // Den første tændte lampe viser hvidt lys og farve for rummet; lysstyrken er den lyseste.
    const foerste = taendte[0];
    if (this._tilstand === "lysstyrke" && !venter("lysstyrke")) {
      this._visLysstyrke(taendt ? Math.max(...taendte.map(pct)) : 0);
    } else if (this._tilstand === "hvid") {
      const [min, max] = this._kelvinOmraade();
      e.hvid.style.background = hvidOvergang(min, max);
      if (!venter("hvid")) {
        if (foerste && foerste.attributes.color_mode === "color_temp" && Number(foerste.attributes.color_temp_kelvin) > 0) {
          this._visHvid(Number(foerste.attributes.color_temp_kelvin), min, max);
        } else {
          e.hvidGreb.classList.add("skjult");
          e.vaerdi.textContent = taendt ? "" : this.t("slukket");
        }
      }
    } else if (this._tilstand === "farve" && !venter("farve")) {
      const hs = foerste && Array.isArray(foerste.attributes.hs_color) ? foerste.attributes.hs_color.map(Number) : null;
      if (hs && foerste.attributes.color_mode !== "color_temp") this._visFarve(hs);
      else {
        e.markoer.classList.add("skjult");
        e.vaerdi.textContent = taendt ? "" : this.t("slukket");
      }
    }

    // «Hold lys», scener og lamper hører til rummet og vises kun på forsiden af menuen.
    const hold = k._delvis() ? null : hass.states[rum.entiteter.hold];
    e.hold.classList.toggle("skjult", !rummet || !hold);
    if (rummet && hold) {
      const aktiv = hold.state === "on";
      e.hold.classList.toggle("aktiv", aktiv);
      const rest = aktiv && hold.attributes.slutter ? restTekst(hass, new Date(hold.attributes.slutter) - Date.now()) : "";
      const tid = hass.states[rum.entiteter.hold_tid];
      e.holdtekst.textContent = aktiv
        ? this.t("slutter_om", { tid: rest })
        : this.t("hold_lyset") + (tid ? " · " + this.t("i_timer", { tid: restTekst(hass, Number(tid.state) * 3600000) }) : "");
    }

    const scener = rummet ? k._rummetsScener() : [];
    const sceneNoegle = scener.map((s) => s.id).join(",");
    if (sceneNoegle !== this._sceneNoegle) {
      this._sceneNoegle = sceneNoegle;
      e.scener.textContent = "";
      scener.forEach((s) => e.scener.appendChild(sceneKnap(hass, s, (knap) => k._anvendScene(s.id, knap))));
    }
    e.sceneOverskrift.textContent = this.t("scener");
    e.scenesektion.classList.toggle("skjult", !rummet || !scener.length);

    // Lamperne: rummets egne, eller pærerne i gruppen, når rummet kun har én gruppe.
    const rumLamper = k._lamper();
    const liste = rummet ? (rumLamper.length === 1 ? paerer(hass, rumLamper).filter((id) => id !== rumLamper[0] && hass.states[id]) : rumLamper.filter((id) => hass.states[id])) : [];
    e.lampeOverskrift.textContent = this.t("lamper");
    e.lampesektion.classList.toggle("skjult", liste.length < 2);
    if (liste.length >= 2) this._opdaterLamper(liste, rum);

    const admin = !!(hass.user && hass.user.is_admin);
    e.indstillinger.classList.toggle("skjult", !rummet || !admin);
    e.indstillinger.querySelector("span").textContent = this.t("indstillinger_for", { navn: rum.navn });
  }

  _opdaterLamper(ids, rum) {
    const e = this._el;
    const hass = this._hass;
    const noegle = ids.join(",");
    if (noegle !== this._lampeNoegle) {
      this._lampeNoegle = noegle;
      this._raekker = {};
      e.paerer.textContent = "";
      ids.forEach((id) => {
        const r = {
          prik: h("span", { class: "prik" }),
          navn: h("div", { class: "pnavn" }),
          status: h("div", { class: "pstatus" }),
          skyder: h("input", { class: "skyder", type: "range", min: "0", max: "100", step: "1" }),
          kontakt: h("button", { class: "kontakt", type: "button", role: "switch" }, h("span", { class: "knop" })),
          traekker: false,
        };
        const raekke = h("div", { class: "paere" }, r.prik, h("div", { class: "ptekst" }, r.navn, r.status), r.skyder, r.kontakt);
        raekke.addEventListener("click", () => {
          this._lampe = id;
          this._tilstand = "lysstyrke";
          this.opdater();
          e.indhold.scrollTop = 0;
        });
        ["click", "pointerdown", "touchstart"].forEach((t) => {
          r.skyder.addEventListener(t, (ev) => ev.stopPropagation(), { passive: true });
        });
        r.skyder.addEventListener("input", () => {
          r.traekker = true;
          r.skyder.style.setProperty("--rl-pct", r.skyder.value + "%");
        });
        r.skyder.addEventListener("change", () => {
          r.traekker = false;
          const vaerdi = Number(r.skyder.value);
          hass.callService("light", vaerdi <= 0 ? "turn_off" : "turn_on", vaerdi <= 0 ? { entity_id: id } : { entity_id: id, brightness_pct: vaerdi });
        });
        r.kontakt.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this._skift([id]);
        });
        this._raekker[id] = r;
        e.paerer.appendChild(raekke);
      });
    }
    ids.forEach((id) => {
      const r = this._raekker[id];
      const st = hass.states[id];
      const a = st.attributes;
      const taendt = st.state === "on";
      r.prik.style.background = taendt ? css(lysFarve(a)) : "transparent";
      r.navn.textContent = kortNavn(a.friendly_name || id, rum.navn);
      r.navn.title = a.friendly_name || id;
      r.status.textContent = lampeStatus(hass, st);
      r.skyder.classList.toggle("skjult", !daempbar(st));
      r.skyder.disabled = r.kontakt.disabled = st.state === "unavailable" || st.state === "unknown";
      if (!r.traekker) {
        const vaerdi = taendt ? pct(st) : 0;
        r.skyder.value = String(vaerdi);
        r.skyder.style.setProperty("--rl-pct", vaerdi + "%");
      }
      r.kontakt.classList.toggle("til", taendt);
      r.kontakt.setAttribute("aria-checked", taendt ? "true" : "false");
    });
  }
}

/* ---------- kortets opsætning ---------- */

const EDITOR_STYLE = `
  :host { display:block; }
  .felt { display:grid; gap:6px; margin-bottom:16px; }
  label, .etiket { font-size:12px; font-weight:500; color:var(--secondary-text-color); }
  select { font:inherit; color:var(--primary-text-color); background:var(--secondary-background-color, #f3f3f3); border:1px solid var(--divider-color, #ddd); border-radius:10px; padding:10px 12px; min-height:42px; }
  .valg { display:inline-flex; gap:4px; background:var(--secondary-background-color, #f3f3f3); border-radius:999px; padding:3px; flex-wrap:wrap; }
  .valg button { border:0; background:transparent; border-radius:999px; padding:6px 14px; cursor:pointer; font:inherit; font-size:13px; color:var(--secondary-text-color); }
  .valg button.valgt { background:var(--card-background-color, #fff); color:var(--primary-text-color); box-shadow:0 1px 3px rgba(0,0,0,.15); }
  p { font-size:13px; color:var(--secondary-text-color); margin:0; }
`;

// Kortets opsætning er rummet og udseendet. Hvilke lamper kortet viser, vælges i Rumlys under rummet.
class RumlysCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._rummene = null;
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    // Et kort sat ind før 0.4.11 eller skrevet i kode har intet id: det får et, så det kan få sin boks i Rumlys.
    if (!this._config.kort) {
      this._skift("kort", nytKortId());
      return;
    }
    this._tegn();
  }

  set hass(hass) {
    const foerste = !this._hass;
    this._hass = hass;
    if (foerste) {
      hentRum(hass).then((r) => { this._rummene = r; this._tegn(); }, () => { this._rummene = []; this._tegn(); });
    }
  }

  _skift(noegle, vaerdi) {
    const config = Object.assign({}, this._config);
    if (vaerdi === undefined || vaerdi === "") delete config[noegle];
    else config[noegle] = vaerdi;
    // Et ældre kort med rummets id går over til området, når rummet vælges igen. Lamper fra 0.4.9–0.4.10
    // hørte til det gamle rum.
    if (noegle === "omraade") {
      delete config.rum;
      delete config.lamper;
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    this._tegn();
  }

  _tegn() {
    if (!this._hass || !this._config) return;
    const t = (n) => tekst(this._hass, n);
    // Alle husets rum: dem, der er sat op i Rumlys, først.
    const rummene = this._rummene || [];
    const satOp = new Set(rummene.map((r) => r.omraade));
    const omraader = Object.values(this._hass.areas || {}).sort((a, b) => a.name.localeCompare(b.name, this._hass.language));
    const gammelt = rummene.find((r) => r.id === this._config.rum);
    const valgt = this._config.omraade || (gammelt ? gammelt.omraade : "");
    const vaelger = h("select", {});
    vaelger.appendChild(h("option", { value: "" }, "—"));
    [
      ["gruppe_sat_op", omraader.filter((o) => satOp.has(o.area_id))],
      ["gruppe_ikke_sat_op", omraader.filter((o) => !satOp.has(o.area_id))],
    ].forEach(([gruppe, liste]) => {
      if (liste.length) vaelger.appendChild(h("optgroup", { label: t(gruppe) }, liste.map((o) => h("option", { value: o.area_id }, o.name))));
    });
    vaelger.value = valgt;
    vaelger.addEventListener("change", () => this._skift("omraade", vaelger.value));
    const ikkeSatOp = !!valgt && !!this._rummene && !satOp.has(valgt);
    const knapper = (noegle, muligheder, standard) => {
      const nu = this._config[noegle] || standard;
      return h("div", { class: "valg" }, ...muligheder.map(([vaerdi, navn]) => {
        const knap = h("button", { type: "button", class: vaerdi === nu ? "valgt" : "" }, t(navn));
        knap.addEventListener("click", () => this._skift(noegle, vaerdi === standard ? undefined : vaerdi));
        return knap;
      }));
    };
    const r = this.shadowRoot;
    r.textContent = "";
    r.append(
      h("style", {}, EDITOR_STYLE),
      h("div", { class: "felt" }, h("label", {}, t("vaelg_rum")), vaelger, ikkeSatOp ? h("p", {}, t("ikke_sat_op_hint")) : null),
      h("div", { class: "felt" }, h("span", { class: "etiket" }, t("stoerrelse")), knapper("size", [["small", "lille"], ["medium", "mellem"], ["large", "stor"]], "medium")),
      h("div", { class: "felt" }, h("span", { class: "etiket" }, t("scenefelter")), knapper("scene_size", [["small", "smaa"], ["large", "store"]], "small")),
      h("p", {}, t("kort_hint"))
    );
  }
}

customElements.define(NAVN, RumlysCard);
customElements.define(NAVN + "-menu", RumlysMenu);
customElements.define(NAVN + "-editor", RumlysCardEditor);

// Kortet står ikke i Home Assistants «Tilføj kort»-liste: det sættes ind fra Rumlys under rummets «Kort»,
// så Rumlys kender det fra første sekund. Et kort, der alligevel kommer ind — YAML, «Duplikér» eller en
// gendannet backup — klarer fanens regel.
console.info("%c RUMLYS-KORT %c " + VERSION + " ", "color:#fff;background:#F5A623;font-weight:700;border-radius:3px 0 0 3px", "color:#fff;background:#3373A3;font-weight:700;border-radius:0 3px 3px 0");
