/*
  Rumlys' eget ikonsæt — «rumlys:lampe».

  Filen står helt alene, uden en eneste import, og Home Assistant serverer den på en fast
  adresse uden version (/rumlys_ikoner/). Begge dele er med vilje.

  Home Assistant slår et eget ikonsæt op én gang — netop som ikonet tegnes — og prøver
  aldrig igen (frontend/src/components/ha-icon.ts). Menuen i venstre side tegnes, mens
  resten af Rumlys stadig hentes, så der er et kapløb, og taber vi det, står Rumlys uden
  ikon i menuen, til siden genindlæses. Derfor: én lille fil uden import at vente på, og
  en adresse, der er den samme fra version til version, så browseren har den liggende fra
  sidste besøg i stedet for at hente den forfra efter hver opdatering.

  Adressen er cachet i browseren i 30 dage. Ændres et ikon, skal filen have et nyt navn —
  ellers får den, der allerede har været her, det gamle ikon i en måned endnu.
*/

const IKONER = {
  lampe:
    "M11 1H13V4.5H11ZM8.8 4H15.2V7.4H8.8ZM1.5 13.6A10.5 7.1 0 0 1 22.5 13.6ZM20.4 11.9A8.4 3.6 0 0 0 3.6 11.9Z" +
    "M14.7 13.6A2.7 2.7 0 0 1 9.3 13.6ZM10.87 18.46L9.87 22.16A1 1 0 0 1 7.93 21.64L8.93 17.94A1 1 0 0 1 10.87 18.46Z" +
    "M15.07 17.94L16.07 21.64A1 1 0 0 1 14.13 22.16L13.13 18.46A1 1 0 0 1 15.07 17.94Z" +
    "M6.85 17.99L3.25 19.79A1 1 0 0 1 2.35 18.01L5.95 16.21A1 1 0 0 1 6.85 17.99Z" +
    "M18.05 16.21L21.65 18.01A1 1 0 0 1 20.75 19.79L17.15 17.99A1 1 0 0 1 18.05 16.21Z",
};

window.customIcons = window.customIcons || {};
window.customIcons.rumlys = {
  getIcon: async (navn) => ({ path: IKONER[navn] || "" }),
  getIconList: async () => Object.keys(IKONER).map((name) => ({ name, keywords: ["rumlys", "lampe", "loftlampe"] })),
};

/*
  Og taber vi alligevel kapløbet, så ryddes der op efter det her.

  Et <ha-icon>, der ikke fandt sættet, tegner et <iron-icon> — et element, Home Assistant
  ikke selv har, og derfor den tomme plads i menuen. Elementet henter kun ikonet igen, når
  «icon» skifter, og det er ikke nok i sig selv: gemmer man sættet og sætter det samme ikon
  igen, rammer opslaget grenen for egne ikonsæt, og den gren sætter aldrig elementet ud af
  den gamle tilstand.

  Vejen udenom bruger kun almindelige egenskaber, ikke Home Assistants indmad: sæt først et
  mdi-ikon — dén gren rydder selv op — vent på, at det er tegnet, og sæt så vores eget
  tilbage. Det koster ét billede med en forkert lampe, dér hvor der ellers ikke stod noget.

  Elementer, der klarede sig, har intet <iron-icon> og bliver ikke rørt. Derfor kan det køre
  flere gange uden at blinke.
*/
function samlTabte(rod, fundne) {
  const alle = rod.querySelectorAll("*");
  for (let i = 0; i < alle.length; i++) {
    const el = alle[i];
    if (el.localName === "ha-icon") {
      const eget = typeof el.icon === "string" && el.icon.slice(0, 7) === "rumlys:";
      if (eget && el.shadowRoot && el.shadowRoot.querySelector("iron-icon")) fundne.push(el);
    } else if (el.shadowRoot) {
      samlTabte(el.shadowRoot, fundne);
    }
  }
}

async function tegnIgen() {
  const fundne = [];
  try {
    samlTabte(document.body, fundne);
  } catch (_fejl) {
    return;
  }
  for (const el of fundne) {
    const ikon = el.icon;
    el.icon = "mdi:ceiling-light";
    try {
      await el.updateComplete;
    } catch (_fejl) {
      // Et element, der ikke er et lit-element endnu, har intet at vente på.
    }
    el.icon = ikon;
  }
}

// Menuen kan være tegnet før os, samtidig med os, eller lige efter. Fire forsøg over tre
// sekunder dækker dem alle, og de tre sidste koster ingenting, når det første virkede.
if (typeof document !== "undefined") {
  [0, 300, 1000, 3000].forEach((ms) => setTimeout(tegnIgen, ms));
}
