"""Hvad et rum må indeholde, når sidepanelet gemmer det."""

from __future__ import annotations

from datetime import time
from typing import Any

import voluptuous as vol

from homeassistant.helpers import config_validation as cv

from .const import (
    ALLE_DAGE,
    AUT_ID,
    AUT_LAMPER,
    AUT_LYS,
    AUT_OVERGANG,
    AUT_SENSORER,
    AUT_TIDSRUM,
    CONF_AUTOMATIK,
    CONF_BEVAEGELSE,
    CONF_DAGE,
    CONF_ENTITY_ID,
    CONF_FARVE,
    CONF_IKON,
    CONF_KELVIN,
    CONF_KNAP_MAAL,
    CONF_KNAPPER,
    CONF_KORT,
    KORT_IKON,
    KORT_LAMPER,
    KORT_SCENER,
    CONF_LAMPER,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_NAVN,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENE,
    CONF_SCENER,
    CONF_SENSORER,
    CONF_SENSOR_LAMPER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    CONF_TILSTEDE,
    CONF_TYPE,
    HOLD_TID,
    LYS_FARVE,
    LYS_HVID,
    LYS_SCENE,
    LYSTYPER,
    SLUK_EFTER_BEVAEGELSE,
    SLUK_EFTER_TRYK,
    STANDARD_LYS,
)


def _klokkeslaet(vaerdi: Any) -> str:
    """«22:00» og «22:00:00» gemmes ens."""
    try:
        return time.fromisoformat(str(vaerdi)).replace(microsecond=0).isoformat()
    except ValueError as err:
        raise vol.Invalid("ugyldigt klokkeslæt") from err


def _lysvalg_komplet(lys: dict[str, Any]) -> dict[str, Any]:
    if lys[CONF_TYPE] == LYS_HVID and not lys.get(CONF_KELVIN):
        raise vol.Invalid("hvidt lys kræver kelvin")
    if lys[CONF_TYPE] == LYS_FARVE and not lys.get(CONF_FARVE):
        raise vol.Invalid("farve kræver en farve")
    if lys[CONF_TYPE] == LYS_SCENE and not lys.get(CONF_SCENE):
        raise vol.Invalid("scene kræver en scene")
    return lys


LYSVALG = vol.All(
    vol.Schema(
        {
            vol.Required(CONF_TYPE): vol.In(LYSTYPER),
            vol.Optional(CONF_LYSSTYRKE): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
            vol.Optional(CONF_KELVIN): vol.All(vol.Coerce(int), vol.Range(min=1000, max=10000)),
            vol.Optional(CONF_FARVE): vol.All(
                [vol.Coerce(float)],
                vol.Length(min=2, max=2),
                lambda farve: [vol.Range(min=0, max=360)(farve[0]), vol.Range(min=0, max=100)(farve[1])],
            ),
            vol.Optional(CONF_SCENE): cv.string,
        }
    ),
    _lysvalg_komplet,
)


DAGE = vol.All(
    [vol.All(vol.Coerce(int), vol.Range(min=0, max=6))],
    vol.Length(min=1, msg="vælg mindst én dag"),
    lambda dage: sorted(set(dage)),
)

TIDSRUM = vol.Schema(
    {
        vol.Required(CONF_NAVN): vol.All(cv.string, vol.Length(min=1)),
        vol.Required(CONF_START): _klokkeslaet,
        vol.Required(CONF_SLUT): _klokkeslaet,
        vol.Optional(CONF_DAGE, default=lambda: list(ALLE_DAGE)): DAGE,
        vol.Required(CONF_LYS): LYSVALG,
        vol.Optional(CONF_SLUK_EFTER): vol.All(vol.Coerce(int), vol.Range(min=0, max=3600)),
    }
)


AUTOMATIK = vol.Schema(
    {
        vol.Required(AUT_ID): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional(AUT_LAMPER, default=list): [cv.entity_domain("light")],
        vol.Optional(AUT_SENSORER, default=list): [cv.entity_domain("binary_sensor")],
        vol.Optional(AUT_LYS, default=lambda: dict(STANDARD_LYS)): LYSVALG,
        vol.Optional(AUT_OVERGANG, default=0): vol.All(vol.Coerce(float), vol.Range(min=0, max=10)),
        vol.Optional(AUT_TIDSRUM, default=list): [TIDSRUM],
    }
)


def _med_automatik(rum: dict[str, Any]) -> dict[str, Any]:
    """Et rum fra før 0.7.0 har sin opsætning liggende fladt. Den bliver til én automatik med
    alle lamperne og alle sensorerne — præcis det, rummet gjorde før.

    Havde sensorerne hver deres lamper (`sensor_lamper` fra 0.4.5), er det den samme tanke som en
    automatik, men delingen følger ikke med: den skal laves om i sidepanelet, hvor den nu hører til.
    """
    if rum.get(CONF_AUTOMATIK):
        return rum
    return rum | {
        CONF_AUTOMATIK: [
            {
                AUT_ID: 1,
                AUT_LAMPER: [lampe[CONF_ENTITY_ID] for lampe in rum[CONF_LAMPER]],
                AUT_SENSORER: list(rum.get(CONF_SENSORER, [])),
                AUT_LYS: rum.get(CONF_LYS) or dict(STANDARD_LYS),
                AUT_OVERGANG: rum.get(CONF_OVERGANG, 0),
                AUT_TIDSRUM: rum.get(CONF_TIDSRUM, []),
            }
        ]
    }


