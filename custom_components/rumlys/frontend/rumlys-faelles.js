/*
  Rumlys: det sidepanelet og kortet deler — tekster, farver, scener og tider.
  Farveregningen er flyttet hertil fra Room Light Card 2.3.0, hvor den er afprøvet på
  ha-martin: hvidt lys tegnes som i Hue-appen, og en hvid scene genkendes på pærerne.
*/

export const VERSION = "0.4.3";
// Mappen, filen selv ligger i — i Home Assistant med versionen i stien, på testsiden repoets egen.
export const FILER = new URL("./", import.meta.url).href;
// Scenerne ligger i Rumlys selv; findes de ikke, bruges en installeret Scene Presets.
const SCENE_KILDER = [
  [FILER + "scener/scener.json", FILER + "scener/"],
  ["/assets/scene_presets/scene_presets.json", "/assets/scene_presets/"],
];
export const OPDATERET = "rumlys-opdateret";

/* ---------- tekster ---------- */

const TEKSTER = {
  da: {
    titel: "Rumlys",
    nyt_rum: "Nyt rum",
    nyt_rum_hint: "Vælg området. Rummet får områdets navn, og områdets lamper og sensorer er valgt på forhånd.",
    har_rum: "Har allerede et rum i Rumlys",
    opret: "Opret rum",
    annuller: "Annullér",
    gem_rum: "Gem rum",
    fortryd: "Fortryd",
    alt_gemt: "Alt er gemt",
    ikke_gemt: "Ændringer er ikke gemt",
    gemt: "Rummet er gemt",
    tilbage: "Tilbage",
    ingen_rum: "Der er ingen rum endnu. Opret det første med «Nyt rum».",
    ikke_sat_op: "Rumlys er ikke sat op. Tilføj integrationen under Enheder og tjenester.",
    kan_ikke_hentes: "Rummet kunne ikke hentes.",
    kan_ikke_gemmes: "Rummet kunne ikke gemmes: {fejl}",
    lampe_1: "1 lampe",
    lamper_n: "{n} lamper",
    sensor_1: "1 sensor",
    sensorer_n: "{n} sensorer",
    ingen_sensor: "ingen sensor",
    tidsrum_1: "1 tidsrum",
    tidsrum_n: "{n} tidsrum",
    t_slukket: "Slukket",
    t_bevaegelse: "Tændt af sensor",
    t_haand: "Valgt lys",
    t_hold: "Holdes tændt",
    slukker_om: "slukker om {tid}",
    til_kl: "til {kl}",
    rummet: "Rummet",
    omraade: "Område i Home Assistant",
    omraade_hint: "Rummet hedder det samme som området og følger med, hvis området omdøbes. Lamper og sensorer foreslås fra området, og enheden lægges i området.",
    slet_rum: "Slet rummet",
    slet_spoergsmaal: "Slet {navn}? Rummets enhed og entiteter forsvinder fra Home Assistant.",
    slet: "Slet",
    lamper: "Lamper",
    lamper_hint: "Vælg rummets lamper. Er en gruppe valgt, skjules dens pærer, så de ikke styres to gange.",
    taender_ved_bevaegelse: "Tænder ved bevægelse",
    gruppe_med: "Gruppe med {n}",
    fra_omraade: "Fra {omraade}",
    uden_omraade: "Uden område",
    vis_andre: "Vis lamper fra andre områder",
    lamper_andre: "Lamper fra andre områder",
    ingen_lamper: "Området har ingen lamper.",
    sensorer: "Sensorer",
    sensorer_hint: "Lyset tænder, når en af dem ser nogen. Uden sensor slukker lyset kun efter tiden for valgt lys.",
    ser_nogen: "Ser nogen nu",
    ingen_sensorer: "Området har ingen bevægelsessensorer.",
    blod: "Blød tænd og sluk",
    sek: "{n} sek.",
    min: "{n} min",
    timer: "{n} t",
    aldrig: "Aldrig",
    tidsplan: "Tidsplan",
    tidsplan_hint: "Tidsrummene gælder oven på «Hele døgnet». Overlapper to, gælder det øverste på listen. Vælger nogen selv et lys, husker rummet det, til et andet tidsrum tager over.",
    hele_doegnet: "Hele døgnet",
    naar_intet: "Når intet tidsrum gælder",
    tilfoej_tidsrum: "Tilføj tidsrum",
    tidsrum: "Tidsrum",
    navn: "Navn",
    navn_hint: "Fx Dag eller Nat",
    fra: "Fra",
    til: "Til",
    over_midnat: "Går over midnat og hører til den dag, det begynder.",
    et_doegn: "Samme klokkeslæt i Fra og Til er et helt døgn.",
    et_doegn_fra: "Et døgn fra {kl}",
    dage: "Dage",
    alle_dage: "Alle dage",
    hverdage: "Hverdage",
    weekend: "Weekend",
    dag_0: "Mandag",
    dag_1: "Tirsdag",
    dag_2: "Onsdag",
    dag_3: "Torsdag",
    dag_4: "Fredag",
    dag_5: "Lørdag",
    dag_6: "Søndag",
    kort_dag_0: "Man",
    kort_dag_1: "Tir",
    kort_dag_2: "Ons",
    kort_dag_3: "Tor",
    kort_dag_4: "Fre",
    kort_dag_5: "Lør",
    kort_dag_6: "Søn",
    mangler_navn: "Tidsrummet skal have et navn.",
    mangler_tid: "Vælg både Fra og Til.",
    mangler_dage: "Vælg mindst én dag.",
    lys: "Lys",
    egen_slukketid: "Egen slukketid",
    egen_slukketid_hint: "Ellers gælder rummets egen tid for automatisk lys",
    gem: "Gem",
    ingen_i_rummet: "Når ingen er i rummet",
    ingen_hint: "Hvor længe lyset bliver, efter at sensoren ikke ser nogen. Er nogen i rummet, slukker det aldrig.",
    auto_lys: "Lys tændt af sensoren",
    auto_sub: "Slukker efter",
    valgt_lys: "Lys, som nogen selv har valgt",
    valgt_sub: "På kortet, med en scene, i appen eller på væggen. «Aldrig» betyder, at det ikke slukker af sig selv",
    hold: "Hold lys tændt",
    hold_hint: "Slås til med «Hold lys» øverst på siden eller på kortet. Sensoren og nedtællingen er så ude af spil, til lyset slukkes i hånden, eller tiden er gået.",
    hold_i: "Holder lyset tændt i",
    hold_lys: "Hold lys",
    slaa_fra: "Slå fra",
    sluk: "Sluk",
    scener_paa_kortet: "Scener på kortet",
    scener_hint: "De samme scener vises på alle kort for rummet. Træk for at ændre rækkefølgen.",
    tilfoej_scener: "Tilføj scener",
    soeg: "Søg efter scene eller kategori",
    faerdig: "Færdig",
    ingen_scener: "Ingen scener på kortet.",
    haendelser: "Seneste hændelser",
    haendelser_hint: "Hvad rummet har gjort og hvorfor.",
    vis_alle: "Vis alle",
    ingen_haendelser: "Ingen hændelser endnu.",
    h_taendt_rummet: "Nogen kom ind: tændt med lyset for «Hele døgnet»",
    h_taendt_tidsrum: "Nogen kom ind: tændt med lyset for {navn}",
    h_taendt_husket: "Nogen kom ind: tændt med det valgte lys",
    h_slukket_bevaegelse: "Slukket: ingen i rummet, automatisk lys",
    h_slukket_haand: "Slukket: ingen i rummet, valgt lys",
    h_valgt: "Lyset valgt i hånden",
    h_slukket_i_haanden: "Slukket i hånden",
    h_hold_til: "Hold lys slået til",
    h_hold_fra: "Hold lys slået fra",
    h_hold_udloebet: "Hold lys er udløbet",
    h_tidsrum: "Nyt tidsrum: {navn}",
    h_tidsrum_slut: "Tidsrummet sluttede: lyset for «Hele døgnet»",
    vaelg_lys: "Vælg lys",
    scene: "Scene",
    farve: "Farve",
    hvidt: "Hvidt lys",
    kun: "Kun lysstyrke",
    varm: "Varm",
    kold: "Kold",
    lysstyrke: "Lysstyrke",
    kun_hint: "Kun lysstyrken ændres. Lampernes farve bliver, som den er.",
    tryk_hjul: "Tryk i hjulet for at vælge farve",
    vaelg: "Vælg",
    ingen_katalog: "Scenerne kunne ikke hentes.",
    b_hvid: "Hvidt lys · {k} K",
    b_farve: "Farve",
    b_scene: "Scene · {navn}",
    b_kun: "Kun lysstyrke",
    taendt: "Tændt",
    slukket: "Slukket",
    utilgaengelig: "Utilgængelig",
    holdes_i: "holdes tændt i {tid}",
    hold_lyset: "Hold lyset tændt",
    i_timer: "I {tid}",
    slutter_om: "Slutter om {tid} · tryk for at slå fra",
    scener: "Scener",
    indstillinger_for: "Indstillinger for {navn}",
    vaelg_rum: "Rum",
    rum_findes_ikke: "Rummet findes ikke i Rumlys",
    stoerrelse: "Størrelse",
    lille: "Lille",
    mellem: "Mellem",
    stor: "Stor",
    scenefelter: "Scenefelter",
    smaa: "Små",
    store: "Store med navn",
    kort_hint: "Lamper, hold lys og scener hentes fra rummet. De rettes i Rumlys i sidepanelet.",
    vaelg_rum_hint: "Vælg rummet i kortets opsætning",
    taend_sluk: "Tænd eller sluk",
    luk: "Luk",
    detaljer: "Historik og indstillinger i Home Assistant",
    findes_ikke: "Findes ikke",
    kort_navn: "Rumlys",
    kort_beskrivelse: "Lyset i et rum fra Rumlys: lysstyrke, hold lys og rummets scener.",
  },
  en: {
    titel: "Rumlys",
    nyt_rum: "New room",
    nyt_rum_hint: "Choose the area. The room takes the area's name, and the area's lights and sensors are selected in advance.",
    har_rum: "Already has a room in Rumlys",
    opret: "Create room",
    annuller: "Cancel",
    gem_rum: "Save room",
    fortryd: "Undo",
    alt_gemt: "Everything is saved",
    ikke_gemt: "Changes are not saved",
    gemt: "The room is saved",
    tilbage: "Back",
    ingen_rum: "There are no rooms yet. Create the first with «New room».",
    ikke_sat_op: "Rumlys is not set up. Add the integration under Devices & services.",
    kan_ikke_hentes: "The room could not be loaded.",
    kan_ikke_gemmes: "The room could not be saved: {fejl}",
    lampe_1: "1 light",
    lamper_n: "{n} lights",
    sensor_1: "1 sensor",
    sensorer_n: "{n} sensors",
    ingen_sensor: "no sensor",
    tidsrum_1: "1 period",
    tidsrum_n: "{n} periods",
    t_slukket: "Off",
    t_bevaegelse: "On by sensor",
    t_haand: "Chosen light",
    t_hold: "Kept on",
    slukker_om: "turns off in {tid}",
    til_kl: "until {kl}",
    rummet: "The room",
    omraade: "Area in Home Assistant",
    omraade_hint: "The room has the same name as the area and follows if the area is renamed. Lights and sensors are suggested from the area, and the device is placed in the area.",
    slet_rum: "Delete room",
    slet_spoergsmaal: "Delete {navn}? The room's device and entities disappear from Home Assistant.",
    slet: "Delete",
    lamper: "Lights",
    lamper_hint: "Choose the room's lights. When a group is chosen, its bulbs are hidden so they are not controlled twice.",
    taender_ved_bevaegelse: "Turns on with motion",
    gruppe_med: "Group of {n}",
    fra_omraade: "From {omraade}",
    uden_omraade: "No area",
    vis_andre: "Show lights from other areas",
    lamper_andre: "Lights from other areas",
    ingen_lamper: "The area has no lights.",
    sensorer: "Sensors",
    sensorer_hint: "The light turns on when one of them sees someone. Without a sensor, the light only turns off after the time for chosen light.",
    ser_nogen: "Sees someone now",
    ingen_sensorer: "The area has no motion sensors.",
    blod: "Soft on and off",
    sek: "{n} s",
    min: "{n} min",
    timer: "{n} h",
    aldrig: "Never",
    tidsplan: "Schedule",
    tidsplan_hint: "The periods apply on top of «All day». If two overlap, the one highest in the list applies. If someone chooses a light, the room remembers it until another period takes over.",
    hele_doegnet: "All day",
    naar_intet: "When no period applies",
    tilfoej_tidsrum: "Add period",
    tidsrum: "Period",
    navn: "Name",
    navn_hint: "For example Day or Night",
    fra: "From",
    til: "To",
    over_midnat: "Runs past midnight and belongs to the day it starts.",
    et_doegn: "The same time in From and To is a whole day.",
    et_doegn_fra: "A whole day from {kl}",
    dage: "Days",
    alle_dage: "Every day",
    hverdage: "Weekdays",
    weekend: "Weekend",
    dag_0: "Monday",
    dag_1: "Tuesday",
    dag_2: "Wednesday",
    dag_3: "Thursday",
    dag_4: "Friday",
    dag_5: "Saturday",
    dag_6: "Sunday",
    kort_dag_0: "Mon",
    kort_dag_1: "Tue",
    kort_dag_2: "Wed",
    kort_dag_3: "Thu",
    kort_dag_4: "Fri",
    kort_dag_5: "Sat",
    kort_dag_6: "Sun",
    mangler_navn: "The period needs a name.",
    mangler_tid: "Choose both From and To.",
    mangler_dage: "Choose at least one day.",
    lys: "Light",
    egen_slukketid: "Own turn-off time",
    egen_slukketid_hint: "Otherwise the room's own time for automatic light applies",
    gem: "Save",
    ingen_i_rummet: "When nobody is in the room",
    ingen_hint: "How long the light stays on after the sensor no longer sees anyone. While someone is in the room, it never turns off.",
    auto_lys: "Light turned on by the sensor",
    auto_sub: "Turns off after",
    valgt_lys: "Light someone has chosen",
    valgt_sub: "On the card, with a scene, in the app or on the wall. «Never» means it does not turn off by itself",
    hold: "Keep light on",
    hold_hint: "Turned on with «Keep on» at the top of the page or on the card. The sensor and the countdown are then out of play until the light is turned off by hand or the time is up.",
    hold_i: "Keeps the light on for",
    hold_lys: "Keep on",
    slaa_fra: "Turn off",
    sluk: "Turn off",
    scener_paa_kortet: "Scenes on the card",
    scener_hint: "The same scenes are shown on every card for the room. Drag to change the order.",
    tilfoej_scener: "Add scenes",
    soeg: "Search for a scene or category",
    faerdig: "Done",
    ingen_scener: "No scenes on the card.",
    haendelser: "Recent events",
    haendelser_hint: "What the room has done and why.",
    vis_alle: "Show all",
    ingen_haendelser: "No events yet.",
    h_taendt_rummet: "Someone came in: on with the light for «All day»",
    h_taendt_tidsrum: "Someone came in: on with the light for {navn}",
    h_taendt_husket: "Someone came in: on with the chosen light",
    h_slukket_bevaegelse: "Off: nobody in the room, automatic light",
    h_slukket_haand: "Off: nobody in the room, chosen light",
    h_valgt: "Light chosen by hand",
    h_slukket_i_haanden: "Turned off by hand",
    h_hold_til: "Keep light on turned on",
    h_hold_fra: "Keep light on turned off",
    h_hold_udloebet: "Keep light on ran out",
    h_tidsrum: "New period: {navn}",
    h_tidsrum_slut: "The period ended: the light for «All day»",
    vaelg_lys: "Choose light",
    scene: "Scene",
    farve: "Colour",
    hvidt: "White light",
    kun: "Brightness only",
    varm: "Warm",
    kold: "Cool",
    lysstyrke: "Brightness",
    kun_hint: "Only the brightness changes. The lights keep their colour.",
    tryk_hjul: "Tap the wheel to choose a colour",
    vaelg: "Choose",
    ingen_katalog: "The scenes could not be loaded.",
    b_hvid: "White light · {k} K",
    b_farve: "Colour",
    b_scene: "Scene · {navn}",
    b_kun: "Brightness only",
    taendt: "On",
    slukket: "Off",
    utilgaengelig: "Unavailable",
    holdes_i: "kept on for {tid}",
    hold_lyset: "Keep the light on",
    i_timer: "For {tid}",
    slutter_om: "Ends in {tid} · tap to turn off",
    scener: "Scenes",
    indstillinger_for: "Settings for {navn}",
    vaelg_rum: "Room",
    rum_findes_ikke: "The room does not exist in Rumlys",
    stoerrelse: "Size",
    lille: "Small",
    mellem: "Medium",
    stor: "Large",
    scenefelter: "Scene tiles",
    smaa: "Small",
    store: "Large with name",
    kort_hint: "Lights, keep light on and scenes come from the room. They are edited in Rumlys in the sidebar.",
    vaelg_rum_hint: "Choose the room in the card's settings",
    taend_sluk: "Turn on or off",
    luk: "Close",
    detaljer: "History and settings in Home Assistant",
    findes_ikke: "Does not exist",
    kort_navn: "Rumlys",
    kort_beskrivelse: "The light in a room from Rumlys: brightness, keep light on and the room's scenes.",
  },
};

