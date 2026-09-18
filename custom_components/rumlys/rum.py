"""Lyset i ét rum: bevægelse, de to sluk-tider, «hold lys», tidsrum og det sidst brugte lys.

Rummet har én kilde ad gangen: tændt af bevægelse, valgt i hånden, eller slukket. «Hold lys»
ligger ovenpå og sætter sensoren og nedtællingen ud af spil. Vælger nogen selv lyset, husker
rummet det, til et andet tidsrum tager over, og bevægelse tænder så med det.

Et tidsrum gælder på sine ugedage. Går det over midnat, hører det til den dag, det begynder, og
samme klokkeslæt i start og slut er et helt døgn. Uden for tidsrummene gælder rummets eget lys.
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
    async_call_later,
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.util import dt as dt_util

from .const import (
    ALLE_DAGE,
    BEVAEGELSE,
    CONF_BEVAEGELSE,
    CONF_DAGE,
    CONF_ENTITY_ID,
    CONF_FARVE,
    CONF_KELVIN,
    CONF_LAMPER,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_NAVN,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENE,
    CONF_SCENER,
    CONF_SENSORER,
    CONF_SENSOR_LAMPER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    CONF_TYPE,
    EKKO_VINDUE,
    HAAND,
    HAENDELSER,
    HOLD,
    HOLD_TID,
    HUSK_EFTER,
    LYS_FARVE,
    LYS_HVID,
    LYS_SCENE,
    SLUK_EFTER_BEVAEGELSE,
    SLUK_EFTER_TRYK,
    SLUKKET,
    STANDARD_INDSTILLINGER,
    STANDARD_LYS,
)
from . import scener
from .omraade import omraadets_navn

UKENDT = (STATE_UNAVAILABLE, STATE_UNKNOWN)

# Lampens farve står i den attribut, farvetilstanden hedder.
FARVEATTRIBUT = {
    "color_temp": "color_temp_kelvin",
    "hs": "hs_color",
    "xy": "xy_color",
    "rgb": "rgb_color",
    "rgbw": "rgbw_color",
    "rgbww": "rgbww_color",
}


class Rum:
    """Ét rum og dets lys."""

    def __init__(
        self,
        hass: HomeAssistant,
        subentry: ConfigSubentry,
        gemt: dict[str, Any],
        gem: Callable[[], None],
        katalog: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        data = subentry.data
        self.hass = hass
        self._katalog = katalog or {}
        self.id = subentry.subentry_id
        self.omraade: str | None = data.get(CONF_OMRAADE)
        self._titel = subentry.title
        lamper = data.get(CONF_LAMPER, [])
        self.lys: list[str] = [lampe[CONF_ENTITY_ID] for lampe in lamper]
        # Lamperne, bevægelse tænder. De andre hører til rummet og slukker med det.
        self.foelger: list[str] = [
            lampe[CONF_ENTITY_ID] for lampe in lamper if lampe.get(CONF_BEVAEGELSE, True)
        ]
        self.sensorer: list[str] = list(data.get(CONF_SENSORER, []))
        # Hver sensor kan tænde sine egne af rummets lamper. Uden valg tænder den alle, der tænder ved bevægelse.
        self.sensor_lamper: dict[str, list[str]] = {
            sensor: valgte
            for sensor, lamper in (data.get(CONF_SENSOR_LAMPER) or {}).items()
            if sensor in self.sensorer and (valgte := [l for l in lamper if l in self.foelger])
        }
        # Lamperne, bevægelse sidst tændte — dem gælder et skift af tidsrum.
        self._sidst_taendt: list[str] | None = None
        self.overgang: float = data.get(CONF_OVERGANG, 0)
        self.standard: dict[str, Any] = data.get(CONF_LYS) or dict(STANDARD_LYS)
        self.tidsrum = [
            t
            | {
                CONF_START: time.fromisoformat(t[CONF_START]),
                CONF_SLUT: time.fromisoformat(t[CONF_SLUT]),
                CONF_DAGE: frozenset(t.get(CONF_DAGE, ALLE_DAGE)),
            }
            for t in data.get(CONF_TIDSRUM, [])
        ]
        # Tidsrummet, der gjaldt ved sidste skift — et klokkeslæt er ikke et skift alle dage.
        self._aktivt: dict[str, Any] | None = None
        self.scener: list[str] = list(data.get(CONF_SCENER, []))
        self.indstillinger = STANDARD_INDSTILLINGER | gemt.get("indstillinger", {})
        self.kilde: str | None = gemt.get("kilde")
        self.slukker = _tidspunkt(gemt.get("slukker"))
        self.hold_slutter = _tidspunkt(gemt.get("hold_slutter"))
        # Det sidst valgte lys, lampe for lampe, og hvornår et nyt tidsrum gør det forældet.
        self.husket: dict[str, Any] | None = gemt.get("husket")
        self.haendelser: deque[dict[str, Any]] = deque(
            gemt.get("haendelser", []), maxlen=HAENDELSER
        )
        # Kortene på betjeningspanelerne efter id, og de lamper hvert kort viser. En tom liste er hele
        # rummet, None ingen lamper. Et kort, rummet ikke kender endnu, er nyt i sidepanelet.
        self.kort: dict[str, list[str] | None] = {
            kort_id: None if lamper is None else list(lamper)
            for kort_id, lamper in gemt.get("kort", {}).items()
        }
        # Hvornår kortene sidst er ændret. Står på tilstandssensoren, så et kort på en anden skærm henter rummet igen.
        self.kort_opdateret: str | None = gemt.get("kort_opdateret")
        self.bevaegelse = False
        self._gem = gem
        self._lyttere: list[Callable[[], None]] = []
        self._afmeld: list[CALLBACK_TYPE] = []
        self._timere: list[CALLBACK_TYPE] = []
        self._husk_senere: CALLBACK_TYPE | None = None
        self._egne: deque[str] = deque(maxlen=20)
        self._sidste_kommando: datetime | None = None

    @property
    def navn(self) -> str:
        """Områdets navn; rummet følger med, hvis området omdøbes."""
        return omraadets_navn(self.hass, self.omraade) or self._titel

    @property
    def tilstand(self) -> str:
        if self.hold_slutter is not None:
            return HOLD
        return self.kilde or SLUKKET

    def aktivt_tidsrum(self) -> dict[str, Any] | None:
        """Det første tidsrum, klokken er inde i lige nu."""
        return self.tidsrum_ved(dt_util.now())

    def tidsrum_ved(self, tidspunkt: datetime) -> dict[str, Any] | None:
        """Det første tidsrum, et lokalt tidspunkt er inde i."""
        for tidsrum in self.tidsrum:
            if _inden_for(tidspunkt, tidsrum):
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
        self._aktivt = self.aktivt_tidsrum()
        self.bevaegelse = self._sensor_taendt()
        self._synk()

    @callback
    def stop(self) -> None:
        for afmeld in self._afmeld + self._timere:
            afmeld()
        self._afmeld.clear()
        self._timere.clear()
        if self._husk_senere is not None:
            self._husk_senere()
            self._husk_senere = None

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
            "husket": self.husket,
            "haendelser": list(self.haendelser),
            "kort": self.kort,
            "kort_opdateret": self.kort_opdateret,
        }

    @callback
    def saet_kort(self, kort: dict[str, list[str] | None], lys: list[str]) -> None:
        """Kortenes lamper, som sidepanelet gemmer dem — målt mod rummets lamper, som de gemmes samtidig."""
        nye = {kort_id: _kortets_lamper(lamper, lys) for kort_id, lamper in kort.items()}
        if nye != self.kort:
            self.kort = nye
            self.kort_opdateret = dt_util.utcnow().isoformat()
            self._opdater()

    @callback
    def nye_kort(self, kort: dict[str, list[str] | None]) -> None:
        """Kort, sidepanelet har fundet for første gang. Et kort, rummet kender, røres ikke."""
        nye = {
            kort_id: _kortets_lamper(lamper, self.lys)
            for kort_id, lamper in kort.items()
            if kort_id not in self.kort
        }
        if nye:
            self.kort |= nye
            self.kort_opdateret = dt_util.utcnow().isoformat()
            self._opdater()

    @callback
    def saet(self, noegle: str, vaerdi: float) -> None:
        """En af tiderne er ændret. Den gælder fra næste nedtælling."""
        self.indstillinger[noegle] = vaerdi
        self._opdater()

    @callback
    def hold_til(self, lamper: list[str] | None = None) -> None:
        """Hold lyset tændt i hold-tiden. Holdet gælder hele rummet — rummet har én tilstand — men er lyset
        slukket, tændes kun `lamper`, når det kommer fra et kort for nogle af lamperne."""
        self.hold_slutter = dt_util.utcnow() + timedelta(
            hours=self.indstillinger[HOLD_TID]
        )
        self.slukker = None
        if self.kilde is None:
            self.kilde = HAAND
            maal = self.lamperne(lamper) if lamper else self.foelger
            husket = self._husket_lys()
            if husket is None or not self._gendan(husket, maal):
                self._kald("turn_on", {}, maal)
        self._log("hold_til")
        self._opdater()

    @callback
    def hold_fra(self, udloebet: bool = False) -> None:
        """Tilbage til sensoren: uden bevægelse slukker lyset efter «sluk efter bevægelse»."""
        if self.hold_slutter is None:
            return
        self.hold_slutter = None
        if self.kilde is not None and not self.bevaegelse:
            self.slukker = self._frist(BEVAEGELSE if self.sensorer else HAAND)
        self._log("hold_udloebet" if udloebet else "hold_fra")
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
        elif self.bevaegelse:
            # Bevægelse stopper nedtællingen — også en, der er gemt fra før en genstart.
            self.slukker = None
        elif self.hold_slutter is None and self.slukker is None:
            self.slukker = self._frist(self.kilde)
        self._opdater()

    @callback
    def _nulstil(self) -> None:
        self.kilde = self.slukker = self.hold_slutter = None
        self._sidst_taendt = None
        self._opdater()

    @callback
    def _sensor_aendret(self, event: Event[EventStateChangedData]) -> None:
        bevaegelse = self._sensor_taendt()
        ny_tilstand = event.data["new_state"]
        udloeser = event.data["entity_id"] if ny_tilstand is not None and ny_tilstand.state == STATE_ON else None
        if bevaegelse == self.bevaegelse:
            # En anden sensor i rummet ser nogen: har den sine egne lamper, tændes de med.
            if bevaegelse and udloeser and self.kilde == BEVAEGELSE and self.hold_slutter is None:
                self._taend_med_sensor(udloeser, kun_slukkede=True)
            return
        self.bevaegelse = bevaegelse
        if self.hold_slutter is not None:
            return
        if bevaegelse:
            if self.kilde is None:
                self.kilde = BEVAEGELSE
                self._taend_ved_bevaegelse(udloeser)
            # Bevægelse stopper nedtællingen — også når lyset er valgt i hånden.
            self.slukker = None
        elif self.kilde is not None:
            self.slukker = self._frist(self.kilde)
        self._opdater()

    def _sensorens_lamper(self, sensor: str | None) -> list[str]:
        """Lamperne, en sensor tænder: dens egne, ellers alle rummets, der tænder ved bevægelse."""
        return self.sensor_lamper.get(sensor or "") or self.foelger

    @callback
    def _taend_med_sensor(self, sensor: str, kun_slukkede: bool = False) -> None:
        """Sensorens egne lamper, mens rummet allerede er tændt af bevægelse. Kun for rum, hvor sensorerne
        har hver deres lamper — ellers er der intet nyt at tænde."""
        if sensor not in self.sensor_lamper:
            return
        lamper = [
            entity_id
            for entity_id in self._sensorens_lamper(sensor)
            if not kun_slukkede or (t := self.hass.states.get(entity_id)) is None or t.state != STATE_ON
        ]
        if not lamper:
            return
        self._sidst_taendt = sorted({*(self._sidst_taendt or []), *lamper}, key=self.lys.index)
        self._anvend(self._scenarie(), lamper)
        self._log("taendt", lys="sensor")

    @callback
    def _taend_ved_bevaegelse(self, sensor: str | None = None) -> None:
        lamper = self._sensorens_lamper(sensor)
        self._sidst_taendt = lamper
        husket = self._husket_lys()
        if husket is not None and self._gendan(husket, lamper):
            self._log("taendt", lys="husket")
            return
        tidsrum = self.aktivt_tidsrum()
        self._anvend(self._scenarie(), lamper)
        if tidsrum is not None:
            self._log("taendt", lys="tidsrum", navn=tidsrum[CONF_NAVN])
        else:
            self._log("taendt", lys="rummet")

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
                self._log("slukket_i_haanden")
                self._nulstil()
            return
        if _aftryk(gammel) == _aftryk(ny) or self._egen(ny.context):
            return
        self.valgt_i_haanden()

    def lamperne(self, lamper: list[str] | None) -> list[str]:
        """Rummets lamper — eller dem af dem, et kort for nogle af lamperne har valgt."""
        if not lamper:
            return self.lys
        return [entity_id for entity_id in self.lys if entity_id in lamper]

    @callback
    def anvend_lys(self, lys: dict[str, Any], lamper: list[str] | None = None) -> None:
        """Nogen har valgt et lys til rummet — på kortet, i sidepanelet eller i en automatisering."""
        self._anvend(lys, self.lamperne(lamper))
        self.valgt_i_haanden()

    @callback
    def daemp(self, procent: int, lamper: list[str] | None = None) -> None:
        """Lamperne i samme forhold: den lyseste lampe får procenten, og de andre følger med."""
        valgte = self.lamperne(lamper)
        if procent <= 0:
            self._kald("turn_off", {}, valgte)
            if self._taendt_uden_for(valgte):
                # Rummet lyser stadig med sine andre lamper.
                return
            if self.kilde is not None:
                self._log("slukket_i_haanden")
            self._nulstil()
            return
        taendte = {
            entity_id: tilstand.attributes.get("brightness") or 255
            for entity_id in valgte
            if (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
        }
        if not taendte:
            # Slukket: lamperne tænder med deres egen farve, ved den valgte lysstyrke.
            self._kald("turn_on", {"brightness_pct": procent}, self.foelger if not lamper else valgte)
        else:
            faktor = procent * 255 / 100 / max(taendte.values())
            kontekst: Context | None = None
            for entity_id, lysstyrke in taendte.items():
                kontekst = self._kald(
                    "turn_on",
                    {"brightness": max(1, min(255, round(lysstyrke * faktor)))},
                    [entity_id],
                    kontekst,
                )
        self.valgt_i_haanden()

    def status(self) -> dict[str, Any]:
        """Hvad rummet gør lige nu — til sidepanelet."""
        tidsrum = self.aktivt_tidsrum()
        return {
            "tilstand": self.tilstand,
            "slukker": self.slukker and self.slukker.isoformat(),
            "hold_slutter": self.hold_slutter and self.hold_slutter.isoformat(),
            "bevaegelse": self.bevaegelse,
            "tidsrum": tidsrum[CONF_NAVN] if tidsrum else None,
            "husket": self._husket_lys() is not None,
            "indstillinger": dict(self.indstillinger),
            "haendelser": list(self.haendelser),
        }

    @callback
    def valgt_i_haanden(self) -> None:
        """Nogen har selv valgt lyset — på kortet, med en scene, i appen eller på væggen."""
        if self.kilde != HAAND:
            self._log("valgt")
        self.kilde = HAAND
        if self.hold_slutter is None:
            self.slukker = None if self.bevaegelse else self._frist(HAAND)
        if self._husk_senere is not None:
            self._husk_senere()
        self._husk_senere = async_call_later(self.hass, HUSK_EFTER, self._husk)
        self._opdater()

    @callback
    def _husk(self, _nu: datetime | None = None) -> None:
        self._husk_senere = None
        lamper = {
            entity_id: _gengivelse(tilstand)
            for entity_id in self.lys
            if (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state not in UKENDT
        }
        if not any(lampe["state"] == STATE_ON for lampe in lamper.values()):
            return
        til = self._naeste_skift()
        self.husket = {"lamper": lamper, "til": til and til.isoformat()}
        # Kun gem: nedtællingerne er ikke ændret og skal ikke sættes forfra.
        self._gem()

    def _husket_lys(self) -> dict[str, dict[str, Any]] | None:
        """Det sidst valgte lys — hvis det er valgt i det tidsrum, klokken er i nu."""
        if not self.husket:
            return None
        til = _tidspunkt(self.husket.get("til"))
        if til is not None and dt_util.utcnow() >= til:
            self.husket = None
            return None
        return self.husket["lamper"]

    def _naeste_skift(self) -> datetime | None:
        """Næste gang et andet tidsrum tager over. None, når det aldrig sker."""
        if not self.tidsrum:
            return None
        nu = dt_util.now()
        tider = {t[k] for t in self.tidsrum for k in (CONF_START, CONF_SLUT)}
        # Tidsrummene gentager sig hver uge, så otte dage frem er nok.
        kandidater = sorted(
            skift
            for dag in range(8)
            for tid in tider
            if (skift := datetime.combine(nu.date() + timedelta(days=dag), tid, nu.tzinfo)) > nu
        )
        for skift in kandidater:
            if self.tidsrum_ved(skift) is not self.tidsrum_ved(skift - timedelta(seconds=1)):
                return dt_util.as_utc(skift)
        return None

    @callback
    def _tidsrum_skifter(self, nu: datetime) -> None:
        """Et nyt tidsrum begynder med sit eget lys. Lys tændt af bevægelse skifter med det."""
        tidsrum = self.tidsrum_ved(dt_util.as_local(nu))
        if tidsrum is self._aktivt:
            # Klokkeslættet skifter kun på andre dage, eller tidsrummet fortsætter over midnat.
            return
        self._aktivt = tidsrum
        self.husket = None
        self._log("tidsrum", navn=tidsrum[CONF_NAVN] if tidsrum else None)
        if self.kilde == BEVAEGELSE and self.hold_slutter is None:
            self._anvend(tidsrum[CONF_LYS] if tidsrum else self.standard, self._sidst_taendt or self.foelger)
        self._opdater()

    @callback
    def _slukketid(self, _nu: datetime) -> None:
        self._log("slukket", kilde=self.kilde)
        self._sluk()
        self._nulstil()

    @callback
    def _hold_udloebet(self, _nu: datetime) -> None:
        self.hold_fra(udloebet=True)

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

    @callback
    def _log(self, hvad: str, **detaljer: Any) -> None:
        self.haendelser.append(
            {"tid": dt_util.utcnow().isoformat(), "hvad": hvad} | detaljer
        )

    def _scenarie(self) -> dict[str, Any]:
        tidsrum = self.aktivt_tidsrum()
        return tidsrum[CONF_LYS] if tidsrum else self.standard

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

    def _taendt_uden_for(self, lamper: list[str]) -> bool:
        """Om en af rummets andre lamper er tændt."""
        return any(
            (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
            for entity_id in self.lys
            if entity_id not in lamper
        )

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
    def _anvend(self, lys: dict[str, Any], lamper: list[str]) -> None:
        """Tænd lamperne med et lysvalg. En scene giver hver lampe sit eget lys."""
        scene = self._katalog.get(lys.get(CONF_SCENE)) if lys.get(CONF_TYPE) == LYS_SCENE else None
        if scene is None:
            self._kald("turn_on", _lysdata(lys), lamper)
            return
        kontekst: Context | None = None
        for ids, data in scener.kommandoer(self.hass, scene, lamper, lys.get(CONF_LYSSTYRKE)):
            kontekst = self._kald("turn_on", data, ids, kontekst)

    @callback
    def _gendan(self, husket: dict[str, dict[str, Any]], lamper: list[str]) -> bool:
        """Tænd lamperne, som de var, da lyset blev husket. False, hvis ingen af dem var tændt."""
        kontekst: Context | None = None
        for entity_id in lamper:
            lampe = husket.get(entity_id)
            if not lampe or lampe["state"] != STATE_ON:
                continue
            data = {k: v for k, v in lampe.items() if k != "state"}
            kontekst = self._kald("turn_on", data, [entity_id], kontekst)
        return kontekst is not None

    @callback
    def _sluk(self) -> None:
        self._kald("turn_off", {}, self.lys)

    @callback
    def _kald(
        self,
        tjeneste: str,
        data: dict[str, Any],
        lamper: list[str],
        kontekst: Context | None = None,
    ) -> Context:
        if kontekst is None:
            kontekst = Context()
            self._egne.append(kontekst.id)
        self._sidste_kommando = dt_util.utcnow()
        data = dict(data)
        data[ATTR_ENTITY_ID] = list(lamper)
        if self.overgang:
            data["transition"] = self.overgang
        self.hass.async_create_task(
            self.hass.services.async_call("light", tjeneste, data, context=kontekst),
            f"rumlys {self.navn} {tjeneste}",
        )
        return kontekst


def _kortets_lamper(lamper: list[str] | None, lys: list[str]) -> list[str] | None:
    """Rummets lamper blandt de valgte, i rummets rækkefølge. En tom liste er hele rummet — ligesom alle lamperne —
    og None er ingen lamper: et kort, der deler fanen med et andet kort for rummet og ikke har fået lamper endnu.
    Er ingen af de valgte lamper i rummet længere, viser kortet ingen, ikke hele rummet."""
    if lamper is None:
        return None
    if not lamper:
        return []
    valgte = [entity_id for entity_id in lys if entity_id in lamper]
    if not valgte:
        return None
    return [] if len(valgte) == len(lys) else valgte


def _lysdata(lys: dict[str, Any]) -> dict[str, Any]:
    """Et lysvalg som data til light.turn_on. En scene, der ikke findes, tænder kun med lysstyrken."""
    data: dict[str, Any] = {}
    if lys.get(CONF_LYSSTYRKE) is not None:
        data["brightness_pct"] = lys[CONF_LYSSTYRKE]
    if lys.get(CONF_TYPE) == LYS_HVID and lys.get(CONF_KELVIN):
        data["color_temp_kelvin"] = lys[CONF_KELVIN]
    elif lys.get(CONF_TYPE) == LYS_FARVE and lys.get(CONF_FARVE):
        data["hs_color"] = list(lys[CONF_FARVE])
    return data


def _gengivelse(tilstand: State) -> dict[str, Any]:
    """Det ved lampen, der skal til for at tænde den på samme måde igen."""
    if tilstand.state != STATE_ON:
        return {"state": "off"}
    attributter = tilstand.attributes
    lampe: dict[str, Any] = {"state": STATE_ON}
    if attributter.get("brightness") is not None:
        lampe["brightness"] = attributter["brightness"]
    farve = FARVEATTRIBUT.get(attributter.get("color_mode"))
    if farve and attributter.get(farve) is not None:
        vaerdi = attributter[farve]
        lampe[farve] = list(vaerdi) if isinstance(vaerdi, (list, tuple)) else vaerdi
    return lampe


def _inden_for(tidspunkt: datetime, tidsrum: dict[str, Any]) -> bool:
    start, slut, dage = tidsrum[CONF_START], tidsrum[CONF_SLUT], tidsrum[CONF_DAGE]
    klokken = tidspunkt.time()
    if start < slut:
        return tidspunkt.weekday() in dage and start <= klokken < slut
    # Hen over midnat, eller et helt døgn: efter midnat hører til dagen før.
    return (tidspunkt.weekday() in dage and klokken >= start) or (
        (tidspunkt.weekday() - 1) % 7 in dage and klokken < slut
    )


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