def _kun_rummets(rum: dict[str, Any]) -> dict[str, Any]:
    """Sensorer, knapper og deres lamper skal være rummets egne."""
    rummets = {lampe[CONF_ENTITY_ID] for lampe in rum[CONF_LAMPER]}
    valgte = {
        sensor: [lampe for lampe in lamper if lampe in rummets]
        for sensor, lamper in rum.get(CONF_SENSOR_LAMPER, {}).items()
        if sensor in rum[CONF_SENSORER]
    }
    knapper = {
        knap: maal
        for knap, maal in rum.get(CONF_KNAP_MAAL, {}).items()
        if knap in rum[CONF_KNAPPER]
    }
    for knap, maal in list(knapper.items()):
        if CONF_LAMPER not in maal:
            continue
        # En knap, der styrer bestemte lamper, må kun styre rummets. Er ingen af dem tilbage,
        # styrer den hele rummet — som en knap uden valg.
        if lamper := [lampe for lampe in maal[CONF_LAMPER] if lampe in rummets]:
            knapper[knap] = {CONF_LAMPER: lamper}
        else:
            del knapper[knap]
    # Automatikkernes lamper og sensorer skal være rummets egne, og **en lampe hører til én
    # automatik**. Står den to steder, bliver den, hvor den står først — ellers kunne to
    # automatikker trække i den samme pære, og hele modellen bygger på, at det ikke kan ske.
    taget: set[str] = set()
    automatik = []
    for aut in rum.get(CONF_AUTOMATIK) or []:
        lamper = [l for l in aut[AUT_LAMPER] if l in rummets and l not in taget]
        taget.update(lamper)
        automatik.append(
            aut
            | {
                AUT_LAMPER: lamper,
                AUT_SENSORER: [s for s in aut[AUT_SENSORER] if s in rum[CONF_SENSORER]],
            }
        )
    return rum | {
        CONF_TILSTEDE: [s for s in rum[CONF_TILSTEDE] if s in rum[CONF_SENSORER]],
        # En sensor uden lamper tilbage tænder alle rummets bevægelseslamper — som en sensor uden valg.
        CONF_SENSOR_LAMPER: {s: l for s, l in valgte.items() if l},
        CONF_KNAP_MAAL: knapper,
        CONF_AUTOMATIK: automatik,
    }


# Et kort i Rumlys' lager: lamper (tom = hele rummet), scener og ikon. Den gamle form — bare
# lampelisten, eller None for «ingen lamper» — tages stadig imod og bliver til hele rummet.
KORT = vol.Any(
    None,
    [cv.entity_domain("light")],
    vol.Schema(
        {
            vol.Optional(KORT_LAMPER, default=list): [cv.entity_domain("light")],
            vol.Optional(KORT_SCENER, default=list): [cv.string],
            vol.Optional(KORT_IKON, default=None): vol.Any(None, cv.icon),
        }
    ),
)

RUM_DATA = vol.All(
    vol.Schema(
        {
            vol.Required(CONF_OMRAADE): cv.string,
            vol.Required(CONF_LAMPER): [
                vol.Schema(
                    {
                        vol.Required(CONF_ENTITY_ID): cv.entity_domain("light"),
                        vol.Optional(CONF_BEVAEGELSE, default=True): cv.boolean,
                    }
                )
            ],
            vol.Optional(CONF_SENSORER, default=[]): [cv.entity_domain("binary_sensor")],
            vol.Optional(CONF_TILSTEDE, default=[]): [cv.entity_domain("binary_sensor")],
            vol.Optional(CONF_SENSOR_LAMPER, default={}): {
                cv.entity_domain("binary_sensor"): [cv.entity_domain("light")]
            },
            # En vægknap er en binary_sensor, der melder «on», mens den er nede — sådan giver
            # IHC dem. Andre slags knapper melder hændelser og kan ikke bruges endnu.
            vol.Optional(CONF_KNAPPER, default=[]): [cv.entity_domain("binary_sensor")],
            vol.Optional(CONF_KNAP_MAAL, default={}): {
                cv.entity_domain("binary_sensor"): vol.Schema(
                    {
                        vol.Exclusive(CONF_KORT, "maal"): cv.string,
                        vol.Exclusive(CONF_LAMPER, "maal"): [cv.entity_domain("light")],
                    }
                )
            },
            # Fra 0.7.0 ligger lys, overgang og tidsplan i automatikken. De tre herunder er
            # rummets gamle form; de tages imod og foldes ind i én automatik ved indlæsningen.
            vol.Optional(CONF_AUTOMATIK, default=list): [AUTOMATIK],
            vol.Optional(CONF_LYS): LYSVALG,
            vol.Optional(CONF_OVERGANG, default=0): vol.All(
                vol.Coerce(float), vol.Range(min=0, max=10)
            ),
            vol.Optional(CONF_TIDSRUM, default=[]): [TIDSRUM],
            vol.Optional(CONF_SCENER, default=[]): [cv.string],
            vol.Optional(CONF_IKON): cv.icon,
        }
    ),
    _med_automatik,
    _kun_rummets,
)

INDSTILLINGER = vol.Schema(
    {
        vol.Optional(SLUK_EFTER_BEVAEGELSE): vol.All(vol.Coerce(int), vol.Range(min=0, max=1800)),
        vol.Optional(SLUK_EFTER_TRYK): vol.All(vol.Coerce(int), vol.Range(min=0, max=120)),
        vol.Optional(HOLD_TID): vol.All(vol.Coerce(float), vol.Range(min=0.5, max=24)),
    }
)


def hele_tal(data: Any) -> Any:
    """Formularens tal kommer som 3.0; gem hele tal som hele tal."""
    if isinstance(data, dict):
        return {k: hele_tal(v) for k, v in data.items()}
    if isinstance(data, list):
        return [hele_tal(v) for v in data]
    if isinstance(data, float) and data.is_integer():
        return int(data)
    return data
