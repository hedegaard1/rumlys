"""Kommandoerne, sidepanelet og kortet taler med Rumlys igennem."""

from __future__ import annotations

from types import MappingProxyType
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry, ConfigEntryState, ConfigSubentry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import (
    area_registry as ar,
    config_validation as cv,
    device_registry as dr,
    entity_registry as er,
)

from .const import (
    CONF_ENTITY_ID,
    CONF_IKON,
    CONF_KNAP_MAAL,
    CONF_KORT,
    CONF_LAMPER,
    CONF_OMRAADE,
    DOMAIN,
    RUM,
)
from .omraade import entiteter_i_omraade, er_knap, gruppens_lamper, nyt_rum
from .rum import Rum, automatikkerne
from .sidepanel import VERSION
from .skema import INDSTILLINGER, KORT, RUM_DATA, hele_tal

# Rummets entiteter efter nøgle, som kortet og sidepanelet slår op i.
ENTITETER = {
    "hold": "switch",
    "tilstand": "sensor",
    "sluk_efter_bevaegelse": "number",
    "sluk_efter_tryk": "number",
    "hold_tid": "number",
}


@callback
def async_register(hass: HomeAssistant) -> None:
    for kommando in (
        ws_version,
        ws_liste,
        ws_hent,
        ws_gem,
        ws_nye_kort,
        ws_opret,
        ws_slet,
        ws_omraader,
        ws_knapper,
        ws_lamper,
    ):
        websocket_api.async_register_command(hass, kommando)


@callback
def rumlys_entry(hass: HomeAssistant) -> ConfigEntry | None:
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry
    return None


def _entry_eller_fejl(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> ConfigEntry | None:
    entry = rumlys_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], "ikke_sat_op", "Rumlys er ikke sat op")
    return entry


