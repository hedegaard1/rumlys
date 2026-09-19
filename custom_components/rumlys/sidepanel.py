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
# Scenerne har en fast adresse uden version: de ændrer sig ikke mellem versionerne, og et kort,
# der har stået åbent under en opdatering, kører stadig forrige versions kode og beder om dem dér.
SCENER_URL = "/rumlys_scener"
# Ikonsættet har også en fast adresse, og af samme grund som det står i sin egen fil uden
# import: menuen i venstre side tegner Rumlys' ikon, mens resten af Rumlys stadig hentes, og
# Home Assistant slår et eget ikonsæt op én gang og prøver aldrig igen. Med en fast adresse
# ligger filen i browseren fra sidste besøg i stedet for at blive hentet forfra efter hver
# opdatering. Filen rydder selv op, hvis den alligevel kom for sent.
IKON_URL = "/rumlys_ikoner"


# Beskeden efter en opdatering gives af kortet selv: det sammenligner den udgave, dets egen fil
# blev hentet som, med den, der kører, og viser en besked i bunden af siden med en knap, der
# genindlæser. Før stod der en notits om at trykke Ctrl+F5, og det skulle man så gøre i hånden.


async def async_register(hass: HomeAssistant) -> None:
    if not {"http", "frontend"} <= hass.config.components:
        return
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(URL, str(MAPPE / "frontend"), cache_headers=False),
            StaticPathConfig(SCENER_URL, str(MAPPE / "frontend" / "scener"), cache_headers=False),
            # Den eneste med cache-headere: browseren må gerne gemme den i en måned, for
            # det er hele pointen. Ændres et ikon, skal filen have et nyt navn.
            StaticPathConfig(IKON_URL, str(MAPPE / "frontend" / "ikoner"), cache_headers=True),
        ]
    )
    # Ikonerne først. Home Assistant gemmer adresserne i et frozenset og lover ingen
    # rækkefølge, så det er ikke den, der afgør kapløbet — det gør størrelsen og cachen.
    frontend.add_extra_js_url(hass, f"{IKON_URL}/rumlys-ikoner.js")
    frontend.add_extra_js_url(hass, f"{URL}/rumlys-card.js")
    if DOMAIN not in hass.data.get(frontend.DATA_PANELS, {}):
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=DOMAIN,
            webcomponent_name="rumlys-panel",
            sidebar_title="Rumlys",
            sidebar_icon="rumlys:lampe",
            module_url=f"{URL}/rumlys-panel.js",
            require_admin=True,
            config={},
        )
