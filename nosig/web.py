"""What main.js calls. Every function returns a JSON string."""

from __future__ import annotations

import json

from . import play as _play
from .games import BEST_ANGLES, BEST_GHZ, CLASSICAL, QUANTUM, SIZES, plan

ATLAS_FILE = "data/atlas.json"


def _read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def boot(backend) -> str:
    prof = _play.profile(backend)
    groups = plan(prof["cap"], prof["one_circuit"], BEST_ANGLES, BEST_GHZ, seed=1)
    fits = {g: sum(1 for x in groups if x.game == g) for g in ("chsh", "ghz", "ms")}
    return json.dumps({"profile": prof, "fits": fits, "classical": CLASSICAL, "quantum": QUANTUM,
                       "best_angles": BEST_ANGLES, "best_ghz": {k: list(v) for k, v in BEST_GHZ.items()},
                       "atlas": _read(ATLAS_FILE) or {"runs": []}})


def play(backend, angles_json: str = "", ghz_json: str = "", shots: int = 1000) -> str:
    try:
        angles = json.loads(angles_json) if angles_json else None
        ghz = {k: tuple(v) for k, v in json.loads(ghz_json).items()} if ghz_json else None
        out = _play.play(backend, angles=angles, ghz=ghz, shots=int(shots))
        try:
            from js import sendFile
            sendFile("no-signal-run.json", "application/json", out)
        except Exception:
            pass
        return out
    except Exception as exc:
        import traceback
        traceback.print_exc()
        msg = str(exc)
        return json.dumps({"ok": False, "error": "one_job" if "one job" in msg.lower() else "failed", "message": msg[:400]})
