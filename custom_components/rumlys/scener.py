"""Scenerne: kataloget og de lyskommandoer, en scene giver lamperne.

Kataloget og beregningen stammer fra Scene Presets 2.4.0 af Hypfer (Apache-2.0), se NOTICE.
Scenens farvepunkter fordeles på pærerne efter tur; en farvepære får punktet, en hvid pære
nærmeste farvetemperatur, og en pære der kun kan dæmpes, lysstyrken. Grupper foldes ud til deres
pærer, og får alle pærer i en gruppe det samme, sendes det til gruppen som én kommando — så når
alle pærerne den med det samme.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import color as color_util

from .omraade import gruppens_lamper

KATALOG = Path(__file__).parent / "frontend" / "scener" / "scener.json"
FARVE_TILSTANDE = ("xy", "hs", "rgb", "rgbw")

# Farvetemperaturen for hvert punkt på den hvide kurve, regnet med HA's egne farvefunktioner
# som i Scene Presets' color_temperature.py.
KELVIN_TABEL = [
    (kelvin, color_util.color_RGB_to_xy(*color_util.color_temperature_to_rgb(kelvin)))
    for kelvin in range(2000, 6550, 50)
]


async def async_hent_katalog(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """Scenerne efter id."""

    def laes() -> dict[str, Any]:
        return json.loads(KATALOG.read_text(encoding="utf-8"))

    data = await hass.async_add_executor_job(laes)
    return {scene["id"]: scene for scene in data.get("presets", [])}


def naermeste_kelvin(x: float, y: float) -> int:
    return min(KELVIN_TABEL, key=lambda k: (k[1][0] - x) ** 2 + (k[1][1] - y) ** 2)[0]


def _lampens_lys(hass: HomeAssistant, entity_id: str, punkt: tuple[float, float], lysstyrke: int) -> dict[str, Any] | None:
    tilstand = hass.states.get(entity_id)
    tilstande = (tilstand.attributes.get("supported_color_modes") if tilstand else None) or []
    if any(t in tilstande for t in FARVE_TILSTANDE):
        return {"brightness": lysstyrke, "xy_color": list(punkt)}
    if "color_temp" in tilstande:
        return {"brightness": lysstyrke, "color_temp_kelvin": naermeste_kelvin(*punkt)}
    if "brightness" in tilstande:
        return {"brightness": lysstyrke}
    return None


def kommandoer(
    hass: HomeAssistant,
    scene: dict[str, Any],
    lamper: list[str],
    lysstyrke_pct: int | None = None,
) -> list[tuple[list[str], dict[str, Any]]]:
    """Lampe for lampe: hvilke entiteter der skal have hvilke data til light.turn_on."""
    punkter = [(lys["x"], lys["y"]) for lys in scene.get("lights", [])]
    if not punkter:
        return []
    lysstyrke = round(lysstyrke_pct * 255 / 100) if lysstyrke_pct else int(scene.get("bri") or 255)
    tur = 0

    def naeste(entity_id: str) -> dict[str, Any] | None:
        nonlocal tur
        punkt = punkter[tur % len(punkter)]
        tur += 1
        return _lampens_lys(hass, entity_id, punkt, lysstyrke)

    kald: list[tuple[list[str], dict[str, Any]]] = []
    for entity_id in lamper:
        if hass.states.get(entity_id) is None:
            continue
        medlemmer = gruppens_lamper(hass, entity_id)
        if not medlemmer or any(hass.states.get(m) is None for m in medlemmer):
            if (lys := naeste(entity_id)) is not None:
                kald.append(([entity_id], lys))
            continue
        alle = [naeste(m) for m in medlemmer]
        if all(lys is not None and lys == alle[0] for lys in alle):
            kald.append(([entity_id], alle[0]))
        else:
            kald.extend(([m], lys) for m, lys in zip(medlemmer, alle, strict=True) if lys is not None)
    return kald