export function sprog(hass) {
  const s = String((hass && (hass.locale && hass.locale.language)) || (hass && hass.language) || "da");
  return s.slice(0, 2) === "da" ? "da" : "en";
}

export function tekst(hass, noegle, vaerdier) {
  const tabel = TEKSTER[sprog(hass)];
  let t = tabel[noegle] !== undefined ? tabel[noegle] : TEKSTER.da[noegle] !== undefined ? TEKSTER.da[noegle] : noegle;
  if (vaerdier) Object.keys(vaerdier).forEach((k) => { t = t.split("{" + k + "}").join(String(vaerdier[k])); });
  return t;
}

/* ---------- DOM ---------- */

// Et element med egenskaber og børn. Tekst sættes altid som tekst, aldrig som HTML.
export function h(tag, egenskaber, ...boern) {
  const el = document.createElement(tag);
  Object.entries(egenskaber || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  });
  boern.flat(Infinity).forEach((b) => {
    if (b === null || b === undefined || b === false) return;
    el.appendChild(b instanceof Node ? b : document.createTextNode(String(b)));
  });
  return el;
}

export function ikon(navn, klasse) {
  return h("ha-icon", { icon: navn, class: klasse || "" });
}

/* ---------- farver ---------- */

const FARVE_TILSTANDE = ["xy", "hs", "rgb", "rgbw"];

