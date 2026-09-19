"""Fælles for rummets entiteter: hvert rum er én enhed i sit område."""

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity
from homeassistant.util import slugify

from .const import DOMAIN
from .rum import Automatik, Rum

# Id'et dannes af nøglen og ikke af det oversatte navn, så det er det samme på alle sprog og
# ikke skifter, når navnene på skærmen ændres.
OBJEKT_ID = {"hold": "hold_lys"}


class RumEntitet(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, rum: Rum, noegle: str, domaene: str) -> None:
        self.rum = rum
        self.entity_id = f"{domaene}.{slugify(rum.navn)}_{OBJEKT_ID.get(noegle, noegle)}"
        self._attr_translation_key = noegle
        self._attr_unique_id = f"{rum.id}_{noegle}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, rum.id)},
            name=rum.navn,
            manufacturer="Rumlys",
            model="Rum",
            configuration_url=f"homeassistant://{DOMAIN}/{rum.id}",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.rum.lyt(self.async_write_ha_state))


class AutomatikEntitet(Entity):
    """Hører til én automatik, men står på rummets enhed — det er stadig ét rum i huset.

    Id'et har automatikkens nummer i sig, så det bliver stående, når den får flere eller færre
    lamper. Navnet på skærmen er derimod lampernes, for det er dét, man genkender den på.
    """

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, automatik: Automatik, noegle: str, domaene: str) -> None:
        self.automatik = automatik
        self.rum = automatik.rum
        nummer = automatik.id
        self.entity_id = (
            f"{domaene}.{slugify(self.rum.navn)}_automatik_{nummer}_{OBJEKT_ID.get(noegle, noegle)}"
        )
        self._attr_translation_key = f"automatik_{noegle}"
        self._attr_translation_placeholders = {"nr": str(nummer)}
        self._attr_unique_id = f"{self.rum.id}_automatik_{nummer}_{noegle}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, self.rum.id)},
            name=self.rum.navn,
            manufacturer="Rumlys",
            model="Rum",
            configuration_url=f"homeassistant://{DOMAIN}/{self.rum.id}",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.rum.lyt(self.async_write_ha_state))
