"""Rummets tilstand: slukket, bevægelse, tændt i hånden eller holdes tændt."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import RumlysConfigEntry
from .const import BEVAEGELSE, HAAND, HOLD, SLUKKET
from .entity import RumEntitet


async def async_setup_entry(
    hass: HomeAssistant,
    entry: RumlysConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for rum_id, rum in entry.runtime_data.rum.items():
        async_add_entities([Tilstand(rum, "tilstand")], config_subentry_id=rum_id)


class Tilstand(RumEntitet, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [SLUKKET, BEVAEGELSE, HAAND, HOLD]

    @property
    def native_value(self) -> str:
        return self.rum.tilstand

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        slukker = self.rum.slukker
        return {"slukker": slukker and slukker.isoformat()}
