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
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from custom_components.rumlys import scener
from custom_components.rumlys.const import DOMAIN, RUM

SPOTS = "light.traeningsrum_spots"
STENLAMPE = "light.traeningsrum_stenlampe"
SENSOR = "binary_sensor.bevaegelse_traeningsrum"
KNAP = "binary_sensor.knap_traeningsrum"
HOLD = "switch.traeningsrum_hold_lys"
TILSTAND = "sensor.traeningsrum_tilstand"
# Tiderne hører til automatikken fra 0.7.0, og nummeret står i id'et.
SLUK_BEVAEGELSE = "number.traeningsrum_automatik_1_sluk_efter_bevaegelse"
SLUK_TRYK = "number.traeningsrum_automatik_1_sluk_efter_tryk"
HOLD_TID = "number.traeningsrum_automatik_1_hold_tid"

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

    async def knap(self, tilstand: str, knap: str = KNAP) -> None:
        """Vægknappen melder «on», mens den er nede."""
        self.hass.states.async_set(knap, tilstand)
        await self.hass.async_block_till_done()

    async def tryk(self, knap: str = KNAP) -> None:
        """Et kort tryk: ned og op igen, hurtigere end hold-grænsen.

        Uret skrues ikke frem undervejs. `async_fire_time_changed` lægger selv et halvt sekund
        til, så enhver vent() ville fyre både hold-grænsen på 0,8 og dobbeltklik-vinduet på 0,3."""
        await self.knap("on", knap)
        await self.knap("off", knap)

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
    hass.states.async_set(KNAP, "off")
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


async def test_hver_automatik_taendes_af_sine_egne_sensorer(hus: Hus) -> None:
    """To automatikker i samme rum: hver sensor tænder sine egne lamper, og de tæller hver for sig.

    Det, `sensor_lamper` gjorde indtil 0.6.x, er nu en automatik pr. gruppe — og nu har hver
    gruppe også sin egen nedtælling, hvilket den ikke havde før.
    """
    sensor2 = "binary_sensor.bevaegelse_traeningsrum_2"
    rummet = RUMMET | {
        "lamper": [
            {"entity_id": SPOTS, "bevaegelse": True},
            {"entity_id": STENLAMPE, "bevaegelse": True},
        ],
        "sensorer": [SENSOR, sensor2],
        "automatik": [
            {"id": 1, "lamper": [SPOTS], "sensorer": [SENSOR], "lys": RUMMET["lys"]},
            {"id": 2, "lamper": [STENLAMPE], "sensorer": [sensor2], "lys": RUMMET["lys"]},
        ],
    }
    entry = await hus.saet_op(rummet)
    hus.hass.states.async_set(sensor2, "off")
    await hus.hass.async_block_till_done()

    await hus.bevaegelse("on")
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]

    # Den anden sensor ser nogen: kun dens egen automatik tænder.
    hus.hass.states.async_set(sensor2, "on")
    await hus.hass.async_block_till_done()
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS], [STENLAMPE]]

    rum = entry.runtime_data.rum["traeningsrum"]
    assert [a.tilstand for a in rum.automatik] == ["bevaegelse", "bevaegelse"]

    # Den første sensor holder op med at se nogen. Kun dens egen automatik tæller ned.
    await hus.bevaegelse("off")
    assert rum.automatik[0].slukker is not None
    assert rum.automatik[1].slukker is None

    # Ingen ser nogen: hver automatik slukker sine egne lamper, hver for sig. Før 0.7.0 slukkede
    # rummet som én blok, og det er netop dét, der ikke længere er sandt.
    hus.hass.states.async_set(sensor2, "off")
    await hus.hass.async_block_till_done()
    await hus.vent(31)
    assert [k.data["entity_id"] for k in hus.sluk] == [[SPOTS], [STENLAMPE]]


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


