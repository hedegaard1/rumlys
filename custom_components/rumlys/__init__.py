"""Rumlys: lyset i hvert rum samlet ét sted."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, RUM
from .rum import Rum

PLATFORMS = [Platform.NUMBER, Platform.SENSOR, Platform.SWITCH]


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
    for rum in data.rum.values():
        rum.start()
    entry.async_on_unload(entry.add_update_listener(_genindlaes))
    return True


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
