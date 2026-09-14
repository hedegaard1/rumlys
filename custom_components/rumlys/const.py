"""Konstanter for Rumlys."""

from datetime import timedelta

DOMAIN = "rumlys"

# Underopsætningens type: ét rum
RUM = "rum"

# Rummets opsætning
CONF_LYS = "lys"
CONF_SENSORER = "sensorer"
CONF_LYSSTYRKE = "lysstyrke"
CONF_KELVIN = "kelvin"
CONF_OVERGANG = "overgang"
CONF_TIDSRUM = "tidsrum"

# Et tidsrum
CONF_NAVN = "navn"
CONF_START = "start"
CONF_SLUT = "slut"
CONF_SLUK_EFTER = "sluk_efter"

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
