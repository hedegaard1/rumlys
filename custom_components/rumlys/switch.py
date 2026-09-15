"""«Hold lys»: lyset holdes tændt i hold-tiden, og sensoren sættes ud af spil imens."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import DOMAIN as SWITCH_DOMAIN, SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import RumlysConfigEntry
from .entity import RumEntitet


async def async_setup_entry(
    hass: HomeAssistant,
    entry: RumlysConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for rum_id, rum in entry.runtime_data.rum.items():
        async_add_entities([HoldLys(rum, "hold", SWITCH_DOMAIN)], config_subentry_id=rum_id)


class HoldLys(RumEntitet, SwitchEntity):
    @property
    def is_on(self) -> bool:
        return self.rum.hold_slutter is not None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        slutter = self.rum.hold_slutter
        return {"slutter": slutter and slutter.isoformat()}

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.rum.hold_til()

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.rum.hold_fra()
