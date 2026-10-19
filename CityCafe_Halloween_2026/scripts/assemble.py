#!/usr/bin/env python3
"""
assemble.py - schneidet die zwei 60s-Halloween-Videos aus den KI-Clips
(generated/*.mp4) und lokal berechneten Effekten zusammen. Kein API-Aufruf.

    venv/bin/python3 scripts/assemble.py video1 [--frames 0,300,...] [--out datei.mp4]
    venv/bin/python3 scripts/assemble.py video2

Mit --frames werden nur die genannten Frames als JPG in previews/ geschrieben
(schnelle Kontrolle), ohne das ganze Video zu rendern.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

PROJEKT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJEKT / "effects"))
import fx  # noqa: E402

B, H, FPS = fx.B, fx.H, 30
CFG = json.loads((PROJEKT / "config" / "config.json").read_text(encoding="utf-8"))
POSTER = cv2.imread(str(PROJEKT / CFG["referenz"]["plakat_datei"]))
GEN = PROJEKT / "generated"


def smooth(x):
    x = float(np.clip(x, 0, 1))
    return x * x * (3 - 2 * x)


class ClipReader:
    """Liest einen 24fps-Clip sequentiell, gibt Frames fuer beliebige (monotone) 30fps-Zeitpunkte."""

    def __init__(self, pfad):
        self.cap = cv2.VideoCapture(str(pfad))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 24.0
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.pos = -1
        self.letzter = None

    def get(self, t_src):
        idx = min(int(round(t_src * self.fps)), self.n - 1)
        if idx < 0:
            idx = 0
        if idx < self.pos:  # Rueckwaerts: neu oeffnen (sollte kaum vorkommen)
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            self.pos = idx - 1
        while self.pos < idx - 1:
            self.cap.grab()
            self.pos += 1
        if self.pos < idx:
            ok, fr = self.cap.read()
            self.pos += 1
            if ok:
                self.letzter = fr
        if self.letzter is None:
            raise RuntimeError("Clip lieferte kein Frame")
        return self.letzter


def letztes_frame_von(pfad):
    cap = cv2.VideoCapture(str(pfad))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, n - 1)
    ok, fr = cap.read()
    if not ok:  # manche Container: ein Frame davor
        cap.set(cv2.CAP_PROP_POS_FRAMES, n - 2)
        ok, fr = cap.read()
    return fr


# ---------------------------------------------------------------- Segmente

class ClipSeg:
    def __init__(self, name, speed=1.0, overlay=None):
        self.r = ClipReader(GEN / f"{name}.mp4")
        self.speed = speed
        self.overlay = overlay  # callable(frame, j) -> frame
        self.t_start = 0.0

    def frame(self, j):
        f = self.r.get(j / FPS * self.speed)
        if f.shape[:2] != (H, B):
            f = cv2.resize(f, (B, H), interpolation=cv2.INTER_LANCZOS4)
        return self.overlay(f, j) if self.overlay else f


class ThreatSeg:
    """10-20s: Gewitter zieht auf, Mond verdunkelt sich, Blitz, Fledermaeuse."""

    def __init__(self, basis):
        self.fx = fx.PosterFX(basis, seed=11)
        w = fx.nebel_textur(7, B, H)
        grad = np.clip(1.0 - np.linspace(0, 1, H) / 0.62, 0, 1)[:, None]
        self.wolken = cv2.GaussianBlur(w * grad, (0, 0), 20).astype(np.float32)
        self.rng = np.random.default_rng(3)
        self.blitz_frame = 186
        self.bolt = fx.blitz_polylinie(np.random.default_rng(9), (1720, 0), (1640, 470))
        self.bats = [(self.rng.uniform(0.6, 1.4), self.rng.uniform(0, 8), self.rng.uniform(70, 260),
                      self.rng.uniform(26, 48)) for _ in range(6)]

    def frame(self, j):
        t = j / FPS
        f = self.fx.render(t, nebel=0.55 + 0.3 * smooth(t / 8), flackern=1.0,
                           zoom=1.0 + 0.07 * (t / 10.0), nebel_tint=(175, 160, 150)).astype(np.float32)
        dunkel = smooth((t - 0.5) / 6.0) * 0.8
        f = f * (1 - dunkel * self.wolken[..., None] * 0.85) \
            + np.array([55, 40, 30], np.float32) * dunkel * self.wolken[..., None] * 0.25

        # Blitz: kurze, nicht-stroboskopische Folge (ein Blitz mit Nachflackern)
        profil = {0: 0.95, 1: 0.2, 2: 0.75, 3: 0.45, 4: 0.25, 5: 0.1}
        k = j - self.blitz_frame
        if k in profil:
            a = profil[k]
            f = f * (1 - a * 0.55) + np.array([255, 235, 205], np.float32) * a * 0.55
            if k in (0, 2):
                lage = np.zeros((H, B), np.float32)
                cv2.polylines(lage, [self.bolt], False, 1.0, 4, cv2.LINE_AA)
                glow = cv2.GaussianBlur(lage, (0, 0), 9) * 1.6 + lage
                f = f + np.clip(glow, 0, 1)[..., None] * np.array([255, 240, 220], np.float32) * 0.9
        f = np.clip(f, 0, 255).astype(np.uint8)

        for tempo, phase, y0, gr in self.bats:
            x = ((t * 190 * tempo + phase * 260) % (B + 300)) - 150
            y = y0 + 26 * np.sin(t * 2.2 * tempo + phase)
            fx.fledermaus(f, x, y, gr, 0.5 + 0.5 * np.sin(2 * np.pi * (4.5 + tempo) * t + phase))
        return f


class StageSeg:
    """30-40s: abrupter Schnitt auf die Buehne: pulsierende rote/orange Scheinwerfer, Nebel, LIVE MUSIK."""

    def __init__(self, geist_ende):
        # Letztes Geister-Frame: Plakatschrift ist im Nebel verschwunden, Buehne bleibt sichtbar.
        self.basis = fx.zoom_bild(geist_ende, 1.35, (1330, 600))
        self.fx = fx.PosterFX(self.basis, seed=21)
        self.warm = fx.warm_maske(self.basis)
        # LIVE-MUSIK-Schrift aus dem Plakat freistellen (orange, helle Pixel)
        box = POSTER[715:905, 620:1335]
        hsv = cv2.cvtColor(box, cv2.COLOR_BGR2HSV).astype(np.float32)
        m = ((hsv[..., 1] > 110) & (hsv[..., 2] > 120)).astype(np.float32)
        m = cv2.GaussianBlur(m, (0, 0), 1.0)
        self.txt_img = box.astype(np.float32)
        self.txt_mask = m

    def frame(self, j):
        t = j / FPS
        puls = max(0.0, np.sin(2 * np.pi * 2.0 * t)) ** 2  # 120 bpm
        f = self.fx.render(t, nebel=0.75, flackern=1.6, zoom=1.0 + 0.09 * (t / 10.0),
                           zentrum=(1000, 540), nebel_tint=(60, 70, 215), nebel_speed=1.8).astype(np.float32)
        f = f + f * self.warm[..., None] * (0.35 + 1.0 * puls)
        f = f * (0.72 + 0.28 * puls * 0.6)

        # LIVE MUSIK gross im unteren Drittel, mit Puls-Glow
        sk = 1.15
        tw, th = int(self.txt_img.shape[1] * sk), int(self.txt_img.shape[0] * sk)
        ti = cv2.resize(self.txt_img, (tw, th), interpolation=cv2.INTER_CUBIC)
        tm = cv2.resize(self.txt_mask, (tw, th), interpolation=cv2.INTER_CUBIC)[..., None]
        x0, y0 = (B - tw) // 2, 700
        glow = np.zeros((H, B), np.float32)
        glow[y0:y0 + th, x0:x0 + tw] = tm[..., 0]
        glow = cv2.GaussianBlur(glow, (0, 0), 18)[..., None]
        f = f + glow * np.array([30, 90, 255], np.float32) * (0.45 + 0.9 * puls)
        reg = f[y0:y0 + th, x0:x0 + tw]
        f[y0:y0 + th, x0:x0 + tw] = reg * (1 - tm) + ti * tm * (1.0 + 0.25 * puls)
        return np.clip(f, 0, 255).astype(np.uint8)


class ScareSeg:
    """48-51s: der Jumpscare. Schneller Lunge auf das Gesicht, ein einzelner Lichtblitz, danach Abklingen."""

    def __init__(self, letztes):
        self.basis = letztes
        self.gesicht = (907.0, 232.0)
        self.warm = fx.warm_maske(letztes)
        self.rng = np.random.default_rng(5)
        yy, xx = np.mgrid[0:H, 0:B].astype(np.float32)
        d = np.sqrt(((xx - B / 2) / (B / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        self.vignette = np.clip(1.0 - 0.55 * d ** 1.6, 0.25, 1.0)[..., None]

    def _zoom(self, z, mitte):
        return fx.zoom_bild(self.basis.astype(np.float32), z, mitte)

    def frame(self, j):
        lunge = 12
        if j < lunge:
            x = (j + 1) / lunge
            z = 1.0 + 2.4 * x ** 2.2
            mx = 960 + (self.gesicht[0] - 960) * x ** 1.3
            my = 540 + (self.gesicht[1] - 540) * x ** 1.3
        else:
            z = 3.4 + 0.3 * (j - lunge) / (90 - lunge)
            mx, my = self.gesicht
        mitte = (mx, my)
        f = self._zoom(z, mitte)
        if 3 <= j <= 13:  # Bewegungsunschaerfe waehrend des Lunges
            f = (self._zoom(z * 0.93, mitte) + f + self._zoom(z * 1.07, mitte)) / 3.0

        if j >= lunge:  # leichtes Zittern, klingt ab
            s = 4.0 * max(0.0, 1 - (j - lunge) / 40.0)
            mat = np.float32([[1, 0, self.rng.uniform(-s, s)], [0, 1, self.rng.uniform(-s, s)]])
            f = cv2.warpAffine(f, mat, (B, H), borderMode=cv2.BORDER_REFLECT)
            glut = 1.0 + 0.5 * np.sin(j * 0.5)
            f = f + f * cv2.resize(self.warm, (B, H))[..., None] * 0.25 * glut  # Augen glimmen
            f = f * np.array([0.82, 0.82, 1.12], np.float32)  # blutroter Stich

        flash = {9: 0.55, 10: 0.95, 11: 0.5, 12: 0.2}.get(j, 0.0)
        if flash:
            f = f * (1 - flash) + np.array([255, 245, 235], np.float32) * flash

        f = f * self.vignette
        if j >= 48:  # Abklingen ins Dunkle
            f = f * (1.0 - 0.80 * smooth(((j - 48) / 42.0) ** 1.2))
        f = np.clip(f, 0, 255).astype(np.uint8)
        return fx.korn(f, 7, self.rng)


class EndSeg:
    """51-60s: das Event. Nebel zieht ab, Bild beruhigt sich und endet exakt im Plakat (Loop zum Anfang)."""

    def __init__(self):
        self.fx = fx.PosterFX(POSTER, seed=31)

    def frame(self, j):
        n = 270
        t = j / FPS
        fade = 0.30 + 0.70 * smooth(j / 40.0)
        dichte = 0.9 * (1 - smooth(j / 235.0))
        flack = 1.0 - smooth((j - 215) / 55.0)
        zoom = 1.0 + 0.1 * (1 - smooth(j / 255.0))
        f = self.fx.render(t, nebel=dichte, flackern=flack, zoom=zoom, nebel_tint=(175, 160, 150),
                           helligkeit=fade)
        return f


# V2: ein Overlay, das ueber jede Clip-Frame gelegt wird
class V2Overlay:
    def __init__(self, seed, text_ueberlagerung=False):
        self.fx = fx.PosterFX(POSTER, seed=seed)
        self.versatz = seed * 3.7
        # Dunkle Stellen im Plakat (per Luminanz-Analyse + Sichtkontrolle geprueft):
        # Waldkante am Huegel rechts, kahle Aeste oben links
        self.augen_orte = {21.0: (1806, 328), 44.6: (416, 200)}
        self.text_ueberlagerung = text_ueberlagerung
        if text_ueberlagerung:
            g = cv2.cvtColor(POSTER, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(POSTER, cv2.COLOR_BGR2HSV)
            hell = (g > 165) | ((hsv[..., 1] > 130) & (hsv[..., 2] > 150))
            m = np.zeros((H, B), np.float32)
            for (x0, y0, x1, y1) in [(430, 190, 1490, 905), (700, 20, 1230, 190), (540, 905, 1380, 1010)]:
                m[y0:y1, x0:x1] = hell[y0:y1, x0:x1]
            self.tmask = cv2.GaussianBlur(cv2.dilate(m, np.ones((3, 3), np.uint8)), (0, 0), 1.2)[..., None]

    def __call__(self, f, jg):
        t = jg / FPS
        # leichter zusaetzlicher Nebel mit eigener Phase = keine sichtbaren Wiederholungen
        m = self.fx.nebel(t + self.versatz, 0.22, 0.8)[..., None]
        f = f.astype(np.float32)
        f = f * (1 - m * 0.4) + np.array([175, 160, 150], np.float32) * m * 0.4
        if self.text_ueberlagerung:
            f = f * (1 - self.tmask) + POSTER.astype(np.float32) * self.tmask
        # zwei rote Augen im tiefen Schatten, kurz und selten (Zeitpunkte unabhaengig vom Loop-Uebergang)
        for t0, (x, y) in self.augen_orte.items():
            a = np.sin(np.pi * (t - t0) / 0.9) ** 2 if t0 <= t <= t0 + 0.9 else 0
            if a > 0.01:
                glow = np.zeros((H, B), np.float32)
                for dx in (-17, 17):
                    cv2.ellipse(glow, (x + dx, y), (5, 3), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
                halo = cv2.GaussianBlur(glow, (0, 0), 7) * 3.5
                f = f + np.clip(glow * 1.2 + halo, 0, 1)[..., None] * np.array([40, 40, 255], np.float32) * a
        return np.clip(f, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- Zeitleiste

class Zeitleiste:
    def __init__(self, segmente):
        """segmente: Liste von (segment, nominale_dauer_frames, ueberblendung_in_vorheriges_frames)"""
        self.segs = []
        s = 0
        for seg, d, k in segmente:
            self.segs.append({"seg": seg, "start": s, "d": d, "k": k})
            s += d
        self.gesamt = s

    def frame(self, f):
        for i, e in enumerate(self.segs):
            if e["start"] <= f < e["start"] + e["d"]:
                j = f - e["start"]
                if i > 0 and e["k"] > 0 and j < e["k"]:
                    vor = self.segs[i - 1]
                    a = (j + 1) / (e["k"] + 1)
                    a = smooth(a)
                    return fx.kuerzester_weg_blend(vor["seg"].frame(vor["d"] + j), e["seg"].frame(j), a)
                return e["seg"].frame(j)
        raise IndexError(f)


def video1():
    opening_ende = letztes_frame_von(GEN / "v1_opening_approach.mp4")
    if opening_ende.shape[:2] != (H, B):
        opening_ende = cv2.resize(opening_ende, (B, H), interpolation=cv2.INTER_LANCZOS4)
    geist_ende = letztes_frame_von(GEN / "v1_ghost_apparition.mp4")
    if geist_ende.shape[:2] != (H, B):
        geist_ende = cv2.resize(geist_ende, (B, H), interpolation=cv2.INTER_LANCZOS4)
    dread_ende = letztes_frame_von(GEN / "v1_dread_closeup.mp4")
    if dread_ende.shape[:2] != (H, B):
        dread_ende = cv2.resize(dread_ende, (B, H), interpolation=cv2.INTER_LANCZOS4)
    return Zeitleiste([
        (ClipSeg("v1_opening_approach"), 300, 0),             # 00-10  Das Erwachen
        (ThreatSeg(opening_ende), 300, 0),                    # 10-20  Die Bedrohung
        (ClipSeg("v1_ghost_apparition"), 300, 12),            # 20-30  Das Grauen
        (StageSeg(geist_ende), 300, 0),                                 # 30-40  Die Musik beginnt (harter Schnitt)
        (ClipSeg("v1_dread_closeup", speed=1.25), 240, 15),   # 40-48  Stille vor dem Schrei
        (ScareSeg(dread_ende), 90, 0),                        # 48-51  Jumpscare
        (EndSeg(), 270, 0),                                   # 51-60  Das Event / Loop
    ])


def video2():
    reihenfolge = ["v2_atmosphere_whole", "v2_window_shadow", "v2_ember_glow",
                   "v2_atmosphere_whole", "v2_ember_glow", "v2_window_shadow"]
    segs = []
    for i, name in enumerate(reihenfolge):
        ov = V2Overlay(seed=40 + i)
        offset = i * 300
        segs.append((ClipSeg(name, overlay=(lambda f, j, ov=ov, off=offset: ov(f, j + off))),
                     300, 12 if i > 0 else 0))
    return Zeitleiste(segs)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video", choices=["video1", "video2"])
    p.add_argument("--frames", default=None)
    p.add_argument("--out", default=None)
    args = p.parse_args()

    zl = video1() if args.video == "video1" else video2()
    assert zl.gesamt == 1800, zl.gesamt

    if args.frames:
        for f in [int(x) for x in args.frames.split(",")]:
            img = zl.frame(f)
            cv2.imwrite(str(PROJEKT / "previews" / f"{args.video}_f{f:04d}.jpg"), img)
            print("geschrieben", f)
        return

    ziel = PROJEKT / (args.out or f"output/{args.video}_roh.mp4")
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{B}x{H}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
        "-r", str(FPS), "-movflags", "+faststart", str(ziel)], stdin=subprocess.PIPE)
    erster = zl.frame(0)
    naht = 12
    for f in range(zl.gesamt):
        fr = zl.frame(f)
        if f >= zl.gesamt - naht:
            a = smooth((f - (zl.gesamt - naht - 1)) / naht)
            fr = fx.kuerzester_weg_blend(fr, erster, a)
        ff.stdin.write(fr.tobytes())
        if f % 150 == 0:
            print(f"  {f}/{zl.gesamt}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("Fertig:", ziel)


if __name__ == "__main__":
    main()
