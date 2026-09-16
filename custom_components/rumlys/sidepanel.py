"""Sidepanelet og kortet: filerne serveres af Rumlys selv, og kortet indlæses på alle sider."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN

MAPPE = Path(__file__).parent
VERSION = json.loads((MAPPE / "manifest.json").read_text(encoding="utf-8"))["version"]
# Versionen står i selve stien, så en opdatering giver alle filerne en ny adresse — også dem,
# sidepanelet og kortet importerer. Med «?v=» fik kun de to filer ny adresse, og browseren
# blandede et nyt sidepanel med sine gemte tekster fra forrige version.
URL = f"/rumlys_filer/{VERSION}"


async def async_register(hass: HomeAssistant) -> None:
    if not {"http", "frontend"} <= hass.config.components:
        return
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL, str(MAPPE / "frontend"), cache_headers=False)]
    )
    frontend.add_extra_js_url(hass, f"{URL}/rumlys-card.js")
    if DOMAIN not in hass.data.get(frontend.DATA_PANELS, {}):
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=DOMAIN,
            webcomponent_name="rumlys-panel",
            sidebar_title="Rumlys",
            sidebar_icon="mdi:lightbulb-group-outline",
            module_url=f"{URL}/rumlys-panel.js",
            require_admin=True,
            config={},
        )
