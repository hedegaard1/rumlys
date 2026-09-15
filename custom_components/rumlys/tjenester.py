"""Tjenesterne: dæmp hele rummet, og vælg et lys eller en scene til det."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import CONF_LYSSTYRKE, CONF_SCENE, CONF_TYPE, DOMAIN, LYS_SCENE
from .rum import Rum
from .skema import LYSVALG, hele_tal
from .websocket import rumlys_entry

RUM_VALG = {
    vol.Exclusive("rum", "rum"): cv.string,
    vol.Exclusive("omraade", "rum"): cv.string,
}

DAEMP = vol.Schema(
    {**RUM_VALG, vol.Required("lysstyrke"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100))}
)
ANVEND_LYS = vol.Schema({**RUM_VALG, vol.Required("lys"): LYSVALG})
ANVEND_SCENE = vol.Schema(
    {
        **RUM_VALG,
        vol.Required(CONF_SCENE): cv.string,
        vol.Optional(CONF_LYSSTYRKE): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
    }
)


@callback
def async_register(hass: HomeAssistant) -> None:
    hass.services.async_register(DOMAIN, "daemp", _daemp, schema=DAEMP)
    hass.services.async_register(DOMAIN, "anvend_lys", _anvend_lys, schema=ANVEND_LYS)
    hass.services.async_register(DOMAIN, "anvend_scene", _anvend_scene, schema=ANVEND_SCENE)


def _rummet(call: ServiceCall) -> Rum:
    entry = rumlys_entry(call.hass)
    if entry is not None:
        for rum in entry.runtime_data.rum.values():
            if call.data.get("rum") == rum.id or (
                call.data.get("omraade") and call.data.get("omraade") == rum.omraade
            ):
                return rum
    raise ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key="rum_findes_ikke",
        translation_placeholders={
            "rum": str(call.data.get("rum") or call.data.get("omraade") or "")
        },
    )


async def _daemp(call: ServiceCall) -> None:
    _rummet(call).daemp(call.data["lysstyrke"])


async def _anvend_lys(call: ServiceCall) -> None:
    _rummet(call).anvend_lys(hele_tal(call.data["lys"]))


async def _anvend_scene(call: ServiceCall) -> None:
    lys = {CONF_TYPE: LYS_SCENE, CONF_SCENE: call.data[CONF_SCENE]}
    if CONF_LYSSTYRKE in call.data:
        lys[CONF_LYSSTYRKE] = call.data[CONF_LYSSTYRKE]
    _rummet(call).anvend_lys(lys)
