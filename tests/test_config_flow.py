"""Opsætningen: integrationen, rum som områder, og migreringen fra 0.1.0."""

from __future__ import annotations

from pytest_homeassistant_custom_component.common import MockConfigEntry
import voluptuous as vol

from homeassistant.config_entries import SOURCE_RECONFIGURE, SOURCE_USER, ConfigSubentryData
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import (
    area_registry as ar,
    device_registry as dr,
    entity_registry as er,
)

from custom_components.rumlys.const import DOMAIN, RUM, STANDARD_LYS


def rum_i(omraade: str, titel: str, **data) -> ConfigSubentryData:
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


async def gangen(hass: HomeAssistant) -> None:
    """Gangen: en gruppe med to spots, en lampe, en bevægelsessensor og en dørsensor."""
    ar.async_get(hass).async_create("Gang")
    kilde = MockConfigEntry(domain="test")
    kilde.add_to_hass(hass)
    enheder, entiteter = dr.async_get(hass), er.async_get(hass)

    def lampe(navn: str, **kwargs) -> None:
        enhed = enheder.async_get_or_create(
            config_entry_id=kilde.entry_id, identifiers={("test", navn)}, name=navn
        )
        enheder.async_update_device(enhed.id, area_id="gang")
        entiteter.async_get_or_create(
            "light", "test", navn, suggested_object_id=navn, device_id=enhed.id, **kwargs
        )

    lampe("gang_spot_1")
    lampe("gang_spot_2")
    lampe("gang_loftspots")
    hass.states.async_set(
        "light.gang_loftspots", "off", {"group_entities": ["light.gang_spot_1", "light.gang_spot_2"]}
    )
    entiteter.async_get_or_create(
        "light", "test", "lampe", suggested_object_id="gang_lampe"
    )
    entiteter.async_update_entity("light.gang_lampe", area_id="gang")
    for navn, klasse in (("gang_bevaegelse", "motion"), ("gang_doer", "door")):
        entiteter.async_get_or_create(
            "binary_sensor",
            "test",
            navn,
            suggested_object_id=navn,
            original_device_class=klasse,
        )
        entiteter.async_update_entity(f"binary_sensor.{navn}", area_id="gang")
    entiteter.async_get_or_create(
        "light", "test", "skjult", suggested_object_id="gang_skjult", hidden_by=er.RegistryEntryHider.USER
    )
    entiteter.async_update_entity("light.gang_skjult", area_id="gang")