// Hvidt lys, som Hue-appen tegner det: 2000 K gul-orange, 4200 K hvid, 6500 K lyseblå.
export function hueFarve(kelvin) {
  const k = Math.max(2000, Math.min(6500, kelvin));
  const bland = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return k < 4200
    ? bland([255, 180, 55], [255, 255, 255], (k - 2000) / 2200)
    : bland([255, 255, 255], [190, 228, 243], (k - 4200) / 2300);
}

// Et farvepunkt er hvidt inden for Duv 0,006 af Planck-kurven (ANSI C78.377).
const HVID_DUV = 0.006;

function planckUv(T) {
  const u = (0.860117757 + 1.54118254e-4 * T + 1.28641212e-7 * T * T) / (1 + 8.42420235e-4 * T + 7.08145163e-7 * T * T);
  const v = (0.317398726 + 4.22806245e-5 * T + 4.20481691e-8 * T * T) / (1 - 2.89741816e-5 * T + 1.61456053e-7 * T * T);
  return [u, v];
}

export function afstandTilHvid(x, y) {
  const n = -2 * x + 12 * y + 3;
  const u = (4 * x) / n;
  const v = (6 * y) / n;
  let mindst = 1;
  for (let T = 1000; T <= 20000; T += 25) {
    const p = planckUv(T);
    const d = Math.hypot(u - p[0], v - p[1]);
    if (d < mindst) mindst = d;
  }
  return mindst;
}

