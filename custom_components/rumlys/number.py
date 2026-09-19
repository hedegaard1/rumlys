"""Rummets tre tider som skydere på enheden."""

from __future__ import annotations

from homeassistant.components.number import (
    DOMAIN as NUMBER_DOMAIN,
    NumberDeviceClass,
    NumberEntity,
    NumberEntityDescription,
    NumberMode,
)
from homeassistant.const import EntityCategory, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import RumlysConfigEntry
from .const import HOLD_TID, SLUK_EFTER_BEVAEGELSE, SLUK_EFTER_TRYK
from .entity import AutomatikEntitet
from .rum import Automatik

BESKRIVELSER = (
    NumberEntityDescription(
        key=SLUK_EFTER_BEVAEGELSE,
        device_class=NumberDeviceClass.DURATION,
        entity_category=EntityCategory.CONFIG,
        mode=NumberMode.SLIDER,
        native_min_value=0,
        native_max_value=1800,
        native_step=10,
        native_unit_of_measurement=UnitOfTime.SECONDS,
    ),
    NumberEntityDescription(
        key=SLUK_EFTER_TRYK,
        device_class=NumberDeviceClass.DURATION,
        entity_category=EntityCategory.CONFIG,
        mode=NumberMode.SLIDER,
        native_min_value=0,
        native_max_value=120,
        native_step=1,
        native_unit_of_measurement=UnitOfTime.MINUTES,
    ),
    NumberEntityDescription(
        key=HOLD_TID,
        device_class=NumberDeviceClass.DURATION,
        entity_category=EntityCategory.CONFIG,
        mode=NumberMode.SLIDER,
        native_min_value=0.5,
        native_max_value=24,
        native_step=0.5,
        native_unit_of_measurement=UnitOfTime.HOURS,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: RumlysConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for rum_id, rum in entry.runtime_data.rum.items():
        async_add_entities(
            [
                Tid(aut, beskrivelse)
                for aut in rum.automatik
                for beskrivelse in BESKRIVELSER
            ],
            config_subentry_id=rum_id,
        )


class Tid(AutomatikEntitet, NumberEntity):
    """Tiderne hører til automatikken fra 0.7.0 — to grupper lamper i samme rum kan have hver sine."""

    def __init__(self, automatik: Automatik, beskrivelse: NumberEntityDescription) -> None:
        super().__init__(automatik, beskrivelse.key, NUMBER_DOMAIN)
        self.entity_description = beskrivelse

    @property
    def native_value(self) -> float:
        return self.automatik.indstillinger[self.entity_description.key]

    async def async_set_native_value(self, value: float) -> None:
        # Skyderen sender 15.0; gem hele tal som 15, så tilstanden ikke skifter udseende.
        self.automatik.saet(
            self.entity_description.key, int(value) if value.is_integer() else value
        )
