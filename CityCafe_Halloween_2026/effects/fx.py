#!/usr/bin/env python3
"""
fx.py - wiederverwendbare lokale Effekte fuer die Halloween-Videos.
Alles rein lokal (NumPy/OpenCV), keine API-Kosten.

PosterFX nimmt ein Basisbild (1920x1080 BGR) und rendert daraus einzelne
Frames mit: warmem Flackern (Kerzen/Kuerbisse, automatisch erkannt),
mehrschichtigem Nebel, Zoom, optionaler Abdunklung/Tonung.
"""

import cv2
import numpy as np

B, H = 1920, 1080
HB, HH = B // 2, H // 2  # Halbaufloesung fuer schwere Masken-/Nebelrechnungen


def warm_maske(bild_bgr):
    """Warme (orange/rote), helle Bereiche: Kerzen, Kuerbisse, gluehende Schrift."""
    hsv = cv2.cvtColor(bild_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    warm = np.clip(1.0 - np.minimum(np.abs(h - 10), np.abs(h - 170)) / 25.0, 0, 1)
    m = warm * (s / 255.0) * (v / 255.0)
    return np.clip(cv2.GaussianBlur(m, (9, 9), 0), 0, 1).astype(np.float32)


def flacker_bloebe(maske, seed=42, max_bloebe=24):
    bin_m = (maske > 0.15).astype(np.uint8)
    n, labels = cv2.connectedComponents(bin_m)
    rng = np.random.default_rng(seed)
    masken, phasen, freqs, amps = [], [], [], []
    for i in range(1, min(n, max_bloebe + 1)):
        einzel = (labels == i).astype(np.float32) * maske
        if einzel.sum() < 15:
            continue
        masken.append(cv2.resize(einzel, (HB, HH), interpolation=cv2.INTER_AREA))
        phasen.append(rng.uniform(0, 2 * np.pi))
        freqs.append(rng.uniform(0.6, 2.2))
        amps.append(rng.uniform(0.15, 0.4))
    if not masken:
        masken = [np.zeros((HH, HB), np.float32)]
        phasen, freqs, amps = [0.0], [1.0], [0.0]
    return np.stack(masken), np.array(phasen), np.array(freqs), np.array(amps)


def nebel_textur(seed, breite=HB * 2, hoehe=HH):
    rng = np.random.default_rng(seed)
    klein = rng.random((hoehe // 8, breite // 8)).astype(np.float32)
    n = cv2.resize(klein, (breite, hoehe), interpolation=cv2.INTER_CUBIC)
    n = cv2.GaussianBlur(n, (0, 0), sigmaX=14, sigmaY=8)
    n = (n - n.min()) / (n.max() - n.min() + 1e-6)
    return n.astype(np.float32)


class PosterFX:
    def __init__(self, basis_bgr, seed=1):
        if basis_bgr.shape[:2] != (H, B):
            basis_bgr = cv2.resize(basis_bgr, (B, H), interpolation=cv2.INTER_LANCZOS4)
        self.basis = basis_bgr
        self.basis_f = basis_bgr.astype(np.float32)
        self.masken, self.phasen, self.freqs, self.amps = flacker_bloebe(warm_maske(basis_bgr))
        self.nebel1 = nebel_textur(seed)
        self.nebel2 = nebel_textur(seed + 100)

    def nebel(self, t, dichte, speed=1.0, tint=(170, 160, 150)):
        """Nebelmaske (HxW float 0..1) mit Tonung, zwei Schichten unterschiedlicher Geschwindigkeit."""
        o1 = int((t * 9 * speed) % HB)
        o2 = int((t * 21 * speed) % HB)
        s1 = self.nebel1[:, o1:o1 + HB]
        s2 = self.nebel2[:, o2:o2 + HB]
        m = np.clip(s1 * 0.65 + s2 * 0.45, 0, 1) * dichte
        return cv2.resize(m, (B, H), interpolation=cv2.INTER_LINEAR)

    def render(self, t, nebel=0.5, flackern=1.0, zoom=1.0, zentrum=None,
               nebel_tint=(170, 160, 150), nebel_speed=1.0, helligkeit=1.0,
               basis_f=None):
        frame = (basis_f if basis_f is not None else self.basis_f).copy()

        # Flackern: pro Blob eigener Takt, auf halber Aufloesung berechnet
        takt = self.amps * flackern * np.sin(2 * np.pi * self.freqs * t + self.phasen)
        gain = np.tensordot(takt, self.masken, axes=1)
        gain = cv2.resize(gain, (B, H), interpolation=cv2.INTER_LINEAR)
        frame = np.clip(frame + frame * np.clip(gain, -1, 1.5)[..., None] * 0.9, 0, 255)

        if nebel > 0.001:
            m = self.nebel(t, nebel, nebel_speed)[..., None]
            tint = np.array(nebel_tint, np.float32)
            frame = frame * (1 - m * 0.55) + tint * m * 0.55

        if zoom != 1.0:
            frame = zoom_bild(frame, zoom, zentrum)
        if helligkeit != 1.0:
            frame = frame * helligkeit
        return np.clip(frame, 0, 255).astype(np.uint8)


def zoom_bild(bild, zoom, zentrum=None):
    """Zoomt per Ausschnitt+Skalierung auf (B,H); zentrum in Bildkoordinaten (x,y)."""
    h, b = bild.shape[:2]
    cx, cy = zentrum if zentrum else (b / 2, h / 2)
    w, hh = b / zoom, h / zoom
    x0 = float(np.clip(cx - w / 2, 0, b - w))
    y0 = float(np.clip(cy - hh / 2, 0, h - hh))
    mat = np.array([[zoom, 0, -x0 * zoom], [0, zoom, -y0 * zoom]], np.float32)
    return cv2.warpAffine(bild, mat, (b, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def kuerzester_weg_blend(a, b, alpha):
    return cv2.addWeighted(a, 1 - alpha, b, alpha, 0)


def korn(bild, staerke, rng):
    """Filmkorn (leichtes, zeitlich wechselndes Rauschen)."""
    if staerke <= 0:
        return bild
    r = rng.normal(0, staerke, bild.shape[:2]).astype(np.float32)[..., None]
    return np.clip(bild.astype(np.float32) + r, 0, 255).astype(np.uint8)


def blitz_polylinie(rng, start, ende, segmente=14, versatz=55):
    """Zackiger Blitz von start nach ende (Pixelkoordinaten)."""
    pts = [start]
    for i in range(1, segmente):
        f = i / segmente
        x = start[0] + (ende[0] - start[0]) * f + rng.uniform(-versatz, versatz)
        y = start[1] + (ende[1] - start[1]) * f
        pts.append((x, y))
    pts.append(ende)
    return np.array(pts, np.int32)


def fledermaus(bild, x, y, groesse, flap):
    """Zeichnet eine einfache Fledermaus-Silhouette (flap 0..1 = Fluegelstellung)."""
    fl = groesse * (0.35 + 0.65 * flap)
    pts = np.array([
        (x, y),
        (x - groesse * 0.45, y - fl * 0.8), (x - groesse, y - fl * 0.35),
        (x - groesse * 0.75, y + groesse * 0.05), (x - groesse * 0.45, y - groesse * 0.02),
        (x - groesse * 0.2, y + groesse * 0.18), (x, y + groesse * 0.1),
        (x + groesse * 0.2, y + groesse * 0.18), (x + groesse * 0.45, y - groesse * 0.02),
        (x + groesse * 0.75, y + groesse * 0.05), (x + groesse, y - fl * 0.35),
        (x + groesse * 0.45, y - fl * 0.8),
    ], np.int32)
    cv2.fillPoly(bild, [pts], (8, 6, 10), lineType=cv2.LINE_AA)