async def test_hold_fra_et_kort_taender_kun_kortets_lamper(hus: Hus) -> None:
    """«Hold lys» gælder hele rummet, men fra et kort for nogle af lamperne tændes kun dem."""
    rummet = RUMMET | {
        "lamper": [
            {"entity_id": SPOTS, "bevaegelse": True},
            {"entity_id": STENLAMPE, "bevaegelse": True},
        ]
    }
    await hus.saet_op(rummet)

    await hus.tjeneste("rumlys", "hold", rum="traeningsrum", til=True, lamper=[SPOTS])
    # Kun kortets lampe tændes — stenlampen bliver slukket, selvom den hører til rummet.
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]
    assert hus.tilstand() == "hold"

    await hus.tjeneste("rumlys", "hold", rum="traeningsrum", til=False)
    assert hus.tilstand() != "hold"


KNAPRUMMET = RUMMET | {"knapper": [KNAP]}


async def test_et_tryk_paa_vaegknappen_taender_og_slukker(hus: Hus) -> None:
    """Et kort tryk tænder med rummets eget lys. Trykket virker først, når dobbeltklik-vinduet er forbi."""
    await hus.saet_op(KNAPRUMMET)

    await hus.tryk()
    assert not hus.taend
    await hus.vent(0.4)
    assert [k.data for k in hus.taend] == [
        {
            "entity_id": [SPOTS],
            "brightness_pct": 100,
            "color_temp_kelvin": 3500,
            "transition": 3,
        }
    ]
    await hus.lampen_svarer()
    assert hus.tilstand() == "haand"

    await hus.tryk()
    await hus.vent(0.4)
    assert [k.data["entity_id"] for k in hus.sluk] == [[SPOTS]]


async def test_dobbeltklik_slaar_hold_lys_til_og_fra(hus: Hus) -> None:
    """To tryk inden for vinduet er et dobbeltklik. Det enkelte tryk må ikke virke bagefter."""
    await hus.saet_op(KNAPRUMMET)
    await hus.tryk()
    await hus.tryk()
    assert hus.tilstand() == "hold"
    assert len(hus.taend) == 1

    await hus.vent(1)
    # Det andet tryk er brugt på dobbeltklikket og tænder ikke noget mere.
    assert len(hus.taend) == 1

    await hus.lampen_svarer()
    await hus.tryk()
    await hus.tryk()
    assert hus.tilstand() == "haand"


async def test_knappen_holdt_nede_daemper(hus: Hus) -> None:
    """Over hold-grænsen dæmpes lyset i skridt — ned, fordi lampen lyser kraftigt."""
    await hus.saet_op(KNAPRUMMET)
    await hus.lys("on", brightness=204)

    await hus.knap("on")
    await hus.vent(0.9)
    assert len(hus.taend) == 1
    assert hus.taend[-1].data["entity_id"] == [SPOTS]
    assert hus.taend[-1].data["brightness"] < 204
    assert hus.taend[-1].data["transition"] == 0.05

    await hus.vent(0.1)
    assert len(hus.taend) == 2

    await hus.knap("off")
    await hus.vent(0.5)
    assert len(hus.taend) == 2
    # Slippet efter en dæmpning må ikke også tælle som et tryk: så ville lyset slukke bagefter.
    assert not hus.sluk


async def test_knappen_uden_dobbeltklik_virker_med_det_samme(hus: Hus) -> None:
    """Holder et dobbeltklik ikke lyset, er der intet at vente på: trykket virker ved slippet."""
    await hus.saet_op(KNAPRUMMET | {"knap_maal": {KNAP: {"hold": False}}})

    await hus.tryk()
    # Ingen ventetid — lyset er tændt, før vinduet på 0,3 sekunder ville være udløbet.
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]


async def test_knappen_uden_daempning_daemper_ikke(hus: Hus) -> None:
    """Må knappen ikke dæmpe, går et hold ikke til dæmpning — det bliver et almindeligt tryk."""
    await hus.saet_op(KNAPRUMMET | {"knap_maal": {KNAP: {"daemp": False}}})
    await hus.lys("on", brightness=204)

    await hus.knap("on")
    await hus.vent(1.2)  # længere end hold-grænsen på 0,8
    assert not hus.taend, "knappen dæmpede, selvom den ikke må"

    await hus.knap("off")
    await hus.vent(0.5)
    # Lyset var tændt, så trykket slukker det.
    assert hus.sluk


