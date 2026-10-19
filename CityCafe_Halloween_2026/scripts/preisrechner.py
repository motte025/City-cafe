#!/usr/bin/env python3
"""
preisrechner.py - rechnet die Kosten der geplanten kie.ai-Clips rein lokal
aus, OHNE API-Aufruf. Liest config/config.json und config/clips.json.
"""

import json
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent


def main():
    config = json.loads((PROJEKT / "config" / "config.json").read_text(encoding="utf-8"))
    clips = json.loads((PROJEKT / "config" / "clips.json").read_text(encoding="utf-8"))

    credits_pro_clip = config["kie_ai"]["credits_pro_10s_clip"]
    usd_pro_credit = config["kie_ai"]["usd_pro_credit"]
    max_budget = config["kie_ai"]["max_budget_usd"]

    alle_clips = clips["video1_clips"] + clips["video2_clips"]
    anzahl = len(alle_clips)
    gesamt_credits = anzahl * credits_pro_clip
    gesamt_usd = gesamt_credits * usd_pro_credit

    print(f"Geplante Clips: {anzahl} (davon {len(clips['video1_clips'])} fuer Video 1, "
          f"{len(clips['video2_clips'])} fuer Video 2)")
    print(f"Je Clip: 10s * {credits_pro_clip} Credits = {credits_pro_clip} Credits "
          f"* {usd_pro_credit} $/Credit = {credits_pro_clip * usd_pro_credit:.2f} $")
    print()
    print(f"GESAMT: {gesamt_credits} Credits = {gesamt_usd:.2f} $")
    print(f"Budget-Limit laut Konfiguration: {max_budget:.2f} $")

    if gesamt_usd > max_budget:
        print(f"\n⚠️  ACHTUNG: Kalkulation ({gesamt_usd:.2f} $) ueberschreitet das Budget-Limit "
              f"({max_budget:.2f} $) um {gesamt_usd - max_budget:.2f} $!")
    else:
        print(f"\n✓ Innerhalb des Budgets, {max_budget - gesamt_usd:.2f} $ Puffer.")

    print("\nEinzelne Clips:")
    for c in alle_clips:
        print(f"  - {c['id']} ({c['verwendung']})")


if __name__ == "__main__":
    main()
