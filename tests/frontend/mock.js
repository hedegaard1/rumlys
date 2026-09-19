// Et lille falsk Home Assistant til at se sidepanelet og kortet i en browser uden HA:
//   python tests/frontend/server.py 8766   og åbn /tests/frontend/panel.html
// Home Assistants egne elementer (ha-icon, ha-menu-button) er erstattet af simple udgaver.

const STANDARD = [
  ["b6f58e22-677f-4670-8677-3dea4ac60383", "Nightlight", 2200, 25],
  ["8f55e62a-e5f8-456a-9e8b-61f314bd4e99", "Dimmed", 2700, 77],
  ["e03267e7-9914-4f47-97fe-63c0bd317fe7", "Rest", 2400, 140],
  ["e71b2ef3-1b15-4c4b-b036-4b3d6efe58f8", "Relax", 2700, 144],
  ["84ebc26c-9d61-4d25-830c-41ea66f1c325", "Bright", 2700, 254],
  ["035b6ecf-414e-4781-abc7-3911556097cb", "Read", 3000, 254],
  ["6d10a807-7330-46d1-b093-c15520ba72c0", "Cool bright", 5000, 254],
  ["0cbec4e8-d064-4457-986a-fe6078a63f39", "Concentrate", 4300, 254],
  ["0eeacfc5-2d81-4035-a23d-4a9bc02af965", "Energize", 6300, 254],
];
const XY = { 2200: [0.5019, 0.4152], 2400: [0.4853, 0.4146], 2700: [0.4599, 0.4106], 3000: [0.4369, 0.4041], 4300: [0.3679, 0.3684], 5000: [0.3451, 0.3516], 6300: [0.3164, 0.3267] };
const KATALOG = {
  categories: [{ id: "defaults", name: "Defaults" }, { id: "colors", name: "Colors" }],
  presets: STANDARD.map(([id, name, k, bri]) => ({ id, name, categoryId: "defaults", bri, lights: [{ x: XY[k][0], y: XY[k][1] }] })).concat([
    { id: "trop", name: "Tropical twilight", categoryId: "colors", bri: 180, lights: [{ x: 0.62, y: 0.34 }, { x: 0.25, y: 0.1 }, { x: 0.5, y: 0.41 }] },
    { id: "arktis", name: "Arctic aurora", categoryId: "colors", bri: 200, lights: [{ x: 0.17, y: 0.7 }, { x: 0.15, y: 0.06 }, { x: 0.22, y: 0.33 }] },
    { id: "savanne", name: "Savanna sunset", categoryId: "colors", bri: 200, lights: [{ x: 0.6, y: 0.38 }, { x: 0.53, y: 0.43 }] },
  ]),
};

// Scenerne hentes fra repoets egne filer ved siden af rumlys-faelles.js; Home Assistants faste
// adresse findes ikke her. Uden repoets filer bruges det lille katalog herover i stedet for den
// sidste kilde, Scene Presets.
const aegteFetch = window.fetch.bind(window);
window.fetch = async (url, ...rest) => {
  const svar = await aegteFetch(url, ...rest);
  if (!svar.ok && String(url).indexOf("scene_presets.json") >= 0) return new Response(JSON.stringify(KATALOG), { status: 200 });
  return svar;
};

