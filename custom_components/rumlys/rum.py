"""Lyset i ét rum: bevægelse, de to sluk-tider, «hold lys» og tidsrum.

Rummet har én kilde ad gangen: tændt af bevægelse, tændt eller ændret i hånden, eller
slukket. «Hold lys» ligger ovenpå og sætter sensoren og nedtællingen ud af spil.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
from datetime import datetime, time, timedelta
from typing import Any

from homeassistant.config_entries import ConfigSubentry
from homeassistant.const import (
    ATTR_ENTITY_ID,
    STATE_ON,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import (
    CALLBACK_TYPE,
    Context,
    Event,
    EventStateChangedData,
    HomeAssistant,
    State,
    callback,
)
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.util import dt as dt_util

from .const import (
    BEVAEGELSE,
    CONF_KELVIN,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_OVERGANG,
    CONF_SENSORER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    EKKO_VINDUE,
    HAAND,
    HOLD,
    HOLD_TID,
    SLUK_EFTER_BEVAEGELSE,
    SLUK_EFTER_TRYK,
    SLUKKET,
    STANDARD_INDSTILLINGER,
)

UKENDT = (STATE_UNAVAILABLE, STATE_UNKNOWN)


class Rum:
    """Ét rum og dets lys."""

    def __init__(
        self,
        hass: HomeAssistant,
        subentry: ConfigSubentry,
        gemt: dict[str, Any],
        gem: Callable[[], None],
    ) -> None:
        data = subentry.data
        self.hass = hass
        self.id = subentry.subentry_id
        self.navn = subentry.title
        self.lys: list[str] = list(data[CONF_LYS])
        self.sensorer: list[str] = list(data.get(CONF_SENSORER, []))
        self.overgang: float = data.get(CONF_OVERGANG, 0)
        self.standard = {
            k: data[k] for k in (CONF_LYSSTYRKE, CONF_KELVIN) if k in data
        }
        self.tidsrum = [
            t
            | {
                CONF_START: time.fromisoformat(t[CONF_START]),
                CONF_SLUT: time.fromisoformat(t[CONF_SLUT]),
            }
            for t in data.get(CONF_TIDSRUM, [])
        ]
        self.indstillinger = STANDARD_INDSTILLINGER | gemt.get("indstillinger", {})
        self.kilde: str | None = gemt.get("kilde")
        self.slukker = _tidspunkt(gemt.get("slukker"))
        self.hold_slutter = _tidspunkt(gemt.get("hold_slutter"))
        self.bevaegelse = False
        self._gem = gem
        self._lyttere: list[Callable[[], None]] = []
        self._afmeld: list[CALLBACK_TYPE] = []
        self._timere: list[CALLBACK_TYPE] = []
        self._egne: deque[str] = deque(maxlen=20)
        self._sidste_kommando: datetime | None = None

    @property
    def tilstand(self) -> str:
        if self.hold_slutter is not None:
            return HOLD
        return self.kilde or SLUKKET

    def aktivt_tidsrum(self) -> dict[str, Any] | None:
        """Det første tidsrum, klokken er inde i lige nu."""
        nu = dt_util.now().time()
        for tidsrum in self.tidsrum:
            if _inden_for(nu, tidsrum[CONF_START], tidsrum[CONF_SLUT]):
                return tidsrum
        return None

    @callback
    def start(self) -> None:
        self._afmeld.append(
            async_track_state_change_event(self.hass, self.lys, self._lys_aendret)
        )
        if self.sensorer:
            self._afmeld.append(
                async_track_state_change_event(
                    self.hass, self.sensorer, self._sensor_aendret
                )
            )
        skift = {t[k] for t in self.tidsrum for k in (CONF_START, CONF_SLUT)}
        for tid in skift:
            self._afmeld.append(
                async_track_time_change(
                    self.hass, self._tidsrum_skifter, tid.hour, tid.minute, tid.second
                )
            )
        self.bevaegelse = self._sensor_taendt()
        self._synk()

    @callback
    def stop(self) -> None:
        for afmeld in self._afmeld + self._timere:
            afmeld()
        self._afmeld.clear()
        self._timere.clear()

    @callback
    def lyt(self, lytter: Callable[[], None]) -> CALLBACK_TYPE:
        self._lyttere.append(lytter)
        return lambda: self._lyttere.remove(lytter)

    def til_lagring(self) -> dict[str, Any]:
        return {
            "indstillinger": self.indstillinger,
            "kilde": self.kilde,
            "slukker": self.slukker and self.slukker.isoformat(),
            "hold_slutter": self.hold_slutter and self.hold_slutter.isoformat(),
        }

    @callback
    def saet(self, noegle: str, vaerdi: float) -> None:
        """En af tiderne er ændret. Den gælder fra næste nedtælling."""
        self.indstillinger[noegle] = vaerdi
        self._opdater()

    @callback
    def hold_til(self) -> None:
        """Hold lyset tændt i hold-tiden. Slukket lys tændes med sidste lysstyrke og farve."""
        self.hold_slutter = dt_util.utcnow() + timedelta(
            hours=self.indstillinger[HOLD_TID]
        )
        self.slukker = None
        if self.kilde is None:
            self.kilde = HAAND
            self._taend(None)
        self._opdater()

    @callback
    def hold_fra(self) -> None:
        """Tilbage til sensoren: uden bevægelse slukker lyset efter «sluk efter bevægelse»."""
        if self.hold_slutter is None:
            return
        self.hold_slutter = None
        if self.kilde is not None and not self.bevaegelse:
            self.slukker = self._frist(BEVAEGELSE if self.sensorer else HAAND)
        self._opdater()

    @callback
    def _synk(self) -> None:
        """Ret tilstanden ind efter lyset, som det er — ved start, og når en lampe dukker op igen."""
        taendt = self._lys_status()
        if taendt is None:
            return
        if not taendt:
            self._nulstil()
            return
        if self.kilde is None:
            self.kilde = HAAND
            self.slukker = None if self.bevaegelse else self._frist(HAAND)
        elif self.hold_slutter is None and self.slukker is None and not self.bevaegelse:
            self.slukker = self._frist(self.kilde)
        self._opdater()

    @callback
    def _nulstil(self) -> None:
        self.kilde = self.slukker = self.hold_slutter = None
        self._opdater()

    @callback
    def _sensor_aendret(self, event: Event[EventStateChangedData]) -> None:
        bevaegelse = self._sensor_taendt()
        if bevaegelse == self.bevaegelse:
            return
        self.bevaegelse = bevaegelse
        if self.hold_slutter is not None:
            return
        if bevaegelse:
            if self.kilde is None:
                self.kilde = BEVAEGELSE
                self._taend(self._scenarie())
            # Bevægelse stopper nedtællingen — også når lyset er tændt i hånden.
            self.slukker = None
        elif self.kilde is not None:
            self.slukker = self._frist(self.kilde)
        self._opdater()

    @callback
    def _lys_aendret(self, event: Event[EventStateChangedData]) -> None:
        gammel = event.data["old_state"]
        ny = event.data["new_state"]
        if ny is None or ny.state in UKENDT:
            return
        if gammel is None or gammel.state in UKENDT:
            self._synk()
            return
        if ny.state != STATE_ON and gammel.state != STATE_ON:
            # En attribut på en slukket lampe. Den må ikke nulstille rummet, mens vores
            # egen tænd-kommando er undervejs.
            return
        if not self._lys_status():
            if self.kilde is not None:
                self._nulstil()
            return
        if _aftryk(gammel) == _aftryk(ny) or self._egen(ny.context):
            return
        self.kilde = HAAND
        if self.hold_slutter is None:
            self.slukker = None if self.bevaegelse else self._frist(HAAND)
        self._opdater()

    @callback
    def _tidsrum_skifter(self, _nu: datetime) -> None:
        """Lys tændt af bevægelse skifter til det nye tidsrums lys. Lys valgt i hånden bliver."""
        if self.kilde == BEVAEGELSE and self.hold_slutter is None:
            self._taend(self._scenarie())

    @callback
    def _slukketid(self, _nu: datetime) -> None:
        self._sluk()
        self._nulstil()

    @callback
    def _hold_udloebet(self, _nu: datetime) -> None:
        self.hold_fra()

    @callback
    def _opdater(self) -> None:
        """Sæt nedtællingerne efter tiderne, gem, og fortæl entiteterne det."""
        for afmeld in self._timere:
            afmeld()
        self._timere = []
        if self.slukker is not None:
            self._timere.append(
                async_track_point_in_utc_time(self.hass, self._slukketid, self.slukker)
            )
        if self.hold_slutter is not None:
            self._timere.append(
                async_track_point_in_utc_time(
                    self.hass, self._hold_udloebet, self.hold_slutter
                )
            )
        self._gem()
        for lytter in list(self._lyttere):
            lytter()

    def _scenarie(self) -> dict[str, Any]:
        return self.aktivt_tidsrum() or self.standard

    def _frist(self, kilde: str) -> datetime | None:
        """Hvornår lyset skal slukke, regnet fra nu. None: det slukker ikke af sig selv."""
        if kilde == BEVAEGELSE:
            tidsrum = self.aktivt_tidsrum()
            if tidsrum and tidsrum.get(CONF_SLUK_EFTER) is not None:
                sekunder = tidsrum[CONF_SLUK_EFTER]
            else:
                sekunder = self.indstillinger[SLUK_EFTER_BEVAEGELSE]
        else:
            sekunder = self.indstillinger[SLUK_EFTER_TRYK] * 60
            if not sekunder:
                return None
        return dt_util.utcnow() + timedelta(seconds=sekunder)

    def _lys_status(self) -> bool | None:
        """Om en lampe er tændt. None, hvis ingen af dem kan ses endnu."""
        kendte = [
            tilstand
            for entity_id in self.lys
            if (tilstand := self.hass.states.get(entity_id))
            and tilstand.state not in UKENDT
        ]
        if not kendte:
            return None
        return any(tilstand.state == STATE_ON for tilstand in kendte)

    def _sensor_taendt(self) -> bool:
        return any(
            (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
            for entity_id in self.sensorer
        )

    def _egen(self, kontekst: Context) -> bool:
        """Om en ændring på lyset er svar på Rumlys' egen kommando."""
        if kontekst.id in self._egne or kontekst.parent_id in self._egne:
            return True
        if kontekst.user_id is not None or self._sidste_kommando is None:
            return False
        return dt_util.utcnow() - self._sidste_kommando < EKKO_VINDUE

    @callback
    def _taend(self, scenarie: dict[str, Any] | None) -> None:
        data: dict[str, Any] = {}
        if scenarie:
            data["brightness_pct"] = scenarie[CONF_LYSSTYRKE]
            if scenarie.get(CONF_KELVIN):
                data["color_temp_kelvin"] = scenarie[CONF_KELVIN]
        self._kald("turn_on", data)

    @callback
    def _sluk(self) -> None:
        self._kald("turn_off", {})

    @callback
    def _kald(self, tjeneste: str, data: dict[str, Any]) -> None:
        kontekst = Context()
        self._egne.append(kontekst.id)
        self._sidste_kommando = dt_util.utcnow()
        data[ATTR_ENTITY_ID] = self.lys
        if self.overgang:
            data["transition"] = self.overgang
        self.hass.async_create_task(
            self.hass.services.async_call("light", tjeneste, data, context=kontekst),
            f"rumlys {self.navn} {tjeneste}",
        )


def _inden_for(nu: time, start: time, slut: time) -> bool:
    if start < slut:
        return start <= nu < slut
    return nu >= start or nu < slut  # hen over midnat


def _aftryk(tilstand: State) -> tuple[Any, ...]:
    """Det ved lyset, som en person kan ændre."""
    attributter = tilstand.attributes
    hs = attributter.get("hs_color")
    return (
        tilstand.state,
        attributter.get("brightness"),
        attributter.get("color_mode"),
        attributter.get("color_temp_kelvin"),
        hs and tuple(round(v) for v in hs),
        attributter.get("effect"),
    )


def _tidspunkt(tekst: str | None) -> datetime | None:
    return dt_util.parse_datetime(tekst) if tekst else None
