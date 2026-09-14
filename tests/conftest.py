"""Fælles opsætning af testene."""

import socket
import sys

import pytest
import pytest_socket

if sys.platform == "win32":
    # HA's testmiljø spærrer alle netværks-sockets. På Windows laver asyncio sin interne
    # forbindelse med socketpair(), som her er to TCP-sockets på 127.0.0.1, og så kan
    # event-loopet ikke starte. Kun socketpair() får lov; spærringen gælder alt andet.
    _socketpair = socket.socketpair

    def _socketpair_uden_spaerring(*args, **kwargs):
        spaerret = socket.socket
        socket.socket = pytest_socket._true_socket
        try:
            return _socketpair(*args, **kwargs)
        finally:
            socket.socket = spaerret

    socket.socketpair = _socketpair_uden_spaerring


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Lad Home Assistant indlæse custom_components i alle test."""
    return
