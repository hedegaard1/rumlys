"""Rumlys' adfærd i ét rum — tabellen «Adfærd» i projektnoten, situation for situation."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from freezegun.api import FrozenDateTimeFactory
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
    async_mock_service,
)

from homeassistant.config_entries import ConfigSubentryData
from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util

from custom_components.rumlys import scener
from custom_components.rumlys.const import DOMAIN, RUM

SPOTS = "light.traeningsrum_spots"
STENLAMPE = "light.traeningsrum_stenlampe"
SENSOR = "binary_sensor.bevaegelse_traeningsrum"
HOLD = "switch.traeningsrum_hold_lys"
TILSTAND = "sensor.traeningsrum_tilstand"
SLUK_BEVAEGELSE = "number.traeningsrum_sluk_efter_bevaegelse"
SLUK_TRYK = "number.traeningsrum_sluk_efter_tryk"
HOLD_TID = "number.traeningsrum_hold_tid"

RUMMET = {
    "omraade": None,
    "lamper": [{"entity_id": SPOTS, "bevaegelse": True}],
    "sensorer": [SENSOR],
    "lys": {"type": "hvid", "lysstyrke": 100, "kelvin": 3500},
    "overgang": 3,
    "tidsrum": [],
    "scener": [],
}
NAT = {
    "navn": "Nat",
    "start": "22:00:00",
    "slut": "06:30:00",
    "lys": {"type": "hvid", "lysstyrke": 10, "kelvin": 2700},
    "sluk_efter": 60,
}
ARBEJDE = {
    "navn": "Arbejde",
    "start": "08:00:00",
    "slut": "16:00:00",
    "dage": [0, 1, 2, 3, 4],
    "lys": {"type": "hvid", "lysstyrke": 80, "kelvin": 4000},
}
WEEKEND = {
    "navn": "Weekend",
    "start": "00:00:00",
    "slut": "00:00:00",
    "dage": [5, 6],
    "lys": {"type": "hvid", "lysstyrke": 60, "kelvin": 2700},
}


class Hus:
    """Lampen og sensoren i Træningsrum, som testene styrer."""

    def __init__(self, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
        self.hass = hass
        self.freezer = freezer
        self.taend = async_mock_service(hass, "light", "turn_on")
        self.sluk = async_mock_service(hass, "light", "turn_off")

    async def saet_op(
        self, rummet: dict[str, Any] = RUMMET, gemt: dict[str, Any] | None = None
    ) -> MockConfigEntry:
        entry = MockConfigEntry(
            domain=DOMAIN,
            title="Rumlys",
            minor_version=2,
            subentries_data=[
                ConfigSubentryData(
                    data=rummet,
                    subentry_id="traeningsrum",
                    subentry_type=RUM,
                    title="Træningsrum",
                    unique_id=None,
                )
            ],
        )
        if gemt is not None:
            noegle = f"{DOMAIN}.{entry.entry_id}"
            self.hass_storage[noegle] = {
                "version": 1,
                "minor_version": 1,
                "key": noegle,
                "data": {"traeningsrum": gemt},
            }
        entry.add_to_hass(self.hass)
        assert await self.hass.config_entries.async_setup(entry.entry_id)
        # En tid, der allerede er løbet ud, afvikles i en senere runde af event-loopet end
        # async_block_till_done venter på. Skru tiden frem, så den altid er kørt.
        await self.vent(0)
        return entry

    async def vent(self, sekunder: float) -> None:
        self.freezer.tick(timedelta(seconds=sekunder))
        async_fire_time_changed(self.hass)
        await self.hass.async_block_till_done()

    async def lys(
        self, tilstand: str, kontekst: Context | None = None, **attributter: Any
    ) -> None:
        self.hass.states.async_set(SPOTS, tilstand, attributter, context=kontekst)
        await self.hass.async_block_till_done()

    async def lampen_svarer(self) -> None:
        """Lampen melder tilbage på Rumlys' seneste tænd-kommando, med samme context."""
        kald = self.taend[-1]
        await self.lys(
            "on",
            kald.context,
            brightness=round(kald.data.get("brightness_pct", 100) * 2.55),
            color_mode="color_temp",
            color_temp_kelvin=kald.data.get("color_temp_kelvin", 3500),
        )

    async def bevaegelse(self, tilstand: str) -> None:
        self.hass.states.async_set(SENSOR, tilstand)
        await self.hass.async_block_till_done()

    async def tjeneste(self, domaene: str, tjeneste: str, **data: Any) -> None:
        await self.hass.services.async_call(domaene, tjeneste, data, blocking=True)
        await self.hass.async_block_till_done()

    def tilstand(self) -> str:
        return self.hass.states.get(TILSTAND).state

    def slukker(self) -> str | None:
        return self.hass.states.get(TILSTAND).attributes["slukker"]