export function kelvinForPunkt(x, y) {
  const n = (x - 0.332) / (0.1858 - y);
  return 449 * n * n * n + 3525 * n * n + 6823.3 * n + 5520.33;
}

export function hsRgb(nuanceGrad, maetning) {
  const s = Math.max(0, Math.min(100, maetning)) / 100;
  const f = (n) => {
    const k = (n + nuanceGrad / 60) % 6;
    return Math.round(255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

function xyRgb(x, y) {
  const Y = 1;
  const X = (Y / y) * x;
  const Z = (Y / y) * (1 - x - y);
  let rgb = [
    X * 1.656492 - Y * 0.354851 - Z * 0.255038,
    -X * 0.707196 + Y * 1.655397 + Z * 0.036152,
    X * 0.051713 - Y * 0.121364 + Z * 1.01153,
  ].map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055));
  const maks = Math.max(...rgb, 1e-6);
  rgb = rgb.map((c) => Math.round(Math.max(0, c / maks) * 255));
  return rgb;
}

// Lampens egen farve lige nu: hvidt lys som Hue tegner det, en farve som pærens farve, og en
// pære der kun kan dæmpes, som 2700 K.
export function lysFarve(a) {
  const kelvin = Number(a.color_temp_kelvin);
  if (a.color_mode === "color_temp" && kelvin > 0) return hueFarve(kelvin);
  const xy = a.xy_color;
  if (Array.isArray(xy) && xy.length === 2) {
    const x = Number(xy[0]);
    const y = Number(xy[1]);
    if (afstandTilHvid(x, y) <= HVID_DUV) return hueFarve(kelvinForPunkt(x, y));
  }
  const rgb = a.rgb_color;
  if (Array.isArray(rgb) && rgb.length === 3) return rgb.map(Number);
  return hueFarve(2700);
}

export function nuance(rgb) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  let n = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  n = n * 60 - 195;
  return ((n % 360) + 360) % 360;
}