async def test_knappens_egen_hold_graense(hus: Hus) -> None:
    """Hold-grænsen kan finindstilles pr. knap."""
    await hus.saet_op(KNAPRUMMET | {"knap_maal": {KNAP: {"daempning": {"graense": 2.0}}}})
    await hus.lys("on", brightness=204)

    await hus.knap("on")
    await hus.vent(1.2)  # forbi standardens 0,8, men ikke forbi knappens egne 2,0
    assert not hus.taend, "knappen dæmpede før sin egen grænse"
    await hus.vent(1.2)
    assert hus.taend, "knappen dæmpede ikke efter sin egen grænse"
    assert hus.taend[-1].data["brightness"] < 204


async def test_knappens_egne_daempningstal(hus: Hus) -> None:
    """Skridt, pause og overgang er knappens egne."""
    await hus.saet_op(
        KNAPRUMMET
        | {"knap_maal": {KNAP: {"daempning": {"skridt": 25, "pause": 0.5, "overgang": 0.2}}}}
    )
    await hus.lys("on", brightness=255)

    await hus.knap("on")
    await hus.vent(0.9)
    assert len(hus.taend) == 1
    assert hus.taend[-1].data["transition"] == 0.2
    # 100 % - 25 % = 75 %, altså 191 af 255. Standardens skridt ville give 90 %.
    assert hus.taend[-1].data["brightness"] == round(75 * 2.55)

    # Næste skridt er 25 % længere nede, ikke 10. (Afrundingen til 0-255 giver en enkelt pixel
    # i slør, så der sammenlignes med en tolerance frem for på et eksakt byte.)
    await hus.vent(0.6)
    assert abs(hus.taend[-1].data["brightness"] - 50 * 2.55) <= 1


async def test_knap_der_melder_haendelser(hus: Hus) -> None:
    """En event-entitet med klassen «button» er også en vægknap (fra 0.9.0).

    Den har ingen «nede»-tilstand: hver melding ER et tryk, og hvilken slags står i event_type.
    Sådan modellerer Home Assistant selv en knap — IHC's egne kommer som binary_sensors.
    """
    knap = "event.fjernbetjening"
    await hus.saet_op(KNAPRUMMET | {"knapper": [knap]})

    async def melder(slags: str, tid: str) -> None:
        hus.hass.states.async_set(knap, tid, {"event_type": slags, "device_class": "button"})
        await hus.hass.async_block_till_done()

    await melder("initial_press", "2026-09-19T21:00:00.000+00:00")
    await melder("single_press", "2026-09-19T21:00:01.000+00:00")
    # Et enkelt tryk virker med det samme — der er ingen varighed at vente på.
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]

    hus.taend.clear()
    await melder("double_press", "2026-09-19T21:00:02.000+00:00")
    assert hus.tilstand() == "hold"


async def test_knappen_styrer_kortets_lamper(hus: Hus) -> None:
    """En knap kan følge et kort og styre præcis de lamper, kortet viser."""
    rummet = KNAPRUMMET | {
        "lamper": [
            {"entity_id": SPOTS, "bevaegelse": True},
            {"entity_id": STENLAMPE, "bevaegelse": True},
        ],
        "knap_maal": {KNAP: {"kort": "kort1"}},
    }
    await hus.saet_op(rummet, gemt={"kort": {"kort1": [STENLAMPE]}})

    await hus.tryk()
    await hus.vent(0.4)
    assert [k.data["entity_id"] for k in hus.taend] == [[STENLAMPE]]


async def test_kortet_kan_fravaelge_en_lampe_og_stadig_vaere_alt_lys(hus: Hus) -> None:
    """«Alt lys» med et fravalg viser resten — fx alt undtagen lyset i en 3D-printer.

    Det er stadig alt lys: undtagelserne gemmes, ikke listen over det kortet viser, så en lampe,
    der kommer til i rummet, er med uden at nogen retter kortet.
    """
    rummet = KNAPRUMMET | {
        "lamper": [
            {"entity_id": SPOTS, "bevaegelse": True},
            {"entity_id": STENLAMPE, "bevaegelse": True},
        ],
        "knap_maal": {KNAP: {"kort": "kort1"}},
    }
    await hus.saet_op(rummet, gemt={"kort": {"kort1": {"undtagen": [STENLAMPE]}}})

    await hus.tryk()
    await hus.vent(0.4)
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]


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
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-16 10:00:00"))["navn"] == "Arbejde"  # onsdag


