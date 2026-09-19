"""Lyset i ét rum: bevægelse, de to sluk-tider, «hold lys», tidsrum og det sidst brugte lys.

Rummet er delt i **automatikker** (fra 0.7.0). En automatik er en gruppe af rummets lamper, der
opfører sig ens: den har sine egne sensorer, sit eget lys, sin egen tidsplan, sine egne sluk-tider
— og sin egen nedtælling. **En lampe hører til én automatik**, og det er dét, der gør, at to
aldrig kan trække i den samme pære. En lampe uden automatik gør kun det, nogen selv beder om.

Hver automatik har én kilde ad gangen: tændt af bevægelse, valgt i hånden, eller slukket. «Hold
lys» ligger ovenpå og sætter sensoren og nedtællingen ud af spil. Vælger nogen selv lyset, husker
automatikken det, til et andet tidsrum tager over, og bevægelse tænder så med det.

Rummets egen tilstand er en opsummering af automatikkernes: den højeste af dem.

Et tidsrum gælder på sine ugedage. Går det over midnat, hører det til den dag, det begynder, og
samme klokkeslæt i start og slut er et helt døgn. Uden for tidsrummene gælder automatikkens lys.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from functools import partial
from datetime import datetime, time, timedelta
from typing import Any

from homeassistant.components.light import LightEntityFeature
from homeassistant.config_entries import ConfigSubentry
from homeassistant.const import (
    ATTR_ENTITY_ID,
    ATTR_SUPPORTED_FEATURES,
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
    AUT_ID,
    AUT_LAMPER,
    AUT_LYS,
    AUT_OVERGANG,
    AUT_SENSORER,
    AUT_TIDSRUM,
    BEVAEGELSE,
    CONF_AUTOMATIK,
    CONF_BEVAEGELSE,
    CONF_DAGE,
    CONF_ENTITY_ID,
    CONF_FARVE,
    CONF_KELVIN,
    CONF_KNAP_MAAL,
    CONF_KNAPPER,
    CONF_KORT,
    CONF_LAMPER,
    CONF_LYS,
    CONF_LYSSTYRKE,
    CONF_NAVN,
    CONF_OMRAADE,
    CONF_OVERGANG,
    CONF_SCENE,
    CONF_SCENER,
    CONF_IKON,
    CONF_SENSORER,
    CONF_SENSOR_LAMPER,
    CONF_SLUK_EFTER,
    CONF_SLUT,
    CONF_START,
    CONF_TIDSRUM,
    CONF_TYPE,
    DAEMP_OVERGANG,
    DAEMP_PAUSE,
    DAEMP_SKRIDT,
    DAEMP_VEND,
    EKKO_VINDUE,
    HAAND,
    HAENDELSER,
    HOLD,
    HOLD_TID,
    HUSK_EFTER,
    KNAP_DOBBELT,
    KNAP_HOLD,
    KORT_IKON,
    KORT_LAMPER,
    KORT_UNDTAGEN,
    KORT_SCENER,
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
from .omraade import lamper_og_sensorer, omraadets_navn

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


@dataclass
class _Tryk:
    """Hvad der er i gang på én vægknap. En IHC-knap melder «on», mens den er nede."""

    hold: CALLBACK_TYPE | None = None  # timeren, der gør trykket til et hold
    vent: CALLBACK_TYPE | None = None  # timeren, der venter på et dobbeltklik
    skridt: CALLBACK_TYPE | None = None  # timeren til næste skridt i dæmpningen
    daemper: int | None = None  # lysstyrken i procent, mens knappen dæmper
    retning: int = 0
    brugt: bool = False  # trykket er gået til et dobbeltklik eller en dæmpning; slippet gør intet

    def stop(self) -> None:
        for timer in (self.hold, self.vent, self.skridt):
            if timer is not None:
                timer()
        self.hold = self.vent = self.skridt = None
        self.daemper = None


@callback
def rummets_lamper(hass: HomeAssistant, data: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Rummets lamper: alle områdets, plus dem der står i opsætningen og ikke er der længere.

    Ingen skal vælge dem til (Martins ønske 19-09-2026): er en lampe i rummet, er den en
    mulighed. En lampe, der kommer til i området, er derfor med efter næste indlæsning uden at
    nogen har gemt rummet — men den lander i ingen automatik og gør derfor kun det, nogen selv
    beder om, til den bliver lagt i en.

    Det gemte kastes ikke væk. Lamper valgt fra et andet område, dengang det kunne lade sig gøre,
    bliver ved med at være med, og «tænder ved bevægelse» på en lampe huskes.
    """
    gemte = list(data.get(CONF_LAMPER, []))
    omraade = data.get(CONF_OMRAADE)
    if not omraade:
        return gemte
    kendte = {lampe[CONF_ENTITY_ID] for lampe in gemte}
    fra_omraadet, _ = lamper_og_sensorer(hass, omraade)
    return gemte + [
        {CONF_ENTITY_ID: entity_id, CONF_BEVAEGELSE: True}
        for entity_id in fra_omraadet
        if entity_id not in kendte
    ]