@pytest.fixture
async def hus(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> Hus:
    freezer.move_to("2026-09-14 12:00:00+00:00")
    hass.states.async_set(SPOTS, "off")
    hass.states.async_set(SENSOR, "off")
    hus = Hus(hass, freezer)
    hus.hass_storage = hass_storage
    return hus


def lokal(tekst: str) -> datetime:
    return datetime.fromisoformat(tekst).replace(tzinfo=dt_util.get_default_time_zone())


async def test_rummet_bliver_en_enhed_med_fem_entiteter(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op()
    assert hass.states.get(HOLD).state == "off"
    assert hus.tilstand() == "slukket"
    assert hass.states.get(SLUK_BEVAEGELSE).state == "30"
    assert hass.states.get(SLUK_TRYK).state == "5"
    assert hass.states.get(HOLD_TID).state == "4"


async def test_bevaegelse_taender_og_slukker_efter_tiden(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    assert [k.data for k in hus.taend] == [
        {
            "entity_id": [SPOTS],
            "brightness_pct": 100,
            "color_temp_kelvin": 3500,
            "transition": 3,
        }
    ]
    await hus.lampen_svarer()
    assert hus.tilstand() == "bevaegelse"
    assert hus.slukker() is None

    await hus.bevaegelse("off")
    await hus.vent(29)
    assert not hus.sluk
    await hus.vent(2)
    assert [k.data for k in hus.sluk] == [{"entity_id": [SPOTS], "transition": 3}]
    assert hus.tilstand() == "slukket"
    await hus.lys("off", hus.sluk[-1].context)
    assert hus.tilstand() == "slukket"
    assert len(hus.taend) == 1


async def test_sensoren_taender_kun_sine_egne_lamper(hus: Hus) -> None:
    """Hver sensor kan have sine egne af rummets lamper. Rummet slukker stadig samlet."""
    sensor2 = "binary_sensor.bevaegelse_traeningsrum_2"
    rummet = RUMMET | {
        "lamper": [
            {"entity_id": SPOTS, "bevaegelse": True},
            {"entity_id": STENLAMPE, "bevaegelse": True},
        ],
        "sensorer": [SENSOR, sensor2],
        "sensor_lamper": {SENSOR: [SPOTS], sensor2: [STENLAMPE]},
    }
    await hus.saet_op(rummet)
    hus.hass.states.async_set(sensor2, "off")
    await hus.hass.async_block_till_done()

    await hus.bevaegelse("on")
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]

    # Den anden sensor ser nogen, mens lyset er tændt: dens egen lampe tændes med.
    hus.hass.states.async_set(sensor2, "on")
    await hus.hass.async_block_till_done()
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS], [STENLAMPE]]

    # Ingen ser nogen: hele rummet slukker efter tiden.
    await hus.bevaegelse("off")
    hus.hass.states.async_set(sensor2, "off")
    await hus.hass.async_block_till_done()
    await hus.vent(31)
    assert hus.sluk[-1].data["entity_id"] == [SPOTS, STENLAMPE]


async def test_sensor_uden_egne_lamper_taender_dem_alle(hus: Hus) -> None:
    """Uden valg tænder sensoren alle rummets lamper, der tænder ved bevægelse — som hidtil."""
    rummet = RUMMET | {
        "lamper": [
            {"entity_id": SPOTS, "bevaegelse": True},
            {"entity_id": STENLAMPE, "bevaegelse": True},
        ]
    }
    await hus.saet_op(rummet)
    await hus.bevaegelse("on")
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS, STENLAMPE]]


