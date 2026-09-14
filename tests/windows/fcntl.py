"""Erstatning for Linux-modulet fcntl, kun til testene på Windows.

Home Assistant bruger det kun til låsefilen, der sikrer at HA kører én gang.
"""

LOCK_EX = 2
LOCK_NB = 4
LOCK_UN = 8


def flock(fd, operation):
    return None
