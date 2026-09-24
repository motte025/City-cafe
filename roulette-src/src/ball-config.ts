/**
 * Alle Stellgrößen der Kugelphysik an einer Stelle.
 *
 * Maßstab: 6,5 Einheiten Außendurchmesser = 900 mm, also 1 Einheit ≈ 138,5 mm.
 * Geschwindigkeiten in Einheiten/s (1 m/s ≈ 7,22 E/s), Zeiten in Sekunden.
 * Die Kollisionsgeometrie wird NICHT hier eingestellt, sie kommt 1:1 aus der
 * sichtbaren Geometrie (wheel-shape.ts / wheel-model.ts, siehe ball-physics.ts).
 */
export const MM_PER_UNIT = 900/6.5;
/** Erdschwerkraft in Einheiten/s² (≈ 70,85). */
export const G_EARTH = 9810/MM_PER_UNIT;

export type MaterialName='track'|'rail'|'cone'|'deflector'|'ring'|'divider'|'wall'|'pocket';
export interface Material {
 /** Stoßzahl (Restitution) bei 100 % Sprungstärke. */
 e:number;
 /** Coulomb-Reibung im Kontaktpunkt (bremst Gleiten, erzeugt Drall). */
 mu:number;
 /** Rollwiderstand: Bremsimpuls je Normalimpuls beim Rollen. */
 roll:number;
}

export const BALL_PHYSICS = {
 /**
  * Schwerkraft-Faktor für ALLE Flugphasen (Wurfparabeln, Abstieg, Taschen).
  * 1 = Erde. Für die Lesbarkeit am TV höchstens um ~40 % reduzieren (≥ 0,6).
  */
 gravityFactor:.72,
 /** Fester Rechenschritt. Bei 1/4000 s legt die Kugel selbst bei 2 m/s nur 0,5 mm pro Schritt zurück. */
 dt:1/4000,
 /** Jeder wievielte Schritt in die Zeitreihe geht (2 → 2000 Stützstellen/s). */
 recordEvery:2,
 /** Unterhalb dieser Aufprallgeschwindigkeit (E/s) kein Rückprall, sondern Aufliegen (≈ 5 cm/s). */
 restingSpeed:.35,
 /** Luft: Dichte kg/m³ und cw-Wert einer glatten Kugel. */
 airDensity:1.2,dragCoefficient:.47,
 /**
  * Oberflächen. e = Restitution, mu = Reibung, roll = Rollwiderstand.
  * track: Holz der Kugellaufbahn, rail: Metallring und Holzrand außen (daran läuft die schnelle Kugel),
  * cone: Konus zwischen Laufbahn und Rotor, deflector: Metallrauten,
  * ring: Zahlenkranz und Rotorringe, divider: Metallstege, wall: Ebenholzwände vor und hinter
  * den Taschen, pocket: Taschenboden (leicht gedämpft, damit die Kugel zügig zur Ruhe kommt).
  */
 materials:{
  track:{e:.35,mu:.30,roll:.0065},
  rail:{e:.35,mu:.30,roll:.001},
  cone:{e:.38,mu:.25,roll:.004},
  deflector:{e:.78,mu:.05,roll:.004},
  ring:{e:.42,mu:.25,roll:.006},
  divider:{e:.70,mu:.10,roll:.006},
  wall:{e:.55,mu:.25,roll:.01},
  pocket:{e:.30,mu:.34,roll:.035},
 } as Record<MaterialName,Material>,
 /**
  * Laufbahnwiderstand in E/s², solange die Kugel Laufbahn oder Außenring berührt
  * (Rollreibung auf Holz, Staub, feines Rattern). Zusammen mit Luftwiderstand und
  * Rollwiderstand am Ring ergibt das die Abbremskurve der Runden auf der Laufbahn.
  */
 trackDrag:.59,
 /** Höchste Abwurfgeschwindigkeit (rad/s). Darüber klettert die Kugel am Holzrand hoch. */
 maxLaunchSpeed:13,
 /**
  * Mikro-Rauheit je Aufprall (nur echte Stöße, nie beim Aufliegen):
  * Streuung der Stoßzahl (relativ) und Kippung der Normale (Grad).
  * Das ist die physikalische Quelle der Vielfalt zwischen zwei Würfen mit gleichem Start.
  */
 roughness:{restitution:.08,normalDeg:1.5},
 /** Sprungstärke-Regler (50–140 %) wirkt auf die Stoßzahl: e · sqrt(Sprungstärke). */
 maxRestitution:.86,
 /** Gewicht als Materialreferenz: leichtere Kugel (PTFE) etwas lebhafter, schwerere ruhiger. */
 massLiveliness:.12,
};

/** Fenster, die jeder ausgewählte Wurf einhalten muss. */
export const BALL_WINDOWS = {
 /** Laufweg in Taschen (netto, relativ zum Rotor, ab erstem Kontakt mit dem Taschenkranz). */
 runDefault:[5,15] as [number,number],
 runLimits:[3,20] as [number,number],
 /** Rundendauer ab Abwurf: gezogene Dauer ± Toleranz. */
 durationTolerance:.4,
 /** Dauer vom ersten Taschenkontakt bis Stillstand (Richtwert 2–4 s; wenige Taschen kürzer, viele länger). */
 pocketTime:(run:number)=>[.9+.02*run,2.2+.14*run] as [number,number],
 /** Ausklingen in der Endtasche (letzter Taschenwechsel bis Stillstand). */
 settleMax:.8,
 /** Ruhelage mindestens so weit (rad) neben der Taschenmitte: nie zentriert. */
 restOffsetMin:.005,
};

/** Suche nach einem passenden Wurf. Grenzen in Kandidaten, nicht in Zeit: so bleibt alles deterministisch. */
export const BALL_SEARCH = {
 /** Abwurf-Kandidaten in der strengen Suche. */
 candidates:900,
 /** Rauheits-Varianten der Taschenphase je passendem Kandidaten. */
 pocketVariants:1,
 /** … und so viele, wenn die erste Variante schon nahe am nötigen Laufweg endet. */
 pocketVariantsNear:8,
 /** Toleranz um den gezogenen Wunsch-Laufweg (Taschen) … */
 runTolerance:2,
 /** … wird nach so vielen Kandidaten auf ±3 und danach auf den ganzen Bereich erweitert. */
 widenAfter:[220,450] as [number,number],
 /** Gelockerte zweite Suche (nur falls die strenge scheitert). */
 relaxedCandidates:300,relaxedDuration:1.2,relaxedSettle:1.2,
};
