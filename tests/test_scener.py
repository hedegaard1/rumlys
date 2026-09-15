"""Scenerne fra Scene Presets: kataloget og lyskommandoerne."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from custom_components.rumlys import scener

HVILE = "e03267e7-9914-4f47-97fe-63c0bd317fe7"  # «Rest»: lysstyrke 90, ét punkt
TO_PUNKTER = {"id": "to", "bri": 200, "lights": [{"x": 0.6, "y": 0.35}, {"x": 0.2, "y": 0.1}]}


def lampe(hass: HomeAssistant, entity_id: str, *tilstande: str, **attributter) -> None:
    hass.states.async_set(entity_id, "off", {"supported_color_modes": list(tilstande)} | attributter)


async def test_kataloget_har_alle_scenerne(hass: HomeAssistant) -> None:
    katalog = await scener.async_hent_katalog(hass)
    assert len(katalog) == 146
    assert katalog[HVILE]["bri"] == 90
    mappe = scener.KATALOG.parent
    assert all((mappe / scene["img"]).is_file() for scene in katalog.values() if scene.get("img"))


def test_naermeste_farvetemperatur() -> None:
    kelvin, (x, y) = scener.KELVIN_TABEL[14]
    assert scener.naermeste_kelvin(x, y) == kelvin == 2700


async def test_punkterne_fordeles_efter_hvad_lamperne_kan(hass: HomeAssistant) -> None:
    lampe(hass, "light.farve", "color_temp", "xy")
    lampe(hass, "light.hvid", "color_temp")
    lampe(hass, "light.daempbar", "brightness")
    lampe(hass, "light.kontakt", "onoff")
    lampe(hass, "light.farve2", "hs")
    kald = scener.kommandoer(
        hass, TO_PUNKTER, ["light.farve", "light.hvid", "light.daempbar", "light.kontakt", "light.farve2"]
    )
    assert kald == [
        (["light.farve"], {"brightness": 200, "xy_color": [0.6, 0.35]}),
        (["light.hvid"], {"brightness": 200, "color_temp_kelvin": scener.naermeste_kelvin(0.2, 0.1)}),
        (["light.daempbar"], {"brightness": 200}),
        # Kontakten tager sin tur med det andet punkt, men tændes ikke.
        (["light.farve2"], {"brightness": 200, "xy_color": [0.6, 0.35]}),
    ]


async def test_en_gruppe_med_samme_lys_faar_en_kommando(hass: HomeAssistant) -> None:
    for pære in ("light.spot_1", "light.spot_2"):
        lampe(hass, pære, "color_temp", "xy")
    lampe(hass, "light.spots", "color_temp", "xy", group_entities=["light.spot_1", "light.spot_2"])
    katalog = await scener.async_hent_katalog(hass)
    assert scener.kommandoer(hass, katalog[HVILE], ["light.spots"]) == [
        (["light.spots"], {"brightness": 90, "xy_color": [0.561, 0.4042]})
    ]
    # To punkter giver pærerne hver sit, så de sendes hver for sig.
    assert scener.kommandoer(hass, TO_PUNKTER, ["light.spots"]) == [
        (["light.spot_1"], {"brightness": 200, "xy_color": [0.6, 0.35]}),
        (["light.spot_2"], {"brightness": 200, "xy_color": [0.2, 0.1]}),
    ]


async def test_egen_lysstyrke(hass: HomeAssistant) -> None:
    lampe(hass, "light.farve", "xy")
    assert scener.kommandoer(hass, TO_PUNKTER, ["light.farve"], lysstyrke_pct=50) == [
        (["light.farve"], {"brightness": 128, "xy_color": [0.6, 0.35]})
    ]