async def test_over_midnat_hoerer_til_dagen_det_begynder(hus: Hus) -> None:
    entry = await hus.saet_op(RUMMET | {"tidsrum": [NAT | {"dage": [4]}]})  # fredag
    rum = entry.runtime_data.rum["traeningsrum"]
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-18 23:00:00"))["navn"] == "Nat"  # fredag aften
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-19 03:00:00"))["navn"] == "Nat"  # natten til lørdag
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-17 23:00:00")) is None  # torsdag aften
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-18 03:00:00")) is None  # natten til fredag


async def test_samme_klokkeslaet_er_et_helt_doegn(hus: Hus) -> None:
    entry = await hus.saet_op(RUMMET | {"tidsrum": [WEEKEND]})
    rum = entry.runtime_data.rum["traeningsrum"]
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-19 00:00:00"))["navn"] == "Weekend"
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-20 23:59:59"))["navn"] == "Weekend"
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-18 23:59:59")) is None
    assert rum.automatik[0].tidsrum_ved(lokal("2026-09-21 00:00:00")) is None


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
    assert dt_util.parse_datetime(rum.automatik[0].husket["til"]) == lokal("2026-09-21 00:00:00")
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
        {"hvad": "taendt", "lys": "automatik", "automatik": 1},
        {"hvad": "tidsrum", "navn": "Nat", "automatik": 1},
        {"hvad": "valgt", "automatik": 1},
        {"hvad": "hold_til", "automatik": 1},
        {"hvad": "hold_fra", "automatik": 1},
        {"hvad": "slukket_i_haanden", "automatik": 1},
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
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["color_temp", "xy"], "supported_features": 32})
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
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["color_temp"], "supported_features": 32})
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
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["color_temp"], "supported_features": 32})
    hass.states.async_set(STENLAMPE, "off", {"supported_color_modes": ["color_temp"], "supported_features": 32})
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
    # Lampen skal melde tilbage, ellers står den slukket med sensoren tændt ved genindlæsningen,
    # og så tænder Rumlys den igen — med rette. Det er en rigtig lampe, prøven skal ligne.
    await hus.lampen_svarer()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    rum = entry.runtime_data.rum["traeningsrum"]
    assert [h["hvad"] for h in rum.haendelser] == ["taendt"]


# --- Blød tænd og sluk på lamper, der ikke selv kan lave en overgang -----------------------
#
# Et IHC-lys med dæmper kan stå på 40 %, men ikke glide derhen: Home Assistants `transition`
# går i gulvet uden en fejl. Rumlys trapper derfor lysstyrken selv. Rummets overgang er 3
# sekunder og standardpausen 0,2, så det bliver 15 skridt.
#
# `vent()` fyrer timerne én gang, og et skridt lægger det næste. Derfor trappes der med en
# løkke i testene — ikke med ét langt spring.

BRIGHTNESS = {"supported_color_modes": ["brightness"]}


async def trap_faerdigt(hus: Hus, skridt: int = 20) -> None:
    """Lad trappen køre til ende."""
    for _ in range(skridt):
        await hus.vent(0.2)


async def test_trappe_naar_lampen_ikke_selv_kan_lave_overgang(hass: HomeAssistant, hus: Hus) -> None:
    """Lampen kan dæmpes, men har ikke TRANSITION: Rumlys sætter lysstyrken i skridt."""
    hass.states.async_set(SPOTS, "off", BRIGHTNESS)
    await hus.saet_op()
    await hus.bevaegelse("on")

    # Første skridt: en lav lysstyrke, og ingen `transition` — den ville alligevel blive tabt.
    assert len(hus.taend) == 1
    assert hus.taend[0].data["entity_id"] == [SPOTS]
    # Bunden er 15 % = 38 af 255, og derfra 15 skridt op til 255.
    assert hus.taend[0].data["brightness"] == 52
    assert "transition" not in hus.taend[0].data
    assert "brightness_pct" not in hus.taend[0].data
    # Farven følger med hele vejen, så lampen ikke skifter farve til sidst.
    assert hus.taend[0].data["color_temp_kelvin"] == 3500

    await hus.vent(0.2)
    assert hus.taend[-1].data["brightness"] == 67

    await trap_faerdigt(hus)
    assert hus.taend[-1].data["brightness"] == 255
    assert len(hus.taend) == 15
    assert not hus.sluk


