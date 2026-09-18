"""Konstanter for Rumlys."""

from datetime import timedelta

DOMAIN = "rumlys"

# Underopsætningens type: ét rum
RUM = "rum"

# Rummets opsætning
CONF_OMRAADE = "omraade"
CONF_LAMPER = "lamper"
CONF_SENSORER = "sensorer"
CONF_TILSTEDE = "tilstede"  # sensorerne, der ser tilstedeværelse; de andre ser kun bevægelse
CONF_SENSOR_LAMPER = "sensor_lamper"  # hvilke af rummets lamper hver sensor tænder; tom = alle
CONF_KNAPPER = "knapper"  # rummets vægknapper
# Hvad hver knap styrer: {"kort": id} eller {"lamper": [...]}. Uden valg hele rummet.
CONF_KNAP_MAAL = "knap_maal"
CONF_KORT = "kort"
CONF_LYS = "lys"  # rummets eget lys
CONF_OVERGANG = "overgang"
# Blød tænd og sluk i et nyt rum, når lamperne kan det.
STANDARD_OVERGANG = 3
CONF_TIDSRUM = "tidsrum"
CONF_SCENER = "scener"  # scenerne på kortet
CONF_IKON = "ikon"  # kortets ikon; uden ikon viser kortet lampernes egne

# En lampe i rummet
CONF_ENTITY_ID = "entity_id"
CONF_BEVAEGELSE = "bevaegelse"  # tænder ved bevægelse

# Et lysvalg: hvidt lys, en farve, en scene eller kun lysstyrke
CONF_TYPE = "type"
CONF_LYSSTYRKE = "lysstyrke"
CONF_KELVIN = "kelvin"
CONF_FARVE = "farve"  # [nuance, mætning]
CONF_SCENE = "scene"
LYS_HVID = "hvid"
LYS_FARVE = "farve"
LYS_SCENE = "scene"
LYS_LYSSTYRKE = "lysstyrke"
LYSTYPER = (LYS_HVID, LYS_FARVE, LYS_SCENE, LYS_LYSSTYRKE)
STANDARD_LYS = {CONF_TYPE: LYS_HVID, CONF_LYSSTYRKE: 100, CONF_KELVIN: 3000}

# Et tidsrum
CONF_NAVN = "navn"
CONF_START = "start"
CONF_SLUT = "slut"  # samme klokkeslæt som start: et helt døgn
CONF_DAGE = "dage"  # ugedagene, mandag = 0; over midnat hører til dagen, det begynder
CONF_SLUK_EFTER = "sluk_efter"
ALLE_DAGE = (0, 1, 2, 3, 4, 5, 6)

# Indstillinger på rummets enhed
SLUK_EFTER_BEVAEGELSE = "sluk_efter_bevaegelse"  # sekunder
SLUK_EFTER_TRYK = "sluk_efter_tryk"  # minutter, 0 = aldrig
HOLD_TID = "hold_tid"  # timer

STANDARD_INDSTILLINGER = {
    SLUK_EFTER_BEVAEGELSE: 30,
    SLUK_EFTER_TRYK: 5,
    HOLD_TID: 4,
}

# Rummets tilstand
SLUKKET = "slukket"
BEVAEGELSE = "bevaegelse"
HAAND = "haand"
HOLD = "hold"

# Ændringer på lyset uden bruger, der kommer så kort efter Rumlys' egen kommando, regnes
# for svar på den. En Zigbee2MQTT-gruppe melder først tilbage efter et par sekunder.
EKKO_VINDUE = timedelta(seconds=10)

# Lys valgt i hånden huskes, når lamperne har meldt det hele tilbage: en scene sendes pære
# for pære, og en gruppe melder først efter et par sekunder.
HUSK_EFTER = timedelta(seconds=4)

# Så mange hændelser gemmer hvert rum til sidepanelet.
HAENDELSER = 50

# Vægknapperne. Tallene er dem, Martins bbcontrol-automatiseringer er sat op med, så en knap
# føles ens, før og efter Rumlys overtager den. Dobbeltklikket er nyt: hans egne tryk varede
# 0,14–0,26 sek. (målt 13-09-2026), så 0,3 sek. rummer to tryk i træk.
KNAP_HOLD = 0.8  # sekunder nede, før trykket er et hold, der dæmper
KNAP_DOBBELT = 0.3  # sekunder efter et slip, hvor et nyt tryk er et dobbeltklik
DAEMP_SKRIDT = 10  # procent pr. skridt, mens knappen holdes nede
DAEMP_PAUSE = 0.1  # sekunder mellem skridtene
DAEMP_OVERGANG = 0.05  # sekunder pr. skridt; rummets egen bløde overgang er for lang her
DAEMP_VEND = 51  # er lyset lysere end det, dæmper et hold ned; ellers op
