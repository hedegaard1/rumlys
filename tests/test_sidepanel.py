"""Efter en opdatering: siden skal selv kunne opdage, at den kører forrige udgave.

Før 0.7.0 lagde Rumlys en notits i Home Assistant om at trykke Ctrl+F5. Nu spørger kortet, hvilken
udgave der kører, og sammenligner med den, dets egen fil blev hentet som — er de forskellige,
lægger det en besked i bunden af siden med en knap, der genindlæser. Kommandoen herunder er dét,
svaret kommer fra.
"""

from typing import Any
import json
import re
from pathlib import Path

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.rumlys import sidepanel

from .test_websocket import kommando, opsaet


async def test_version_kan_hentes(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    await opsaet(hass)
    svar = await kommando(await hass_ws_client(hass), type="rumlys/version")
    assert svar["success"]
    assert svar["result"] == {"version": sidepanel.VERSION}


async def test_version_kraever_ikke_administrator(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    """Alle, der har et kort på en fane, skal kunne få beskeden — ikke kun administratorer."""
    await opsaet(hass)
    klient = await hass_ws_client(hass, hass_read_only_access_token)
    svar: dict[str, Any] = await kommando(klient, type="rumlys/version")
    assert svar["success"]
    assert svar["result"]["version"] == sidepanel.VERSION


def test_siden_og_integrationen_har_samme_version() -> None:
    """Versionen står to steder, og de skal følges ad.

    `manifest.json` bestemmer, hvad serveren svarer, og hvilken adresse filerne hentes fra.
    `VERSION` i rumlys-faelles.js er, hvad siden tror, den selv er. Står de forskelligt, melder
    siden «opdateret» ved hver eneste indlæsning — også lige efter et tryk på «Genindlæs», for den
    nye side tror stadig, den er den gamle. Det skete i 0.16.0, hvor kun manifestet blev rettet.
    """
    mappe = Path(sidepanel.__file__).parent
    manifest = json.loads((mappe / "manifest.json").read_text(encoding="utf-8"))["version"]
    faelles = (mappe / "frontend" / "rumlys-faelles.js").read_text(encoding="utf-8")
    fundet = re.search(r'^export const VERSION = "([^"]+)";$', faelles, re.MULTILINE)
    assert fundet is not None
    assert fundet.group(1) == manifest
