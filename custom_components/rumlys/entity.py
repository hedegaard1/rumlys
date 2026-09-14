"""Fælles for rummets entiteter: hvert rum er én enhed."""

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .rum import Rum


class RumEntitet(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, rum: Rum, noegle: str) -> None:
        self.rum = rum
        self._attr_translation_key = noegle
        self._attr_unique_id = f"{rum.id}_{noegle}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, rum.id)},
            name=rum.navn,
            manufacturer="Rumlys",
            model="Rum",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.rum.lyt(self.async_write_ha_state))
