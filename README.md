# Rumlys

Home Assistant-integration, der samler lyset i hvert rum ét sted: bevægelse, to sluk-tider,
«hold lys» og tidsrum med hvert sit lys.

*A Home Assistant integration for the light in each room: motion, two off timers, "hold light" and
time periods. The integration is translated to English; this README is in Danish.*

## Installation

Gennem HACS som eget repository:

1. Åbn HACS, vælg menuen øverst til højre og **Custom repositories**.
2. Skriv `https://github.com/hedegaard1/rumlys` og vælg typen **Integration**.
3. Hent **Rumlys**, og genstart Home Assistant.
4. Gå til **Indstillinger → Enheder & tjenester → Tilføj integration**, og vælg **Rumlys**.

Kræver Home Assistant 2026.9 eller nyere.

## Rum

Rummene tilføjes under integrationen med **Tilføj rum**. Et rum har:

- **Lys:** lamper eller grupper, som bevægelse tænder, og som Rumlys slukker.
- **Bevægelsessensorer** (valgfrit).
- **Lysstyrke og hvidt lys**, når bevægelse tænder lyset. Uden farvetemperatur røres farven ikke.
- **Overgang** i sekunder, når lyset tændes og slukkes.
- **Tidsrum**, fx *Nat* 22:00–06:30 med 10 %. Et tidsrum har sit eget lys og kan have sin egen
  sluk-tid. Uden for tidsrummene bruges rummets eget lys.

Hvert rum bliver en enhed med fem entiteter:

| Entitet | Hvad den gør |
|---|---|
| Hold lys | Holder lyset tændt i hold-tiden; sensoren er ude af spil imens |
| Sluk efter bevægelse | Sekunder, fra sensoren holder op med at se bevægelse (standard 30) |
| Sluk efter tryk | Minutter, efter lyset er tændt eller ændret i hånden (standard 5; 0 = aldrig) |
| Hold-tid | Timer (standard 4) |
| Tilstand | Slukket, Bevægelse, Tændt i hånden eller Holdes tændt — med tidspunktet for næste sluk |

## Sådan opfører lyset sig

| Situation | Hvad sker der |
|---|---|
| Bevægelse, og lyset er slukket | Tænder med rummets lys — eller tidsrummets, når klokken er inde i et |
| Bevægelsen holder op | Slukker efter «sluk efter bevægelse»; ny bevægelse stopper nedtællingen |
| Lyset tændes eller ændres i hånden (kort, scene, app, væg) | Slukker efter «sluk efter tryk», når der ikke er bevægelse |
| Bevægelse, mens lyset er valgt i hånden | Lyset bliver, som det er; bevægelsen forlænger kun tiden |
| Tidsrummet skifter, mens bevægelse har tændt lyset | Skifter til det nye tidsrums lys |
| «Hold lys» slås til | Sensor og nedtælling er ude af spil; slukket lys tændes med sidste lysstyrke og farve |
| Hold-tiden løber ud, eller hold slås fra | Tilbage til sensoren; uden bevægelse slukker lyset efter «sluk efter bevægelse» |
| Lyset slukkes i hånden | Alt stopper, og hold slås fra; lyset tænder igen ved næste bevægelse |
| Home Assistant genstarter | Tider og tilstand huskes; en tid, der er løbet ud imens, afvikles straks |

Rumlys kender sine egne kommandoer på Home Assistants *context* og på et kort vindue bagefter,
fordi en Zigbee2MQTT-gruppe melder tilbage et par sekunder senere.

## Udvikling

Testene bruger `pytest-homeassistant-custom-component`:

```
python -m venv .venv
.venv/Scripts/python -m pip install pytest-homeassistant-custom-component==0.13.365
.venv/Scripts/python -m pytest
```

Home Assistant er ikke lavet til Windows. Der skal testene køres med
`PYTHONPATH=tests/windows`, som giver to Linux-moduler, Home Assistant importerer, en tom
erstatning.
