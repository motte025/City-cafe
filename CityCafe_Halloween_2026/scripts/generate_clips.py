#!/usr/bin/env python3
"""
generate_clips.py - erzeugt einzelne kie.ai-Clips aus config/clips.json.
Bereits erzeugte Clips (generated/<id>.mp4) werden NIE erneut bestellt.

Nutzung:
    venv/bin/python3 scripts/generate_clips.py v1_opening_approach
"""

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kie_client  # noqa: E402

PROJEKT = Path(__file__).resolve().parent.parent
LOG = PROJEKT / "generated" / "kosten_log.json"


def log_lesen():
    return json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else []


def main():
    if len(sys.argv) != 2:
        sys.exit("Nutzung: generate_clips.py <clip_id>")
    clip_id = sys.argv[1]

    config = json.loads((PROJEKT / "config" / "config.json").read_text(encoding="utf-8"))
    clips = json.loads((PROJEKT / "config" / "clips.json").read_text(encoding="utf-8"))
    alle = {c["id"]: c for c in clips["video1_clips"] + clips["video2_clips"]}
    if clip_id not in alle:
        sys.exit(f"Unbekannte Clip-ID. Gueltig: {', '.join(alle)}")
    clip = alle[clip_id]

    ziel = PROJEKT / "generated" / f"{clip_id}.mp4"
    if ziel.exists():
        sys.exit(f"{ziel.name} existiert bereits - wird nicht erneut bestellt.")

    # Budget-Wache: bisher ausgegebene Credits aus dem Log
    bisher = sum(e["credits"] for e in log_lesen())
    limit = config["kie_ai"]["max_budget_usd"] / config["kie_ai"]["usd_pro_credit"]
    if bisher + config["kie_ai"]["credits_pro_10s_clip"] > limit:
        sys.exit(f"Budget-Limit wuerde ueberschritten ({bisher} Credits bereits ausgegeben).")

    plakat = PROJEKT / config["referenz"]["plakat_datei"]
    url_cache = PROJEKT / "generated" / "plakat_url.txt"
    if url_cache.exists():
        image_url = url_cache.read_text().strip()
    else:
        image_url = kie_client.bild_hochladen(str(plakat), dateiname="halloween_poster_master.png")
        url_cache.write_text(image_url)

    urls, credits = kie_client.clip_erzeugen(
        prompt=clip["prompt"],
        image_url=image_url,
        dauer=config["kie_ai"]["clip_dauer_sekunden"],
        tail_image_url=image_url if clip["tail_loop"] else None,
        negative_prompt=clip.get("negative_prompt"),
    )
    if not urls:
        sys.exit("Keine Ergebnis-URL erhalten.")

    req = urllib.request.Request(urls[0], headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        ziel.write_bytes(r.read())

    eintraege = log_lesen()
    eintraege.append({"zeit": datetime.now().isoformat(timespec="seconds"),
                      "clip": clip_id, "credits": credits, "datei": ziel.name})
    LOG.write_text(json.dumps(eintraege, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Fertig: {ziel} ({credits} Credits, {credits * 0.005:.2f} $)")


if __name__ == "__main__":
    main()