// Material Design Icons' egne stier for de ikoner, kortet bruger. Et ikon tegnet som et tegn
// (🔒, ⏻) ligner ikke Home Assistant, og laaseknappen saa ud som en tom cirkel paa testsiden,
// selvom den er i orden i HA. Ikoner uden en sti her falder tilbage paa tegnet.
const MDI_STIER = {
  "arrow-left": "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z",
  "brightness-6": "M12,18V6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,15.31L23.31,12L20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  "cog-outline": "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z",
  "lock-clock": "M8.5,2C6,2 4,4 4,6.5V7C2.89,7 2,7.89 2,9V18C2,19.11 2.89,20 4,20H8.72C10.18,21.29 12.06,22 14,22A8,8 0 0,0 22,14A8,8 0 0,0 14,6C13.66,6 13.32,6.03 13,6.08C12.76,3.77 10.82,2 8.5,2M8.5,4A2.5,2.5 0 0,1 11,6.5V7H6V6.5A2.5,2.5 0 0,1 8.5,4M14,8A6,6 0 0,1 20,14A6,6 0 0,1 14,20A6,6 0 0,1 8,14A6,6 0 0,1 14,8M13,10V15L16.64,17.19L17.42,15.9L14.5,14.15V10H13Z",
  power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  lightbulb: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  "lightbulb-group": "M15 14V16A1 1 0 0 1 14 17H10A1 1 0 0 1 9 16V14A5 5 0 1 1 15 14M14 18H10V19A1 1 0 0 0 11 20H13A1 1 0 0 0 14 19M7 19V18H5V19A1 1 0 0 0 6 20H7.17A2.93 2.93 0 0 1 7 19M5 10A6.79 6.79 0 0 1 5.68 7A4 4 0 0 0 4 14.45V16A1 1 0 0 0 5 17H7V14.88A6.92 6.92 0 0 1 5 10M17 18V19A2.93 2.93 0 0 1 16.83 20H18A1 1 0 0 0 19 19V18M18.32 7A6.79 6.79 0 0 1 19 10A6.92 6.92 0 0 1 17 14.88V17H19A1 1 0 0 0 20 16V14.45A4 4 0 0 0 18.32 7Z",
};
const MDI_TEGN = { check: "✓", plus: "+", "chevron-right": "›", drag: "⋮⋮", "delete-outline": "🗑", "home-outline": "⌂", "lightbulb-group-outline": "💡", "motion-sensor": "◎", "lightbulb-auto-outline": "✦", "clock-outline": "◷", "motion-sensor-off": "◌", "palette-outline": "🎨", history: "↺", cog: "⚙", "ceiling-light": "💡" };

customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this.tegn(); }
  attributeChangedCallback() { this.tegn(); }
  set icon(v) { this.setAttribute("icon", v); }
  async tegn() {
    this.style.cssText = "display:inline-grid;place-items:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);font-size:10px;line-height:1";
    const hele = this.getAttribute("icon") || "";
    const [foran, bagved] = hele.split(":", 2);
    let sti = foran === "mdi" ? MDI_STIER[bagved] : null;
    // Rumlys' eget ikonsaet - det samme opslag, Home Assistant selv laver.
    if (!sti && bagved && window.customIcons && window.customIcons[foran]) {
      sti = (await window.customIcons[foran].getIcon(bagved)).path;
    }
    if (sti) {
      this.style.opacity = "";
      this.innerHTML = '<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block"><path fill="currentColor" d="' + sti + '"></path></svg>';
      return;
    }
    this.style.opacity = ".8";
    this.textContent = MDI_TEGN[bagved] || "•";
  }
});
customElements.define("ha-menu-button", class extends HTMLElement {
  connectedCallback() { this.innerHTML = '<button style="border:0;background:transparent;font-size:20px;width:40px;height:40px">☰</button>'; }
});

const om = (min) => new Date(Date.now() + min * 60000).toISOString();
const spots = (rum, n, attr) => {
  const s = {};
  for (let i = 1; i <= n; i++) s[`light.${rum}_spot_${i}`] = { state: attr ? "on" : "off", attributes: Object.assign({ friendly_name: `${rum} Spot ${i}`, icon: "hue:bulb-spot-hung", supported_color_modes: ["color_temp", "xy"], supported_features: 44, min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6535 }, attr || {}) };
  return s;
};
const hvid = (k, b) => ({ brightness: b, color_mode: "color_temp", color_temp_kelvin: k });