// Relativ luminans efter WCAG. Over 0,179 giver mørk tekst den bedste kontrast.
export function luminans(rgb) {
  const c = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function css(rgb) {
  return "rgb(" + rgb.join(", ") + ")";
}

export function overgang(farver, retning) {
  if (!farver.length) return "";
  if (farver.length === 1) return css(farver[0]);
  const trin = farver.length - 1;
  return "linear-gradient(" + retning + ", " + farver.map((f, i) => css(f) + " " + Math.round((i * 100) / trin) + "%").join(", ") + ")";
}

// Pærerne bag lamperne: en gruppe foldes ud til sine medlemmer, og hver pære tælles én gang.
export function paerer(hass, ids) {
  const sete = {};
  const ud = [];
  const gaa = (id) => {
    if (sete[id]) return;
    sete[id] = true;
    const st = hass && hass.states ? hass.states[id] : null;
    const a = (st && st.attributes) || {};
    const medlemmer = [].concat(a.group_entities || [], a.entity_id || [])
      .filter((m) => typeof m === "string" && m.indexOf("light.") === 0);
    if (medlemmer.length) medlemmer.forEach(gaa);
    else ud.push(id);
  };
  ids.forEach(gaa);
  return ud;
}

// Den farvetemperatur Scene Presets giver et hvidt farvepunkt: nærmeste punkt i en tabel over
// 2000–6500 K regnet med HA's egne farvefunktioner.
function xyForKelvin(k) {
  const t = k / 100;
  const b = (v) => Math.max(0, Math.min(255, v));
  const r = t <= 66 ? 255 : b(329.698727446 * Math.pow(t - 60, -0.1332047592));
  const g = t <= 66 ? b(99.4708025861 * Math.log(t) - 161.1195681661) : b(288.1221695283 * Math.pow(t - 60, -0.0755148492));
  const bl = t >= 66 ? 255 : t <= 19 ? 0 : b(138.5177312231 * Math.log(t - 10) - 305.0447927307);
  const lin = (c) => (c / 255 > 0.04045 ? Math.pow((c / 255 + 0.055) / 1.055, 2.4) : c / 255 / 12.92);
  const R = lin(r);
  const G = lin(g);
  const B = lin(bl);
  const X = R * 0.664511 + G * 0.154324 + B * 0.162028;
  const Y = R * 0.283881 + G * 0.668433 + B * 0.047685;
  const Z = R * 0.000088 + G * 0.07231 + B * 0.986039;
  return [X / (X + Y + Z), Y / (X + Y + Z)];
}

const KELVIN_TABEL = [];
for (let k = 2000; k <= 6500; k += 50) KELVIN_TABEL.push([k, xyForKelvin(k)]);

function kelvinAfXy(x, y) {
  let bedst = KELVIN_TABEL[0];
  let mindst = Infinity;
  KELVIN_TABEL.forEach((p) => {
    const d = Math.hypot(p[1][0] - x, p[1][1] - y);
    if (d < mindst) {
      mindst = d;
      bedst = p;
    }
  });
  return bedst[0];
}

// Gennemsnitsfarven i en scenes billede, målt i browseren én gang pr. billede.
const billedFarver = {};
const billedMaalinger = {};

function maalBillede(url) {
  if (!billedMaalinger[url]) {
    billedMaalinger[url] = new Promise((resolve) => {
      const billede = new Image();
      billede.onload = () => {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 32;
        const ctx = c.getContext("2d");
        ctx.drawImage(billede, 0, 0, 32, 32);
        const px = ctx.getImageData(0, 0, 32, 32).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < px.length; i += 4) {
          sum[0] += px[i];
          sum[1] += px[i + 1];
          sum[2] += px[i + 2];
        }
        billedFarver[url] = sum.map((s) => Math.round(s / (px.length / 4)));
        resolve(billedFarver[url]);
      };
      billede.onerror = () => resolve(null);
      billede.src = url;
    });
  }
  return billedMaalinger[url];
}

