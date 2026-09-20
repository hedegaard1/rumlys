"""Tidsplanens liste og dens dialog skal læse fra det samme sted.

Tidsplanen lå oprindelig på rummet og flyttede siden ned på automatikken, som ejer sit eget lys
og sin egen tidsplan. `_sekTidsplan` fulgte med og fik `const d = aut`. `_retTidsrum` gjorde ikke,
og stod tilbage med `const d = this._kladde.data`.

Et rum med en eksplicit automatik har tomt `tidsrum` på selve rummet. Dialogen slog derfor op i en
tom liste: `kopi(d.tidsrum[plads])` blev `JSON.parse(undefined)`, som kaster — og dialogen åbnede
aldrig. Et tryk på et tidsrum gjorde bogstaveligt talt ingenting. Gemningen pegede samme forkerte
sted, så et nyt tidsrum hverken kom med i listen eller fik virkning, fordi Rumlys ignorerer
rummets tidsrum når der findes en eksplicit automatik. **Tidsplanen kunne altså slet ikke laves
fra sidepanelet** (fundet 20-09-2026, rettet i 0.12.3).

Prøven er kildenær med vilje: sidepanelet er et custom element, og der er ingen DOM i prøverne.
Det, der skal bindes fast, er ikke en bestemt linje, men at de to funktioner læser det **samme**
sted — omdøbes eller flyttes noget, fejler prøven og nogen tager stilling.
"""

from __future__ import annotations

import re
from pathlib import Path

PANEL = (
    Path(__file__).parents[1] / "custom_components" / "rumlys" / "frontend" / "rumlys-panel.js"
)

# Næste metode på klasseniveau — de står alle med to mellemrum foran.
NAESTE_METODE = re.compile(r"\n  [_A-Za-z]\w*\(")


def _krop(navn: str) -> str:
    """Funktionens tekst, fra dens egen linje til den næste metode."""
    tekst = PANEL.read_text(encoding="utf-8")
    start = tekst.index(f"  {navn}(")
    slut = NAESTE_METODE.search(tekst, start + 1)
    return tekst[start : slut.start()] if slut else tekst[start:]


def _binder(navn: str) -> str:
    """Det, «d» peger på i funktionen."""
    fund = re.search(r"^    const d = (.+);$", _krop(navn), re.M)
    assert fund is not None, f"{navn} binder ikke «d»"
    return fund.group(1)


def test_listen_og_dialogen_laeser_samme_sted() -> None:
    assert _binder("_sekTidsplan") == _binder("_retTidsrum") == "aut"


def test_dialogen_roerer_ikke_rummet() -> None:
    """Ét eneste `this._kladde.data` i dialogen er nok til at gemme det forkerte sted."""
    assert "_kladde" not in _krop("_retTidsrum")