async def test_ny_bevaegelse_stopper_nedtaellingen(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    await hus.vent(20)
    await hus.bevaegelse("on")
    assert hus.slukker() is None
    await hus.vent(60)
    assert not hus.sluk
    assert len(hus.taend) == 1

    await hus.bevaegelse("off")
    await hus.vent(31)
    assert len(hus.sluk) == 1


async def test_sluk_efter_bevaegelse_kan_saettes(hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste("number", "set_value", entity_id=SLUK_BEVAEGELSE, value=120)
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    await hus.vent(119)
    assert not hus.sluk
    await hus.vent(2)
    assert len(hus.sluk) == 1


async def test_taendt_i_haanden_slukker_efter_tryk(hus: Hus) -> None:
    await hus.saet_op()
    await hus.lys("on", Context(), brightness=128)  # fra appen eller en væg
    assert hus.tilstand() == "haand"
    await hus.vent(299)
    assert not hus.sluk
    await hus.vent(2)
    assert len(hus.sluk) == 1
    assert hus.tilstand() == "slukket"


async def test_sluk_efter_tryk_0_slukker_aldrig(hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste("number", "set_value", entity_id=SLUK_TRYK, value=0)
    await hus.lys("on", Context(), brightness=128)
    assert hus.tilstand() == "haand"
    assert hus.slukker() is None
    await hus.vent(3 * 3600)
    assert not hus.sluk


async def test_bevaegelse_beholder_scenen_og_forlaenger_tiden(hus: Hus) -> None:
    await hus.saet_op()
    await hus.lys("on", Context(user_id="martin"), brightness=40, hs_color=(30, 80))
    await hus.bevaegelse("on")
    assert not hus.taend
    assert hus.slukker() is None
    await hus.bevaegelse("off")
    assert hus.tilstand() == "haand"
    await hus.vent(299)
    assert not hus.sluk
    await hus.vent(2)
    assert len(hus.sluk) == 1


async def test_scene_valgt_mens_bevaegelse_har_taendt(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.vent(30)
    await hus.lys("on", Context(), brightness=90, color_mode="hs", hs_color=(240, 60))
    assert hus.tilstand() == "haand"
    await hus.bevaegelse("off")
    await hus.vent(31)
    assert not hus.sluk  # «sluk efter tryk», ikke «sluk efter bevægelse»
    await hus.vent(270)
    assert len(hus.sluk) == 1


async def test_lampens_ekko_er_ikke_en_aendring_i_haanden(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.vent(3)
    # En Zigbee2MQTT-gruppe melder igen, lidt senere og uden context.
    await hus.lys("on", Context(), brightness=254, color_mode="color_temp", color_temp_kelvin=3508)
    assert hus.tilstand() == "bevaegelse"

    await hus.vent(15)
    await hus.lys("on", Context(), brightness=100, color_mode="color_temp", color_temp_kelvin=3508)
    assert hus.tilstand() == "haand"


async def test_en_bruger_lige_efter_rumlys_er_i_haanden(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.lys("on", Context(user_id="martin"), brightness=60)
    assert hus.tilstand() == "haand"


async def test_attribut_paa_slukket_lampe_nulstiller_ikke_rummet(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    # Før lampen svarer, melder den en attribut, mens den stadig er slukket.
    await hus.lys("off", Context(), color_mode=None)
    assert hus.tilstand() == "bevaegelse"
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    await hus.vent(31)
    assert len(hus.sluk) == 1


async def test_lyset_slukket_i_haanden_stopper_alt(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    await hus.lys("off", Context(user_id="martin"))
    assert hus.tilstand() == "slukket"
    assert hus.slukker() is None
    await hus.vent(60)
    assert not hus.sluk


async def test_bevaegelse_der_fortsaetter_efter_sluk_taender_ikke_igen(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.lys("off", Context(user_id="martin"))
    await hus.vent(60)
    assert len(hus.taend) == 1  # først når sensoren melder bevægelse på ny
    await hus.bevaegelse("off")
    await hus.bevaegelse("on")
    assert len(hus.taend) == 2


async def test_hold_lys(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    # Uden lysstyrke og farve: lyset kommer tilbage, som det var.
    assert [k.data for k in hus.taend] == [{"entity_id": [SPOTS], "transition": 3}]
    await hus.lampen_svarer()
    assert hass.states.get(HOLD).state == "on"
    assert hass.states.get(HOLD).attributes["slutter"] == "2026-09-14T16:00:00+00:00"
    assert hus.tilstand() == "hold"

    await hus.bevaegelse("on")
    await hus.bevaegelse("off")
    assert len(hus.taend) == 1
    assert hus.slukker() is None
    await hus.vent(4 * 3600 - 10)
    assert not hus.sluk
    assert hass.states.get(HOLD).state == "on"

    # Hold-tiden løber ud: tilbage til sensoren, og uden bevægelse slukker lyset.
    await hus.vent(10)
    assert hass.states.get(HOLD).state == "off"
    assert hus.tilstand() == "haand"
    await hus.vent(29)
    assert not hus.sluk
    await hus.vent(2)
    assert len(hus.sluk) == 1


async def test_hold_slaaet_fra_i_haanden(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    assert len(hus.taend) == 1  # lyset var tændt
    await hus.tjeneste("switch", "turn_off", entity_id=HOLD)
    assert hus.tilstand() == "bevaegelse"
    assert hus.slukker() is None  # der er stadig bevægelse
    await hus.bevaegelse("off")
    await hus.vent(31)
    assert len(hus.sluk) == 1


async def test_lyset_slukket_under_hold_slaar_hold_fra(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    await hus.lampen_svarer()
    await hus.vent(60)
    await hus.lys("off", Context())
    assert hass.states.get(HOLD).state == "off"
    assert hus.tilstand() == "slukket"
    await hus.vent(5 * 3600)
    assert not hus.sluk


async def test_hold_tiden_kan_saettes(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste("number", "set_value", entity_id=HOLD_TID, value=1.5)
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    assert hass.states.get(HOLD).attributes["slutter"] == "2026-09-14T13:30:00+00:00"


async def test_tidsrummets_lys_ved_bevaegelse(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-14 23:00:00"))
    await hus.saet_op(RUMMET | {"tidsrum": [NAT]})
    await hus.bevaegelse("on")
    assert hus.taend[-1].data["brightness_pct"] == 10
    assert hus.taend[-1].data["color_temp_kelvin"] == 2700
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    await hus.vent(59)
    assert not hus.sluk  # tidsrummets egen sluk-tid
    await hus.vent(2)
    assert len(hus.sluk) == 1


async def test_tidsrummet_skifter_mens_bevaegelse_har_taendt(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-14 21:59:50"))
    await hus.saet_op(RUMMET | {"tidsrum": [NAT]})
    await hus.bevaegelse("on")
    assert hus.taend[-1].data["brightness_pct"] == 100
    await hus.lampen_svarer()
    await hus.vent(10)
    assert len(hus.taend) == 2
    assert hus.taend[-1].data["brightness_pct"] == 10
    assert hus.taend[-1].data["color_temp_kelvin"] == 2700
    await hus.lampen_svarer()
    assert hus.tilstand() == "bevaegelse"

    hus.freezer.move_to(lokal("2026-09-15 06:29:59"))
    await hus.vent(1)
    assert len(hus.taend) == 3
    assert hus.taend[-1].data["brightness_pct"] == 100


async def test_tidsrummet_skifter_ikke_lys_valgt_i_haanden(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-14 21:59:50"))
    await hus.saet_op(RUMMET | {"tidsrum": [NAT]})
    await hus.bevaegelse("on")
    await hus.lys("on", Context(user_id="martin"), brightness=200, hs_color=(0, 100))
    await hus.vent(10)
    assert len(hus.taend) == 1


async def test_tidsrummet_gaelder_kun_paa_sine_dage(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-19 10:00:00"))  # lørdag
    entry = await hus.saet_op(RUMMET | {"tidsrum": [ARBEJDE]})
    await hus.bevaegelse("on")
    assert hus.taend[-1].data["color_temp_kelvin"] == 3500  # lyset for hele døgnet
    rum = entry.runtime_data.rum["traeningsrum"]
    assert rum.tidsrum_ved(lokal("2026-09-16 10:00:00"))["navn"] == "Arbejde"  # onsdag


async def test_over_midnat_hoerer_til_dagen_det_begynder(hus: Hus) -> None:
    entry = await hus.saet_op(RUMMET | {"tidsrum": [NAT | {"dage": [4]}]})  # fredag
    rum = entry.runtime_data.rum["traeningsrum"]
    assert rum.tidsrum_ved(lokal("2026-09-18 23:00:00"))["navn"] == "Nat"  # fredag aften
    assert rum.tidsrum_ved(lokal("2026-09-19 03:00:00"))["navn"] == "Nat"  # natten til lørdag
    assert rum.tidsrum_ved(lokal("2026-09-17 23:00:00")) is None  # torsdag aften
    assert rum.tidsrum_ved(lokal("2026-09-18 03:00:00")) is None  # natten til fredag


async def test_samme_klokkeslaet_er_et_helt_doegn(hus: Hus) -> None:
    entry = await hus.saet_op(RUMMET | {"tidsrum": [WEEKEND]})
    rum = entry.runtime_data.rum["traeningsrum"]
    assert rum.tidsrum_ved(lokal("2026-09-19 00:00:00"))["navn"] == "Weekend"
    assert rum.tidsrum_ved(lokal("2026-09-20 23:59:59"))["navn"] == "Weekend"
    assert rum.tidsrum_ved(lokal("2026-09-18 23:59:59")) is None
    assert rum.tidsrum_ved(lokal("2026-09-21 00:00:00")) is None


async def test_skift_paa_en_dag_uden_tidsrummet_roerer_ikke_lyset(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-19 07:59:50"))  # lørdag
    entry = await hus.saet_op(RUMMET | {"tidsrum": [ARBEJDE]})
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.vent(10)
    assert len(hus.taend) == 1
    rum = entry.runtime_data.rum["traeningsrum"]
    assert [h["hvad"] for h in rum.haendelser] == ["taendt"]


async def test_valgt_lys_huskes_over_midnat_i_samme_tidsrum(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-19 20:00:00"))  # lørdag
    entry = await hus.saet_op(RUMMET | {"tidsrum": [WEEKEND]})
    await hus.lys("on", Context(user_id="martin"), brightness=200, color_mode="hs", hs_color=(0, 100))
    await hus.vent(4)
    rum = entry.runtime_data.rum["traeningsrum"]
    # Søndag er stadig weekend; først mandag tager hele døgnets lys over.
    assert dt_util.parse_datetime(rum.husket["til"]) == lokal("2026-09-21 00:00:00")
    await hus.lys("off", Context(user_id="martin"))

    hus.freezer.move_to(lokal("2026-09-20 10:00:00"))
    await hus.vent(0)
    await hus.bevaegelse("on")
    assert hus.taend[-1].data["hs_color"] == [0, 100]


async def test_kun_lysstyrke_roerer_ikke_farven(hus: Hus) -> None:
    rummet = RUMMET | {"lys": {"type": "lysstyrke", "lysstyrke": 100}, "overgang": 0}
    await hus.saet_op(rummet)
    await hus.bevaegelse("on")
    assert [k.data for k in hus.taend] == [{"entity_id": [SPOTS], "brightness_pct": 100}]


async def test_rum_uden_sensor(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op(RUMMET | {"sensorer": []})
    await hus.lys("on", Context(), brightness=128)
    await hus.vent(301)
    assert len(hus.sluk) == 1

    await hus.lys("off", hus.sluk[-1].context)
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    await hus.lampen_svarer()
    await hus.vent(4 * 3600)
    assert hass.states.get(HOLD).state == "off"
    await hus.vent(299)  # uden sensor gælder «sluk efter tryk»
    assert len(hus.sluk) == 1
    await hus.vent(2)
    assert len(hus.sluk) == 2


async def test_genstart_afvikler_en_tid_der_er_loebet_ud(hus: Hus) -> None:
    await hus.lys("on", brightness=255)
    await hus.saet_op(
        gemt={
            "indstillinger": {"sluk_efter_bevaegelse": 120},
            "kilde": "bevaegelse",
            "slukker": "2026-09-14T11:58:00+00:00",
            "hold_slutter": None,
        }
    )
    assert len(hus.sluk) == 1
    assert hus.tilstand() == "slukket"


async def test_genstart_husker_nedtaellingen_og_tiderne(hass: HomeAssistant, hus: Hus) -> None:
    await hus.lys("on", brightness=255)
    await hus.saet_op(
        gemt={
            "indstillinger": {"sluk_efter_bevaegelse": 120},
            "kilde": "bevaegelse",
            "slukker": "2026-09-14T12:00:20+00:00",
            "hold_slutter": None,
        }
    )
    assert hass.states.get(SLUK_BEVAEGELSE).state == "120"
    assert hus.tilstand() == "bevaegelse"
    assert not hus.sluk
    await hus.vent(21)
    assert len(hus.sluk) == 1


async def test_genstart_med_hold(hass: HomeAssistant, hus: Hus) -> None:
    await hus.lys("on", brightness=255)
    await hus.saet_op(
        gemt={
            "indstillinger": {},
            "kilde": "haand",
            "slukker": None,
            "hold_slutter": "2026-09-14T13:00:00+00:00",
        }
    )
    assert hass.states.get(HOLD).state == "on"
    await hus.vent(3600)
    assert hass.states.get(HOLD).state == "off"


async def test_lampe_der_dukker_op_efter_start(hus: Hus) -> None:
    hus.hass.states.async_set(SPOTS, "unavailable")
    await hus.saet_op(
        gemt={
            "indstillinger": {},
            "kilde": "bevaegelse",
            "slukker": "2026-09-14T11:59:00+00:00",
            "hold_slutter": None,
        }
    )
    assert not hus.sluk
    await hus.lys("on", brightness=255)
    await hus.vent(0)
    assert len(hus.sluk) == 1


async def test_bevaegelse_ved_genstart_stopper_den_gemte_nedtaelling(hus: Hus) -> None:
    # Kontor 16-09: sensoren mistede Martin, genstarten kom midt i nedtællingen, og da
    # HA var oppe igen, så sensoren ham — men lyset slukkede alligevel til den gemte tid.
    await hus.bevaegelse("on")
    hus.hass.states.async_set(SPOTS, "unavailable")
    await hus.saet_op(
        gemt={
            "indstillinger": {},
            "kilde": "haand",
            "slukker": "2026-09-14T12:01:00+00:00",
            "hold_slutter": None,
        }
    )
    await hus.lys("on", brightness=255)
    assert hus.slukker() is None
    await hus.vent(3600)
    assert not hus.sluk
    await hus.bevaegelse("off")
    await hus.vent(301)  # uden bevægelse slukker lyset som ellers efter «sluk efter tryk»
    assert len(hus.sluk) == 1


async def test_lys_der_er_taendt_ved_start_slukker_efter_tryk(hus: Hus) -> None:
    await hus.lys("on", brightness=255)
    await hus.saet_op()
    assert hus.tilstand() == "haand"
    await hus.vent(301)
    assert len(hus.sluk) == 1


async def test_tilstand_gemmes_ved_genindlaesning(hass: HomeAssistant, hus: Hus) -> None:
    entry = await hus.saet_op()
    await hus.tjeneste("number", "set_value", entity_id=SLUK_TRYK, value=15)
    assert hass.states.get(SLUK_TRYK).state == "15"
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get(SLUK_TRYK).state == "15"
    assert hus.tilstand() == "bevaegelse"
    await hus.vent(31)
    assert len(hus.sluk) == 1


async def test_farve_som_rummets_lys(hus: Hus) -> None:
    await hus.saet_op(RUMMET | {"lys": {"type": "farve", "lysstyrke": 60, "farve": [300, 90]}})
    await hus.bevaegelse("on")
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness_pct": 60,
        "hs_color": [300, 90],
        "transition": 3,
    }


async def test_valgt_lys_taender_igen_ved_naeste_bevaegelse(hus: Hus) -> None:
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.lys("on", Context(user_id="martin"), brightness=60, color_mode="hs", hs_color=(300, 90))
    assert hus.tilstand() == "haand"
    await hus.vent(4)  # rummet husker lyset, når lamperne har meldt det hele
    await hus.bevaegelse("off")
    await hus.vent(301)
    assert len(hus.sluk) == 1
    await hus.lys("off", hus.sluk[-1].context)

    await hus.bevaegelse("on")
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness": 60,
        "hs_color": [300, 90],
        "transition": 3,
    }
    assert hus.tilstand() == "bevaegelse"


async def test_valgt_lys_huskes_ogsaa_naar_det_slukkes_i_haanden(hus: Hus) -> None:
    await hus.saet_op()
    await hus.lys("on", Context(user_id="martin"), brightness=40, color_mode="color_temp", color_temp_kelvin=2200)
    await hus.vent(4)
    await hus.lys("off", Context(user_id="martin"))
    assert hus.tilstand() == "slukket"
    await hus.bevaegelse("on")
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness": 40,
        "color_temp_kelvin": 2200,
        "transition": 3,
    }


async def test_nyt_tidsrum_glemmer_det_valgte_lys(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-14 21:00:00"))
    await hus.saet_op(RUMMET | {"tidsrum": [NAT]})
    await hus.lys("on", Context(user_id="martin"), brightness=200, color_mode="hs", hs_color=(0, 100))
    await hus.vent(4)
    await hus.lys("off", Context(user_id="martin"))

    # Stadig samme tidsrum: det valgte lys.
    hus.freezer.move_to(lokal("2026-09-14 21:30:00"))
    await hus.vent(0)
    await hus.bevaegelse("on")
    assert hus.taend[-1].data["hs_color"] == [0, 100]
    await hus.lys("off", Context(user_id="martin"))
    await hus.bevaegelse("off")

    # Natten er begyndt: nattens eget lys.
    hus.freezer.move_to(lokal("2026-09-14 22:30:00"))
    await hus.vent(0)
    await hus.bevaegelse("on")
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness_pct": 10,
        "color_temp_kelvin": 2700,
        "transition": 3,
    }


async def test_husket_lys_overlever_genstart(hus: Hus) -> None:
    await hus.saet_op(
        gemt={
            "indstillinger": {},
            "kilde": None,
            "slukker": None,
            "hold_slutter": None,
            "husket": {"lamper": {SPOTS: {"state": "on", "brightness": 40, "color_temp_kelvin": 2200}}, "til": None},
        }
    )
    await hus.bevaegelse("on")
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness": 40,
        "color_temp_kelvin": 2200,
        "transition": 3,
    }


async def test_hold_lys_taender_med_det_valgte_lys(hus: Hus) -> None:
    await hus.saet_op()
    await hus.lys("on", Context(user_id="martin"), brightness=90, color_mode="xy", xy_color=(0.4, 0.3))
    await hus.vent(4)
    await hus.lys("off", Context(user_id="martin"))
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness": 90,
        "xy_color": [0.4, 0.3],
        "transition": 3,
    }


async def test_lampe_der_ikke_taender_ved_bevaegelse(hass: HomeAssistant, hus: Hus) -> None:
    hass.states.async_set(STENLAMPE, "off")
    await hus.saet_op(
        RUMMET
        | {
            "lamper": [
                {"entity_id": SPOTS, "bevaegelse": True},
                {"entity_id": STENLAMPE, "bevaegelse": False},
            ]
        }
    )
    await hus.bevaegelse("on")
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]
    await hus.lampen_svarer()
    await hus.bevaegelse("off")
    await hus.vent(31)
    # Den hører stadig til rummet og slukker med det.
    assert [k.data for k in hus.sluk] == [{"entity_id": [SPOTS, STENLAMPE], "transition": 3}]


async def test_haendelser_til_sidepanelet(hus: Hus) -> None:
    hus.freezer.move_to(lokal("2026-09-14 21:59:00"))
    entry = await hus.saet_op(RUMMET | {"tidsrum": [NAT]})
    await hus.bevaegelse("on")
    await hus.lampen_svarer()
    await hus.vent(60)
    await hus.lys("on", Context(user_id="martin"), brightness=10)
    await hus.bevaegelse("off")
    await hus.tjeneste("switch", "turn_on", entity_id=HOLD)
    await hus.tjeneste("switch", "turn_off", entity_id=HOLD)
    await hus.lys("off", Context(user_id="martin"))

    rum = entry.runtime_data.rum["traeningsrum"]
    assert [{k: v for k, v in h.items() if k != "tid"} for h in rum.haendelser] == [
        {"hvad": "taendt", "lys": "rummet"},
        {"hvad": "tidsrum", "navn": "Nat"},
        {"hvad": "valgt"},
        {"hvad": "hold_til"},
        {"hvad": "hold_fra"},
        {"hvad": "slukket_i_haanden"},
    ]


async def test_daemp_hele_rummet_i_samme_forhold(hass: HomeAssistant, hus: Hus) -> None:
    to_lamper = [{"entity_id": SPOTS, "bevaegelse": True}, {"entity_id": STENLAMPE, "bevaegelse": False}]
    hass.states.async_set(STENLAMPE, "on", {"brightness": 128})
    await hus.lys("on", brightness=255)
    await hus.saet_op(RUMMET | {"lamper": to_lamper})
    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=50)
    assert sorted((k.data["entity_id"][0], k.data["brightness"]) for k in hus.taend) == [
        (SPOTS, 128),
        (STENLAMPE, 64),
    ]
    assert hus.tilstand() == "haand"


async def test_daemp_slukket_rum_taender_med_lampernes_egen_farve(hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=40)
    assert hus.taend[-1].data == {"entity_id": [SPOTS], "brightness_pct": 40, "transition": 3}


async def test_daemp_til_0_slukker(hus: Hus) -> None:
    await hus.lys("on", brightness=255)
    await hus.saet_op()
    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=0)
    assert hus.sluk[-1].data == {"entity_id": [SPOTS], "transition": 3}
    assert hus.tilstand() == "slukket"


async def test_vaelg_lys_til_rummet(hus: Hus) -> None:
    await hus.saet_op()
    await hus.tjeneste(
        DOMAIN, "anvend_lys", rum="traeningsrum", lys={"type": "farve", "lysstyrke": 70, "farve": [200, 80]}
    )
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness_pct": 70,
        "hs_color": [200, 80],
        "transition": 3,
    }
    assert hus.tilstand() == "haand"


async def test_scene_som_tidsrummets_lys(hass: HomeAssistant, hus: Hus) -> None:
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["color_temp", "xy"]})
    hus.freezer.move_to(lokal("2026-09-14 23:00:00"))
    hvile = {"type": "scene", "scene": "e03267e7-9914-4f47-97fe-63c0bd317fe7"}
    await hus.saet_op(RUMMET | {"tidsrum": [NAT | {"lys": hvile}]})
    await hus.bevaegelse("on")
    assert hus.taend[-1].data == {
        "entity_id": [SPOTS],
        "brightness": 90,
        "xy_color": [0.561, 0.4042],
        "transition": 3,
    }


async def test_vaelg_scene_til_rummet(hass: HomeAssistant, hus: Hus) -> None:
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["color_temp"]})
    await hus.saet_op()
    await hus.tjeneste(DOMAIN, "anvend_scene", rum="traeningsrum", scene="e03267e7-9914-4f47-97fe-63c0bd317fe7", lysstyrke=40)
    data = hus.taend[-1].data
    assert data["brightness"] == 102
    assert data["color_temp_kelvin"] == scener.naermeste_kelvin(0.561, 0.4042) == 2400
    assert hus.tilstand() == "haand"


async def test_tjeneste_til_et_rum_der_ikke_findes(hus: Hus) -> None:
    await hus.saet_op()
    with pytest.raises(ServiceValidationError):
        await hus.tjeneste(DOMAIN, "daemp", rum="stue", lysstyrke=50)


TO_LAMPER = [{"entity_id": SPOTS, "bevaegelse": True}, {"entity_id": STENLAMPE, "bevaegelse": False}]


async def test_daemp_kun_kortets_lamper(hass: HomeAssistant, hus: Hus) -> None:
    # Et kort for stenlampen alene dæmper kun den.
    hass.states.async_set(STENLAMPE, "on", {"brightness": 128})
    await hus.lys("on", brightness=255)
    await hus.saet_op(RUMMET | {"lamper": TO_LAMPER})
    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=50, lamper=[STENLAMPE])
    assert [(k.data["entity_id"], k.data["brightness"]) for k in hus.taend] == [([STENLAMPE], 128)]
    assert hus.tilstand() == "haand"


async def test_slukket_kortlampe_taender_kun_sig_selv(hass: HomeAssistant, hus: Hus) -> None:
    await hus.saet_op(RUMMET | {"lamper": TO_LAMPER})
    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=40, lamper=[STENLAMPE])
    assert [(k.data["entity_id"], k.data["brightness_pct"]) for k in hus.taend] == [([STENLAMPE], 40)]


async def test_sluk_kortets_lamper_mens_rummet_lyser(hass: HomeAssistant, hus: Hus) -> None:
    hass.states.async_set(STENLAMPE, "on", {"brightness": 128})
    await hus.lys("on", brightness=255)
    await hus.saet_op(RUMMET | {"lamper": TO_LAMPER})
    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=0, lamper=[STENLAMPE])
    assert [k.data["entity_id"] for k in hus.sluk] == [[STENLAMPE]]
    assert hus.tilstand() == "haand"  # spottene lyser stadig, så rummet nulstilles ikke


async def test_lys_og_scene_kun_til_kortets_lamper(hass: HomeAssistant, hus: Hus) -> None:
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["color_temp"]})
    hass.states.async_set(STENLAMPE, "off", {"supported_color_modes": ["color_temp"]})
    await hus.saet_op(RUMMET | {"lamper": TO_LAMPER})
    await hus.tjeneste(DOMAIN, "anvend_lys", rum="traeningsrum", lys={"type": "hvid", "lysstyrke": 60, "kelvin": 2700}, lamper=[STENLAMPE])
    await hus.tjeneste(DOMAIN, "anvend_scene", rum="traeningsrum", scene="e03267e7-9914-4f47-97fe-63c0bd317fe7", lamper=[STENLAMPE])
    assert {lampe for k in hus.taend for lampe in k.data["entity_id"]} == {STENLAMPE}


async def test_lamper_uden_for_rummet_afvises(hus: Hus) -> None:
    await hus.saet_op()
    with pytest.raises(ServiceValidationError):
        await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=50, lamper=["light.stue_loftspots"])


async def test_haendelserne_overlever_genindlaesning(hass: HomeAssistant, hus: Hus) -> None:
    entry = await hus.saet_op()
    await hus.bevaegelse("on")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    rum = entry.runtime_data.rum["traeningsrum"]
    assert [h["hvad"] for h in rum.haendelser] == ["taendt"]
