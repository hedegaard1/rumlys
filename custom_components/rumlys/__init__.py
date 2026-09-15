"""Rumlys: lyset i hvert rum samlet ét sted."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import (
    area_registry as ar,
    config_validation as cv,
    device_registry as dr,
)
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_BEVAEGELSE,
    CONF_ENTITY_ID,
    CONF_KELVIN,
    CONF_LAMPER,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_NAVN,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENER,
    CONF_SENSORER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    CONF_TYPE,
    DOMAIN,
    LYS_HVID,
    LYS_LYSSTYRKE,
    RUM,
)
from . import tjenester, websocket
from .rum import Rum

PLATFORMS = [Platform.NUMBER, Platform.SENSOR, Platform.SWITCH]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Kommandoerne og tjenesterne findes, så snart integrationen er indlæst."""
    websocket.async_register(hass)
    tjenester.async_register(hass)
    return True


@dataclass
class RumlysData:
    """Rummene og lageret, hvor de gemmer tider og tilstand til næste start."""

    lager: Store[dict[str, Any]]
    rum: dict[str, Rum] = field(default_factory=dict)

    def til_lagring(self) -> dict[str, Any]:
        return {rum_id: rum.til_lagring() for rum_id, rum in self.rum.items()}


type RumlysConfigEntry = ConfigEntry[RumlysData]


def _lager(hass: HomeAssistant, entry: ConfigEntry) -> Store[dict[str, Any]]:
    return Store(hass, 1, f"{DOMAIN}.{entry.entry_id}")


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """0.1.0 gemte et navn og en liste af lamper; fra 0.3.0 er rummet et område."""
    if entry.version > 1:
        return False
    if entry.minor_version < 2:
        omraader = ar.async_get(hass)
        for subentry in list(entry.subentries.values()):
            if subentry.subentry_type != RUM or CONF_LAMPER in subentry.data:
                continue
            omraade = omraader.async_get_area_by_name(subentry.title)
            hass.config_entries.async_update_subentry(
                entry,
                subentry,
                data=_rum_fra_0_1(subentry.data, omraade.id if omraade else None),
                title=omraade.name if omraade else subentry.title,
                unique_id=omraade.id if omraade else None,
            )
        hass.config_entries.async_update_entry(entry, minor_version=2)
    return True


def _rum_fra_0_1(data: Any, omraade: str | None) -> dict[str, Any]:
    def lysvalg(gammelt: Any) -> dict[str, Any]:
        lys = {CONF_LYSSTYRKE: gammelt.get(CONF_LYSSTYRKE, 100)}
        if gammelt.get(CONF_KELVIN):
            return {CONF_TYPE: LYS_HVID, **lys, CONF_KELVIN: gammelt[CONF_KELVIN]}
        return {CONF_TYPE: LYS_LYSSTYRKE, **lys}

    tidsrum = []
    for gammelt in data.get(CONF_TIDSRUM, []):
        nyt = {k: gammelt[k] for k in (CONF_NAVN, CONF_START, CONF_SLUT)}
        if CONF_SLUK_EFTER in gammelt:
            nyt[CONF_SLUK_EFTER] = gammelt[CONF_SLUK_EFTER]
        tidsrum.append(nyt | {CONF_LYS: lysvalg(gammelt)})
    return {
        CONF_OMRAADE: omraade,
        CONF_LAMPER: [
            {CONF_ENTITY_ID: entity_id, CONF_BEVAEGELSE: True}
            for entity_id in data.get(CONF_LYS, [])
        ],
        CONF_SENSORER: list(data.get(CONF_SENSORER, [])),
        CONF_LYS: lysvalg(data),
        CONF_OVERGANG: data.get(CONF_OVERGANG, 0),
        CONF_TIDSRUM: tidsrum,
        CONF_SCENER: [],
    }


async def async_setup_entry(hass: HomeAssistant, entry: RumlysConfigEntry) -> bool:
    lager = _lager(hass, entry)
    gemt = await lager.async_load() or {}
    data = RumlysData(lager)

    def gem() -> None:
        lager.async_delay_save(data.til_lagring, 1)

    for subentry in entry.get_subentries_of_type(RUM):
        data.rum[subentry.subentry_id] = Rum(
            hass, subentry, gemt.get(subentry.subentry_id, {}), gem
        )
    entry.runtime_data = data
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    _laeg_i_omraader(hass, entry)
    for rum in data.rum.values():
        rum.start()
    entry.async_on_unload(entry.add_update_listener(_genindlaes))

    @callback
    def omraade_aendret(event: Event) -> None:
        _omraade_aendret(hass, entry, event)

    entry.async_on_unload(
        hass.bus.async_listen(ar.EVENT_AREA_REGISTRY_UPDATED, omraade_aendret)
    )
    return True


@callback
def _laeg_i_omraader(hass: HomeAssistant, entry: RumlysConfigEntry) -> None:
    """Rummets enhed hører til rummets område."""
    enheder = dr.async_get(hass)
    for rum in entry.runtime_data.rum.values():
        enhed = enheder.async_get_device_by_identifier((DOMAIN, rum.id), entry.entry_id)
        if enhed and rum.omraade and enhed.area_id != rum.omraade:
            enheder.async_update_device(enhed.id, area_id=rum.omraade)


@callback
def _omraade_aendret(hass: HomeAssistant, entry: RumlysConfigEntry, event: Event) -> None:
    """Et område er omdøbt: rummet hedder det samme."""
    if event.data["action"] != "update":
        return
    omraade = ar.async_get(hass).async_get_area(event.data["area_id"])
    if omraade is None:
        return
    for subentry in entry.get_subentries_of_type(RUM):
        if subentry.data.get(CONF_OMRAADE) == omraade.id and subentry.title != omraade.name:
            hass.config_entries.async_update_subentry(entry, subentry, title=omraade.name)


async def _genindlaes(hass: HomeAssistant, entry: RumlysConfigEntry) -> None:
    """Et rum er tilføjet, rettet eller slettet."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: RumlysConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    data = entry.runtime_data
    for rum in data.rum.values():
        rum.stop()
    # Gem med det samme, så en genindlæsning ikke læser lageret før den ventende skrivning.
    await data.lager.async_save(data.til_lagring())
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await _lager(hass, entry).async_remove()
