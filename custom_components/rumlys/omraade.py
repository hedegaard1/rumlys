"""Home Assistants områder: rummet er et område, og dets lamper og sensorer foreslås derfra."""

from __future__ import annotations

from typing import Any

from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
    entity_registry as er,
)

from .const import (
    CONF_BEVAEGELSE,
    CONF_ENTITY_ID,
    CONF_LAMPER,
    CONF_LYS,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENER,
    CONF_SENSORER,
    CONF_TIDSRUM,
    STANDARD_LYS,
)

SENSORKLASSER = ("motion", "occupancy", "presence")


@callback
def entiteter_i_omraade(hass: HomeAssistant, omraade: str) -> list[er.RegistryEntry]:
    """Synlige entiteter i området — sat på entiteten selv eller arvet fra enheden."""
    enheder = {enhed.id for enhed in dr.async_entries_for_area(dr.async_get(hass), omraade)}
    return [
        entitet
        for entitet in er.async_get(hass).entities.values()
        if not entitet.disabled_by
        and not entitet.hidden_by
        and (
            entitet.area_id == omraade
            or (entitet.area_id is None and entitet.device_id in enheder)
        )
    ]


@callback
def gruppens_lamper(hass: HomeAssistant, entity_id: str) -> list[str]:
    """Lamperne i en gruppe. Zigbee2MQTT melder dem i group_entities, HA's grupper i entity_id."""
    tilstand = hass.states.get(entity_id)
    if tilstand is None:
        return []
    return list(
        tilstand.attributes.get("group_entities")
        or tilstand.attributes.get(ATTR_ENTITY_ID)
        or []
    )


@callback
def lamper_og_sensorer(hass: HomeAssistant, omraade: str) -> tuple[list[str], list[str]]:
    """Områdets lamper og bevægelsessensorer. Er en gruppe med, er dens pærer det ikke."""
    entiteter = entiteter_i_omraade(hass, omraade)
    lys = sorted(e.entity_id for e in entiteter if e.domain == "light")
    medlemmer = {m for entity_id in lys for m in gruppens_lamper(hass, entity_id)}
    grupper = [e for e in lys if gruppens_lamper(hass, e)]
    enkelte = [e for e in lys if e not in medlemmer and e not in grupper]
    sensorer = sorted(
        e.entity_id
        for e in entiteter
        if e.domain == "binary_sensor"
        and (e.device_class or e.original_device_class) in SENSORKLASSER
    )
    return grupper + enkelte, sensorer


@callback
def nyt_rum(hass: HomeAssistant, omraade: str) -> dict[str, Any]:
    """Et nyt rum med områdets lamper og sensorer valgt på forhånd."""
    lamper, sensorer = lamper_og_sensorer(hass, omraade)
    return {
        CONF_OMRAADE: omraade,
        CONF_LAMPER: [{CONF_ENTITY_ID: e, CONF_BEVAEGELSE: True} for e in lamper],
        CONF_SENSORER: sensorer,
        CONF_LYS: dict(STANDARD_LYS),
        CONF_OVERGANG: 0,
        CONF_TIDSRUM: [],
        CONF_SCENER: [],
    }


@callback
def omraadets_navn(hass: HomeAssistant, omraade: str | None) -> str | None:
    if omraade and (entry := ar.async_get(hass).async_get_area(omraade)):
        return entry.name
    return None
