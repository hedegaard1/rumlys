"""Opsætning af Rumlys. Hvert rum er en underopsætning med sine egne tidsrum."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    SOURCE_USER,
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    SubentryFlowResult,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    TextSelector,
    TimeSelector,
)

from .const import (
    CONF_KELVIN,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_NAVN,
    CONF_OVERGANG,
    CONF_SENSORER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    DOMAIN,
    RUM,
)


class RumlysConfigFlow(ConfigFlow, domain=DOMAIN):
    """Selve integrationen. Rummene tilføjes bagefter med «Tilføj rum»."""

    VERSION = 1

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


def _lysstyrke() -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(
            min=1, max=100, step=1, unit_of_measurement="%", mode=NumberSelectorMode.SLIDER
        )
    )


def _kelvin() -> NumberSelector:
    # Et felt og ikke en skyder, så det kan stå tomt: så røres farven ikke.
    return NumberSelector(
        NumberSelectorConfig(
            min=2000, max=6500, step=50, unit_of_measurement="K", mode=NumberSelectorMode.BOX
        )
    )


def _sekunder(maks: float, step: float) -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(
            min=0, max=maks, step=step, unit_of_measurement="s", mode=NumberSelectorMode.BOX
        )
    )


def _heltal(data: dict[str, Any]) -> dict[str, Any]:
    """Formularens tal kommer som 100.0; gem hele tal som hele tal."""
    return {
        k: int(v) if isinstance(v, float) and v.is_integer() else v
        for k, v in data.items()
    }


def _beskriv(tidsrum: dict[str, Any]) -> str:
    tekst = (
        f"{tidsrum[CONF_NAVN]}: {tidsrum[CONF_START][:5]}–{tidsrum[CONF_SLUT][:5]},"
        f" {tidsrum[CONF_LYSSTYRKE]} %"
    )
    if CONF_KELVIN in tidsrum:
        tekst += f", {tidsrum[CONF_KELVIN]} K"
    if CONF_SLUK_EFTER in tidsrum:
        tekst += f", {tidsrum[CONF_SLUK_EFTER]} s"
    return tekst


class RumFlow(ConfigSubentryFlow):
    """Tilføj eller ret et rum: først rummet, så tidsrummene."""

    def __init__(self) -> None:
        self._navn = ""
        self._data: dict[str, Any] = {CONF_TIDSRUM: []}
        self._valgt: int | None = None

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        return await self.async_step_rum()

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        rum = self._get_reconfigure_subentry()
        self._navn = rum.title
        self._data = dict(rum.data)
        self._data[CONF_TIDSRUM] = list(rum.data.get(CONF_TIDSRUM, []))
        return await self.async_step_rum()

    async def async_step_rum(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        if user_input is not None:
            self._navn = user_input.pop(CONF_NAVN)
            self._data = _heltal(user_input) | {CONF_TIDSRUM: self._data[CONF_TIDSRUM]}
            return await self.async_step_menu()
        skema = vol.Schema(
            {
                vol.Required(CONF_NAVN): TextSelector(),
                vol.Required(CONF_LYS): EntitySelector(
                    EntitySelectorConfig(domain="light", multiple=True)
                ),
                vol.Optional(CONF_SENSORER): EntitySelector(
                    EntitySelectorConfig(domain="binary_sensor", multiple=True)
                ),
                vol.Required(CONF_LYSSTYRKE, default=100): _lysstyrke(),
                vol.Optional(CONF_KELVIN): _kelvin(),
                vol.Required(CONF_OVERGANG, default=0): _sekunder(10, 0.5),
            }
        )
        if self._navn:
            skema = self.add_suggested_values_to_schema(
                skema, {CONF_NAVN: self._navn} | self._data
            )
        return self.async_show_form(step_id="rum", data_schema=skema)

    async def async_step_menu(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        tidsrum = self._data[CONF_TIDSRUM]
        valg = ["tilfoej_tidsrum"]
        if tidsrum:
            valg += ["ret_tidsrum", "slet_tidsrum"]
        valg.append("gem")
        return self.async_show_menu(
            step_id="menu",
            menu_options=valg,
            description_placeholders={
                "navn": self._navn,
                "tidsrum": "\n".join(f"- {_beskriv(t)}" for t in tidsrum) or "–",
            },
        )

    async def async_step_tilfoej_tidsrum(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        self._valgt = None
        return await self.async_step_tidsrum()

    async def async_step_ret_tidsrum(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        if user_input is not None:
            self._valgt = int(user_input[CONF_TIDSRUM])
            return await self.async_step_tidsrum()
        return self.async_show_form(step_id="ret_tidsrum", data_schema=self._vaelg())

    async def async_step_slet_tidsrum(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        if user_input is not None:
            del self._data[CONF_TIDSRUM][int(user_input[CONF_TIDSRUM])]
            return await self.async_step_menu()
        return self.async_show_form(step_id="slet_tidsrum", data_schema=self._vaelg())

    async def async_step_tidsrum(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        fejl: dict[str, str] = {}
        if user_input is not None:
            if user_input[CONF_START] == user_input[CONF_SLUT]:
                fejl["base"] = "samme_tid"
            else:
                tidsrum = _heltal(user_input)
                if self._valgt is None:
                    self._data[CONF_TIDSRUM].append(tidsrum)
                else:
                    self._data[CONF_TIDSRUM][self._valgt] = tidsrum
                return await self.async_step_menu()
        skema = vol.Schema(
            {
                vol.Required(CONF_NAVN): TextSelector(),
                vol.Required(CONF_START): TimeSelector(),
                vol.Required(CONF_SLUT): TimeSelector(),
                vol.Required(CONF_LYSSTYRKE, default=100): _lysstyrke(),
                vol.Optional(CONF_KELVIN): _kelvin(),
                vol.Optional(CONF_SLUK_EFTER): _sekunder(1800, 5),
            }
        )
        forslag = user_input
        if forslag is None and self._valgt is not None:
            forslag = self._data[CONF_TIDSRUM][self._valgt]
        if forslag:
            skema = self.add_suggested_values_to_schema(skema, forslag)
        return self.async_show_form(step_id="tidsrum", data_schema=skema, errors=fejl)

    async def async_step_gem(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        if self.source == SOURCE_USER:
            return self.async_create_entry(title=self._navn, data=self._data)
        return self.async_update_and_abort(
            self._get_entry(),
            self._get_reconfigure_subentry(),
            title=self._navn,
            data=self._data,
        )

    def _vaelg(self) -> vol.Schema:
        return vol.Schema(
            {
                vol.Required(CONF_TIDSRUM): SelectSelector(
                    SelectSelectorConfig(
                        options=[
                            SelectOptionDict(value=str(i), label=_beskriv(t))
                            for i, t in enumerate(self._data[CONF_TIDSRUM])
                        ]
                    )
                )
            }
        )
