"""Home Assistants områder: rummet er et område, og dets lamper og sensorer foreslås derfra."""

from __future__ import annotations

from typing import Any

from homeassistant.components.light import LightEntityFeature
from homeassistant.const import ATTR_ENTITY_ID, ATTR_SUPPORTED_FEATURES
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
    entity_registry as er,
)

from .const import (
    CONF_BEVAEGELSE,
    CONF_ENTITY_ID,
    CONF_LAMPER,
    CONF_LYS,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENER,
    CONF_SENSORER,
    CONF_TIDSRUM,
    STANDARD_LYS,
    STANDARD_OVERGANG,
)

SENSORKLASSER = ("motion", "occupancy", "presence")

# Farvetilstande, hvor lysstyrken kan sættes. Home Assistant melder dem som ColorMode-værdier,
# og «onoff» og «unknown» er de to, der ikke kan. Sammenlignes som tekst, fordi attributten kan
# indeholde både enum og streng afhængigt af integrationen.
LYSSTYRKETILSTANDE = frozenset(
    {
        "brightness",
        "color_temp",
        "hs",
        "rgb",
        "rgbw",
        "rgbww",
        "white",
        "xy",
        "ColorMode.BRIGHTNESS",
        "ColorMode.COLOR_TEMP",
        "ColorMode.HS",
        "ColorMode.RGB",
        "ColorMode.RGBW",
        "ColorMode.RGBWW",
        "ColorMode.WHITE",
        "ColorMode.XY",
    }
)
# En vægknap melder sig som «opening»: IHC giver alle sine indgange den klasse, og en rigtig
# dør- eller vinduessensor siger «door» eller «window». Det er det nærmeste, der findes.
KNAPKLASSER = ("opening",)


@callback
def er_knap(entitet: er.RegistryEntry) -> bool:
    """En vægknap, Rumlys kan overtage.

    To slags: IHC giver hver indgang som en binary_sensor med klassen «opening» — der findes ingen
    knap-klasse for en binary_sensor overhovedet — mens Home Assistants egen måde at modellere en
    knap på er en event-entitet med klassen «button». Begge skal stå på listen (fra 0.9.0), så
    længe IHC ikke melder sine som rigtige knapper.
    """
    klasse = entitet.device_class or entitet.original_device_class
    if entitet.domain == "event":
        return klasse == "button"
    return entitet.domain == "binary_sensor" and klasse in KNAPKLASSER


@callback
def entiteter_i_omraade(hass: HomeAssistant, omraade: str) -> list[er.RegistryEntry]:
    """Synlige entiteter i området — sat på entiteten selv eller arvet fra enheden."""
    enheder = {enhed.id for enhed in dr.async_entries_for_area(dr.async_get(hass), omraade)}
    return [
        entitet
        for entitet in er.async_get(hass).entities.values()
        if not entitet.disabled_by
        and not entitet.hidden_by
        and (
            entitet.area_id == omraade
            or (entitet.area_id is None and entitet.device_id in enheder)
        )
    ]


@callback
def gruppens_lamper(hass: HomeAssistant, entity_id: str) -> list[str]:
    """Lamperne i en gruppe. Zigbee2MQTT melder dem i group_entities, HA's grupper i entity_id."""
    tilstand = hass.states.get(entity_id)
    if tilstand is None:
        return []
    return list(
        tilstand.attributes.get("group_entities")
        or tilstand.attributes.get(ATTR_ENTITY_ID)
        or []
    )


@callback
def lamper_og_sensorer(hass: HomeAssistant, omraade: str) -> tuple[list[str], list[str]]:
    """Områdets lamper og bevægelsessensorer. Er en gruppe med, er dens pærer det ikke."""
    entiteter = entiteter_i_omraade(hass, omraade)
    lys = sorted(e.entity_id for e in entiteter if e.domain == "light")
    medlemmer = {m for entity_id in lys for m in gruppens_lamper(hass, entity_id)}
    grupper = [e for e in lys if gruppens_lamper(hass, e)]
    enkelte = [e for e in lys if e not in medlemmer and e not in grupper]
    sensorer = sorted(
        e.entity_id
        for e in entiteter
        if e.domain == "binary_sensor"
        and (e.device_class or e.original_device_class) in SENSORKLASSER
    )
    return grupper + enkelte, sensorer


@callback
def kan_selv_overgang(hass: HomeAssistant, entity_id: str) -> bool:
    """Laver lampen selv overgangen? Så sendes `transition` med, som Home Assistant vil have det."""
    tilstand = hass.states.get(entity_id)
    return (
        tilstand is not None
        and bool(tilstand.attributes.get(ATTR_SUPPORTED_FEATURES, 0) & LightEntityFeature.TRANSITION)
    )


@callback
def kan_trappes(hass: HomeAssistant, entity_id: str) -> bool:
    """Kan lampen dæmpes, men ikke selv lave en overgang? Så trapper Rumlys lysstyrken i skridt.

    Det er tilfældet for et IHC-lys med dæmper: det kan stå på 40 %, men ikke glide derhen, og
    et `transition` i kaldet går i gulvet uden en fejl."""
    tilstand = hass.states.get(entity_id)
    if tilstand is None or kan_selv_overgang(hass, entity_id):
        return False
    tilstande = tilstand.attributes.get("supported_color_modes") or []
    return any(str(tilstand_) in LYSSTYRKETILSTANDE for tilstand_ in tilstande)


@callback
def _kan_blodt(hass: HomeAssistant, lamper: list[str]) -> bool:
    """Kan mindst én af lamperne tænde og slukke blødt? Et rent IHC-relæ kan ikke."""
    return any(
        kan_selv_overgang(hass, entity_id) or kan_trappes(hass, entity_id)
        for entity_id in lamper
    )


@callback
def nyt_rum(hass: HomeAssistant, omraade: str) -> dict[str, Any]:
    """Et nyt rum med områdets lamper og sensorer valgt på forhånd."""
    lamper, sensorer = lamper_og_sensorer(hass, omraade)
    return {
        CONF_OMRAADE: omraade,
        CONF_LAMPER: [{CONF_ENTITY_ID: e, CONF_BEVAEGELSE: True} for e in lamper],
        CONF_SENSORER: sensorer,
        CONF_LYS: dict(STANDARD_LYS),
        # Blød tænd og sluk i 3 sekunder, som Kontor og Træningsrum blev sat op med. Kan ingen af lamperne
        # det, står feltet slet ikke på rummets side, og så skal tallet være 0.
        CONF_OVERGANG: STANDARD_OVERGANG if _kan_blodt(hass, lamper) else 0,
        CONF_TIDSRUM: [],
        CONF_SCENER: [],
    }


@callback
def omraadets_navn(hass: HomeAssistant, omraade: str | None) -> str | None:
    if omraade and (entry := ar.async_get(hass).async_get_area(omraade)):
        return entry.name
    return None
