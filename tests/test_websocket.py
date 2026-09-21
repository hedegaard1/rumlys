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
        # Rummet er fra før 0.7.0 og folder til én automatik med alle lamperne.
        "automatik": [
            {
                "id": 1,
                "lamper": [SPOTS],
                "sensorer": [],
                "lys": {"type": "hvid", "lysstyrke": 100, "kelvin": 3000},
                "overgang": 0,
                "tidsrum": [],
            }
        ],
        "entiteter": {
            "hold": "switch.gang_hold_lys",
            "tilstand": "sensor.gang_tilstand",
            # Tiderne hører til automatikken nu; rummets egne findes ikke længere.
            "sluk_efter_bevaegelse": None,
            "sluk_efter_tryk": None,
            "hold_tid": None,
            "automatik": {
                "1": {
                    "hold": "switch.gang_automatik_1_hold_lys",
                    "tilstand": "sensor.gang_automatik_1_tilstand",
                    "sluk_efter_bevaegelse": "number.gang_automatik_1_sluk_efter_bevaegelse",
                    "sluk_efter_tryk": "number.gang_automatik_1_sluk_efter_tryk",
                    "hold_tid": "number.gang_automatik_1_hold_tid",
                }
            },
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


async def test_lamperne_kommer_fra_omraadet(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Ingen vaelger rummets lamper til: er en lampe i omraadet, er den rummets.

    Den lander i ingen automatik, saa den goer kun det nogen selv beder om, til den bliver lagt
    i en - men den er med paa listen og kan staa paa et kort.
    """
    await opsaet(hass)
    entiteter = er.async_get(hass)
    entiteter.async_get_or_create("light", "test", "ny", suggested_object_id="gang_ny")
    entiteter.async_update_entity("light.gang_ny", area_id="gang")
    hass.states.async_set("light.gang_ny", "off", {"friendly_name": "Gang Ny"})
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/rum/hent", rum_id="gang")
    lamper = [lampe["entity_id"] for lampe in svar["result"]["lamper"]]
    assert lamper == [SPOTS, "light.gang_ny"]
    # Den er ikke i nogen automatik - den taendes ikke af bevaegelse, foer nogen laegger den i en.
    assert svar["result"]["automatik"][0]["lamper"] == [SPOTS]
    # Og den skal staa i «data» ogsaa, ikke kun ved siden af. Sidepanelet retter i «data»:
    # automatikkens lampeliste og kontakten «Taender ved bevaegelse» tegnes derfra. Stod lampen
    # kun i «lamper», kunne den ses i rummet, men ikke laegges i en automatik - fundet paa
    # Alrums spisebordslampe 20-09-2026.
    assert [l["entity_id"] for l in svar["result"]["data"]["lamper"]] == [SPOTS, "light.gang_ny"]


async def test_gruppens_paerer_taeller_ikke_med_som_egne_lamper(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """En gruppes paerer er ikke rummets lamper - gruppen er.

    Det kan foerst afgoeres, naar gruppens tilstand findes: pærerne staar i dens `group_entities`.
    Ved indlaesningen under Home Assistants opstart er den der ikke, og saa tog rummet de seks
    spots med som seks selvstaendige lamper. Maalt paa Kontor 19-09-2026: «0 af 8 lamper taendt ·
    6 uden automatik», mens sidepanelet - som spoerger bagefter - viste to.
    """
    await opsaet(hass)
    entiteter = er.async_get(hass)
    for navn in ("gang_gruppe", "gang_paere"):
        entiteter.async_get_or_create("light", "test", navn, suggested_object_id=navn)
        entiteter.async_update_entity(f"light.{navn}", area_id="gang")
    hass.states.async_set("light.gang_paere", "off", {"friendly_name": "Gang Paere"})
    hass.states.async_set(
        "light.gang_gruppe",
        "off",
        {"friendly_name": "Gang Gruppe", "group_entities": ["light.gang_paere"]},
    )
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/rum/hent", rum_id="gang")
    lamper = [lampe["entity_id"] for lampe in svar["result"]["lamper"]]
    assert "light.gang_gruppe" in lamper
    assert "light.gang_paere" not in lamper, "gruppens paere kom med som sin egen lampe"


async def test_hent_folder_automatikken_ud(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Et rum fra før 0.7.0 har ingen automatik i det gemte, og sidepanelet retter i netop det.

    Fik det rå gemte, stod siden med «Rummet kunne ikke hentes» — den har ikke andre
    automatikker at tegne end dem, der står i «data».
    """
    await opsaet(hass)
    klient = await hass_ws_client(hass)

    for rum_id, lamper in (("gang", [SPOTS]), ("kontor", [])):
        data = (await kommando(klient, type="rumlys/rum/hent", rum_id=rum_id))["result"]["data"]
        assert [aut["lamper"] for aut in data["automatik"]] == [lamper]


async def test_hent_og_gem(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    entry = await opsaet(hass)
    klient = await hass_ws_client(hass)

    svar = await kommando(klient, type="rumlys/rum/hent", rum_id="gang")
    assert svar["result"]["data"]["lamper"] == [{"entity_id": SPOTS, "bevaegelse": True}]
    status = svar["result"]["status"]
    assert status["tilstand"] == "slukket"
    assert status["automatik"][0]["indstillinger"] == {
        "sluk_efter_bevaegelse": 30,
        "sluk_efter_tryk": 5,
        "hold_tid": 4,
    }

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
        klient,
        type="rumlys/rum/gem",
        rum_id="gang",
        data=data,
        # Tiderne gemmes pr. automatik fra 0.7.0.
        indstillinger={"1": {"sluk_efter_tryk": 10}},
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
    assert hass.states.get("number.gang_automatik_1_sluk_efter_tryk").state == "10"


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
        kort={
            "k1": {"lamper": [bord, "light.fremmed"], "scener": ["s1"]},
            "k2": {"lamper": [bord, SPOTS]},
            "k3": {"lamper": []},
            "k5": None,
            "k6": {"lamper": ["light.fremmed"], "ikon": "mdi:lamp"},
        },
    )
    assert svar["success"], svar
    await hass.async_block_till_done()
    liste = (await kommando(klient, type="rumlys/rum/liste"))["result"]
    # Lamper uden for rummet tæller ikke, og alle rummets lamper er hele rummet. Et kort, hvis lamper
    # alle er uden for rummet, viser hele rummet — to kort må gerne vise den samme lampe fra 0.6.0.
    assert liste[0]["kort"] == {
        "k1": {"lamper": [bord], "undtagen": [], "scener": ["s1"], "ikon": None},
        "k2": {"lamper": [], "undtagen": [], "scener": [], "ikon": None},
        "k3": {"lamper": [], "undtagen": [], "scener": [], "ikon": None},
        "k5": {"lamper": [], "undtagen": [], "scener": [], "ikon": None},
        "k6": {"lamper": [], "undtagen": [], "scener": [], "ikon": "mdi:lamp"},
    }

    # Nye kort fra sidepanelet: et kort, rummet kender, røres ikke.
    foer = hass.states.get("sensor.gang_tilstand").attributes["kort_opdateret"]
    svar = await kommando(
        klient, type="rumlys/kort/nye", rum_id="gang",
        kort={"k1": {"lamper": [SPOTS]}, "k4": {"lamper": [SPOTS], "scener": ["s2"]}},
    )
    assert svar["result"]["kort"]["k1"]["lamper"] == [bord]
    assert svar["result"]["kort"]["k4"] == {"lamper": [SPOTS], "undtagen": [], "scener": ["s2"], "ikon": None}
    # Tilstandssensoren viser, at kortene er ændret, så kort på andre skærme henter rummet igen.
    await hass.async_block_till_done()
    assert hass.states.get("sensor.gang_tilstand").attributes["kort_opdateret"] not in (None, foer)

    # Kortene overlever, at Rumlys genindlæses, og de alene genindlæser det ikke.
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    liste = (await kommando(klient, type="rumlys/rum/liste"))["result"]
    assert sorted(liste[0]["kort"]) == ["k1", "k2", "k3", "k4", "k5", "k6"]
    assert liste[0]["kort"]["k1"] == {"lamper": [bord], "undtagen": [], "scener": ["s1"], "ikon": None}

    # Et gem, hvor kun kortene er ændret, gemmer dem også — og et glemt kort er væk.
    data = (await kommando(klient, type="rumlys/rum/hent", rum_id="gang"))["result"]["data"]
    svar = await kommando(klient, type="rumlys/rum/gem", rum_id="gang", data=data,
                          kort={"k1": {"lamper": [SPOTS], "scener": ["s1"]}})
    assert svar["success"], svar
    await hass.async_block_till_done()
    liste = (await kommando(klient, type="rumlys/rum/liste"))["result"]
    # Rummet har to lamper, så loftspottene alene er ikke hele rummet.
    assert liste[0]["kort"] == {"k1": {"lamper": [SPOTS], "undtagen": [], "scener": ["s1"], "ikon": None}}


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
BAAND = "light.gang_baand"
GANGKNAP = "binary_sensor.gang_knap"


async def test_en_slettet_automatik_efterlader_ikke_knappen_i_det_blaa(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Peger en knap på en automatik, der slettes, overtager knappen automatikkens lamper.

    Samme regel som for et kort, der ryddes væk: en knap på væggen skal blive ved med at gøre
    det, den plejer. Og knappens egne valg følger med — det er kun målet, der fryses.
    """
    await opsaet(hass)
    entiteter = er.async_get(hass)
    entiteter.async_get_or_create("light", "test", "baand", suggested_object_id="gang_baand")
    entiteter.async_update_entity(BAAND, area_id="gang")
    hass.states.async_set(BAAND, "off", {"friendly_name": "Gang Bånd"})
    entiteter.async_get_or_create("binary_sensor", "test", "knap", suggested_object_id="gang_knap")
    entiteter.async_update_entity(GANGKNAP, area_id="gang")
    hass.states.async_set(GANGKNAP, "off")
    klient = await hass_ws_client(hass)

    aut = lambda nr, lampe: {
        "id": nr,
        "lamper": [lampe],
        "sensorer": [],
        "lys": dict(STANDARD_LYS),
        "overgang": 0,
        "tidsrum": [],
    }
    data = (await kommando(klient, type="rumlys/rum/hent", rum_id="gang"))["result"]["data"]
    med_to = data | {
        "lamper": [{"entity_id": SPOTS, "bevaegelse": True}, {"entity_id": BAAND, "bevaegelse": True}],
        "automatik": [aut(1, SPOTS), aut(2, BAAND)],
        "knapper": [GANGKNAP],
        "knap_maal": {GANGKNAP: {"automatik": 2, "hold": False}},
    }
    svar = await kommando(klient, type="rumlys/rum/gem", rum_id="gang", data=med_to)
    assert svar["success"], svar
    await hass.async_block_till_done()

    data = (await kommando(klient, type="rumlys/rum/hent", rum_id="gang"))["result"]["data"]
    assert data["knap_maal"][GANGKNAP]["automatik"] == 2

    # Automatik 2 slettes — knappen står tilbage uden noget at pege på.
    svar = await kommando(
        klient, type="rumlys/rum/gem", rum_id="gang", data=data | {"automatik": [data["automatik"][0]]}
    )
    assert svar["success"], svar
    await hass.async_block_till_done()

    maal = (await kommando(klient, type="rumlys/rum/hent", rum_id="gang"))["result"]["data"]["knap_maal"]
    assert maal[GANGKNAP]["lamper"] == [BAAND]
    assert "automatik" not in maal[GANGKNAP]
    # Og knappens eget valg er ikke gået tabt undervejs.
    assert maal[GANGKNAP]["hold"] is False