// Hvide scener med de punkter, en pære kan genkendes på: lysstyrke og, for hvert punkt, både
// farvepunktet og den farvetemperatur (mired), en hvid pære får.
function hvideScener(katalog) {
  if (!katalog._hvide) {
    katalog._hvide = katalog.scener
      .filter((s) => s.billede && s.punkter.length && s.punkter.every(([x, y]) => afstandTilHvid(x, y) <= HVID_DUV))
      .map((s) => ({ billede: s.billede, bri: s.bri, punkter: s.punkter.map(([x, y]) => ({ x, y, mired: 1e6 / kelvinAfXy(x, y) })) }));
  }
  return katalog._hvide;
}

// Hvor langt en pære er fra en scenes nærmeste punkt: 1 er grænsen. Pærerne afrunder lidt, så der
// tillades 6 i lysstyrke, 12 mired og 0,01 i farvepunkt. Scenens farvetemperatur klemmes ind i
// pærens eget område først (Aqara T2 CCT kan ikke gå under 2700 K).
function afstandTilPunkt(scene, a) {
  const bri = Number(a.brightness);
  if (!(bri > 0) || Math.abs(bri - scene.bri) > 6) return null;
  const kelvin = Number(a.color_temp_kelvin);
  const koldest = Number(a.max_color_temp_kelvin) > 0 ? 1e6 / Number(a.max_color_temp_kelvin) : 0;
  const varmest = Number(a.min_color_temp_kelvin) > 0 ? 1e6 / Number(a.min_color_temp_kelvin) : Infinity;
  const xy = a.xy_color;
  let bedst = null;
  scene.punkter.forEach((p, i) => {
    let d;
    if (a.color_mode === "color_temp" && kelvin > 0) d = Math.abs(1e6 / kelvin - Math.min(varmest, Math.max(koldest, p.mired))) / 12;
    else if (Array.isArray(xy) && xy.length === 2) d = Math.hypot(Number(xy[0]) - p.x, Number(xy[1]) - p.y) / 0.01;
    else return;
    if (d <= 1 && (!bedst || d < bedst.d)) bedst = { d, i };
  });
  return bedst;
}

// Den hvide scene alle tændte pærer står i. En scene med flere punkter kræver pærer på så mange
// forskellige punkter; ellers ligner én farvetemperatur ved fuld lysstyrke flere scener.
function findHvidScene(scener, lys) {
  let bedst = null;
  let mindst = Infinity;
  scener.forEach((scene) => {
    if (scene.punkter.length > 1 && lys.length < 2) return;
    const brugt = {};
    let sum = 0;
    for (const st of lys) {
      const m = afstandTilPunkt(scene, st.attributes);
      if (!m) return;
      brugt[m.i] = true;
      sum += m.d;
    }
    if (Object.keys(brugt).length < Math.min(lys.length, scene.punkter.length)) return;
    if (sum < mindst) {
      mindst = sum;
      bedst = scene;
    }
  });
  return bedst;
}