def _rum_eller_fejl(
    entry: ConfigEntry, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> ConfigSubentry | None:
    subentry = entry.subentries.get(msg["rum_id"])
    if subentry is None or subentry.subentry_type != RUM:
        connection.send_error(msg["id"], "rum_findes_ikke", "Rummet findes ikke")
        return None
    return subentry


@callback
def _entiteter(hass: HomeAssistant, rum_id: str, automatik: list[int] | None = None) -> dict[str, Any]:
    """Rummets egne entiteter, og under «automatik» hver automatiks egne efter nummer.

    Tiderne og «hold lys» hører til automatikken fra 0.7.0; rummets tilstandssensor og hold-kontakt
    bliver stående som opsummering og som den, der tager hele rummet på én gang.
    """
    register = er.async_get(hass)

    def slaa_op(unik: str, domaene: str) -> str | None:
        return register.async_get_entity_id(domaene, DOMAIN, unik)

    ud: dict[str, Any] = {
        noegle: slaa_op(f"{rum_id}_{noegle}", domaene) for noegle, domaene in ENTITETER.items()
    }
    ud["automatik"] = {
        str(nr): {
            noegle: slaa_op(f"{rum_id}_automatik_{nr}_{noegle}", domaene)
            for noegle, domaene in ENTITETER.items()
        }
        for nr in automatik or []
    }
    return ud


@callback
def _rum_kort(hass: HomeAssistant, entry: ConfigEntry, subentry: ConfigSubentry) -> dict[str, Any]:
    rum = entry.runtime_data.rum.get(subentry.subentry_id)
    return {
        "id": subentry.subentry_id,
        "navn": rum.navn if rum else subentry.title,
        "omraade": subentry.data.get(CONF_OMRAADE),
        "lamper": subentry.data.get("lamper", []),
        "sensorer": subentry.data.get("sensorer", []),
        # Tidsrummene hører til automatikkerne fra 0.7.0. Oversigten viser dem samlet.
        "tidsrum": [
            tidsrum["navn"]
            for aut in automatikkerne(subentry.data)
            for tidsrum in aut.get("tidsrum", [])
        ],
        # Automatikkerne, som rummet ser dem: et rum fra før 0.7.0 har dem ikke i sin opsætning,
        # men svarer til den ene, indlæsningen folder det til.
        "automatik": automatikkerne(subentry.data),
        "scener": subentry.data.get("scener", []),
        "ikon": subentry.data.get(CONF_IKON),
        "entiteter": _entiteter(
            hass,
            subentry.subentry_id,
            [aut["id"] for aut in automatikkerne(subentry.data)],
        ),
        "kort": dict(rum.kort) if rum else {},
    }


@callback
def _optaget(entry: ConfigEntry, undtagen: str | None = None) -> dict[str, str]:
    """Områder, der har et rum, og hvilket."""
    return {
        subentry.data[CONF_OMRAADE]: subentry.subentry_id
        for subentry in entry.get_subentries_of_type(RUM)
        if subentry.data.get(CONF_OMRAADE) and subentry.subentry_id != undtagen
    }


@websocket_api.websocket_command({vol.Required("type"): "rumlys/version"})
@callback
def ws_version(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Hvilken udgave af Rumlys, der kører lige nu.

    Kortet og sidepanelet sammenligner den med den udgave, deres egen fil blev hentet som. Er de
    forskellige, kører fanen kode fra før opdateringen, og så siger Rumlys til med en knap, der
    genindlæser. Kræver ikke administrator: alle, der har et kort, skal kunne få beskeden.
    """
    connection.send_result(msg["id"], {"version": VERSION})


@websocket_api.websocket_command({vol.Required("type"): "rumlys/rum/liste"})
@callback
def ws_liste(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Alle rum med det, kortet skal bruge. Også for brugere, der ikke er administratorer."""
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    connection.send_result(
        msg["id"],
        sorted(
            (_rum_kort(hass, entry, s) for s in entry.get_subentries_of_type(RUM)),
            key=lambda rum: rum["navn"].lower(),
        ),
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "rumlys/rum/hent", vol.Required("rum_id"): str}
)
@callback
def ws_hent(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Hele rummets opsætning og det, det gør lige nu."""
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    if (subentry := _rum_eller_fejl(entry, connection, msg)) is None:
        return
    rum = entry.runtime_data.rum[subentry.subentry_id]
    connection.send_result(
        msg["id"],
        _rum_kort(hass, entry, subentry)
        | {"data": dict(subentry.data), "status": rum.status()},
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "rumlys/rum/gem",
        vol.Required("rum_id"): str,
        vol.Required("data"): dict,
        # Tiderne pr. automatik: {"1": {...}, "2": {...}}. Et sidepanel fra før 0.7.0 sender dem
        # fladt; de lægges så på den første automatik.
        vol.Optional("indstillinger"): dict,
        # Kortenes lamper efter kortets id: en tom liste er hele rummet, null ingen lamper. Gemmes i Rumlys'
        # egen tilstand, så de ikke genindlæser Rumlys.
        vol.Optional("kort"): vol.Schema({cv.string: KORT}),
    }
)
@callback
def ws_gem(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Gem rummet fra sidepanelet. Rumlys genindlæses, hvis opsætningen er ændret."""
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    if (subentry := _rum_eller_fejl(entry, connection, msg)) is None:
        return
    try:
        data = hele_tal(RUM_DATA(msg["data"]))
        raa = msg.get("indstillinger") or {}
        if raa and all(isinstance(v, dict) for v in raa.values()):
            indstillinger = {str(k): hele_tal(INDSTILLINGER(v)) for k, v in raa.items()}
        else:
            indstillinger = {"1": hele_tal(INDSTILLINGER(raa))} if raa else {}
    except vol.Invalid as err:
        connection.send_error(msg["id"], "ugyldig", str(err))
        return
    omraade = ar.async_get(hass).async_get_area(data[CONF_OMRAADE])
    if omraade is None:
        connection.send_error(msg["id"], "omraade_findes_ikke", "Området findes ikke")
        return
    if omraade.id in _optaget(entry, undtagen=subentry.subentry_id):
        connection.send_error(msg["id"], "omraade_optaget", "Området har allerede et rum")
        return
    # Tiderne først: en genindlæsning gemmer rummets tilstand, mens den lukker det.
    rum = entry.runtime_data.rum[subentry.subentry_id]
    for aut_id, tider in indstillinger.items():
        for aut in rum.automatik:
            if str(aut.id) == aut_id:
                for noegle, vaerdi in tider.items():
                    aut.saet(noegle, vaerdi)
    if "kort" in msg:
        data = _frys_knapper(rum, data, msg["kort"])
        # Mod lamperne, som de gemmes nu: en lampe, der lige er valgt i rummet, kan også vælges til et kort.
        rum.saet_kort(msg["kort"], [lampe[CONF_ENTITY_ID] for lampe in data[CONF_LAMPER]])
    hass.config_entries.async_update_subentry(
        entry, subentry, data=data, title=omraade.name, unique_id=omraade.id
    )
    connection.send_result(msg["id"], {"id": subentry.subentry_id})


def _frys_knapper(
    rum: Rum, data: dict[str, Any], kort: dict[str, Any]
) -> dict[str, Any]:
    """Fjernes et kort, en knap følger, overtager knappen kortets lamper.

    Ellers holdt knappen på væggen op med at gøre det, den plejer, fordi nogen ryddede op på
    et betjeningspanel. Er kortet hele rummet, styrer knappen hele rummet — og så er valget væk."""
    maal = {}
    for knap, hvad in data.get(CONF_KNAP_MAAL, {}).items():
        if CONF_KORT in hvad and hvad[CONF_KORT] not in kort:
            if lamper := rum.kortets_lamper(hvad[CONF_KORT]):
                maal[knap] = {CONF_LAMPER: lamper}
            continue
        maal[knap] = hvad
    return data | {CONF_KNAP_MAAL: maal}


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "rumlys/kort/nye",
        vol.Required("rum_id"): str,
        vol.Required("kort"): vol.Schema({cv.string: KORT}),
    }
)
@callback
def ws_nye_kort(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Kort, sidepanelet har fundet på betjeningspanelerne for første gang. Genindlæser ikke Rumlys."""
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    if (subentry := _rum_eller_fejl(entry, connection, msg)) is None:
        return
    rum = entry.runtime_data.rum[subentry.subentry_id]
    rum.nye_kort(msg["kort"])
    connection.send_result(msg["id"], {"kort": dict(rum.kort)})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "rumlys/rum/opret", vol.Required("omraade"): str}
)
@callback
def ws_opret(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Et nyt rum i et område, med områdets lamper og sensorer valgt på forhånd."""
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    omraade = ar.async_get(hass).async_get_area(msg["omraade"])
    if omraade is None:
        connection.send_error(msg["id"], "omraade_findes_ikke", "Området findes ikke")
        return
    if omraade.id in _optaget(entry):
        connection.send_error(msg["id"], "omraade_optaget", "Området har allerede et rum")
        return
    subentry = ConfigSubentry(
        data=MappingProxyType(nyt_rum(hass, omraade.id)),
        subentry_type=RUM,
        title=omraade.name,
        unique_id=omraade.id,
    )
    hass.config_entries.async_add_subentry(entry, subentry)
    connection.send_result(msg["id"], {"id": subentry.subentry_id})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "rumlys/rum/slet", vol.Required("rum_id"): str}
)
@callback
def ws_slet(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    if (subentry := _rum_eller_fejl(entry, connection, msg)) is None:
        return
    hass.config_entries.async_remove_subentry(entry, subentry.subentry_id)
    connection.send_result(msg["id"], {"id": subentry.subentry_id})


def _navn(hass: HomeAssistant, entity_id: str) -> str:
    tilstand = hass.states.get(entity_id)
    return tilstand.name if tilstand else entity_id


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "rumlys/omraader"})
@callback
def ws_omraader(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Alle områder med deres lamper og bevægelsessensorer, og hvilke der har et rum."""
    if (entry := _entry_eller_fejl(hass, connection, msg)) is None:
        return
    optaget = _optaget(entry)
    svar = []
    for omraade in sorted(ar.async_get(hass).async_list_areas(), key=lambda o: o.name.lower()):
        entiteter = entiteter_i_omraade(hass, omraade.id)
        lamper = [
            {
                "entity_id": e.entity_id,
                "navn": _navn(hass, e.entity_id),
                "gruppe": gruppens_lamper(hass, e.entity_id),
            }
            for e in sorted(entiteter, key=lambda e: e.entity_id)
            if e.domain == "light"
        ]
        sensorer = [
            {"entity_id": e.entity_id, "navn": _navn(hass, e.entity_id)}
            for e in sorted(entiteter, key=lambda e: e.entity_id)
            if e.domain == "binary_sensor"
            and (e.device_class or e.original_device_class) in ("motion", "occupancy", "presence")
        ]
        knapper = [
            {"entity_id": e.entity_id, "navn": _navn(hass, e.entity_id)}
            for e in sorted(entiteter, key=lambda e: e.entity_id)
            if er_knap(e)
        ]
        svar.append(
            {
                "id": omraade.id,
                "navn": omraade.name,
                "rum": optaget.get(omraade.id),
                "lamper": lamper,
                "sensorer": sensorer,
                "knapper": knapper,
            }
        )
    connection.send_result(msg["id"], svar)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "rumlys/knapper"})
@callback
def ws_knapper(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Alle husets vægknapper — til en knap, der står i et andet område end rummet."""
    register = er.async_get(hass)
    enheder = dr.async_get(hass)
    omraader = ar.async_get(hass)
    svar = []
    for entitet in sorted(register.entities.values(), key=lambda e: e.entity_id):
        if entitet.disabled_by or entitet.hidden_by or not er_knap(entitet):
            continue
        omraade_id = entitet.area_id
        if omraade_id is None and entitet.device_id:
            enhed = enheder.async_get(entitet.device_id)
            omraade_id = enhed.area_id if enhed else None
        omraade = omraader.async_get_area(omraade_id) if omraade_id else None
        svar.append(
            {
                "entity_id": entitet.entity_id,
                "navn": _navn(hass, entitet.entity_id),
                "omraade": omraade.name if omraade else None,
            }
        )
    connection.send_result(msg["id"], svar)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "rumlys/lamper"})
@callback
def ws_lamper(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Alle husets synlige lamper — til en lampe, der står i et andet område end rummet."""
    register = er.async_get(hass)
    enheder = dr.async_get(hass)
    omraader = ar.async_get(hass)
    svar = []
    for tilstand in sorted(hass.states.async_all("light"), key=lambda t: t.name.lower()):
        entitet = register.async_get(tilstand.entity_id)
        if entitet and entitet.hidden_by:
            continue
        omraade_id = entitet.area_id if entitet else None
        if entitet and omraade_id is None and entitet.device_id:
            enhed = enheder.async_get(entitet.device_id)
            omraade_id = enhed.area_id if enhed else None
        omraade = omraader.async_get_area(omraade_id) if omraade_id else None
        svar.append(
            {
                "entity_id": tilstand.entity_id,
                "navn": tilstand.name,
                "omraade": omraade.name if omraade else None,
                "gruppe": gruppens_lamper(hass, tilstand.entity_id),
            }
        )
    connection.send_result(msg["id"], svar)
