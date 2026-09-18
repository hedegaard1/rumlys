"""Kommandoerne, sidepanelet og kortet bruger."""

from __future__ import annotations

from typing import Any

from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from homeassistant.config_entries import ConfigSubentryData
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar, entity_registry as er

from custom_components.rumlys.const import DOMAIN, RUM, STANDARD_LYS

SPOTS = "light.gang_spots"


def rum_i(omraade: str, titel: str, **data: Any) -> ConfigSubentryData:
    return ConfigSubentryData(
        data={
            "omraade": omraade,
            "lamper": [],
            "sensorer": [],
            "lys": STANDARD_LYS,
            "overgang": 0,
            "tidsrum": [],
            "scener": [],
        }
        | data,
        subentry_id=omraade,
        subentry_type=RUM,
        title=titel,
        unique_id=omraade,
    )


async def opsaet(hass: HomeAssistant) -> MockConfigEntry:
    omraader = ar.async_get(hass)
    for navn in ("Gang", "Kontor", "Stue"):
        omraader.async_create(navn)
    entiteter = er.async_get(hass)
    entiteter.async_get_or_create("light", "test", "spots", suggested_object_id="gang_spots")
    entiteter.async_update_entity(SPOTS, area_id="gang")
    # Tilstanden sættes efter registreringen; ellers får entiteten et andet id.
    hass.states.async_set(SPOTS, "off", {"friendly_name": "Gang Spots"})
    entiteter.async_get_or_create(
        "binary_sensor", "test", "pir", suggested_object_id="gang_pir", original_device_class="motion"
    )
    entiteter.async_update_entity("binary_sensor.gang_pir", area_id="gang")
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Rumlys",
        minor_version=2,
        subentries_data=[
            rum_i("gang", "Gang", lamper=[{"entity_id": SPOTS, "bevaegelse": True}], scener=["a", "b"]),
            rum_i("kontor", "Kontor"),
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def kommando(klient, **besked: Any) -> dict[str, Any]:
    await klient.send_json_auto_id(besked)
    return await klient.receive_json()


async def test_liste_til_kortet(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await opsaet(hass)
    svar = await kommando(await hass_ws_client(hass), type="rumlys/rum/liste")
    assert svar["success"]
    assert svar["result"][0] == {
        "id": "gang",
        "navn": "Gang",
        "omraade": "gang",
        "lamper": [{"entity_id": SPOTS, "bevaegelse": True}],
        "sensorer": [],
        "tidsrum": [],
        "scener": ["a", "b"],
        "ikon": None,
        "entiteter": {
            "hold": "switch.gang_hold_lys",
            "tilstand": "sensor.gang_tilstand",
            "sluk_efter_bevaegelse": "number.gang_sluk_efter_bevaegelse",
            "sluk_efter_tryk": "number.gang_sluk_efter_tryk",
            "hold_tid": "number.gang_hold_tid",
        },
        "kort": {},
    }
    assert [rum["navn"] for rum in svar["result"]] == ["Gang", "Kontor"]


async def test_kun_listen_for_andre_end_administratorer(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, hass_read_only_access_token: str
) -> None:
    await opsaet(hass)
    klient = await hass_ws_client(hass, hass_read_only_access_token)
    assert (await kommando(klient, type="rumlys/rum/liste"))["success"]
    svar = await kommando(klient, type="rumlys/rum/hent", rum_id="gang")
    assert svar["error"]["code"] == "unauthorized"


async def test_hent_og_gem(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    entry = await opsaet(hass)
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/rum/hent", rum_id="gang")
    assert svar["result"]["data"]["lamper"] == [{"entity_id": SPOTS, "bevaegelse": True}]
    status = svar["result"]["status"]
    assert status["tilstand"] == "slukket"
    assert status["indstillinger"] == {"sluk_efter_bevaegelse": 30, "sluk_efter_tryk": 5, "hold_tid": 4}

    data = svar["result"]["data"] | {
        "overgang": 2.0,
        "lamper": [{"entity_id": SPOTS, "bevaegelse": False}],
        "sensorer": ["binary_sensor.gang_pir", "binary_sensor.gang_radar"],
        # En sensor, der ikke er valgt i rummet, kan ikke være tilstedeværelsessensor i det.
        "tilstede": ["binary_sensor.gang_radar", "binary_sensor.fjernet"],
        "ikon": "hue:lightstrip",
        "tidsrum": [
            {"navn": "Nat", "start": "22:00", "slut": "06:30", "lys": {"type": "scene", "scene": "x", "lysstyrke": 10.0}},
            {"navn": "Weekend", "start": "00:00", "slut": "00:00", "dage": [6, 5, 6], "lys": STANDARD_LYS},
        ],
    }
    svar = await kommando(
        klient, type="rumlys/rum/gem", rum_id="gang", data=data, indstillinger={"sluk_efter_tryk": 10}
    )
    assert svar["success"], svar
    await hass.async_block_till_done()

    gemt = entry.subentries["gang"].data
    assert gemt["overgang"] == 2
    assert gemt["lamper"] == [{"entity_id": SPOTS, "bevaegelse": False}]
    assert gemt["tilstede"] == ["binary_sensor.gang_radar"]
    assert gemt["ikon"] == "hue:lightstrip"
    assert gemt["tidsrum"] == [
        {
            "navn": "Nat",
            "start": "22:00:00",
            "slut": "06:30:00",
            "dage": [0, 1, 2, 3, 4, 5, 6],
            "lys": {"type": "scene", "scene": "x", "lysstyrke": 10},
        },
        {"navn": "Weekend", "start": "00:00:00", "slut": "00:00:00", "dage": [5, 6], "lys": STANDARD_LYS},
    ]
    assert hass.states.get("number.gang_sluk_efter_tryk").state == "10"


async def test_kortenes_lamper(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    entry = await opsaet(hass)
    klient = await hass_ws_client(hass)
    bord = "light.gang_bordlampe"

    data = (await kommando(klient, type="rumlys/rum/hent", rum_id="gang"))["result"]["data"]
    # Bordlampen vælges i rummet og til et kort i samme gem.
    data |= {"lamper": [{"entity_id": SPOTS, "bevaegelse": True}, {"entity_id": bord, "bevaegelse": False}]}
    svar = await kommando(
        klient,
        type="rumlys/rum/gem",
        rum_id="gang",
        data=data,
        kort={"k1": [bord, "light.fremmed"], "k2": [bord, SPOTS], "k3": [], "k5": None, "k6": ["light.fremmed"]},
    )
    assert svar["success"], svar
    await hass.async_block_till_done()
    liste = (await kommando(klient, type="rumlys/rum/liste"))["result"]
    # Lamper uden for rummet tæller ikke, og alle rummets lamper er hele rummet. None er ingen lamper, og et kort,
    # hvis lamper alle er uden for rummet, viser heller ingen — ikke hele rummet.
    assert liste[0]["kort"] == {"k1": [bord], "k2": [], "k3": [], "k5": None, "k6": None}

    # Nye kort fra sidepanelet: et kort, rummet kender, røres ikke.
    foer = hass.states.get("sensor.gang_tilstand").attributes["kort_opdateret"]
    svar = await kommando(
        klient, type="rumlys/kort/nye", rum_id="gang", kort={"k1": [SPOTS], "k4": [SPOTS], "k7": None}
    )
    assert svar["result"]["kort"] == {"k1": [bord], "k2": [], "k3": [], "k5": None, "k6": None, "k4": [SPOTS], "k7": None}
    # Tilstandssensoren viser, at kortene er ændret, så kort på andre skærme henter rummet igen.
    await hass.async_block_till_done()
    assert hass.states.get("sensor.gang_tilstand").attributes["kort_opdateret"] not in (None, foer)

    # Kortene overlever, at Rumlys genindlæses, og de alene genindlæser det ikke.
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    liste = (await kommando(klient, type="rumlys/rum/liste"))["result"]
    assert liste[0]["kort"] == {"k1": [bord], "k2": [], "k3": [], "k5": None, "k6": None, "k4": [SPOTS], "k7": None}

    # Et gem, hvor kun kortene er ændret, gemmer dem også — og et glemt kort er væk.
    data = (await kommando(klient, type="rumlys/rum/hent", rum_id="gang"))["result"]["data"]
    svar = await kommando(klient, type="rumlys/rum/gem", rum_id="gang", data=data, kort={"k1": [SPOTS]})
    assert svar["success"], svar
    await hass.async_block_till_done()
    liste = (await kommando(klient, type="rumlys/rum/liste"))["result"]
    assert liste[0]["kort"] == {"k1": [SPOTS]}


async def test_gem_afviser_det_ugyldige(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    entry = await opsaet(hass)
    klient = await hass_ws_client(hass)
    data = dict(entry.subentries["gang"].data)

    svar = await kommando(
        klient, type="rumlys/rum/gem", rum_id="gang", data=data | {"lys": {"type": "hvid", "lysstyrke": 50}}
    )
    assert svar["error"]["code"] == "ugyldig"
    svar = await kommando(
        klient,
        type="rumlys/rum/gem",
        rum_id="gang",
        data=data | {"tidsrum": [{"navn": "Nat", "start": "22:00", "slut": "06:30", "dage": [], "lys": STANDARD_LYS}]},
    )
    assert svar["error"]["code"] == "ugyldig"
    svar = await kommando(klient, type="rumlys/rum/gem", rum_id="gang", data=data | {"ikon": "lightstrip"})
    assert svar["error"]["code"] == "ugyldig"
    svar = await kommando(klient, type="rumlys/rum/gem", rum_id="gang", data=data | {"omraade": "kontor"})
    assert svar["error"]["code"] == "omraade_optaget"
    svar = await kommando(klient, type="rumlys/rum/gem", rum_id="findes_ikke", data=data)
    assert svar["error"]["code"] == "rum_findes_ikke"


async def test_opret_og_slet(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    entry = await opsaet(hass)
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/rum/opret", omraade="stue")
    assert svar["success"]
    ny = svar["result"]["id"]
    await hass.async_block_till_done()
    assert entry.subentries[ny].title == "Stue"
    assert (await kommando(klient, type="rumlys/rum/opret", omraade="stue"))["error"]["code"] == "omraade_optaget"

    assert (await kommando(klient, type="rumlys/rum/slet", rum_id=ny))["success"]
    await hass.async_block_till_done()
    assert ny not in entry.subentries


async def test_omraader_og_lamper(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await opsaet(hass)
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/omraader")
    gang, kontor, stue = svar["result"]
    assert gang == {
        "id": "gang",
        "navn": "Gang",
        "rum": "gang",
        "lamper": [{"entity_id": SPOTS, "navn": "Gang Spots", "gruppe": []}],
        "sensorer": [{"entity_id": "binary_sensor.gang_pir", "navn": "binary_sensor.gang_pir"}],
        "knapper": [],
    }
    assert kontor["rum"] == "kontor"
    assert stue["rum"] is None

    svar = await kommando(klient, type="rumlys/lamper")
    assert {"entity_id": SPOTS, "navn": "Gang Spots", "omraade": "Gang", "gruppe": []} in svar["result"]


async def test_skjulte_lamper_kan_ikke_vaelges(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await opsaet(hass)
    # Et relæ, der kun giver strøm til smarte pærer, skjules i Home Assistant.
    entiteter = er.async_get(hass)
    entiteter.async_get_or_create("light", "test", "relae", suggested_object_id="kontor_relae")
    entiteter.async_update_entity("light.kontor_relae", area_id="kontor", hidden_by=er.RegistryEntryHider.USER)
    hass.states.async_set("light.kontor_relae", "on", {"friendly_name": "Kontor Relæ"})
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/omraader")
    assert svar["result"][1]["lamper"] == []
    svar = await kommando(klient, type="rumlys/lamper")
    assert "light.kontor_relae" not in [lampe["entity_id"] for lampe in svar["result"]]
