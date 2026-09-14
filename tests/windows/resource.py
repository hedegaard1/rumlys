"""Erstatning for Linux-modulet resource, kun til testene på Windows.

Home Assistant bruger det kun til at hæve grænsen for åbne filer.
"""

RLIMIT_NOFILE = 7


def getrlimit(which):
    return (8192, 8192)


def setrlimit(which, limits):
    return None
