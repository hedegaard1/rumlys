# Rumlys

Home Assistant-integration, der samler lyset i hvert rum ét sted: bevægelse, sluk-tider, «hold lys»,
døgnets tidsrum og 146 scener — med sit eget sidepanel til opsætningen og sit eget kort til hverdag.

*A Home Assistant integration for the light in each room: motion, turn-off times, "keep light on",
periods of the day and 146 scenes, with its own sidebar panel for setup and its own card for daily
use. The integration is translated to English; this README is in Danish.*

## Installation

Gennem HACS som eget repository:

1. Åbn HACS, vælg menuen øverst til højre og **Custom repositories**.
2. Skriv `https://github.com/hedegaard1/rumlys` og vælg typen **Integration**.
3. Hent **Rumlys**, og genstart Home Assistant.
4. Gå til **Indstillinger → Enheder og tjenester → Tilføj integration**, og vælg **Rumlys**.

Kræver Home Assistant 2026.9 eller nyere.

## Tre steder, hvert med sit job

| Sted | Til | Hvad |
|---|---|---|
| **Kortet** `custom:rumlys-card` | alle i husstanden | tænd, sluk og dæmp hele rummet, vælg scene, farve eller hvidt lys, hold lyset tændt |
| **Rumlys i sidepanelet** | administratorer | al opsætning af et rum på én side, og hvad rummet har gjort og hvorfor |
| **Enheder og tjenester** | — | integrationen og nye rum: kun området |

Sidepanelet har Rumlys' lampe som ikon i én farve, så det passer til de andre ikoner i menuen; logoet med
farver bruges af Home Assistant under Enheder og tjenester og i HACS. Ikonet kan også bruges andre steder,
fx på et kort, som `rumlys:lampe`.

Ikonet står i sin egen fil, `frontend/ikoner/rumlys-ikoner.js`, uden en eneste import, og den serveres på
`/rumlys_ikoner/` — en adresse, der er den samme fra version til version. Det er der en grund til: Home
Assistant slår et eget ikonsæt op én gang, netop som ikonet tegnes, og prøver aldrig igen. Menuen tegnes,
mens resten af Rumlys stadig hentes, så der er et kapløb, og det tabte vi efter hver opdatering, fordi alle
filerne havde fået en ny adresse og skulle hentes forfra. Nu ligger ikonet i browseren fra sidste besøg.
Kommer den alligevel for sent, opdager filen det selv og beder menuens ikon om at tegne sig igen.

### Et rum er et område

**Nyt rum** — i sidepanelet eller under integrationen — spørger kun om området i Home Assistant.
Områder, der allerede har et rum, står ikke på listen, og intet område er valgt på forhånd.
Rummet får områdets navn og følger med, hvis området omdøbes, og områdets lamper og
bevægelsessensorer er valgt på forhånd. Er en gruppe med, er dens pærer det ikke. Ét rum pr. område.
En lampe, der er skjult i Home Assistant — fx et relæ, der kun giver strøm til smarte pærer — kan ikke
vælges.

### Rummets side i sidepanelet

Siden har to halvdele. **Automatik** er det, der sker af sig selv, og **Kort** er ren betjening.

- **Rummet** — området, rummet hører til.
- **Sensorer** — med «ser nogen nu» og valget Bevægelse eller Tilstedeværelse. En bevægelsessensor ser ikke
  en, der står stille, så valget sætter den anbefalede tid for lys tændt af sensoren: 5 min med kun
  bevægelsessensorer, 30 sek. med en tilstedeværelsessensor. Tiden kan stadig sættes frit. **Hver sensor kan
  tænde sine egne af rummets lamper** — «Tænder: alle bevægelseslamper» som standard, eller fx kun loftspots
  ved døren. Rummet har stadig én tilstand og én nedtælling: når ingen sensor ser nogen, slukker det samlet.
- **Automatik** — det, der sker af sig selv, samlet ét sted: rummets lamper, tidsplanen, sluk-tiderne
  og «hold lys».
- **Lamper** (i Automatik) — hver lampe kan sættes til ikke at tænde ved bevægelse; den hører stadig til
  rummet og slukker med det. Tryk på lampens ikon for at skifte det i Home Assistant — det gælder overalt,
  også på kortene. Her sættes også blød tænd og sluk.
- **Tidsplan** (i Automatik) — ugen med én række pr. dag. Nederst ligger **Hele døgnet**, rummets eget lys, som gælder,
  når intet tidsrum gør; det kan ikke slettes. Tidsrummene ligger oven på det, fx *Nat* 22:00–06:30 med
  scenen Natlys, og hvert har sit eget lys, sine dage (Alle dage, Hverdage, Weekend eller enkelte dage) og
  eventuelt sin egen sluk-tid. Et lys kan være en scene, en farve, hvidt lys eller kun lysstyrke.
