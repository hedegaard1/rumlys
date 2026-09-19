"""«Hold lys»: lyset holdes tændt i hold-tiden, og sensoren sættes ud af spil imens."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import DOMAIN as SWITCH_DOMAIN, SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import RumlysConfigEntry
from .entity import AutomatikEntitet, RumEntitet


async def async_setup_entry(
    hass: HomeAssistant,
    entry: RumlysConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for rum_id, rum in entry.runtime_data.rum.items():
        async_add_entities(
            [HoldLys(rum, "hold", SWITCH_DOMAIN)]
            + [AutomatikHoldLys(aut, "hold", SWITCH_DOMAIN) for aut in rum.automatik],
            config_subentry_id=rum_id,
        )


class HoldLys(RumEntitet, SwitchEntity):
    """Holder lyset i hele rummet — alle automatikker på én gang."""

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


class AutomatikHoldLys(AutomatikEntitet, SwitchEntity):
    """Holder lyset i én automatik. De andre i rummet går videre, som de plejer."""

    @property
    def is_on(self) -> bool:
        return self.automatik.hold_slutter is not None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        slutter = self.automatik.hold_slutter
        return {"slutter": slutter and slutter.isoformat()}

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.automatik.hold_til()

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.automatik.hold_fra()
