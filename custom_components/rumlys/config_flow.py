"""Opsætning af Rumlys. Et rum er et område; resten sættes op i Rumlys i sidepanelet."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    SubentryFlowResult,
)
from homeassistant.core import callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import CONF_OMRAADE, DOMAIN, RUM
from .omraade import lamper_og_sensorer, nyt_rum


class RumlysConfigFlow(ConfigFlow, domain=DOMAIN):
    """Selve integrationen. Rummene oprettes bagefter med «Nyt rum»."""

    VERSION = 1
    MINOR_VERSION = 2

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Rumlys", data={})
        return self.async_show_form(step_id="user")

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: ConfigEntry
    ) -> dict[str, type[ConfigSubentryFlow]]:
        return {RUM: RumFlow}


class RumFlow(ConfigSubentryFlow):
    """Tilføj et rum ved at vælge området, eller flyt et rum til et andet område."""

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        fejl: dict[str, str] = {}
        if user_input is not None:
            if omraade := user_input.get(CONF_OMRAADE):
                return self.async_create_entry(
                    title=self._navn(omraade),
                    data=nyt_rum(self.hass, omraade),
                    unique_id=omraade,
                )
            fejl[CONF_OMRAADE] = "vaelg_omraade"
        valg = self._frie_omraader()
        if not valg:
            return self.async_abort(reason="ingen_omraader")
        return self.async_show_form(step_id="user", data_schema=_skema(valg), errors=fejl)

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        rum = self._get_reconfigure_subentry()
        if user_input is not None:
            omraade = user_input[CONF_OMRAADE]
            return self.async_update_and_abort(
                self._get_entry(),
                rum,
                title=self._navn(omraade),
                data_updates={CONF_OMRAADE: omraade},
                unique_id=omraade,
            )
        nuvaerende = rum.data.get(CONF_OMRAADE)
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=_skema(self._frie_omraader(nuvaerende), nuvaerende),
            description_placeholders={
                "navn": rum.title,
                "sti": f"/{DOMAIN}/{rum.subentry_id}",
            },
        )

    def _navn(self, omraade: str) -> str:
        entry = ar.async_get(self.hass).async_get_area(omraade)
        return entry.name if entry else omraade

    def _frie_omraader(self, beholder: str | None = None) -> list[SelectOptionDict]:
        """Områderne uden et rum, med lamper og sensorer som i sidepanelet. Et rum kan beholde sit eget."""
        optaget = {
            subentry.data.get(CONF_OMRAADE)
            for subentry in self._get_entry().get_subentries_of_type(RUM)
        } - {beholder}
        valg = []
        for omraade in sorted(
            ar.async_get(self.hass).async_list_areas(), key=lambda o: o.name.lower()
        ):
            if omraade.id in optaget:
                continue
            lamper, sensorer = lamper_og_sensorer(self.hass, omraade.id)
            antal = _antal(self.hass.config.language, len(lamper), len(sensorer))
            valg.append(SelectOptionDict(value=omraade.id, label=f"{omraade.name} — {antal}"))
        return valg


def _antal(sprog: str, lamper: int, sensorer: int) -> str:
    """Lamperne og sensorerne, et nyt rum får valgt på forhånd — skrevet som i sidepanelet."""
    if sprog.startswith("da"):
        return (
            f"{lamper} {'lampe' if lamper == 1 else 'lamper'} · "
            f"{sensorer} {'sensor' if sensorer == 1 else 'sensorer'}"
        )
    return (
        f"{lamper} {'light' if lamper == 1 else 'lights'} · "
        f"{sensorer} {'sensor' if sensorer == 1 else 'sensors'}"
    )


def _skema(valg: list[SelectOptionDict], standard: str | None = None) -> vol.Schema:
    # Et påkrævet valg uden standard får Home Assistants formular til selv at vælge det første
    # område, så et nyt rum har feltet valgfrit og siger selv til, hvis intet er valgt.
    felt = (
        vol.Required(CONF_OMRAADE, default=standard)
        if standard
        else vol.Optional(CONF_OMRAADE)
    )
    return vol.Schema(
        {
            felt: SelectSelector(
                SelectSelectorConfig(options=valg, mode=SelectSelectorMode.LIST)
            )
        }
    )