async def test_trappe_slukker_rigtigt_til_sidst(hass: HomeAssistant, hus: Hus) -> None:
    """Nedtrapningen ender med en rigtig slukning, ikke med lysstyrke 1."""
    hass.states.async_set(SPOTS, "off", BRIGHTNESS)
    await hus.saet_op()
    await hus.bevaegelse("on")
    await trap_faerdigt(hus)
    await hus.lys("on", hus.taend[-1].context, brightness=255, **BRIGHTNESS)

    await hus.bevaegelse("off")
    await hus.vent(31)
    # Trappen ned kører på turn_on; først det sidste skridt slukker.
    assert not hus.sluk
    assert hus.taend[-1].data["brightness"] < 255

    await trap_faerdigt(hus)
    assert [k.data for k in hus.sluk] == [{"entity_id": [SPOTS]}]


async def test_lampe_med_egen_overgang_trappes_ikke(hass: HomeAssistant, hus: Hus) -> None:
    """Kan lampen selv, bruges `transition` som hidtil — ét kald, ingen skridt."""
    hass.states.async_set(
        SPOTS, "off", {"supported_color_modes": ["brightness"], "supported_features": 32}
    )
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
    await trap_faerdigt(hus)
    assert len(hus.taend) == 1


async def test_relae_uden_daempning_trappes_ikke(hass: HomeAssistant, hus: Hus) -> None:
    """Et rent relæ kan hverken dæmpes eller lave en overgang: ét kald, som før."""
    hass.states.async_set(SPOTS, "off", {"supported_color_modes": ["onoff"]})
    await hus.saet_op()
    await hus.bevaegelse("on")
    assert len(hus.taend) == 1
    assert hus.taend[0].data["transition"] == 3
    await trap_faerdigt(hus)
    assert len(hus.taend) == 1


async def test_ny_kommando_stopper_trappen(hass: HomeAssistant, hus: Hus) -> None:
    """Den næste kommando gælder. En trappe, der stadig kører, må ikke skrive oven i den."""
    hass.states.async_set(SPOTS, "off", BRIGHTNESS)
    await hus.saet_op()
    await hus.bevaegelse("on")
    await hus.vent(0.2)
    antal = len(hus.taend)

    await hus.tjeneste(DOMAIN, "daemp", rum="traeningsrum", lysstyrke=0)
    await trap_faerdigt(hus)
    # Slukningen er en trappe nedad, der ender med turn_off. Det afgørende er, at den gamle
    # optrapning er stoppet: lyset går kun nedad efter kommandoen.
    assert hus.sluk
    efter = [k.data.get("brightness", 0) for k in hus.taend[antal:]]
    assert efter == sorted(efter, reverse=True)


async def test_trappen_maa_ikke_laese_sin_egen_daemper_som_en_slukning(
    hass: HomeAssistant, hus: Hus
) -> None:
    """En dæmper, der falder ud ved lav lysstyrke, er ikke «slukket i hånden».

    Ramt på Alrum 20-09-2026: første skridt drev IHC-lampen under dens minimum, den meldte
    «off», og Rumlys nulstilled rummet midt i optændingen. Lampen tændte færdig bagefter, så
    rummet stod «slukket» med lyset tændt."""
    hass.states.async_set(SPOTS, "off", BRIGHTNESS)
    await hus.saet_op()
    await hus.bevaegelse("on")
    assert hus.tilstand() == "bevaegelse"

    # Lampen melder selv «off» midt i trappen — uden Rumlys' context, som en dæmper der falder ud.
    await hus.lys("off", None, **BRIGHTNESS)
    assert hus.tilstand() == "bevaegelse"

    await trap_faerdigt(hus)
    await hus.lys("on", hus.taend[-1].context, brightness=255, **BRIGHTNESS)
    assert hus.tilstand() == "bevaegelse"