export const hass = {
  language: "da",
  locale: { language: "da" },
  user: { is_admin: true },
  // Områderne har deres eget ikon i Home Assistant - det er dét, rumlisten viser.
  areas: {
    entryway: { area_id: "entryway", name: "Entre", icon: "mdi:coat-rack" },
    hallway: { area_id: "hallway", name: "Gang", icon: "mdi:walk" },
    kitchen: { area_id: "kitchen", name: "Køkken", icon: "mdi:countertop" },
    office: { area_id: "office", name: "Kontor", icon: "mdi:chair-rolling" },
    living_room: { area_id: "living_room", name: "Stue", icon: "mdi:sofa" },
    training_room: { area_id: "training_room", name: "Træningsrum", icon: "mdi:run" },
  },
  // Betjeningspanelerne, som frontenden ser dem: navn og om de er i YAML.
  panels: {
    lovelace: { title: "Overblik", config: { mode: "storage" } },
    map: { title: "Kort", config: { mode: "storage" } },
    "dashboard-hjem": { title: "Hjem", config: { mode: "storage" } },
    "dashboard-yaml": { title: "Væg", config: { mode: "yaml" } },
  },
  // Hændelser fra Home Assistant: kun «lovelace_updated», som sendes, når et betjeningspanel gemmes. Forbindelsens
  // «ready» sendes aldrig her — forbindelsen afbrydes ikke.
  connection: {
    subscribeEvents: async (fn, type) => {
      const lytter = { fn, type };
      haendelsesLyttere.push(lytter);
      return () => { haendelsesLyttere = haendelsesLyttere.filter((l) => l !== lytter); };
    },
    addEventListener: () => {},
  },
  // Entitetsregistret, som frontenden ser det: kun lamper med et id kan få et andet ikon.
  entities: {
    "light.kontor_loftspots": { entity_id: "light.kontor_loftspots" },
    "light.kontor_bord_lysband": { entity_id: "light.kontor_bord_lysband", icon: "hue:lightstrip" },
  },
  states: Object.assign(
    {
      "light.kontor_loftspots": { state: "on", attributes: Object.assign({ friendly_name: "Kontor Loftspots", group_entities: [1, 2, 3, 4, 5, 6].map((i) => `light.kontor_spot_${i}`), supported_color_modes: ["color_temp", "xy"], supported_features: 44, min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6535 }, hvid(3508, 255)) },
      "light.kontor_bord_lysband": { state: "on", attributes: { friendly_name: "Kontor Bord Lysbånd", icon: "hue:lightstrip", brightness: 200, color_mode: "xy", xy_color: [0.45, 0.25], rgb_color: [255, 110, 170], supported_color_modes: ["color_temp", "xy"], supported_features: 44 } },
      "light.entre_loftspots": { state: "on", attributes: Object.assign({ friendly_name: "Entre Loftspots" }, hvid(2700, 230)) },
      "light.gang_loftspots": { state: "off", attributes: { friendly_name: "Gang Loftspots" } },
      "light.traeningsrum_loftspots": { state: "on", attributes: { friendly_name: "Træningsrum Loftspots", brightness: 180, color_mode: "hs", hs_color: [35, 80], rgb_color: [255, 170, 60] } },
      "light.traeningsrum_stenlampe": { state: "on", attributes: Object.assign({ friendly_name: "Træningsrum Stenlampe" }, hvid(2400, 120)) },
      "light.stue_loftspots": { state: "off", attributes: { friendly_name: "Stue Loftspots", group_entities: ["light.stue_loftspot_1", "light.stue_loftspot_2"] } },
      "light.stue_sort_gulvlampe": { state: "off", attributes: { friendly_name: "Stue Sort Gulvlampe" } },
      "binary_sensor.lafaer_office": { state: "on", attributes: { friendly_name: "Lafaer tilstedeværelse" } },
      "binary_sensor.4_button_switch_door_tl_office": { state: "off", attributes: { friendly_name: "4-Button Switch - Door (TL) (Kontor)", device_class: "opening" } },
      "binary_sensor.4_button_switch_door_tr_office": { state: "on", attributes: { friendly_name: "4-Button Switch - Door (TR) (Kontor)", device_class: "opening" } },
      "binary_sensor.4_button_switch_door_bl_office": { state: "off", attributes: { friendly_name: "4-Button Switch - Door (BL) (Kontor)", device_class: "opening" } },
      "binary_sensor.4_button_switch_door_br_office": { state: "off", attributes: { friendly_name: "4-Button Switch - Door (BR) (Kontor)", device_class: "opening" } },
      "binary_sensor.gang_pir": { state: "off", attributes: { friendly_name: "Gang bevægelse" } },
      "sensor.kontor_tilstand": { state: "bevaegelse", attributes: { slukker: null } },
      "switch.kontor_hold_lys": { state: "off", attributes: { slutter: null } },
      "sensor.entre_tilstand": { state: "hold", attributes: { slukker: null } },
      "switch.entre_hold_lys": { state: "on", attributes: { slutter: om(122) } },
      "sensor.gang_tilstand": { state: "slukket", attributes: { slukker: null } },
      "switch.gang_hold_lys": { state: "off", attributes: { slutter: null } },
      "sensor.traeningsrum_tilstand": { state: "haand", attributes: { slukker: om(4) } },
      "switch.traeningsrum_hold_lys": { state: "off", attributes: { slutter: null } },
    },
    spots("kontor", 6, hvid(3508, 255))
  ),
  callWS: async (msg) => {
    console.log("callWS", msg);
    const svar = WS[msg.type];
    if (!svar) throw { code: "unknown_command", message: "Ukendt: " + msg.type };
    return typeof svar === "function" ? svar(msg) : JSON.parse(JSON.stringify(svar));
  },
  callService: async (domaene, tjeneste, data) => {
    console.log("callService", domaene, tjeneste, data);
    if (domaene === "switch" && data.entity_id === "switch.kontor_hold_lys") {
      const til = tjeneste === "turn_on";
      hass.states = Object.assign({}, hass.states, {
        "switch.kontor_hold_lys": { state: til ? "on" : "off", attributes: { slutter: til ? om(240) : null } },
        "sensor.kontor_tilstand": { state: til ? "hold" : "bevaegelse", attributes: { slukker: null } },
      });
      opdater();
    }
  },
};