- **Når ingen er i rummet** (i Automatik) — hvornår lys tændt af sensoren, og lys nogen selv har valgt, slukker.
- **Hold lys tændt** (i Automatik) — hvor længe.
- **Kort** — rummets kort på alle betjeningspaneler, i den rækkefølge de står, og hvor de står. **«Tilføj kort til
  en fane»** sætter kortet ind nederst på den fane, du vælger, og i kortets boks vælger du fanen igen for at flytte
  det — eller «Fjern kortet». Hvert kort står som én linje med, hvad det viser; tryk på linjen for at folde den ud.
  Et kort, der ikke kan bruges, er foldet ud med det samme. I kortets boks står **«Viser»**: hele rummet eller
  én af rummets lamper — og «Vælg lamper …», når rummet har flere end to. På en fane kan en lampe kun stå på ét
  kort, og et kort for hele rummet optager dem alle: på de andre kort står en lampe som «På kort N» — med
  «Flyt hertil», når kort N kun har nogle af lamperne. Kommer et kort ind uden om Rumlys — YAML, «Duplikér» eller en gendannet backup —
  dukker det op som «Nyt»; det viser hele rummet, hvis det er rummets eneste kort på fanen, og ellers ingen lamper,
  til de vælges. Står samme kort flere gange på en fane, virker ingen af dem, til «Adskil» har givet det sidste sit
  eget id. Listen følger selv
  med, når et betjeningspanel gemmes. Et kort, der fjernes, forsvinder fra listen, men Rumlys husker dets valg,
  så et kort, der kommer igen — fx med Fortryd — stadig viser sine lamper.
- **Knapper** — rummets vægknapper. Et tryk tænder og slukker, to hurtige tryk holder lyset tændt, og
  holdes knappen nede, dæmpes lyset — ned, hvis det lyser kraftigt, ellers op, i 10 %-skridt hvert
  tiendedels sekund. Under **«Styrer»** vælger du, hvad knappen gælder: hele rummet, eller ét af rummets
  kort — så styrer knappen præcis de lamper, kortet viser. Fjernes kortet, overtager knappen dets lamper,
  så knappen på væggen bliver ved med at gøre det samme. Ingen knapper er valgt på forhånd: Rumlys skal
  først overtage knappen, når den gamle automatisering på den er slået fra.
  Rækken siger **«Nede nu»**, mens knappen er trykket — tryk på den i rummet for at se, hvilken række den er.
- **Seneste hændelser** — fx «Slukket: ingen i rummet, valgt lys».

### Kortet

Et kort for et rum eller for nogle af dets lamper. Baggrunden viser lampernes farver; skyderen dæmper alle rummets lamper i samme
forhold; knappen holder lyset tændt og tæller ned. Tryk på kortet åbner menuen med lysstyrke, hvidt
lys, farve, scener og hver lampe for sig. Ikonet kommer fra rummet. Kortets opsætning er kun rummet og
udseendet:

```yaml
type: custom:rumlys-card
omraade: <områdets id>             # vælges i kortets opsætning
kort: k1a2b3c4d5e6                 # kortets id — sættes af sig selv
size: medium                       # scenefelterne: xsmall, small, medium, large eller xlarge
scene_size: small                  # large sætter scenernes navne under dem
```

**Kortet tilpasser sig den bredde, det bliver trukket ud i** (fra 0.6.2). Det er det samme design hele
vejen — de samme dele, stillet op efter pladsen. Navn, ikoner, kontakt, skyder og «hold lys» har **én
størrelse** uanset bredden; det er kun opstillingen, der flytter sig. Er der ikke plads til navnet ved
siden af knapperne, får navn og status øverste række for sig selv, og hold, skyder og kontakt står på den
næste; bliver skyderen for kort dér, får den sin egen linje. Under 300 px står rummets første ikon alene i
stedet for stakken. Er der plads til navnet, den længste status og skyderen på én række, står skyderen
mellem dem; ellers lige nedenunder.

**Scenefelterne er det eneste, der skifter størrelse** (fra 0.6.3), og kortets opsætning har derfor to valg:
**Scenefelter** og **Navne på scenerne**.