// Farverne i lamperne lige nu, uden dubletter og sorteret efter nuance. Står alle tændte pærer i en
// hvid scene, er det farven fra scenens billede; er billedet ikke målt endnu, kaldes efterMaaling.
export function rummetsFarver(hass, lamper, katalog, efterMaaling) {
  const taendte = paerer(hass, lamper)
    .map((id) => hass.states[id])
    .filter((st) => st && st.state === "on");
  const direkte = lamper.map((id) => hass.states[id]).filter((st) => st && st.state === "on");
  const lys = taendte.length ? taendte : direkte;
  if (!lys.length) return [];
  const scene = katalog && katalog.scener.length ? findHvidScene(hvideScener(katalog), lys) : null;
  if (scene && !billedFarver[scene.billede]) maalBillede(scene.billede).then((f) => { if (f && efterMaaling) efterMaaling(); });
  let farver = scene && billedFarver[scene.billede] ? [billedFarver[scene.billede]] : lys.map((st) => lysFarve(st.attributes));
  farver = farver.filter((f, i) => farver.findIndex((g) => g.join() === f.join()) === i);
  farver.sort((x, y) => nuance(x) - nuance(y));
  return farver;
}

export function kanFarve(hass, lamper) {
  return paerer(hass, lamper).some((id) => {
    const st = hass.states[id];
    const modes = (st && st.attributes && st.attributes.supported_color_modes) || [];
    return modes.some((m) => FARVE_TILSTANDE.indexOf(m) >= 0);
  });
}

export function kelvinGraenser(hass, lamper) {
  let min = 6500;
  let max = 2000;
  paerer(hass, lamper).forEach((id) => {
    const a = (hass.states[id] && hass.states[id].attributes) || {};
    if (Number(a.min_color_temp_kelvin) > 0) min = Math.min(min, Number(a.min_color_temp_kelvin));
    if (Number(a.max_color_temp_kelvin) > 0) max = Math.max(max, Number(a.max_color_temp_kelvin));
  });
  return min < max ? [min, max] : [2000, 6500];
}

/* ---------- scener ---------- */

let katalogLoefte = null;

// Scenekataloget: kategorier, scener med billede og farvepunkter. Hentes én gang pr. side.
export function hentScener() {
  if (!katalogLoefte) {
    katalogLoefte = (async () => {
      for (const [url, billeder] of SCENE_KILDER) {
        try {
          const svar = await fetch(url);
          if (!svar.ok) continue;
          const d = await svar.json();
          const kategorier = {};
          (d.categories || []).forEach((c) => { kategorier[c.id] = c.name; });
          const scener = (d.presets || []).map((p) => ({
            id: p.id,
            navn: p.name,
            kategori: kategorier[p.categoryId] || "",
            billede: p.img ? billeder + p.img : null,
            bri: Number(p.bri) > 0 ? Number(p.bri) : 255,
            punkter: (p.lights || []).map((l) => [l.x, l.y]),
          }));
          const efterId = {};
          scener.forEach((s) => { efterId[s.id] = s; });
          return { scener, efterId, kategorier: Object.values(kategorier) };
        } catch (e) {
          // næste kilde
        }
      }
      return { scener: [], efterId: {}, kategorier: [] };
    })();
  }
  return katalogLoefte;
}

// En scenes farver som overgang — til felter uden billede og til tidslinjen.
export function sceneFarver(scene) {
  if (!scene || !scene.punkter.length) return [hueFarve(2700)];
  let farver = scene.punkter.map(([x, y]) => (afstandTilHvid(x, y) <= HVID_DUV ? hueFarve(kelvinForPunkt(x, y)) : xyRgb(x, y)));
  farver = farver.filter((f, i) => farver.findIndex((g) => g.join() === f.join()) === i);
  farver.sort((a, b) => nuance(a) - nuance(b));
  return farver;
}

/* ---------- lysvalg ---------- */

// Et lysvalg som farve til felter og tidslinje.
export function lysvalgBaggrund(lys, katalog) {
  if (!lys) return css(hueFarve(2700));
  if (lys.type === "hvid") return "linear-gradient(135deg, #fffaf3, " + css(hueFarve(Number(lys.kelvin) || 2700)) + ")";
  if (lys.type === "farve" && Array.isArray(lys.farve)) return "linear-gradient(135deg, #ffffff, " + css(hsRgb(lys.farve[0], lys.farve[1])) + ")";
  if (lys.type === "scene") {
    const scene = katalog && katalog.efterId[lys.scene];
    if (scene && scene.billede) return "center / cover no-repeat url('" + scene.billede + "')";
    return overgang(sceneFarver(scene), "135deg");
  }
  return "linear-gradient(135deg, #fffaf3, " + css(hueFarve(2700)) + ")";
}

export function beskrivLys(hass, lys, katalog) {
  if (!lys) return "";
  let t;
  if (lys.type === "hvid") t = tekst(hass, "b_hvid", { k: lys.kelvin });
  else if (lys.type === "farve") t = tekst(hass, "b_farve");
  else if (lys.type === "scene") {
    const scene = katalog && katalog.efterId[lys.scene];
    t = tekst(hass, "b_scene", { navn: scene ? sceneNavn(hass, scene) : lys.scene });
  } else t = tekst(hass, "b_kun");
  return lys.lysstyrke ? t + " · " + lys.lysstyrke + " %" : t;
}

