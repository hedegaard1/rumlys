"""Opsætningen: integrationen, og rum med tidsrum."""

from __future__ import annotations

from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.config_entries import SOURCE_RECONFIGURE, SOURCE_USER, ConfigSubentryData
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.rumlys.const import DOMAIN, RUM


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


async def test_tilfoej_rum_med_tidsrum(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Rumlys")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    flow = hass.config_entries.subentries

    result = await flow.async_init((entry.entry_id, RUM), context={"source": SOURCE_USER})
    assert result["step_id"] == "rum"
    result = await flow.async_configure(
        result["flow_id"],
        {
            "navn": "Gang",
            "lys": ["light.gang_spots"],
            "sensorer": ["binary_sensor.gang_bevaegelse"],
            "lysstyrke": 100.0,
            "kelvin": 2700.0,
            "overgang": 0.0,
        },
    )
    assert result["type"] is FlowResultType.MENU
    assert result["menu_options"] == ["tilfoej_tidsrum", "gem"]

    result = await flow.async_configure(result["flow_id"], {"next_step_id": "tilfoej_tidsrum"})
    assert result["step_id"] == "tidsrum"
    nat = {"navn": "Nat", "start": "22:00:00", "slut": "22:00:00", "lysstyrke": 10.0}
    result = await flow.async_configure(result["flow_id"], nat)
    assert result["errors"] == {"base": "samme_tid"}
    result = await flow.async_configure(
        result["flow_id"], nat | {"slut": "06:30:00", "kelvin": 2700.0}
    )
    assert result["type"] is FlowResultType.MENU
    assert result["menu_options"] == ["tilfoej_tidsrum", "ret_tidsrum", "slet_tidsrum", "gem"]
    assert result["description_placeholders"]["tidsrum"] == "- Nat: 22:00–06:30, 10 %, 2700 K"

    result = await flow.async_configure(result["flow_id"], {"next_step_id": "gem"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    (rum,) = entry.subentries.values()
    assert rum.title == "Gang"
    assert dict(rum.data) == {
        "lys": ["light.gang_spots"],
        "sensorer": ["binary_sensor.gang_bevaegelse"],
        "lysstyrke": 100,
        "kelvin": 2700,
        "overgang": 0,
        "tidsrum": [
            {"navn": "Nat", "start": "22:00:00", "slut": "06:30:00", "lysstyrke": 10, "kelvin": 2700}
        ],
    }
    # Integrationen er genindlæst, og rummet er blevet en enhed med entiteter.
    assert hass.states.get("sensor.gang_state").state == "slukket"


async def test_ret_rum(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Rumlys",
        subentries_data=[
            ConfigSubentryData(
                data={
                    "lys": ["light.gang_spots"],
                    "sensorer": ["binary_sensor.gang_bevaegelse"],
                    "lysstyrke": 100,
                    "kelvin": 2700,
                    "overgang": 0,
                    "tidsrum": [
                        {"navn": "Dag", "start": "06:30:00", "slut": "22:00:00", "lysstyrke": 100},
                        {"navn": "Nat", "start": "22:00:00", "slut": "06:30:00", "lysstyrke": 10},
                    ],
                },
                subentry_id="gang",
                subentry_type=RUM,
                title="Gang",
                unique_id=None,
            )
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    flow = hass.config_entries.subentries

    result = await flow.async_init(
        (entry.entry_id, RUM), context={"source": SOURCE_RECONFIGURE, "subentry_id": "gang"}
    )
    assert result["step_id"] == "rum"
    forslag = {
        str(noegle): noegle.description["suggested_value"]
        for noegle in result["data_schema"].schema
        if noegle.description
    }
    assert forslag["navn"] == "Gang"
    assert forslag["kelvin"] == 2700

    # Sensoren og det hvide lys fjernes.
    result = await flow.async_configure(
        result["flow_id"],
        {"navn": "Gangen", "lys": ["light.gang_spots"], "lysstyrke": 80.0, "overgang": 3.0},
    )
    assert "- Nat: 22:00–06:30, 10 %" in result["description_placeholders"]["tidsrum"]

    result = await flow.async_configure(result["flow_id"], {"next_step_id": "ret_tidsrum"})
    result = await flow.async_configure(result["flow_id"], {"tidsrum": "1"})
    assert result["step_id"] == "tidsrum"
    result = await flow.async_configure(
        result["flow_id"],
        {"navn": "Nat", "start": "23:00:00", "slut": "06:00:00", "lysstyrke": 5.0},
    )
    result = await flow.async_configure(result["flow_id"], {"next_step_id": "slet_tidsrum"})
    result = await flow.async_configure(result["flow_id"], {"tidsrum": "0"})
    assert result["description_placeholders"]["tidsrum"] == "- Nat: 23:00–06:00, 5 %"

    result = await flow.async_configure(result["flow_id"], {"next_step_id": "gem"})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()

    rum = entry.subentries["gang"]
    assert rum.title == "Gangen"
    assert dict(rum.data) == {
        "lys": ["light.gang_spots"],
        "lysstyrke": 80,
        "overgang": 3,
        "tidsrum": [{"navn": "Nat", "start": "23:00:00", "slut": "06:00:00", "lysstyrke": 5}],
    }