async def test_sensoren_ser_nogen_allerede_ved_start(hus: Hus) -> None:
    """Stod sensoren tændt, da Rumlys blev indlæst, skal lyset tænde alligevel.

    Rumlys tænder ellers kun på et skift fra fri til set. En bevægelsessensor skifter hele tiden,
    så det mærkes ikke på den — men en tilstedeværelsessensor kan stå tændt i timer, og så blev
    rummet mørkt efter en genstart, til man gik ud og ind igen. Målt i Alrum 20-09-2026.
    """
    hus.hass.states.async_set(SENSOR, "on")
    await hus.saet_op()
    assert [k.data["entity_id"] for k in hus.taend] == [[SPOTS]]
    assert hus.tilstand() == "bevaegelse"
    # Sensoren ser nogen nu, så nedtællingen er ikke begyndt.
    assert hus.slukker() is None


async def test_lyset_taendes_ikke_igen_naar_det_allerede_er_taendt(hus: Hus) -> None:
    """Er lyset tændt ved start, har synk() allerede rettet ind — der skal ikke sendes en kommando."""
    hus.hass.states.async_set(SENSOR, "on")
    hus.hass.states.async_set(SPOTS, "on")
    await hus.saet_op()
    assert hus.taend == []
    assert hus.tilstand() == "haand"


async def test_sensoren_ser_ingen_ved_start_taender_ikke(hus: Hus) -> None:
    """Uden nogen i rummet sker der som før ingenting ved start."""
    await hus.saet_op()
    assert hus.taend == []
    assert hus.tilstand() == "slukket"


async def test_rummet_foelger_med_naar_en_sensor_omdoebes(hass: HomeAssistant, hus: Hus) -> None:
    """Skifter en sensor id, skal rummet OG automatikken pege på det nye.

    Rumlys gemmer sensorerne ved entitets-id. Uden det her falder sensoren ud af rummet, så
    snart nogen omdøber den — og id'et skifter hver gang en enhed flyttes til Zigbee2MQTT.
    Martins FP2 i Alrum tabte sin sensor tre gange på én eftermiddag 20-09-2026.
    """
    registret = er.async_get(hass)
    # Fixturen har allerede sat en tilstand, og så tæller id'et som optaget: registret ville
    # give den «_2». Tag tilstanden væk, mens sensoren skrives ind, og sæt den igen bagefter.
    hass.states.async_remove(SENSOR)
    post = registret.async_get_or_create(
        "binary_sensor", "demo", "fp2", suggested_object_id="bevaegelse_traeningsrum"
    )
    assert post.entity_id == SENSOR
    hass.states.async_set(SENSOR, "off")
    entry = await hus.saet_op()
    assert entry.runtime_data.rum["traeningsrum"].sensorer == [SENSOR]

    nyt = "binary_sensor.traeningsrum_tilstedevaerelse"
    registret.async_update_entity(SENSOR, new_entity_id=nyt)
    await hass.async_block_till_done()

    # Genindlæsningen har bygget rummet om, så det er et nyt objekt.
    rum = entry.runtime_data.rum["traeningsrum"]
    assert rum.sensorer == [nyt]
    assert rum.automatik[0].sensorer == [nyt]
    assert entry.subentries["traeningsrum"].data["sensorer"] == [nyt]


async def test_et_id_der_ikke_er_rummets_roerer_ingenting(hass: HomeAssistant, hus: Hus) -> None:
    """En omdøbning et andet sted i huset må ikke skrive i rummet."""
    registret = er.async_get(hass)
    registret.async_get_or_create(
        "binary_sensor", "demo", "andet", suggested_object_id="noget_helt_andet"
    )
    hass.states.async_set("binary_sensor.noget_helt_andet", "off")
    entry = await hus.saet_op()
    foer = dict(entry.subentries["traeningsrum"].data)
    registret.async_update_entity(
        "binary_sensor.noget_helt_andet", new_entity_id="binary_sensor.noget_tredje"
    )
    await hass.async_block_till_done()
    assert dict(entry.subentries["traeningsrum"].data) == foer