Scenefelterne har fem trin — **Mindst**, **Lille**, **Mellem**, **Stor** og **Størst** — på 20, 31, 42, 53
og 64 px. Trinnet er dit valg og **følger aldrig kortets bredde**: trækker du kortet bredere, bliver felterne
ikke større, der kommer bare flere på en række. Loftet på 64 px er sat af det smalleste kort, gitteret giver
i et afsnit på 500 px: fire kolonner er 161 px, og der skal kunne stå to felter ved siden af hinanden.

**Felterne er altid kvadratiske,** og de strækkes ikke ud, når der er få: er der plads til dem alle på én
række, står de i den størrelse, du har valgt, og rækken slutter, hvor scenerne slutter. Skal de derimod
deles på flere rækker, går rækkerne helt ud til højre kant — ellers står der et hul i hjørnet, og det ligner
en fejl frem for et valg. Feltet må afvige **8 px** fra det valgte, op eller ned, og kortet prøver hvert
antal kolonner og tager det, der kommer tættest på. Er der stadig lidt tilbage, lægges det i mellemrummene,
som må vokse de samme 8 px; resten bliver plads i højre side.

**Navnene retter sig efter knappen, ikke omvendt.** Teksten skrumper for at passe i feltet; vil du kunne
læse navnene, vælger du et større felt.

Kortet bliver selv så højt, som scenerne kræver, og det melder samtidig en bund til afsnittets gitter, så
de nederste scener ikke kan trækkes væk, hvis du selv tager fat i kortets højde.

**Kortet ejer sine lamper, sine scener og sit ikon**, og de vælges i sidepanelet under rummets **Kort**,
efter kortets id. Viser kortet nogle af lamperne, gælder tænd og sluk, skyder, scener og menuen dem, og et
kort for én lampe hedder som lampen. «Hold lys» står på alle rummets kort. Holdet gælder hele rummet — det
har én tilstand og én nedtælling — men fra et kort for nogle af lamperne er det kun dem, der tændes, hvis
lyset er slukket. Tændes en lampe fra kortet, tæller det som valgt lys i rummet, så rummets nedtælling
stadig slukker den.

**To kort må gerne vise den samme lampe** (fra 0.6.0). Et kort er en betjeningsflade, ikke en ejer — som to
afbrydere til samme pære — så du kan have ét kort med hele rummet og et kort pr. lampe på samme fane.
Automatikken ligger ét sted for hele rummet og bliver ikke forvirret af det. Indtil 0.5.0 delte kortene
rummets lamper mellem sig, og et kort, hvis lamper stod på et andet kort, kunne ikke bruges; den regel er
væk, og med den også «Flyt hertil», «Adskil» og «Lamperne står på et andet kort».

**Efter en opdatering siger Rumlys til.** En fane, der stod åben under opdateringen, bruger stadig den
forrige udgave af kortet og sidepanelet — så kan kortene stå tomme. Rumlys lægger derfor en besked i Home
Assistant om at genindlæse fanen med Ctrl+F5. Den kommer ikke, første gang Rumlys sættes op.

**Kortet sættes ind fra Rumlys**, under rummets «Kort», og står derfor ikke i Home Assistants «Tilføj kort»-liste.
Det er sat ind, flyttet og fjernet ét sted, og Rumlys kender det fra første sekund. Et kort, der alligevel kommer
ind — skrevet i YAML, kopieret med «Duplikér» eller gendannet fra en backup — virker stadig; så gælder fanens
regel ovenfor, og sidepanelet giver det et id. Et kort på et betjeningspanel i YAML får
det ikke af sig selv; sidepanelet foreslår en linje `kort: …`. Kort fra 0.4.9–0.4.10 har intet id og kan have
`lamper` i opsætningen: de virker stadig, og får de et id — med «Giv kortet et id» i sidepanelet eller ved at
åbne kortets opsætning — følger lamperne med ind i Rumlys.

Kortets opsætning viser alle husets rum. Et kort kan stå på et betjeningspanel, før rummet er sat op i
Rumlys: så viser det «Ikke sat op i Rumlys», og en administrator kan trykke «Sæt op i Rumlys», som
opretter rummet og åbner det i sidepanelet. Kort fra før 0.4.8 peger på rummets id med `rum` og virker
stadig; de skifter til `omraade`, når rummet vælges igen i opsætningen.

## Entiteter

Hvert rum er en enhed med fem entiteter. Id'erne dannes af nøglen, så de er ens på alle sprog:

| Entitet | Hvad den gør |
|---|---|
| `switch.<rum>_hold_lys` — Hold lys | Holder lyset tændt i hold-tiden; attributten `slutter` siger hvornår |
| `number.<rum>_sluk_efter_bevaegelse` — Automatisk lys slukker efter | Sekunder (standard 30) |
| `number.<rum>_sluk_efter_tryk` — Valgt lys slukker efter | Minutter (standard 5; 0 = aldrig) |
| `number.<rum>_hold_tid` — Hold lys i | Timer (standard 4) |
| `sensor.<rum>_tilstand` — Tilstand | Slukket, Tændt af sensor, Valgt lys eller Holdes tændt; attributten `slukker` |

## Tjenester

| Tjeneste | Hvad |
|---|---|
| `rumlys.daemp` | Dæmper rummet i samme forhold — den lyseste lampe får lysstyrken. 0 slukker |
| `rumlys.anvend_lys` | Tænder rummet med et lysvalg, fx `{"type": "hvid", "lysstyrke": 80, "kelvin": 2700}` |
| `rumlys.anvend_scene` | Tænder rummet med en scene, eventuelt med egen lysstyrke |

Rummet angives med `rum` (id'et) eller `omraade`. Begge tæller som lys valgt i hånden og huskes. Med
`lamper` rammer tjenesten kun de af rummets lamper; slukkes de, mens andre lamper lyser, fortsætter rummet.

## Sådan opfører lyset sig

| Situation | Hvad sker der |
|---|---|
| Bevægelse, og lyset er slukket | Tænder med det lys, der sidst blev valgt i tidsrummet; ellers tidsrummets eller hele døgnets lys |
| Et andet tidsrum tager over | Tidsrummets eget lys gælder, indtil nogen vælger andet; lys tændt af bevægelse skifter med |
| Et tidsrum går over midnat | Det hører til den dag, det begynder: *Nat* om fredagen slutter lørdag morgen |
| Start og slut er samme klokkeslæt | Tidsrummet varer et helt døgn; 00:00–00:00 er hele dagen |
| Overlapper to tidsrum | Det øverste på listen gælder |
| Bevægelsen holder op | Slukker efter «automatisk lys slukker efter»; ny bevægelse stopper nedtællingen |
| Lyset tændes eller ændres i hånden (kort, scene, app, væg) | Rummet husker lyset og slukker efter «valgt lys slukker efter», når ingen er der |
| Bevægelse, mens lyset er valgt i hånden | Lyset bliver, som det er; bevægelsen forlænger kun tiden |
| «Hold lys» slås til | Sensor og nedtælling er ude af spil; slukket lys tændes med det sidst valgte lys |
| Hold-tiden løber ud, eller hold slås fra | Tilbage til sensoren |
| Lyset slukkes i hånden | Nedtælling og hold stopper; det valgte lys huskes stadig |
| Home Assistant genstarter | Tider, tilstand og det valgte lys huskes; en tid, der er løbet ud imens, afvikles straks |

Rumlys kender sine egne kommandoer på Home Assistants *context* og på et kort vindue bagefter, fordi
en Zigbee2MQTT-gruppe melder tilbage et par sekunder senere. Rum fra 0.1.0 flyttes automatisk: navnet
slås op som område, og lysstyrke og farvetemperatur bliver et lysvalg.

## Scener

De 146 scener i 23 kategorier stammer fra [Scene Presets](https://github.com/Hypfer/hass-scene_presets)
af Hypfer (Apache-2.0), se [NOTICE](NOTICE). En scenes farvepunkter fordeles på lamperne efter tur;
en farvelampe får punktet, en hvid lampe nærmeste farvetemperatur, og en lampe, der kun kan dæmpes,
lysstyrken. Får alle pærer i en gruppe det samme, sendes det til gruppen som én kommando.

## Udvikling

Testene bruger `pytest-homeassistant-custom-component`:

```
python -m venv .venv
.venv/Scripts/python -m pip install pytest-homeassistant-custom-component==0.13.365
.venv/Scripts/python -m pytest
```

Home Assistant er ikke lavet til Windows. Der skal testene køres med `PYTHONPATH=tests/windows`, som
giver to Linux-moduler, Home Assistant importerer, en tom erstatning.

Sidepanelet og kortet kan ses uden Home Assistant: `python tests/frontend/server.py 8766`, og åbn
`/tests/frontend/panel.html` eller `/tests/frontend/kort.html`, der bruger et falsk Home Assistant.
Serveren beder browseren om ikke at gemme filerne, så en rettelse ses ved næste genindlæsning.
Reglen for kortene på en fane — den samme i sidepanelet og i kortene — prøves med `node tests/frontend/fordel.test.mjs`.

## Licens

[Apache-2.0](LICENSE), se også [NOTICE](NOTICE).
