"""Beskeden efter en opdatering: en fane, der stod åben, kører stadig forrige udgave."""

from typing import Any
from unittest.mock import patch

from homeassistant.core import HomeAssistant

from custom_components.rumlys import sidepanel

LAGER = "rumlys.version"


def _gemt(version: str) -> dict[str, Any]:
    return {"version": 1, "minor_version": 1, "key": LAGER, "data": {"version": version}}


async def test_besked_naar_versionen_er_skiftet(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    hass.config.language = "da"
    hass_storage[LAGER] = _gemt("0.0.1")

    with patch.object(sidepanel.persistent_notification, "async_create") as besked:
        await sidepanel.meld_opdatering(hass)
    assert besked.call_count == 1
    assert "Ctrl+F5" in besked.call_args.args[1]
    assert hass_storage[LAGER]["data"] == {"version": sidepanel.VERSION}

    # Samme version igen — fx en genindlæsning af integrationen — giver ingen besked.
    with patch.object(sidepanel.persistent_notification, "async_create") as igen:
        await sidepanel.meld_opdatering(hass)
    assert igen.call_count == 0


async def test_ingen_besked_foerste_gang(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Første gang Rumlys sættes op, har ingen fane stået åben med en tidligere udgave."""
    with patch.object(sidepanel.persistent_notification, "async_create") as besked:
        await sidepanel.meld_opdatering(hass)
    assert besked.call_count == 0
    assert hass_storage[LAGER]["data"] == {"version": sidepanel.VERSION}