def automatikkerne(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Automatikkerne i rummets opsætning — eller den ene, et rum fra før 0.7.0 svarer til.

    Skemaet folder den samme vej, når sidepanelet gemmer. Det skal også ske her, for et rum, der
    har ligget i lageret siden 0.6.x, kommer aldrig forbi skemaet igen af sig selv.
    """
    if data.get(CONF_AUTOMATIK):
        return list(data[CONF_AUTOMATIK])
    return [
        {
            AUT_ID: 1,
            AUT_LAMPER: [lampe[CONF_ENTITY_ID] for lampe in data.get(CONF_LAMPER, [])],
            AUT_SENSORER: list(data.get(CONF_SENSORER, [])),
            AUT_LYS: data.get(CONF_LYS) or dict(STANDARD_LYS),
            AUT_OVERGANG: data.get(CONF_OVERGANG, 0),
            AUT_TIDSRUM: data.get(CONF_TIDSRUM, []),
        }
    ]


class Automatik:
    """En gruppe af rummets lamper, der opfører sig ens — med sin egen nedtælling.

    Automatikken ejer sine lamper: ingen anden automatik rører dem. Derfor kan den have sin egen
    kilde, sin egen tidsplan og sine egne tider uden at skulle blive enig med nogen.
    """

    def __init__(self, rum: "Rum", data: dict[str, Any], gemt: dict[str, Any]) -> None:
        self.rum = rum
        self.id: int = data[AUT_ID]
        # Lamperne i rummets rækkefølge, så to automatikker viser dem ens.
        valgte = set(data.get(AUT_LAMPER) or [])
        self.lys: list[str] = [l for l in rum.lys if l in valgte]
        # Dem af dem, bevægelse tænder. En lampe kan høre til automatikken og slukke med den uden
        # selv at tænde — det er rummets gamle «tænder ved bevægelse», og den holder.
        self.foelger: list[str] = [l for l in self.lys if l in rum.bevaegelseslamper]
        self.sensorer: list[str] = [s for s in data.get(AUT_SENSORER) or [] if s in rum.sensorer]
        self.standard: dict[str, Any] = data.get(AUT_LYS) or dict(STANDARD_LYS)
        self.overgang: float = data.get(AUT_OVERGANG, 0)
        self.tidsrum = [
            t
            | {
                CONF_START: time.fromisoformat(t[CONF_START]),
                CONF_SLUT: time.fromisoformat(t[CONF_SLUT]),
                CONF_DAGE: frozenset(t.get(CONF_DAGE, ALLE_DAGE)),
            }
            for t in data.get(AUT_TIDSRUM, [])
        ]
        self.indstillinger = STANDARD_INDSTILLINGER | (gemt.get("indstillinger") or {})
        self.kilde: str | None = gemt.get("kilde")
        self.slukker = _tidspunkt(gemt.get("slukker"))
        self.hold_slutter = _tidspunkt(gemt.get("hold_slutter"))
        self.husket: dict[str, Any] | None = gemt.get("husket")
        # Tidsrummet, der gjaldt ved sidste skift — et klokkeslæt er ikke et skift alle dage.
        self._aktivt: dict[str, Any] | None = None
        # Lamperne, bevægelse sidst tændte — dem gælder et skift af tidsrum.
        self._sidst_taendt: list[str] | None = None
        self.bevaegelse = False
        # Nedtællingerne efter navn: tidspunktet og afmeldingen. Tidspunktet står der, så en
        # timer kan få lov at blive stående, når den skal fyre på præcis det samme klokkeslæt.
        self._timere: dict[str, tuple[datetime, CALLBACK_TYPE]] = {}
        self._husk_senere: CALLBACK_TYPE | None = None

    @property
    def hass(self) -> HomeAssistant:
        return self.rum.hass

    @property
    def tilstand(self) -> str:
        if self.hold_slutter is not None:
            return HOLD
        return self.kilde or SLUKKET

    @property
    def navn(self) -> str:
        """Automatikken hedder det, den styrer — som i sidepanelet."""
        navne = [self.rum.lampenavn(l) for l in self.lys]
        return ", ".join(navne) if navne else str(self.id)

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
        self._aktivt = self.aktivt_tidsrum()
        self.bevaegelse = self.sensor_taendt()
        self.synk()

    @callback
    def stop(self) -> None:
        for _, afmeld in self._timere.values():
            afmeld()
        self._timere.clear()
        if self._husk_senere is not None:
            self._husk_senere()
            self._husk_senere = None

    def til_lagring(self) -> dict[str, Any]:
        return {
            "indstillinger": self.indstillinger,
            "kilde": self.kilde,
            "slukker": self.slukker and self.slukker.isoformat(),
            "hold_slutter": self.hold_slutter and self.hold_slutter.isoformat(),
            "husket": self.husket,
        }

    @callback
    def saet(self, noegle: str, vaerdi: float) -> None:
        """En af tiderne er ændret. Den gælder fra næste nedtælling."""
        self.indstillinger[noegle] = vaerdi
        self.opdater()

    @callback
    def hold_til(self, lamper: list[str] | None = None) -> None:
        """Hold lyset tændt i hold-tiden. Holdet gælder hele automatikken — den har én tilstand —
        men er lyset slukket, tændes kun `lamper`, når det kommer fra et kort for nogle af dem."""
        self.hold_slutter = dt_util.utcnow() + timedelta(hours=self.indstillinger[HOLD_TID])
        self.slukker = None
        if self.kilde is None:
            self.kilde = HAAND
            maal = [l for l in (lamper or []) if l in self.lys] or self.foelger or self.lys
            husket = self.husket_lys()
            if husket is None or not self.rum._gendan(husket, maal):
                self.rum._kald("turn_on", {}, maal)
        self.rum._log("hold_til", automatik=self.id)
        self.opdater()

    @callback
    def hold_fra(self, udloebet: bool = False) -> None:
        """Tilbage til sensoren: uden bevægelse slukker lyset efter «sluk efter bevægelse»."""
        if self.hold_slutter is None:
            return
        self.hold_slutter = None
        if self.kilde is not None and not self.bevaegelse:
            self.slukker = self.frist(BEVAEGELSE if self.sensorer else HAAND)
        self.rum._log("hold_udloebet" if udloebet else "hold_fra", automatik=self.id)
        self.opdater()

    @callback
    def synk(self) -> None:
        """Ret tilstanden ind efter lyset, som det er — ved start, og når en lampe dukker op igen."""
        taendt = self.lys_status()
        if taendt is None:
            return
        if not taendt:
            self.nulstil()
            return
        if self.kilde is None:
            self.kilde = HAAND
            self.slukker = None if self.bevaegelse else self.frist(HAAND)
        elif self.bevaegelse:
            # Bevægelse stopper nedtællingen — også en, der er gemt fra før en genstart.
            self.slukker = None
        elif self.hold_slutter is None and self.slukker is None:
            self.slukker = self.frist(self.kilde)
        self.opdater()

    @callback
    def nulstil(self) -> None:
        self.kilde = self.slukker = self.hold_slutter = None
        self._sidst_taendt = None
        self.opdater()

    @callback
    def sensor_aendret(self, udloeser: str | None) -> None:
        """En af automatikkens sensorer har skiftet. `udloeser` er den, der netop ser nogen."""
        bevaegelse = self.sensor_taendt()
        if bevaegelse == self.bevaegelse:
            return
        self.bevaegelse = bevaegelse
        if self.hold_slutter is not None:
            return
        if bevaegelse:
            if self.kilde is None:
                self.kilde = BEVAEGELSE
                self.taend_ved_bevaegelse()
            # Bevægelse stopper nedtællingen — også når lyset er valgt i hånden.
            self.slukker = None
        elif self.kilde is not None:
            self.slukker = self.frist(self.kilde)
        self.opdater()

    @callback
    def taend_ved_bevaegelse(self) -> None:
        lamper = self.foelger
        if not lamper:
            return
        self._sidst_taendt = lamper
        husket = self.husket_lys()
        if husket is not None and self.rum._gendan(husket, lamper):
            self.rum._log("taendt", lys="husket", automatik=self.id)
            return
        tidsrum = self.aktivt_tidsrum()
        self.rum._anvend(self.scenarie(), lamper)
        if tidsrum is not None:
            self.rum._log("taendt", lys="tidsrum", navn=tidsrum[CONF_NAVN], automatik=self.id)
        else:
            self.rum._log("taendt", lys="automatik", automatik=self.id)

    @callback
    def valgt_i_haanden(self) -> None:
        """Nogen har selv valgt lyset — på kortet, med en scene, i appen eller på væggen."""
        if self.kilde != HAAND:
            self.rum._log("valgt", automatik=self.id)
        self.kilde = HAAND
        if self.hold_slutter is None:
            self.slukker = None if self.bevaegelse else self.frist(HAAND)
        if self._husk_senere is not None:
            self._husk_senere()
        self._husk_senere = async_call_later(self.hass, HUSK_EFTER, self._husk)
        self.opdater()

    @callback
    def _husk(self, _nu: datetime | None = None) -> None:
        """Gem lyset, lampe for lampe, så bevægelse kan tænde med det igen — indtil næste tidsrum."""
        self._husk_senere = None
        lamper = {}
        for entity_id in self.lys:
            tilstand = self.hass.states.get(entity_id)
            if tilstand is None or tilstand.state in UKENDT:
                continue
            lamper[entity_id] = _gengivelse(tilstand)
        til = self.naeste_skift()
        self.husket = {"lamper": lamper, "til": til and til.isoformat()}
        self.opdater()

    @staticmethod
    def _navn_paa(tidsrum: dict[str, Any] | None) -> str | None:
        return tidsrum[CONF_NAVN] if tidsrum else None

    def husket_lys(self) -> dict[str, dict[str, Any]] | None:
        """Det sidst valgte lys, hvis et nyt tidsrum ikke har gjort det forældet."""
        if not self.husket:
            return None
        til = _tidspunkt(self.husket.get("til"))
        if til is not None and dt_util.utcnow() >= til:
            self.husket = None
            return None
        return self.husket["lamper"]

    def naeste_skift(self) -> datetime | None:
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
    def tidsrum_skifter(self, nu: datetime) -> None:
        """Et nyt tidsrum begynder med sit eget lys. Lys tændt af bevægelse skifter med det."""
        tidsrum = self.tidsrum_ved(dt_util.as_local(nu))
        if tidsrum is self._aktivt:
            # Klokkeslættet skifter kun på andre dage, eller tidsrummet fortsætter over midnat.
            return
        self._aktivt = tidsrum
        self.husket = None
        self.rum._log("tidsrum", navn=self._navn_paa(tidsrum), automatik=self.id)
        if self.kilde == BEVAEGELSE and self.hold_slutter is None:
            self.rum._anvend(
                tidsrum[CONF_LYS] if tidsrum else self.standard, self._sidst_taendt or self.foelger
            )
        self.opdater()

    @callback
    def _slukketid(self, _nu: datetime) -> None:
        self.rum._log("slukket", kilde=self.kilde, automatik=self.id)
        self.rum._kald("turn_off", {}, self.lys)
        self.nulstil()

    @callback
    def _hold_udloebet(self, _nu: datetime) -> None:
        self.hold_fra(udloebet=True)

    @callback
    def opdater(self) -> None:
        """Sæt nedtællingerne efter tiderne, gem, og fortæl entiteterne det."""
        self._timer("slukker", self.slukker, self._slukketid)
        self._timer("hold", self.hold_slutter, self._hold_udloebet)
        self.rum._opdater()

    @callback
    def _timer(self, navn: str, tidspunkt: datetime | None, handling: Callable[[datetime], None]) -> None:
        """Sæt én nedtælling — og lad den stå, hvis den skal fyre på det samme klokkeslæt.

        Det er ikke kun for at spare arbejde: afmelder man en timer og sætter den samme igen i
        samme øjeblik, som den skulle fyre, når den det aldrig. Det skete hver gang, det huskede
        lys blev gemt fire sekunder efter, nogen selv havde valgt lyset.
        """
        staar = self._timere.get(navn)
        if staar is not None and staar[0] == tidspunkt:
            return
        if staar is not None:
            staar[1]()
            del self._timere[navn]
        if tidspunkt is not None:
            self._timere[navn] = (
                tidspunkt,
                async_track_point_in_utc_time(self.hass, handling, tidspunkt),
            )

    def scenarie(self) -> dict[str, Any]:
        tidsrum = self.aktivt_tidsrum()
        return tidsrum[CONF_LYS] if tidsrum else self.standard

    def frist(self, kilde: str) -> datetime | None:
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

    def lys_status(self) -> bool | None:
        """Om en af automatikkens lamper er tændt. None, hvis ingen af dem kan ses endnu."""
        kendte = [
            tilstand
            for entity_id in self.lys
            if (tilstand := self.hass.states.get(entity_id)) and tilstand.state not in UKENDT
        ]
        if not kendte:
            return None
        return any(tilstand.state == STATE_ON for tilstand in kendte)

    def sensor_taendt(self) -> bool:
        return any(
            (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
            for entity_id in self.sensorer
        )

    def status(self) -> dict[str, Any]:
        """Hvad automatikken gør lige nu — til sidepanelet."""
        tidsrum = self.aktivt_tidsrum()
        return {
            "id": self.id,
            "navn": self.navn,
            "tilstand": self.tilstand,
            "slukker": self.slukker and self.slukker.isoformat(),
            "hold_slutter": self.hold_slutter and self.hold_slutter.isoformat(),
            "bevaegelse": self.bevaegelse,
            "tidsrum": tidsrum[CONF_NAVN] if tidsrum else None,
            "husket": self.husket_lys() is not None,
            "indstillinger": dict(self.indstillinger),
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
        lamper = rummets_lamper(hass, data)
        self.lys: list[str] = [lampe[CONF_ENTITY_ID] for lampe in lamper]
        # Lamperne, bevægelse tænder. De andre hører til deres automatik og slukker med den.
        self.bevaegelseslamper: list[str] = [
            lampe[CONF_ENTITY_ID] for lampe in lamper if lampe.get(CONF_BEVAEGELSE, True)
        ]
        self.sensorer: list[str] = list(data.get(CONF_SENSORER, []))
        # Vægknapperne og hvad hver af dem styrer: et kort eller bestemte lamper. Uden valg hele rummet.
        self.knapper: list[str] = list(data.get(CONF_KNAPPER, []))
        self.knap_maal: dict[str, dict[str, Any]] = {
            knap: maal
            for knap, maal in (data.get(CONF_KNAP_MAAL) or {}).items()
            if knap in self.knapper
        }
        self._knaptryk: dict[str, _Tryk] = {}
        # Rummets scener findes kun som det, gamle kort arver ved opgraderingen. Kortene ejer dem nu.
        self.scener: list[str] = list(data.get(CONF_SCENER, []))
        # Automatikkerne. Et rum fra før 0.7.0 har sin tilstand liggende fladt i lageret; den
        # bliver til den ene automatiks, præcis som opsætningen bliver til den ene automatik.
        gemt_aut = gemt.get("automatik") or {
            "1": {n: gemt.get(n) for n in ("indstillinger", "kilde", "slukker", "hold_slutter", "husket")}
        }
        self.automatik: list[Automatik] = [
            Automatik(self, aut, gemt_aut.get(str(aut[AUT_ID])) or {})
            for aut in automatikkerne(data)
        ]
        self.haendelser: deque[dict[str, Any]] = deque(
            gemt.get("haendelser", []), maxlen=HAENDELSER
        )
        # Kortene på betjeningspanelerne efter id. Hvert kort har sine lamper (tom liste = hele
        # rummet), sine scener og sit ikon. Et kort, rummet ikke kender endnu, er nyt i sidepanelet.
        self.kort: dict[str, dict[str, Any]] = {
            kort_id: _kortet(vaerdi, data.get(CONF_SCENER, []), data.get(CONF_IKON))
            for kort_id, vaerdi in gemt.get("kort", {}).items()
        }
        # Hvornår kortene sidst er ændret. Står på tilstandssensoren, så et kort på en anden skærm henter rummet igen.
        self.kort_opdateret: str | None = gemt.get("kort_opdateret")
        self._gem = gem
        self._lyttere: list[Callable[[], None]] = []
        self._afmeld: list[CALLBACK_TYPE] = []
        self._egne: deque[str] = deque(maxlen=20)
        self._sidste_kommando: datetime | None = None

    @property
    def navn(self) -> str:
        """Områdets navn; rummet følger med, hvis området omdøbes."""
        return omraadets_navn(self.hass, self.omraade) or self._titel

    def lampenavn(self, entity_id: str) -> str:
        """Lampens navn, som Home Assistant viser det."""
        tilstand = self.hass.states.get(entity_id)
        return (tilstand and tilstand.name) or entity_id

    def automatik_for(self, lampe: str) -> Automatik | None:
        """Automatikken, en lampe hører til. None: den gør kun det, nogen selv beder om."""
        for aut in self.automatik:
            if lampe in aut.lys:
                return aut
        return None

    def automatikker_for(self, lamper: list[str] | None) -> list[Automatik]:
        """Automatikkerne bag et sæt lamper — rummets alle, når der ikke er valgt nogen."""
        if not lamper:
            return list(self.automatik)
        ud: list[Automatik] = []
        for lampe in lamper:
            aut = self.automatik_for(lampe)
            if aut is not None and aut not in ud:
                ud.append(aut)
        return ud

    @property
    def tilstand(self) -> str:
        """Rummets tilstand er den højeste af automatikkernes — en opsummering, ikke en sandhed
        om én ting. Holder én automatik lyset, holder rummet lyset."""
        tilstande = {aut.tilstand for aut in self.automatik}
        for hoejest in (HOLD, HAAND, BEVAEGELSE):
            if hoejest in tilstande:
                return hoejest
        return SLUKKET

    @property
    def slukker(self) -> datetime | None:
        """Den første nedtælling, der løber ud. Rummet er først slukket, når den sidste gør."""
        tider = [aut.slukker for aut in self.automatik if aut.slukker is not None]
        return max(tider) if tider else None

    @property
    def hold_slutter(self) -> datetime | None:
        tider = [aut.hold_slutter for aut in self.automatik if aut.hold_slutter is not None]
        return max(tider) if tider else None

    @property
    def bevaegelse(self) -> bool:
        return any(aut.bevaegelse for aut in self.automatik)

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
        if self.knapper:
            self._afmeld.append(
                async_track_state_change_event(self.hass, self.knapper, self._knap_aendret)
            )
        for aut in self.automatik:
            for tid in {t[k] for t in aut.tidsrum for k in (CONF_START, CONF_SLUT)}:
                self._afmeld.append(
                    async_track_time_change(
                        self.hass, aut.tidsrum_skifter, tid.hour, tid.minute, tid.second
                    )
                )
            aut.start()

    @callback
    def stop(self) -> None:
        for afmeld in self._afmeld:
            afmeld()
        self._afmeld.clear()
        for aut in self.automatik:
            aut.stop()
        for tryk in self._knaptryk.values():
            tryk.stop()
        self._knaptryk.clear()

    @callback
    def lyt(self, lytter: Callable[[], None]) -> CALLBACK_TYPE:
        self._lyttere.append(lytter)
        return lambda: self._lyttere.remove(lytter)

    def til_lagring(self) -> dict[str, Any]:
        return {
            "automatik": {str(aut.id): aut.til_lagring() for aut in self.automatik},
            "haendelser": list(self.haendelser),
            "kort": self.kort,
            "kort_opdateret": self.kort_opdateret,
        }

    @callback
    def saet_kort(self, kort: dict[str, Any], lys: list[str]) -> None:
        """Kortene, som sidepanelet gemmer dem — målt mod rummets lamper, som de gemmes samtidig."""
        nye = {kort_id: _kortet(vaerdi, [], None, lys) for kort_id, vaerdi in kort.items()}
        if nye != self.kort:
            self.kort = nye
            self.kort_opdateret = dt_util.utcnow().isoformat()
            self._opdater()

    @callback
    def nye_kort(self, kort: dict[str, Any]) -> None:
        """Kort, sidepanelet har fundet for første gang. Et kort, rummet kender, røres ikke."""
        nye = {
            kort_id: _kortet(vaerdi, [], None, self.lys)
            for kort_id, vaerdi in kort.items()
            if kort_id not in self.kort
        }
        if nye:
            self.kort |= nye
            self.kort_opdateret = dt_util.utcnow().isoformat()
            self._opdater()

    @callback
    def hold_til(self, lamper: list[str] | None = None) -> None:
        """Hold lyset tændt — i de automatikker, lamperne hører til. Uden valgte lamper: hele rummet."""
        for aut in self.automatikker_for(lamper):
            aut.hold_til(lamper)

    @callback
    def hold_fra(self, udloebet: bool = False) -> None:
        for aut in self.automatik:
            aut.hold_fra(udloebet)

    @callback
    def _sensor_aendret(self, event: Event[EventStateChangedData]) -> None:
        """Sensoren melder til de automatikker, den hører til — og kun dem."""
        sensor = event.data["entity_id"]
        ny_tilstand = event.data["new_state"]
        udloeser = sensor if ny_tilstand is not None and ny_tilstand.state == STATE_ON else None
        for aut in self.automatik:
            if sensor in aut.sensorer:
                aut.sensor_aendret(udloeser)

    # Vægknapperne. Et kort tryk tænder og slukker, et dobbeltklik slår «hold lys» til og fra, og
    # holdes knappen nede, dæmpes lyset op eller ned. Et enkelt tryk kan derfor først virke, når
    # dobbeltklik-vinduet er forbi — ellers ville første klik i et dobbeltklik nå at slukke lyset.

    def kortets_lamper(self, kort_id: str) -> list[str] | None:
        """Lamperne, et kort viser. Tom liste er hele rummet, og så er svaret None — «alle».

        Et kort for hele rummet kan have fravalgt enkelte lamper; så er svaret resten. Det er
        stadig «alt lys»: en ny lampe i området er med, uden at nogen retter kortet.
        """
        kortet = self.kort.get(kort_id) or {}
        if valgte := kortet.get(KORT_LAMPER):
            return valgte
        if undtagne := kortet.get(KORT_UNDTAGEN):
            return [lampe for lampe in self.lys if lampe not in undtagne] or None
        return None

    def _knappens_lamper(self, knap: str) -> list[str] | None:
        """Lamperne, en knap styrer. None er hele rummet — også når kortet er væk eller står tomt:
        en knap på væggen skal altid gøre noget."""
        maal = self.knap_maal.get(knap)
        if not maal:
            return None
        if CONF_LAMPER in maal:
            return self.lamperne(maal[CONF_LAMPER]) or None
        return self.kortets_lamper(maal[CONF_KORT])

    @callback
    def _knap_aendret(self, event: Event[EventStateChangedData]) -> None:
        ny = event.data["new_state"]
        gammel = event.data["old_state"]
        if ny is None or gammel is None or ny.state in UKENDT or gammel.state in UKENDT:
            # Knappen dukker op eller forsvinder. Det er ikke et tryk.
            return
        if ny.state == gammel.state:
            return
        knap = event.data["entity_id"]
        tryk = self._knaptryk.setdefault(knap, _Tryk())
        if ny.state == STATE_ON:
            self._knap_ned(knap, tryk)
        else:
            self._knap_op(knap, tryk)

    @callback
    def _knap_ned(self, knap: str, tryk: _Tryk) -> None:
        if tryk.vent is not None:
            tryk.vent()
            tryk.vent = None
            tryk.brugt = True
            self._knap_dobbelt(knap)
            return
        tryk.brugt = False
        tryk.hold = async_call_later(
            self.hass, KNAP_HOLD, partial(self._knap_holdes, knap, tryk)
        )

    @callback
    def _knap_op(self, knap: str, tryk: _Tryk) -> None:
        if tryk.hold is not None:
            tryk.hold()
            tryk.hold = None
        if tryk.daemper is not None:
            tryk.daemper = None
            if tryk.skridt is not None:
                tryk.skridt()
                tryk.skridt = None
            self.valgt_i_haanden()
        if tryk.brugt:
            tryk.brugt = False
            return
        tryk.vent = async_call_later(
            self.hass, KNAP_DOBBELT, partial(self._knap_enkelt, knap, tryk)
        )

    @callback
    def _knap_enkelt(self, knap: str, tryk: _Tryk, _nu: datetime | None = None) -> None:
        tryk.vent = None
        self.tryk(self._knappens_lamper(knap))

    @callback
    def tryk(self, lamper: list[str] | None = None) -> None:
        """Tænd lyset, eller sluk det igen. Lyser en af lamperne, slukker trykket dem alle."""
        maal = self.lamperne(lamper)
        if any(
            (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
            for entity_id in maal
        ):
            self.daemp(0, lamper)
            return
        # Hver automatik tænder sine egne lamper med sit eget lys — to kan have hver sin tidsplan.
        for aut in self.automatikker_for(maal):
            egne = [l for l in maal if l in aut.lys]
            if not egne:
                continue
            husket = aut.husket_lys()
            if husket is None or not self._gendan(husket, egne):
                self._anvend(aut.scenarie(), egne)
            aut.valgt_i_haanden()
        # Lamper uden automatik har intet lys at tænde med. De tændes, som de var.
        if frie := [l for l in maal if self.automatik_for(l) is None]:
            self._kald("turn_on", {}, frie)
        self._log("taendt", lys="knap")

    @callback
    def _knap_dobbelt(self, knap: str) -> None:
        """Dobbeltklik slår «hold lys» til og fra."""
        lamper = self._knappens_lamper(knap)
        beroerte = self.automatikker_for(self.lamperne(lamper))
        if any(aut.hold_slutter is not None for aut in beroerte):
            for aut in beroerte:
                aut.hold_fra()
        else:
            self.hold_til(lamper)
        self._blink(self.lamperne(lamper))

    @callback
    def _knap_holdes(self, knap: str, tryk: _Tryk, _nu: datetime | None = None) -> None:
        """Knappen har været nede længe nok: dæmp ned fra lyst lys, op fra dæmpet eller slukket."""
        tryk.hold = None
        # Trykket er gået til dæmpningen. Slippet må ikke også tælle som et enkelt tryk — så ville
        # en dæmpning helt ned til slukket tænde lyset igen, så snart knappen blev sluppet.
        tryk.brugt = True
        procent = self._lysstyrke(self.lamperne(self._knappens_lamper(knap)))
        tryk.retning = -1 if procent > DAEMP_VEND else 1
        tryk.daemper = procent
        self._daemp_skridt(knap, tryk)

    @callback
    def _daemp_skridt(self, knap: str, tryk: _Tryk, _nu: datetime | None = None) -> None:
        tryk.skridt = None
        if tryk.daemper is None:
            return
        tilstand = self.hass.states.get(knap)
        if tilstand is None or tilstand.state != STATE_ON:
            tryk.daemper = None
            self.valgt_i_haanden()
            return
        lamper = self._knappens_lamper(knap)
        procent = tryk.daemper + tryk.retning * DAEMP_SKRIDT
        if procent <= 0:
            # Det sidste skridt ned slukker, som knapperne gør det i dag.
            tryk.daemper = None
            self.daemp(0, lamper)
            return
        tryk.daemper = procent = min(100, procent)
        self.daemp(procent, lamper, overgang=DAEMP_OVERGANG, haand=False)
        if procent == 100:
            tryk.daemper = None
            self.valgt_i_haanden()
            return
        tryk.skridt = async_call_later(
            self.hass, DAEMP_PAUSE, partial(self._daemp_skridt, knap, tryk)
        )

    def _lysstyrke(self, lamper: list[str]) -> int:
        """Den lyseste lampes lysstyrke i procent. 0, hvis de alle er slukkede."""
        vaerdier = [
            tilstand.attributes.get("brightness") or 0
            for entity_id in lamper
            if (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
        ]
        return round(max(vaerdier, default=0) * 100 / 255)

    @callback
    def _blink(self, lamper: list[str]) -> None:
        """Kvittering for et dobbeltklik. Kun lamper, der lyser og kan blinke — ellers ville
        kvitteringen tænde lys, ingen har bedt om."""
        blinker = [
            entity_id
            for entity_id in lamper
            if (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
            and tilstand.attributes.get(ATTR_SUPPORTED_FEATURES, 0) & LightEntityFeature.FLASH
        ]
        if blinker:
            self._kald("turn_on", {"flash": "short"}, blinker, overgang=0)

    @callback
    def _lys_aendret(self, event: Event[EventStateChangedData]) -> None:
        gammel = event.data["old_state"]
        ny = event.data["new_state"]
        if ny is None or ny.state in UKENDT:
            return
        if gammel is None or gammel.state in UKENDT:
            if (aut := self.automatik_for(event.data["entity_id"])) is not None:
                aut.synk()
            return
        if ny.state != STATE_ON and gammel.state != STATE_ON:
            # En attribut på en slukket lampe. Den må ikke nulstille rummet, mens vores
            # egen tænd-kommando er undervejs.
            return
        aut = self.automatik_for(event.data["entity_id"])
        if aut is None:
            # Lampen hører ikke til nogen automatik. Så er der ingen tilstand at rette ind.
            return
        if not aut.lys_status():
            if aut.kilde is not None:
                self._log("slukket_i_haanden", automatik=aut.id)
                aut.nulstil()
            return
        if _aftryk(gammel) == _aftryk(ny) or self._egen(ny.context):
            return
        aut.valgt_i_haanden()

    def lamperne(self, lamper: list[str] | None) -> list[str]:
        """Rummets lamper — eller dem af dem, et kort for nogle af lamperne har valgt."""
        if not lamper:
            return self.lys
        return [entity_id for entity_id in self.lys if entity_id in lamper]

    @callback
    def anvend_lys(self, lys: dict[str, Any], lamper: list[str] | None = None) -> None:
        """Nogen har valgt et lys til rummet — på kortet, i sidepanelet eller i en automatisering."""
        valgte = self.lamperne(lamper)
        self._anvend(lys, valgte)
        self.valgt_i_haanden(valgte)

    @callback
    def daemp(
        self,
        procent: int,
        lamper: list[str] | None = None,
        overgang: float | None = None,
        haand: bool = True,
    ) -> None:
        """Lamperne i samme forhold: den lyseste lampe får procenten, og de andre følger med.

        Et skridt i en vægknaps dæmpning sætter sin egen korte overgang og lader være med at
        regne sig for et valg — ellers ville hvert skridt logge og sætte nedtællingen forfra."""
        valgte = self.lamperne(lamper)
        if procent <= 0:
            self._kald("turn_off", {}, valgte)
            # Hver automatik nulstilles, når ingen af dens egne lamper lyser mere.
            for aut in self.automatikker_for(valgte):
                if any(
                    (tilstand := self.hass.states.get(entity_id)) is not None
                    and tilstand.state == STATE_ON
                    for entity_id in aut.lys
                    if entity_id not in valgte
                ):
                    continue
                if aut.kilde is not None:
                    self._log("slukket_i_haanden", automatik=aut.id)
                aut.nulstil()
            return
        taendte = {
            entity_id: tilstand.attributes.get("brightness") or 255
            for entity_id in valgte
            if (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
        }
        if not taendte:
            # Slukket: lamperne tænder med deres egen farve, ved den valgte lysstyrke.
            self._kald(
                "turn_on",
                {"brightness_pct": procent},
                valgte,
                overgang=overgang,
            )
        else:
            faktor = procent * 255 / 100 / max(taendte.values())
            kontekst: Context | None = None
            for entity_id, lysstyrke in taendte.items():
                kontekst = self._kald(
                    "turn_on",
                    {"brightness": max(1, min(255, round(lysstyrke * faktor)))},
                    [entity_id],
                    kontekst,
                    overgang,
                )
        if haand:
            self.valgt_i_haanden(valgte)

    def status(self) -> dict[str, Any]:
        """Hvad rummet gør lige nu — til sidepanelet. Rummets egne tal er opsummeringer;
        det, der gælder hver gruppe lamper, står under «automatik»."""
        taendte = [
            entity_id
            for entity_id in self.lys
            if (tilstand := self.hass.states.get(entity_id)) is not None
            and tilstand.state == STATE_ON
        ]
        return {
            "tilstand": self.tilstand,
            "slukker": self.slukker and self.slukker.isoformat(),
            "hold_slutter": self.hold_slutter and self.hold_slutter.isoformat(),
            "bevaegelse": self.bevaegelse,
            "taendte": len(taendte),
            "lamper": len(self.lys),
            "uden_automatik": [l for l in self.lys if self.automatik_for(l) is None],
            "automatik": [aut.status() for aut in self.automatik],
            "haendelser": list(self.haendelser),
        }

    @callback
    def valgt_i_haanden(self, lamper: list[str] | None = None) -> None:
        """Nogen har selv valgt lyset — på kortet, med en scene, i appen eller på væggen."""
        for aut in self.automatikker_for(lamper):
            aut.valgt_i_haanden()
        self._opdater()

    @callback
    def _opdater(self) -> None:
        """Gem, og fortæl entiteterne det. Nedtællingerne hører til hver sin automatik."""
        self._gem()
        for lytter in list(self._lyttere):
            lytter()

    @callback
    def _log(self, hvad: str, **detaljer: Any) -> None:
        self.haendelser.append(
            {"tid": dt_util.utcnow().isoformat(), "hvad": hvad} | detaljer
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
    def _kald(
        self,
        tjeneste: str,
        data: dict[str, Any],
        lamper: list[str],
        kontekst: Context | None = None,
        overgang: float | None = None,
    ) -> Context:
        if kontekst is None:
            kontekst = Context()
            self._egne.append(kontekst.id)
        self._sidste_kommando = dt_util.utcnow()
        data = dict(data)
        data[ATTR_ENTITY_ID] = list(lamper)
        # Den bløde overgang hører til automatikken bag lamperne. Rammer kaldet flere automatikker,
        # gælder den førstes — de kaldes hver for sig alle de steder, det betyder noget.
        if overgang is None:
            aut = self.automatik_for(lamper[0]) if lamper else None
            overgang = aut.overgang if aut is not None else 0
        if (valgt := overgang):
            data["transition"] = valgt
        self.hass.async_create_task(
            self.hass.services.async_call("light", tjeneste, data, context=kontekst),
            f"rumlys {self.navn} {tjeneste}",
        )
        return kontekst


def _kortet(
    vaerdi: Any,
    scener: list[str],
    ikon: str | None,
    lys: list[str] | None = None,
) -> dict[str, Any]:
    """Et kort i lageret: lamper, scener og ikon.

    Fra 0.6.0 er et kort et opslag. Før var det bare lampelisten, og `None` betød «ingen lamper»,
    fordi to kort ikke måtte dele en lampe. Den regel er væk, så et gammelt kort bliver til hele
    rummet, og det arver rummets scener og ikon, som lå på rummet indtil nu."""
    if isinstance(vaerdi, dict):
        lamper = vaerdi.get(KORT_LAMPER) or []
        kortet = {
            KORT_LAMPER: list(lamper),
            # «Alt lys, undtagen ...»: lamper, kortet alligevel ikke viser. Kun meningsfuld, når
            # kortet er hele rummet — vælger man lamper til, er det dem, der gælder.
            KORT_UNDTAGEN: list(vaerdi.get(KORT_UNDTAGEN) or []),
            KORT_SCENER: list(vaerdi.get(KORT_SCENER) or []),
            KORT_IKON: vaerdi.get(KORT_IKON) or None,
        }
    else:
        kortet = {
            KORT_LAMPER: [] if vaerdi is None else list(vaerdi),
            KORT_UNDTAGEN: [],
            KORT_SCENER: list(scener),
            KORT_IKON: ikon,
        }
    if lys is not None:
        # Kun rummets lamper, i rummets rækkefølge. Er ingen af dem i rummet længere — eller er de
        # der alle — viser kortet hele rummet.
        valgte = [entity_id for entity_id in lys if entity_id in kortet[KORT_LAMPER]]
        kortet[KORT_LAMPER] = [] if len(valgte) == len(lys) else valgte
        # Et fravalg af en lampe, der ikke er i rummet længere, siger ikke noget.
        kortet[KORT_UNDTAGEN] = [e for e in lys if e in kortet[KORT_UNDTAGEN]]
    return kortet


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