// Rummets egne entiteter, og under «automatik» hver automatiks egne — som Rumlys selv giver dem.
const autEnt = (rum, nr) => ({
  hold: `switch.${rum}_automatik_${nr}_hold_lys`,
  tilstand: `sensor.${rum}_automatik_${nr}_tilstand`,
  sluk_efter_bevaegelse: `number.${rum}_automatik_${nr}_sluk_efter_bevaegelse`,
  sluk_efter_tryk: `number.${rum}_automatik_${nr}_sluk_efter_tryk`,
  hold_tid: `number.${rum}_automatik_${nr}_hold_tid`,
});
const ent = (rum, numre = [1]) => {
  const ud = { hold: `switch.${rum}_hold_lys`, tilstand: `sensor.${rum}_tilstand`, sluk_efter_bevaegelse: null, sluk_efter_tryk: null, hold_tid: null, automatik: {} };
  numre.forEach((nr) => { ud.automatik[String(nr)] = autEnt(rum, nr); });
  return ud;
};
const kontorData = {
  omraade: "office",
  lamper: [{ entity_id: "light.kontor_loftspots", bevaegelse: true }, { entity_id: "light.kontor_bord_lysband", bevaegelse: true }],
  sensorer: ["binary_sensor.lafaer_office"],
  lys: { type: "hvid", lysstyrke: 100, kelvin: 3500 },
  overgang: 3,
  tidsrum: [
    { navn: "Arbejde", start: "08:00:00", slut: "16:00:00", dage: [0, 1, 2, 3, 4], lys: { type: "scene", scene: "0cbec4e8-d064-4457-986a-fe6078a63f39", lysstyrke: 100 } },
    { navn: "Fredagsbar", start: "22:00:00", slut: "02:00:00", dage: [4], lys: { type: "farve", farve: [300, 70], lysstyrke: 70 } },
    { navn: "Aften", start: "19:00:00", slut: "23:30:00", lys: { type: "scene", scene: "e71b2ef3-1b15-4c4b-b036-4b3d6efe58f8", lysstyrke: 60 } },
    { navn: "Weekend", start: "00:00:00", slut: "00:00:00", dage: [5, 6], lys: { type: "hvid", lysstyrke: 80, kelvin: 2700 } },
  ],
  scener: STANDARD.map((s) => s[0]),
  // Fra 0.7.0: to automatikker. Loftspotsene tændes af sensoren og følger tidsplanen; lysbåndet
  // har ingen sensor og gør kun det, nogen selv beder om.
  automatik: [
    {
      id: 1,
      lamper: ["light.kontor_loftspots"],
      sensorer: ["binary_sensor.lafaer_office"],
      lys: { type: "hvid", lysstyrke: 100, kelvin: 3500 },
      overgang: 3,
      tidsrum: [
        { navn: "Arbejde", start: "08:00:00", slut: "16:00:00", dage: [0, 1, 2, 3, 4], lys: { type: "scene", scene: "0cbec4e8-d064-4457-986a-fe6078a63f39", lysstyrke: 100 } },
        { navn: "Fredagsbar", start: "22:00:00", slut: "02:00:00", dage: [4], lys: { type: "farve", farve: [300, 70], lysstyrke: 70 } },
        { navn: "Aften", start: "19:00:00", slut: "23:30:00", lys: { type: "scene", scene: "e71b2ef3-1b15-4c4b-b036-4b3d6efe58f8", lysstyrke: 60 } },
        { navn: "Weekend", start: "00:00:00", slut: "00:00:00", dage: [5, 6], lys: { type: "hvid", lysstyrke: 80, kelvin: 2700 } },
      ],
    },
    {
      id: 2,
      lamper: ["light.kontor_bord_lysband"],
      sensorer: [],
      lys: { type: "hvid", lysstyrke: 60, kelvin: 2700 },
      overgang: 3,
      tidsrum: [],
    },
  ],
};
// Kortenes lamper, som Rumlys kender dem: et kort for hele rummet, et der er fjernet fra betjeningspanelet
// (k999…), og et med et lysbånd.
// Et kort i Rumlys' lager fra 0.6.0: lamper, scener og ikon. To kort må gerne vise den samme lampe.
const NI = STANDARD.map((s) => s[0]);
const kortLager = {
  kontor: {
    k111111111111: { lamper: [], scener: NI.slice(), ikon: null },
    k333333333333: { lamper: ["light.kontor_bord_lysband"], scener: NI.slice(0, 4), ikon: null },
    k999999999999: { lamper: ["light.kontor_loftspots"], scener: NI.slice(), ikon: "mdi:spotlight" },
  },
};
const kontorLamper = () => kontorData.lamper.map((l) => l.entity_id);
// Som Rumlys selv: kun rummets lamper, i rummets rækkefølge, og alle af dem er hele rummet.
const kortet = (vaerdi) => {
  const k = vaerdi && !Array.isArray(vaerdi) ? vaerdi : { lamper: vaerdi || [], scener: [], ikon: null };
  const valgte = kontorLamper().filter((l) => (k.lamper || []).indexOf(l) >= 0);
  return {
    lamper: valgte.length === kontorLamper().length ? [] : valgte,
    scener: (k.scener || []).slice(),
    ikon: k.ikon || null,
  };
};
// Betjeningspanelerne, som i Home Assistant 2026.9: standardpanelet hedder «lovelace» og står på listen, og
// et opslag uden navn giver det samme panel. Kontor-fanen har et kort for hele rummet, et nyt lille kort, det
// samme kort kopieret ind i en stak, og et kort fra før 0.4.11 uden id med lamper i sin egen opsætning — de sidste
// kan ikke bruges, fordi det første viser hele rummet. «Arbejde» har et nyt kort alene. «Hjem» har kortet med
// lysbåndet inde i et betinget kort; «Væg» er i YAML; «Kort» og «Energi» bygger Home Assistant selv.
const paneler = {
  map: { strategy: { type: "map" } },
  lovelace: {
    views: [
      { title: "Kontor", path: "kontor", sections: [{ type: "grid", cards: [
        { type: "custom:rumlys-card", omraade: "office", kort: "k111111111111" },
        { type: "custom:rumlys-card", omraade: "office", size: "small", kort: "k222222222222" },
        { type: "vertical-stack", cards: [{ type: "custom:rumlys-card", omraade: "office", size: "small", kort: "k222222222222" }] },
        { type: "custom:rumlys-card", omraade: "office", lamper: ["light.kontor_bord_lysband"] },
      ] }] },
      { title: "Træning", path: "traening", cards: [{ type: "custom:rumlys-card", omraade: "training_room" }] },
      { title: "Arbejde", path: "arbejde", sections: [{ type: "grid", cards: [{ type: "custom:rumlys-card", omraade: "office", kort: "k444444444444" }] }] },
    ],
  },
  "dashboard-hjem": {
    views: [{ title: "Hjem", cards: [{ type: "conditional", conditions: [], card: { type: "custom:rumlys-card", omraade: "office", kort: "k333333333333" } }] }],
  },
  "dashboard-yaml": { views: [{ title: "Tablet", cards: [{ type: "custom:rumlys-card", omraade: "office" }] }] },
};
const WS = {
  "rumlys/rum/liste": () => JSON.parse(JSON.stringify([
    { id: "entre", navn: "Entre", omraade: "entryway", lamper: [{ entity_id: "light.entre_loftspots", bevaegelse: true }], sensorer: ["binary_sensor.entre"], tidsrum: ["Nat"], scener: [], entiteter: ent("entre"), kort: {} },
    { id: "gang", navn: "Gang", omraade: "hallway", lamper: [{ entity_id: "light.gang_loftspots", bevaegelse: true }], sensorer: ["binary_sensor.gang_pir"], tidsrum: ["Dag", "Nat"], scener: [], entiteter: ent("gang"), kort: {} },
    { id: "kontor", navn: "Kontor", omraade: "office", lamper: kontorData.lamper, sensorer: kontorData.sensorer, tidsrum: ["Arbejde", "Aften"], automatik: kontorData.automatik, scener: kontorData.scener, entiteter: ent("kontor", [1, 2]), kort: kortLager.kontor },
    { id: "traeningsrum", navn: "Træningsrum", omraade: "training_room", lamper: [{ entity_id: "light.traeningsrum_loftspots", bevaegelse: true }, { entity_id: "light.traeningsrum_stenlampe", bevaegelse: false }], sensorer: ["binary_sensor.traening"], tidsrum: [], scener: [], entiteter: ent("traeningsrum"), kort: {} },
  ])),
  "rumlys/rum/hent": (msg) => ({
    kort: JSON.parse(JSON.stringify(kortLager.kontor)),
    id: msg.rum_id,
    navn: "Kontor",
    omraade: "office",
    lamper: kontorData.lamper,
    sensorer: kontorData.sensorer,
    tidsrum: ["Arbejde", "Aften"],
    automatik: kontorData.automatik,
    scener: kontorData.scener,
    entiteter: ent("kontor", [1, 2]),
    data: JSON.parse(JSON.stringify(kontorData)),
    status: {
      tilstand: "bevaegelse",
      slukker: null,
      hold_slutter: null,
      bevaegelse: true,
      taendte: 1,
      lamper: 2,
      uden_automatik: [],
      automatik: [
        { id: 1, navn: "Kontor Loftspots", tilstand: "bevaegelse", slukker: null, hold_slutter: null, bevaegelse: true, tidsrum: "Aften", husket: false, indstillinger: { sluk_efter_bevaegelse: 30, sluk_efter_tryk: 5, hold_tid: 4 } },
        { id: 2, navn: "Kontor Bord Lysbånd", tilstand: "slukket", slukker: null, hold_slutter: null, bevaegelse: false, tidsrum: null, husket: false, indstillinger: { sluk_efter_bevaegelse: 0, sluk_efter_tryk: 0, hold_tid: 4 } },
      ],
      haendelser: [
        { tid: om(-47), hvad: "valgt" },
        { tid: om(-41), hvad: "hold_fra" },
        { tid: om(-35), hvad: "slukket", kilde: "haand" },
        { tid: om(-30), hvad: "tidsrum", navn: "Aften" },
        { tid: om(-3), hvad: "slukket", kilde: "bevaegelse" },
        { tid: om(-2), hvad: "taendt", lys: "tidsrum", navn: "Aften" },
      ],
    },
  }),
  "rumlys/omraader": [
    { id: "entryway", navn: "Entre", rum: "entre", lamper: [{ entity_id: "light.entre_loftspots", navn: "Entre Loftspots", gruppe: [] }], sensorer: [], knapper: [] },
    { id: "hallway", navn: "Gang", rum: "gang", lamper: [{ entity_id: "light.gang_loftspots", navn: "Gang Loftspots", gruppe: [] }], sensorer: [{ entity_id: "binary_sensor.gang_pir", navn: "Gang bevægelse" }], knapper: [] },
    { id: "kitchen", navn: "Køkken", rum: null, lamper: [], sensorer: [], knapper: [] },
    { id: "office", navn: "Kontor", rum: "kontor", lamper: [
      { entity_id: "light.kontor_bord_lysband", navn: "Kontor Bord Lysbånd", gruppe: [] },
      { entity_id: "light.kontor_loftspots", navn: "Kontor Loftspots", gruppe: [1, 2, 3, 4, 5, 6].map((i) => `light.kontor_spot_${i}`) },
    ].concat([1, 2, 3, 4, 5, 6].map((i) => ({ entity_id: `light.kontor_spot_${i}`, navn: `Kontor Spot ${i}`, gruppe: [] }))), sensorer: [{ entity_id: "binary_sensor.lafaer_office", navn: "Lafaer tilstedeværelse" }], knapper: ["TL", "TR", "BL", "BR"].map((p) => ({ entity_id: `binary_sensor.4_button_switch_door_${p.toLowerCase()}_office`, navn: `4-Button Switch - Door (${p}) (Kontor)` })) },
    { id: "living_room", navn: "Stue", rum: null, lamper: [{ entity_id: "light.stue_loftspots", navn: "Stue Loftspots", gruppe: ["light.stue_loftspot_1", "light.stue_loftspot_2"] }, { entity_id: "light.stue_sort_gulvlampe", navn: "Stue Sort Gulvlampe", gruppe: [] }], sensorer: [], knapper: [] },
    { id: "training_room", navn: "Træningsrum", rum: "traeningsrum", lamper: [], sensorer: [], knapper: [] },
  ],
  "rumlys/knapper": [
    { entity_id: "binary_sensor.4_button_switch_door_tl_hallway", navn: "4-Button Switch - Door (TL) (Gang)", omraade: "Gang" },
    { entity_id: "binary_sensor.4_button_switch_door_tr_hallway", navn: "4-Button Switch - Door (TR) (Gang)", omraade: "Gang" },
  ].concat(["TL", "TR", "BL", "BR"].map((p) => ({ entity_id: `binary_sensor.4_button_switch_door_${p.toLowerCase()}_office`, navn: `4-Button Switch - Door (${p}) (Kontor)`, omraade: "Kontor" }))),
  "rumlys/lamper": [
    { entity_id: "light.entre_loftspots", navn: "Entre Loftspots", omraade: "Entre", gruppe: [] },
    { entity_id: "light.stue_sort_gulvlampe", navn: "Stue Sort Gulvlampe", omraade: "Stue", gruppe: [] },
    { entity_id: "light.udendors_lampe", navn: "Udendørs lampe", omraade: null, gruppe: [] },
  ],
  "rumlys/rum/gem": (msg) => {
    if (msg.kort) kortLager.kontor = Object.fromEntries(Object.entries(msg.kort).map(([id, v]) => [id, kortet(v)]));
    return { id: msg.rum_id };
  },
  "rumlys/kort/nye": (msg) => {
    Object.entries(msg.kort).forEach(([id, v]) => { if (!(id in kortLager.kontor)) kortLager.kontor[id] = kortet(v); });
    return { kort: JSON.parse(JSON.stringify(kortLager.kontor)) };
  },
  "rumlys/rum/opret": () => ({ id: "kontor" }),
  "rumlys/rum/slet": (msg) => ({ id: msg.rum_id }),
  "lovelace/dashboards/list": [
    { url_path: "lovelace", title: "Overblik", mode: "storage" },
    { url_path: "map", title: "Kort", mode: "storage" },
    { url_path: "dashboard-hjem", title: "Hjem", mode: "storage" },
    { url_path: "dashboard-yaml", title: "Væg", mode: "yaml" },
    { url_path: "dashboard-energi", title: "Energi", mode: "storage" },
  ],
  "lovelace/config": (msg) => {
    const config = paneler[msg.url_path || "lovelace"];
    if (!config) throw { code: "config_not_found", message: "No config found." };
    return JSON.parse(JSON.stringify(config));
  },
  "lovelace/config/save": (msg) => {
    if (msg.url_path === "dashboard-yaml") throw { code: "error", message: "Not supported" };
    gemPanel(msg.url_path || "lovelace", msg.config);
    return null;
  },
  "config/entity_registry/update": (msg) => {
    const st = hass.states[msg.entity_id];
    hass.entities = Object.assign({}, hass.entities, { [msg.entity_id]: Object.assign({}, hass.entities[msg.entity_id], { icon: msg.icon || undefined }) });
    const attributes = Object.assign({}, st.attributes, { icon: msg.icon || undefined });
    hass.states = Object.assign({}, hass.states, { [msg.entity_id]: Object.assign({}, st, { attributes }) });
    setTimeout(opdater, 50);
    return { entity_entry: hass.entities[msg.entity_id] };
  },
};

let lyttere = [];
export function vedOpdatering(fn) { lyttere.push(fn); }
function opdater() { lyttere.forEach((fn) => fn()); }

let haendelsesLyttere = [];
function gemPanel(urlPath, config) {
  paneler[urlPath] = JSON.parse(JSON.stringify(config));
  setTimeout(() => haendelsesLyttere.filter((l) => l.type === "lovelace_updated").forEach((l) => l.fn({ event_type: "lovelace_updated", data: { url_path: urlPath } })), 10);
}
// Som når et kort slettes på et betjeningspanel i en anden fane: fx fjernKort("lovelace", 0, 0, 1).
export function fjernKort(urlPath, fane, sektion, kort) {
  const config = JSON.parse(JSON.stringify(paneler[urlPath]));
  config.views[fane].sections[sektion].cards.splice(kort, 1);
  gemPanel(urlPath, config);
}
