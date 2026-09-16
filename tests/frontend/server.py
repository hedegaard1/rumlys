"""Testsiderne uden browserens cache: python tests/frontend/server.py [port]

Med python -m http.server gemmer browseren sidepanelet og kortet og viser gammel kode, efter at
filerne er rettet — også efter en genindlæsning. Denne server beder browseren om ikke at gemme dem.
"""

import functools
import http.server
import sys
from pathlib import Path


class UdenCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
repo = Path(__file__).resolve().parents[2]
server = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(UdenCache, directory=str(repo)))
server.serve_forever()
