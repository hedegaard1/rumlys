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
  for (let i = 1; i <= n; i++) s[`light.${rum}_spot_${i}`] = { state: attr ? "on" : "off", attributes: Object.assign({ friendly_name: `${rum} Spot ${i}`, icon: "hue:bulb-spot-hung", supported_color_modes: ["color_temp", "xy"], supported_features: 44, min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6535 }, attr || {}) };
  return s;
};
const hvid = (k, b) => ({ brightness: b, color_mode: "color_temp", color_temp_kelvin: k });

export const hass = {
  language: "da",
  locale: { language: "da" },
  user: { is_admin: true },
  areas: {
    entryway: { area_id: "entryway", name: "Entre" },
    hallway: { area_id: "hallway", name: "Gang" },
    kitchen: { area_id: "kitchen", name: "Køkken" },
    office: { area_id: "office", name: "Kontor" },
    living_room: { area_id: "living_room", name: "Stue" },
    training_room: { area_id: "training_room", name: "Træningsrum" },
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
    { navn: "Arbejde", start: "08:00:00", slut: "16:00:00", dage: [0, 1, 2, 3, 4], lys: { type: "scene", scene: "0cbec4e8-d064-4457-986a-fe6078a63f39", lysstyrke: 100 } },
    { navn: "Fredagsbar", start: "22:00:00", slut: "02:00:00", dage: [4], lys: { type: "farve", farve: [300, 70], lysstyrke: 70 } },
    { navn: "Aften", start: "19:00:00", slut: "23:30:00", lys: { type: "scene", scene: "e71b2ef3-1b15-4c4b-b036-4b3d6efe58f8", lysstyrke: 60 } },
    { navn: "Weekend", start: "00:00:00", slut: "00:00:00", dage: [5, 6], lys: { type: "hvid", lysstyrke: 80, kelvin: 2700 } },
  ],
  scener: STANDARD.map((s) => s[0]),
};
// Kortenes lamper, som Rumlys kender dem: et kort for hele rummet, et der er fjernet fra betjeningspanelet
// (k999…), og et med et lysbånd.
const kortLager = { kontor: { k111111111111: [], k333333333333: ["light.kontor_bord_lysband"], k999999999999: ["light.kontor_loftspots"] } };
const kontorLamper = () => kontorData.lamper.map((l) => l.entity_id);
// Som Rumlys selv: en tom liste er hele rummet, null ingen lamper, og lamper uden for rummet tæller ikke.
const kortetsLamper = (lamper) => {
  if (lamper === null) return null;
  if (!lamper.length) return [];
  const valgte = kontorLamper().filter((l) => lamper.indexOf(l) >= 0);
  if (!valgte.length) return null;
  return valgte.length === kontorLamper().length ? [] : valgte;
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
    { id: "kontor", navn: "Kontor", omraade: "office", lamper: kontorData.lamper, sensorer: kontorData.sensorer, tidsrum: ["Arbejde", "Aften"], scener: kontorData.scener, entiteter: ent("kontor"), kort: kortLager.kontor },
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
  "rumlys/rum/gem": (msg) => {
    if (msg.kort) kortLager.kontor = Object.fromEntries(Object.entries(msg.kort).map(([id, lamper]) => [id, kortetsLamper(lamper)]));
    return { id: msg.rum_id };
  },
  "rumlys/kort/nye": (msg) => {
    Object.entries(msg.kort).forEach(([id, lamper]) => { if (!(id in kortLager.kontor)) kortLager.kontor[id] = kortetsLamper(lamper); });
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
