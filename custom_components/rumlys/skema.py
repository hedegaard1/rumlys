"""Hvad et rum må indeholde, når sidepanelet gemmer det."""

from __future__ import annotations

from datetime import time
from typing import Any

import voluptuous as vol

from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_BEVAEGELSE,
    CONF_ENTITY_ID,
    CONF_FARVE,
    CONF_KELVIN,
    CONF_LAMPER,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_NAVN,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENE,
    CONF_SCENER,
    CONF_SENSORER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    CONF_TYPE,
    HOLD_TID,
    LYS_FARVE,
    LYS_HVID,
    LYS_SCENE,
    LYSTYPER,
    SLUK_EFTER_BEVAEGELSE,
    SLUK_EFTER_TRYK,
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


def _tidsrum_komplet(tidsrum: dict[str, Any]) -> dict[str, Any]:
    if tidsrum[CONF_START] == tidsrum[CONF_SLUT]:
        raise vol.Invalid("start og slut kan ikke være samme klokkeslæt")
    return tidsrum


TIDSRUM = vol.All(
    vol.Schema(
        {
            vol.Required(CONF_NAVN): vol.All(cv.string, vol.Length(min=1)),
            vol.Required(CONF_START): _klokkeslaet,
            vol.Required(CONF_SLUT): _klokkeslaet,
            vol.Required(CONF_LYS): LYSVALG,
            vol.Optional(CONF_SLUK_EFTER): vol.All(vol.Coerce(int), vol.Range(min=0, max=3600)),
        }
    ),
    _tidsrum_komplet,
)

RUM_DATA = vol.Schema(
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
        vol.Required(CONF_LYS): LYSVALG,
        vol.Optional(CONF_OVERGANG, default=0): vol.All(
            vol.Coerce(float), vol.Range(min=0, max=10)
        ),
        vol.Optional(CONF_TIDSRUM, default=[]): [TIDSRUM],
        vol.Optional(CONF_SCENER, default=[]): [cv.string],
    }
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
