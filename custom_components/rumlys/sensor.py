"""Rummets tilstand: slukket, tændt af sensor, valgt lys eller holdes tændt."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import (
    DOMAIN as SENSOR_DOMAIN,
    SensorDeviceClass,
    SensorEntity,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import RumlysConfigEntry
from .const import BEVAEGELSE, HAAND, HOLD, SLUKKET
from .entity import AutomatikEntitet, RumEntitet


async def async_setup_entry(
    hass: HomeAssistant,
    entry: RumlysConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for rum_id, rum in entry.runtime_data.rum.items():
        async_add_entities(
            [Tilstand(rum, "tilstand", SENSOR_DOMAIN)]
            + [AutomatikTilstand(aut, "tilstand", SENSOR_DOMAIN) for aut in rum.automatik],
            config_subentry_id=rum_id,
        )


class Tilstand(RumEntitet, SensorEntity):
    """Rummets tilstand: den højeste af automatikkernes. En opsummering, ikke en sandhed om én ting."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [SLUKKET, BEVAEGELSE, HAAND, HOLD]

    @property
    def native_value(self) -> str:
        return self.rum.tilstand

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        slukker = self.rum.slukker
        return {
            "slukker": slukker and slukker.isoformat(),
            "kort_opdateret": self.rum.kort_opdateret,
            "automatikker": len(self.rum.automatik),
        }


class AutomatikTilstand(AutomatikEntitet, SensorEntity):
    """Én automatiks tilstand — den, der faktisk tæller ned."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [SLUKKET, BEVAEGELSE, HAAND, HOLD]

    @property
    def native_value(self) -> str:
        return self.automatik.tilstand

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        slukker = self.automatik.slukker
        return {
            "slukker": slukker and slukker.isoformat(),
            "lamper": list(self.automatik.lys),
            "navn": self.automatik.navn,
        }