// Danske navne til Hues standardscener.
const DANSKE_SCENER = {
  "b6f58e22-677f-4670-8677-3dea4ac60383": "Natlys",
  "8f55e62a-e5f8-456a-9e8b-61f314bd4e99": "Dæmpet",
  "e03267e7-9914-4f47-97fe-63c0bd317fe7": "Hvile",
  "e71b2ef3-1b15-4c4b-b036-4b3d6efe58f8": "Afslapning",
  "84ebc26c-9d61-4d25-830c-41ea66f1c325": "Klart",
  "035b6ecf-414e-4781-abc7-3911556097cb": "Læs",
  "6d10a807-7330-46d1-b093-c15520ba72c0": "Køligt",
  "0cbec4e8-d064-4457-986a-fe6078a63f39": "Koncentration",
  "0eeacfc5-2d81-4035-a23d-4a9bc02af965": "Energi",
};
export const STANDARDSCENER = Object.keys(DANSKE_SCENER);

export function sceneNavn(hass, scene) {
  if (sprog(hass) === "da" && DANSKE_SCENER[scene.id]) return DANSKE_SCENER[scene.id];
  return scene.navn;
}

// Scene Presets' kategorier på dansk.
const DANSKE_KATEGORIER = {
  Defaults: "Standard",
  Refreshing: "Forfriskende",
  Cozy: "Hyggelig",
  "Party vibes": "Fest",
  Serenity: "Sindsro",
  Dreamy: "Drømmende",
  Peaceful: "Fredfyldt",
  Sunrise: "Solopgang",
  Luxurious: "Luksus",
  Pure: "Rent",
  Lush: "Frodig",
  Futuristic: "Futuristisk",
  Halloween: "Halloween",
  "Winter holidays": "Juletid",
  Daily: "Hverdag",
  "Race Day": "Racerdag",
  Romantic: "Romantisk",
  Vibrant: "Livlig",
  Wanderlust: "Udlængsel",
  Rustic: "Rustik",
  "Misc Additions": "Andet",
  "Winter whisper": "Vinterhvisken",
  "Sports live": "Sport",
};

export function kategoriNavn(hass, navn) {
  return sprog(hass) === "da" && DANSKE_KATEGORIER[navn] ? DANSKE_KATEGORIER[navn] : navn;
}

/* ---------- tider ---------- */

export function restTekst(hass, ms) {
  const sek = Math.max(0, Math.round(ms / 1000));
  if (sek < 60) return tekst(hass, "sek", { n: sek });
  const min = Math.ceil(sek / 60);
  const t = Math.floor(min / 60);
  const m = min % 60;
  if (!t) return tekst(hass, "min", { n: m });
  return m ? tekst(hass, "timer", { n: t }) + " " + tekst(hass, "min", { n: m }) : tekst(hass, "timer", { n: t });
}

export function klokken(hass, iso, medSekunder) {
  const d = new Date(iso);
  const valg = { hour: "2-digit", minute: "2-digit" };
  if (medSekunder) valg.second = "2-digit";
  return d.toLocaleTimeString(sprog(hass) === "da" ? "da-DK" : undefined, valg);
}

/* ---------- rummet lige nu ---------- */

// Tilstanden som tekst, med nedtællingen eller hvornår «hold lys» slutter.
export function statusTekst(hass, entiteter) {
  const tilstand = entiteter && hass.states[entiteter.tilstand];
  if (!tilstand) return "";
  const t = tekst(hass, "t_" + tilstand.state);
  if (tilstand.state === "hold") {
    const hold = hass.states[entiteter.hold];
    const slutter = hold && hold.attributes.slutter;
    return slutter ? t + " " + tekst(hass, "til_kl", { kl: klokken(hass, slutter) }) : t;
  }
  const slukker = tilstand.attributes.slukker;
  if (slukker) return t + " · " + tekst(hass, "slukker_om", { tid: restTekst(hass, new Date(slukker) - Date.now()) });
  return t;
}

export function haendelseTekst(hass, h) {
  switch (h.hvad) {
    case "taendt":
      if (h.lys === "tidsrum") return tekst(hass, "h_taendt_tidsrum", { navn: h.navn });
      return tekst(hass, h.lys === "husket" ? "h_taendt_husket" : "h_taendt_rummet");
    case "slukket":
      return tekst(hass, h.kilde === "haand" ? "h_slukket_haand" : "h_slukket_bevaegelse");
    case "tidsrum":
      return h.navn ? tekst(hass, "h_tidsrum", { navn: h.navn }) : tekst(hass, "h_tidsrum_slut");
    default:
      return tekst(hass, "h_" + h.hvad);
  }
}

// Fortæl kort og sidepanel, at et rum er ændret, så de henter det igen.
export function meldOpdateret(rumId) {
  window.dispatchEvent(new CustomEvent(OPDATERET, { detail: { rum: rumId } }));
}
