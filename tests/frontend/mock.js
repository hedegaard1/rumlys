// Et lille falsk Home Assistant til at se sidepanelet og kortet i en browser uden HA:
//   python -m http.server 8766 --directory <repo>   og åbn /tests/frontend/panel.html
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

// Scenerne hentes fra repoets egne filer (window.rumlysFiler sættes på testsiden). Uden dem
// bruges det lille katalog herover.
const aegteFetch = window.fetch.bind(window);
window.fetch = async (url, ...rest) => {
  const svar = await aegteFetch(url, ...rest);
  if (!svar.ok && String(url).indexOf("scener.json") >= 0) return new Response(JSON.stringify(KATALOG), { status: 200 });
  return svar;
};

customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this.tegn(); }
  attributeChangedCallback() { this.tegn(); }
  set icon(v) { this.setAttribute("icon", v); }
  tegn() {
    this.style.cssText = "display:inline-grid;place-items:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);font-size:10px;line-height:1;opacity:.8";
    const navn = (this.getAttribute("icon") || "").replace("mdi:", "");
    const tegn = { "arrow-left": "←", close: "✕", check: "✓", plus: "+", "chevron-right": "›", drag: "⋮⋮", power: "⏻", "lock-clock": "🔒", "delete-outline": "🗑", "home-outline": "⌂", "lightbulb-group-outline": "💡", "motion-sensor": "◎", "lightbulb-auto-outline": "✦", "clock-outline": "◷", "motion-sensor-off": "◌", "palette-outline": "🎨", history: "↺", cog: "⚙", "ceiling-light": "💡" };
    this.textContent = tegn[navn] || "•";
  }
});
customElements.define("ha-menu-button", class extends HTMLElement {
  connectedCallback() { this.innerHTML = '<button style="border:0;background:transparent;font-size:20px;width:40px;height:40px">☰</button>'; }
});

const om = (min) => new Date(Date.now() + min * 60000).toISOString();
const spots = (rum, n, attr) => {
  const s = {};
  for (let i = 1; i <= n; i++) s[`light.${rum}_spot_${i}`] = { state: attr ? "on" : "off", attributes: Object.assign({ friendly_name: `${rum} Spot ${i}`, supported_color_modes: ["color_temp", "xy"], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6535 }, attr || {}) };
  return s;
};
const hvid = (k, b) => ({ brightness: b, color_mode: "color_temp", color_temp_kelvin: k });