async def test_integrationen_saettes_op(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Rumlys"


async def test_integrationen_kun_en_gang(hass: HomeAssistant) -> None:
    MockConfigEntry(domain=DOMAIN, title="Rumlys").add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_tilfoej_rum_vaelger_omraadet(hass: HomeAssistant) -> None:
    hass.config.language = "da"
    await gangen(hass)
    ar.async_get(hass).async_create("Kontor")
    entry = MockConfigEntry(
        domain=DOMAIN, title="Rumlys", minor_version=2, subentries_data=[rum_i("kontor", "Kontor")]
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    flow = hass.config_entries.subentries

    result = await flow.async_init((entry.entry_id, RUM), context={"source": SOURCE_USER})
    assert result["step_id"] == "user"
    ((noegle, felt),) = result["data_schema"].schema.items()
    # Kontor har et rum og er ikke med; Gang står med det, et nyt rum får valgt på forhånd.
    assert felt.config["options"] == [{"value": "gang", "label": "Gang — 2 lamper · 1 sensor"}]
    # Valgfrit felt: et påkrævet valg får Home Assistants formular til at vælge det første område selv.
    assert type(noegle) is vol.Optional
    assert felt.config["mode"] == "list"

    # Intet valgt: formularen igen, uden at et rum er oprettet.
    result = await flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"omraade": "vaelg_omraade"}
    assert len(entry.subentries) == 1

    result = await flow.async_configure(result["flow_id"], {"omraade": "gang"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    rum = next(r for r in entry.subentries.values() if r.unique_id == "gang")
    assert rum.title == "Gang"
    assert dict(rum.data) == {
        "omraade": "gang",
        # Gruppen er med, dens spots er ikke; den skjulte lampe og dørsensoren heller ikke.
        "lamper": [
            {"entity_id": "light.gang_loftspots", "bevaegelse": True},
            {"entity_id": "light.gang_lampe", "bevaegelse": True},
        ],
        "sensorer": ["binary_sensor.gang_bevaegelse"],
        "lys": {"type": "hvid", "lysstyrke": 100, "kelvin": 3000},
        "overgang": 0,
        "tidsrum": [],
        "scener": [],
    }
    # Integrationen er genindlæst, og rummet er en enhed i sit område.
    assert hass.states.get("sensor.gang_tilstand").state == "slukket"
    enhed = dr.async_get(hass).async_get_device_by_identifier((DOMAIN, rum.subentry_id), entry.entry_id)
    assert enhed.name == "Gang"
    assert enhed.area_id == "gang"
    assert enhed.configuration_url == f"homeassistant://rumlys/{rum.subentry_id}"


async def test_nyt_rum_faar_blod_taend_og_sluk_naar_lamperne_kan_det(hass: HomeAssistant) -> None:
    """Blød tænd og sluk står på 3 sekunder i et nyt rum — men kun når en lampe kan det."""
    await gangen(hass)
    # Gruppen melder, at den kan tænde og slukke blødt (LightEntityFeature.TRANSITION).
    hass.states.async_set(
        "light.gang_loftspots",
        "off",
        {"group_entities": ["light.gang_spot_1", "light.gang_spot_2"], "supported_features": 32},
    )
    entry = MockConfigEntry(domain=DOMAIN, title="Rumlys", minor_version=2)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    flow = hass.config_entries.subentries

    result = await flow.async_init((entry.entry_id, RUM), context={"source": SOURCE_USER})
    result = await flow.async_configure(result["flow_id"], {"omraade": "gang"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    rum = next(r for r in entry.subentries.values() if r.unique_id == "gang")
    assert rum.data["overgang"] == 3


async def test_alle_omraader_har_et_rum(hass: HomeAssistant) -> None:
    ar.async_get(hass).async_create("Kontor")
    entry = MockConfigEntry(
        domain=DOMAIN, title="Rumlys", minor_version=2, subentries_data=[rum_i("kontor", "Kontor")]
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    result = await hass.config_entries.subentries.async_init(
        (entry.entry_id, RUM), context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "ingen_omraader"


async def test_ret_rum_flytter_det_til_et_andet_omraade(hass: HomeAssistant) -> None:
    omraader = ar.async_get(hass)
    for navn in ("Gang", "Stue", "Kontor"):
        omraader.async_create(navn)
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Rumlys",
        minor_version=2,
        subentries_data=[
            rum_i("gang", "Gang", overgang=3),
            rum_i("kontor", "Kontor"),
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    flow = hass.config_entries.subentries

    result = await flow.async_init(
        (entry.entry_id, RUM), context={"source": SOURCE_RECONFIGURE, "subentry_id": "gang"}
    )
    assert result["step_id"] == "reconfigure"
    assert result["description_placeholders"] == {"navn": "Gang", "sti": "/rumlys/gang"}
    (felt,) = result["data_schema"].schema.values()
    assert [valg["value"] for valg in felt.config["options"]] == ["gang", "stue"]

    result = await flow.async_configure(result["flow_id"], {"omraade": "stue"})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()

    rum = entry.subentries["gang"]
    assert rum.title == "Stue"
    assert rum.unique_id == "stue"
    assert rum.data["omraade"] == "stue"
    assert rum.data["overgang"] == 3


async def test_omraadet_omdoebes(hass: HomeAssistant) -> None:
    omraader = ar.async_get(hass)
    omraader.async_create("Gang")
    entry = MockConfigEntry(
        domain=DOMAIN, title="Rumlys", minor_version=2, subentries_data=[rum_i("gang", "Gang")]
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)

    omraader.async_update("gang", name="Gangen")
    await hass.async_block_till_done()
    assert entry.subentries["gang"].title == "Gangen"
    enhed = dr.async_get(hass).async_get_device_by_identifier((DOMAIN, "gang"), entry.entry_id)
    assert enhed.name == "Gangen"
    # Id'erne bliver, som de var.
    assert hass.states.get("switch.gang_hold_lys") is not None


async def test_migrering_fra_0_1_0(hass: HomeAssistant) -> None:
    ar.async_get(hass).async_create("Kontor")
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Rumlys",
        minor_version=1,
        subentries_data=[
            ConfigSubentryData(
                data={
                    "lys": ["light.kontor_loftspots", "light.kontor_bord_lysband"],
                    "sensorer": ["binary_sensor.lafaer"],
                    "lysstyrke": 100,
                    "kelvin": 3500,
                    "overgang": 3,
                    "tidsrum": [
                        {"navn": "Nat", "start": "22:00:00", "slut": "06:30:00", "lysstyrke": 10, "sluk_efter": 60},
                    ],
                },
                subentry_id="kontor01",
                subentry_type=RUM,
                title="Kontor",
                unique_id=None,
            )
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert entry.minor_version == 2
    rum = entry.subentries["kontor01"]
    assert rum.title == "Kontor"
    assert rum.unique_id == "kontor"
    assert dict(rum.data) == {
        "omraade": "kontor",
        "lamper": [
            {"entity_id": "light.kontor_loftspots", "bevaegelse": True},
            {"entity_id": "light.kontor_bord_lysband", "bevaegelse": True},
        ],
        "sensorer": ["binary_sensor.lafaer"],
        "lys": {"type": "hvid", "lysstyrke": 100, "kelvin": 3500},
        "overgang": 3,
        "tidsrum": [
            {
                "navn": "Nat",
                "start": "22:00:00",
                "slut": "06:30:00",
                "sluk_efter": 60,
                "lys": {"type": "lysstyrke", "lysstyrke": 10},
            }
        ],
        "scener": [],
    }
    # Samme id'er som 0.1.0 fik på dansk.
    for entity_id in (
        "switch.kontor_hold_lys",
        "sensor.kontor_tilstand",
        "number.kontor_sluk_efter_bevaegelse",
        "number.kontor_sluk_efter_tryk",
        "number.kontor_hold_tid",
    ):
        assert hass.states.get(entity_id) is not None, entity_id
    enhed = dr.async_get(hass).async_get_device_by_identifier((DOMAIN, "kontor01"), entry.entry_id)
    assert enhed.area_id == "kontor"
