"""Sidepanelets og kortets tekster: hver nøgle én gang pr. sprog, og de samme nøgler på dansk og engelsk.

En nøgle, der står to gange i samme sprog, overskriver den første uden fejl. Sådan viste sidepanelet
i 0.4.8 kortets «Ikke sat op i Rumlys» i stedet for sin egen besked, når integrationen mangler.
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

FAELLES = (
    Path(__file__).parents[1] / "custom_components" / "rumlys" / "frontend" / "rumlys-faelles.js"
)


def _noegler() -> dict[str, list[str]]:
    tekst = FAELLES.read_text(encoding="utf-8")
    start = tekst.index("const TEKSTER = {")
    slut = tekst.index("\n};", start)
    sprog: dict[str, list[str]] = {}
    nu = None
    for linje in tekst[start:slut].splitlines():
        if m := re.match(r"^  (\w+): \{$", linje):
            nu = m.group(1)
            sprog[nu] = []
        elif nu and (m := re.match(r"^    (\w+): ", linje)):
            sprog[nu].append(m.group(1))
    return sprog


def test_hver_noegle_en_gang() -> None:
    for navn, noegler in _noegler().items():
        dobbelte = [n for n, antal in Counter(noegler).items() if antal > 1]
        assert not dobbelte, f"{navn}: {dobbelte}"


def test_samme_noegler_paa_begge_sprog() -> None:
    sprog = _noegler()
    assert set(sprog) == {"da", "en"}
    assert set(sprog["da"]) == set(sprog["en"])