export const hass = {
  language: "da",
  locale: { language: "da" },
  user: { is_admin: true },
  states: Object.assign(
    {
      "light.kontor_loftspots": { state: "on", attributes: Object.assign({ friendly_name: "Kontor Loftspots", group_entities: [1, 2, 3, 4, 5, 6].map((i) => `light.kontor_spot_${i}`), supported_color_modes: ["color_temp", "xy"], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6535 }, hvid(3508, 255)) },
      "light.kontor_bord_lysband": { state: "on", attributes: { friendly_name: "Kontor Bord Lysbånd", brightness: 200, color_mode: "xy", xy_color: [0.45, 0.25], rgb_color: [255, 110, 170], supported_color_modes: ["color_temp", "xy"] } },
      "light.entre_loftspots": { state: "on", attributes: Object.assign({ friendly_name: "Entre Loftspots" }, hvid(2700, 230)) },
      "light.gang_loftspots": { state: "off", attributes: { friendly_name: "Gang Loftspots" } },
      "light.traeningsrum_loftspots": { state: "on", attributes: { friendly_name: "Træningsrum Loftspots", brightness: 180, color_mode: "hs", hs_color: [35, 80], rgb_color: [255, 170, 60] } },
      "light.traeningsrum_stenlampe": { state: "on", attributes: Object.assign({ friendly_name: "Træningsrum Stenlampe" }, hvid(2400, 120)) },
      "light.stue_loftspots": { state: "off", attributes: { friendly_name: "Stue Loftspots", group_entities: ["light.stue_loftspot_1", "light.stue_loftspot_2"] } },
      "light.stue_sort_gulvlampe": { state: "off", attributes: { friendly_name: "Stue Sort Gulvlampe" } },
      "binary_sensor.lafaer_office": { state: "on", attributes: { friendly_name: "Lafaer tilstedeværelse" } },
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

const ent = (rum) => ({ hold: `switch.${rum}_hold_lys`, tilstand: `sensor.${rum}_tilstand`, sluk_efter_bevaegelse: `number.${rum}_sluk_efter_bevaegelse`, sluk_efter_tryk: `number.${rum}_sluk_efter_tryk`, hold_tid: `number.${rum}_hold_tid` });
const kontorData = {
  omraade: "office",
  lamper: [{ entity_id: "light.kontor_loftspots", bevaegelse: true }, { entity_id: "light.kontor_bord_lysband", bevaegelse: true }],
  sensorer: ["binary_sensor.lafaer_office"],
  lys: { type: "hvid", lysstyrke: 100, kelvin: 3500 },
  overgang: 3,
  tidsrum: [
    { navn: "Arbejde", start: "08:00:00", slut: "16:00:00", lys: { type: "scene", scene: "0cbec4e8-d064-4457-986a-fe6078a63f39", lysstyrke: 100 } },
    { navn: "Aften", start: "19:00:00", slut: "23:30:00", lys: { type: "scene", scene: "e71b2ef3-1b15-4c4b-b036-4b3d6efe58f8", lysstyrke: 60 } },
  ],
  scener: STANDARD.map((s) => s[0]),
};
const WS = {
  "rumlys/rum/liste": [
    { id: "entre", navn: "Entre", omraade: "entryway", lamper: [{ entity_id: "light.entre_loftspots", bevaegelse: true }], sensorer: ["binary_sensor.entre"], tidsrum: ["Nat"], scener: [], entiteter: ent("entre") },
    { id: "gang", navn: "Gang", omraade: "hallway", lamper: [{ entity_id: "light.gang_loftspots", bevaegelse: true }], sensorer: ["binary_sensor.gang_pir"], tidsrum: ["Dag", "Nat"], scener: [], entiteter: ent("gang") },
    { id: "kontor", navn: "Kontor", omraade: "office", lamper: kontorData.lamper, sensorer: kontorData.sensorer, tidsrum: ["Arbejde", "Aften"], scener: kontorData.scener, entiteter: ent("kontor") },
    { id: "traeningsrum", navn: "Træningsrum", omraade: "training_room", lamper: [{ entity_id: "light.traeningsrum_loftspots", bevaegelse: true }, { entity_id: "light.traeningsrum_stenlampe", bevaegelse: false }], sensorer: ["binary_sensor.traening"], tidsrum: [], scener: [], entiteter: ent("traeningsrum") },
  ],
  "rumlys/rum/hent": (msg) => ({
    id: msg.rum_id,
    navn: "Kontor",
    omraade: "office",
    lamper: kontorData.lamper,
    sensorer: kontorData.sensorer,
    tidsrum: ["Arbejde", "Aften"],
    scener: kontorData.scener,
    entiteter: ent("kontor"),
    data: JSON.parse(JSON.stringify(kontorData)),
    status: {
      tilstand: "bevaegelse",
      slukker: null,
      hold_slutter: null,
      bevaegelse: true,
      tidsrum: "Aften",
      husket: false,
      indstillinger: { sluk_efter_bevaegelse: 30, sluk_efter_tryk: 5, hold_tid: 4 },
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
    { id: "entryway", navn: "Entre", rum: "entre", lamper: [{ entity_id: "light.entre_loftspots", navn: "Entre Loftspots", gruppe: [] }], sensorer: [] },
    { id: "hallway", navn: "Gang", rum: "gang", lamper: [{ entity_id: "light.gang_loftspots", navn: "Gang Loftspots", gruppe: [] }], sensorer: [{ entity_id: "binary_sensor.gang_pir", navn: "Gang bevægelse" }] },
    { id: "kitchen", navn: "Køkken", rum: null, lamper: [], sensorer: [] },
    { id: "office", navn: "Kontor", rum: "kontor", lamper: [
      { entity_id: "light.kontor_bord_lysband", navn: "Kontor Bord Lysbånd", gruppe: [] },
      { entity_id: "light.kontor_loftspots", navn: "Kontor Loftspots", gruppe: [1, 2, 3, 4, 5, 6].map((i) => `light.kontor_spot_${i}`) },
    ].concat([1, 2, 3, 4, 5, 6].map((i) => ({ entity_id: `light.kontor_spot_${i}`, navn: `Kontor Spot ${i}`, gruppe: [] }))), sensorer: [{ entity_id: "binary_sensor.lafaer_office", navn: "Lafaer tilstedeværelse" }] },
    { id: "living_room", navn: "Stue", rum: null, lamper: [{ entity_id: "light.stue_loftspots", navn: "Stue Loftspots", gruppe: ["light.stue_loftspot_1", "light.stue_loftspot_2"] }, { entity_id: "light.stue_sort_gulvlampe", navn: "Stue Sort Gulvlampe", gruppe: [] }], sensorer: [] },
    { id: "training_room", navn: "Træningsrum", rum: "traeningsrum", lamper: [], sensorer: [] },
  ],
  "rumlys/lamper": [
    { entity_id: "light.entre_loftspots", navn: "Entre Loftspots", omraade: "Entre", gruppe: [] },
    { entity_id: "light.stue_sort_gulvlampe", navn: "Stue Sort Gulvlampe", omraade: "Stue", gruppe: [] },
    { entity_id: "light.udendors_lampe", navn: "Udendørs lampe", omraade: null, gruppe: [] },
  ],
  "rumlys/rum/gem": (msg) => ({ id: msg.rum_id }),
  "rumlys/rum/opret": () => ({ id: "kontor" }),
  "rumlys/rum/slet": (msg) => ({ id: msg.rum_id }),
};

let lyttere = [];
export function vedOpdatering(fn) { lyttere.push(fn); }
function opdater() { lyttere.forEach((fn) => fn()); }
