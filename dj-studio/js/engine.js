// Audio-Engine (Web Audio). Zwei Decks mit identischer Kette:
//   Quelle -> Entknack -> Trim -> EQ tief/mitte/hoch -> Tiefpass -> Hochpass
//          -> [Meter PRE] -> Kanalfader -> [Meter POST] -> Crossfader -> Summe
//   Summe -> Headroom -3 dB -> Master -> Limiter (umschaltbar) -> [Meter MASTER] -> Ausgang
// Alle Bedienwuensche laufen ueber request(); erst der umgesetzte, begrenzte
// Wert wird im Store bestaetigt.

import { state, bestaetigen } from './store.js';
import { wellenform, blockPegel } from './analysis.js';

const klemm = (v, a, b) => Math.min(b, Math.max(a, v));
const GLATT = 0.012;            // Zeitkonstante fuer Reglerwechsel (gegen Knacken)
const ENTKNACK = 0.004;         // Ein-/Ausblenden bei Start/Stop/Sprung
const TEMPO_BEREICHE = [6, 10, 16];
const EQ_MIN = -26, EQ_MAX = 6;

export class Engine {
  constructor() {
    this.ctx = null;
    this.decks = {};
    this.quellen = null;
  }

  starten(quellen) {
    this.quellen = quellen;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.summe = ctx.createGain();
    this.headroom = ctx.createGain(); this.headroom.gain.value = 0.708;   // -3 dB
    this.masterGain = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002; this.limiter.release.value = 0.12;
    this.limitWeg = ctx.createGain(); this.direktWeg = ctx.createGain();
    this.ausgang = ctx.createGain();
    this.summe.connect(this.headroom).connect(this.masterGain);
    this.masterGain.connect(this.limiter).connect(this.limitWeg).connect(this.ausgang);
    this.masterGain.connect(this.direktWeg).connect(this.ausgang);
    this.masterMeter = new Abgriff(ctx, this.ausgang);
    this.ausgang.connect(ctx.destination);
    for (const id of ['A', 'B']) this.decks[id] = new DeckEngine(this, id);
    this.limiterSetzen(state.master.limiter, true);
    this.masterSetzen(state.master.volume);
    this.crossfaderAnwenden();
    // Ton erst nach Klick (Browser-Regel): main.js ruft ctx.resume()
    ctx.addEventListener('statechange', () => bestaetigen('audioBereit', ctx.state === 'running'));
  }

  get jetzt() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---- Wuensche aus der Oberflaeche ---------------------------------------
  request(pfad, wert) {
    const t = pfad.split('.');
    if (t[0] === 'decks') return this.decks[t[1]]?.request(t.slice(2).join('.'), wert);
    if (pfad === 'master.volume') return this.masterSetzen(wert);
    if (pfad === 'master.crossfader') { bestaetigen(pfad, klemm(Number(wert) || 0, -1, 1)); return this.crossfaderAnwenden(); }
    if (pfad === 'master.xfKurve' && ['weich', 'scharf'].includes(wert)) { bestaetigen(pfad, wert); return this.crossfaderAnwenden(); }
    if (pfad === 'master.xfSteuert' && ['video', 'audio', 'auto'].includes(wert)) { bestaetigen(pfad, wert); return this.crossfaderAnwenden(); }
    if (pfad === 'master.limiter') return this.limiterSetzen(!!wert);
    if (pfad === 'master.meterAbgriff' && ['pre', 'post'].includes(wert)) return bestaetigen(pfad, wert);
    if (pfad === 'automix') return bestaetigen(pfad, !!wert);
    if (pfad === 'video.ansicht' && ['video', 'audio', 'link'].includes(wert)) return bestaetigen(pfad, wert);
    if (pfad === 'layout.jog' && ['innen', 'aussen'].includes(wert)) return bestaetigen(pfad, wert);
  }

  masterSetzen(v) {
    v = klemm(Number(v) || 0, 0, 1);
    const gain = v / 0.8;                       // 0,8 = 0 dB, Anschlag = +1,9 dB
    if (this.ctx) this.masterGain.gain.setTargetAtTime(gain, this.jetzt, GLATT);
    bestaetigen('master.volume', v);
  }

  limiterSetzen(an, sofort) {
    if (this.ctx) {
      const z = this.jetzt, k = sofort ? 0.001 : 0.02;
      this.limitWeg.gain.setTargetAtTime(an ? 1 : 0, z, k);
      this.direktWeg.gain.setTargetAtTime(an ? 0 : 1, z, k);
    }
    bestaetigen('master.limiter', an);
  }

  // Crossfader-Pegel je Deck (0..1). Bei "video" laufen beide Kanaele voll.
  xfPegel(id) {
    const m = state.master;
    if (m.xfSteuert === 'video') return 1;
    return xfKurve(m.crossfader, m.xfKurve, id);
  }

  // Welcher Kanal ist im Bild (0 = A, 1 = B, dazwischen = Blende)
  videoMix() {
    const m = state.master;
    if (m.xfSteuert === 'audio') {
      const a = this.decks.A.hoerbar(), b = this.decks.B.hoerbar();
      return a + b > 0 ? (b > a ? 1 : 0) : 0;
    }
    return (m.crossfader + 1) / 2;
  }

  crossfaderAnwenden() {
    if (!this.ctx) return;
    for (const id of ['A', 'B']) this.decks[id].xf.gain.setTargetAtTime(this.xfPegel(id), this.jetzt, GLATT);
  }

  // Deck, das gerade "auf Sendung" ist (lauteste hoerbare Quelle)
  aufSendung() {
    const a = this.decks.A.hoerbar(), b = this.decks.B.hoerbar();
    if (a === 0 && b === 0) return state.decks.B.spielt && !state.decks.A.spielt ? 'B' : 'A';
    return b > a ? 'B' : 'A';
  }

  masterPegel() {
    return { ...this.masterMeter.lesen(), reduktion: state.master.limiter ? this.limiter.reduction : 0 };
  }

  // ---- SYNC: Tempo UND Taktphase an das andere Deck angleichen -------------
  sync(id) {
    const d = this.decks[id], o = this.decks[id === 'A' ? 'B' : 'A'];
    const sd = state.decks[id], so = state.decks[o.id];
    if (!sd.track || !so.track) return d.melden('SYNC: anderes Deck ist leer');
    if (!sd.track.grid || !so.track.grid) return d.melden('SYNC gesperrt: kein verifiziertes Taktraster');
    const ziel = so.track.grid.bpm * (1 + so.tempo / 100);
    const tempo = (ziel / sd.track.grid.bpm - 1) * 100;
    if (Math.abs(tempo) > 16) return d.melden('SYNC: Tempounterschied > 16 %');
    if (Math.abs(tempo) > sd.tempoBereich) bestaetigen(`decks.${id}.tempoBereich`, TEMPO_BEREICHE.find(b => b >= Math.abs(tempo)));
    d.tempoSetzen(tempo);
    if (sd.spielt && so.spielt) d.phaseAngleichen(o);
    bestaetigen(`decks.${id}.sync`, true);
    if (!so.master) bestaetigen(`decks.${o.id}.master`, true);
    bestaetigen(`decks.${id}.master`, false);
    d.melden('');
  }

  // pro Frame aufgerufen (main.js): SYNC halten, Ende erkennen
  takt() {
    for (const id of ['A', 'B']) {
      const d = this.decks[id], sd = state.decks[id];
      sd.pos = d.pos();
      if (sd.sync && sd.spielt) {
        const o = this.decks[id === 'A' ? 'B' : 'A'], so = state.decks[o.id];
        if (!so.track || !so.track.grid) continue;
        const ziel = so.track.grid.bpm * (1 + so.tempo / 100);
        const soll = (ziel / sd.track.grid.bpm - 1) * 100;
        if (Math.abs(soll - sd.tempo) > 0.001) d.tempoSetzen(soll);
        if (so.spielt && !sd.loop.an && !so.loop.an && this.jetzt - (d.letzteKorrektur || 0) > 1) {
          d.letzteKorrektur = this.jetzt;
          d.phaseAngleichen(o, 0.012);
        }
      }
    }
  }
}

export function xfKurve(x, kurve, id) {
  const p = (x + 1) / 2;                       // 0 = ganz A, 1 = ganz B
  const q = id === 'A' ? p : 1 - p;           // 0 = ganz eigene Seite
  if (kurve === 'scharf') return klemm((1 - q) / 0.08, 0, 1);
  return Math.cos(q * Math.PI / 2);
}

// Pegel-Abgriff: Stereo in zwei Analyser
class Abgriff {
  constructor(ctx, quelle) {
    this.split = ctx.createChannelSplitter(2);
    this.l = ctx.createAnalyser(); this.r = ctx.createAnalyser();
    for (const a of [this.l, this.r]) { a.fftSize = 2048; a.smoothingTimeConstant = 0; }
    quelle.connect(this.split);
    this.split.connect(this.l, 0); this.split.connect(this.r, 1);
    this.puf = new Float32Array(2048);
  }
  lesen() {
    this.l.getFloatTimeDomainData(this.puf); const L = blockPegel(this.puf);
    this.r.getFloatTimeDomainData(this.puf); const R = blockPegel(this.puf);
    return { L, R };
  }
  spektrum(ziel) { this.l.getByteFrequencyData(ziel); return ziel; }
}

class DeckEngine {
  constructor(engine, id) {
    this.engine = engine; this.id = id;
    const ctx = engine.ctx;
    this.ctx = ctx;
    this.entknack = ctx.createGain(); this.entknack.gain.value = 0;
    this.trim = ctx.createGain();
    this.tief = ctx.createBiquadFilter(); this.tief.type = 'lowshelf'; this.tief.frequency.value = 180;
    this.mitte = ctx.createBiquadFilter(); this.mitte.type = 'peaking'; this.mitte.frequency.value = 1000; this.mitte.Q.value = 0.8;
    this.hoch = ctx.createBiquadFilter(); this.hoch.type = 'highshelf'; this.hoch.frequency.value = 3500;
    this.tp = ctx.createBiquadFilter(); this.tp.type = 'lowpass'; this.tp.frequency.value = 22000; this.tp.Q.value = 0.7;
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 10; this.hp.Q.value = 0.7;
    this.fader = ctx.createGain();
    this.xf = ctx.createGain();
    this.entknack.connect(this.trim).connect(this.tief).connect(this.mitte).connect(this.hoch)
      .connect(this.tp).connect(this.hp).connect(this.fader).connect(this.xf).connect(engine.summe);
    this.meterPre = new Abgriff(ctx, this.hp);
    this.meterPost = new Abgriff(ctx, this.fader);
    this.buffer = null; this.quelle = null; this.token = 0;
    this.basisPos = 0; this.slipBasis = 0; this.basisZeit = 0; this.rate = 1; this.bend = 0;
    this.s = state.decks[id];
    this.trimSetzen(this.s.trim); this.faderSetzen(this.s.fader); this.filterSetzen(this.s.filter);
    for (const b of ['high', 'mid', 'low']) this.eqSetzen(b, this.s.eq[b]);
  }

  p(k) { return `decks.${this.id}.${k}`; }
  melden(text) { bestaetigen(this.p('meldung'), text); }
  get jetzt() { return this.ctx.currentTime; }

  request(k, v) {
    const s = this.s;
    switch (k) {
      case 'trim': return this.trimSetzen(v);
      case 'eq.high': case 'eq.mid': case 'eq.low': return this.eqSetzen(k.slice(3), v);
      case 'filter': return this.filterSetzen(v);
      case 'fader': return this.faderSetzen(v);
      case 'tempo':
        if (s.sync) { bestaetigen(this.p('sync'), false); }
        return this.tempoSetzen(klemm(Number(v) || 0, -s.tempoBereich, s.tempoBereich));
      case 'tempoBereich':
        if (!TEMPO_BEREICHE.includes(v)) return;
        bestaetigen(this.p('tempoBereich'), v);
        if (Math.abs(s.tempo) > v) this.tempoSetzen(klemm(s.tempo, -v, v));
        return;
      case 'quant': case 'slip': case 'vinyl': case 'beatgrid': case 'favorit':
        return bestaetigen(this.p(k), !!v);
      case 'sync':
        if (v) return this.engine.sync(this.id);
        return bestaetigen(this.p('sync'), false);
      case 'master':
        bestaetigen(this.p('master'), !!v);
        if (v) bestaetigen(`decks.${this.id === 'A' ? 'B' : 'A'}.master`, false);
        return;
    }
  }

  // ---- Regler --------------------------------------------------------------
  trimSetzen(db) {
    db = klemm(Number(db) || 0, -12, 12);
    this.trim.gain.setTargetAtTime(Math.pow(10, db / 20), this.jetzt, GLATT);
    bestaetigen(this.p('trim'), db);
  }
  eqSetzen(band, db) {
    db = klemm(Number(db) || 0, EQ_MIN, EQ_MAX);
    const f = { high: this.hoch, mid: this.mitte, low: this.tief }[band];
    f.gain.setTargetAtTime(db, this.jetzt, GLATT);
    bestaetigen(this.p('eq.' + band), db);
  }
  filterSetzen(v) {
    v = klemm(Number(v) || 0, -1, 1);
    if (Math.abs(v) < 0.04) v = 0;
    const z = this.jetzt;
    const tp = v < 0 ? 22000 * Math.pow(120 / 22000, -v) : 22000;
    const hp = v > 0 ? 10 * Math.pow(9000 / 10, v) : 10;
    this.tp.frequency.setTargetAtTime(tp, z, GLATT * 2);
    this.hp.frequency.setTargetAtTime(hp, z, GLATT * 2);
    const q = v === 0 ? 0.7 : 0.7 + Math.abs(v) * 2.2;
    this.tp.Q.setTargetAtTime(v < 0 ? q : 0.7, z, GLATT * 2);
    this.hp.Q.setTargetAtTime(v > 0 ? q : 0.7, z, GLATT * 2);
    bestaetigen(this.p('filter'), v);
  }
  faderSetzen(v) {
    v = klemm(Number(v) || 0, 0, 1);
    this.fader.gain.setTargetAtTime(faderKurve(v), this.jetzt, GLATT);
    bestaetigen(this.p('fader'), v);
  }
  hoerbar() {
    if (!this.s.spielt) return 0;
    return faderKurve(this.s.fader) * this.engine.xfPegel(this.id);
  }

  // ---- Laden ---------------------------------------------------------------
  async laden(meta) {
    if (this.s.spielt) { this.melden('Läuft gerade – zuerst pausieren'); return false; }
    bestaetigen(this.p('laden'), true);
    this.melden('');
    try {
      const daten = await this.engine.quellen.laden(meta);
      this.anhalten(true);
      this.buffer = daten.buffer;
      const wf = wellenform(daten.buffer);
      const track = { ...meta, dauer: daten.buffer.duration, grid: daten.grid || null, abschnitte: daten.abschnitte || [], wf };
      this.basisPos = 0; this.slipBasis = 0;
      bestaetigen(this.p('loop'), { an: false, start: 0, ende: 0, beats: 0 });
      bestaetigen(this.p('sync'), false);
      bestaetigen(this.p('cue'), 0);
      bestaetigen(this.p('pos'), 0);
      bestaetigen(this.p('track'), track);
      return true;
    } catch (e) {
      this.melden('Laden fehlgeschlagen: ' + (e.message || e));
      return false;
    } finally {
      bestaetigen(this.p('laden'), false);
    }
  }

  // ---- Position ------------------------------------------------------------
  roh() { return this.s.spielt ? this.basisPos + (this.jetzt - this.basisZeit) * this.rate : this.basisPos; }
  pos() {
    if (!this.buffer) return 0;
    let p = this.roh();
    const l = this.s.loop;
    if (this.s.spielt && l.an && p >= l.ende) p = l.start + ((p - l.start) % (l.ende - l.start));
    return Math.min(p, this.buffer.duration);
  }
  slipPos() { return this.s.spielt ? this.slipBasis + (this.jetzt - this.basisZeit) * this.rate : this.slipBasis; }
  neuBasis() {
    const p = this.pos(), sp = this.slipPos();
    this.basisPos = p; this.slipBasis = sp; this.basisZeit = this.jetzt;
  }

  // ---- Transport -----------------------------------------------------------
  spielen() {
    if (!this.buffer || this.s.spielt) return;
    if (this.basisPos >= this.buffer.duration - 0.05) this.basisPos = this.s.cue;
    this.quelleStarten(this.basisPos);
    bestaetigen(this.p('spielt'), true);
  }

  anhalten(still) {
    if (!this.s.spielt) return;
    this.neuBasis();
    this.quelleStoppen();
    if (!still) bestaetigen(this.p('pos'), this.basisPos);
    bestaetigen(this.p('spielt'), false);
  }

  umschalten() { this.s.spielt ? this.anhalten() : this.spielen(); }

  springen(pos) {
    if (!this.buffer) return;
    pos = klemm(pos, 0, this.buffer.duration - 0.01);
    if (this.s.spielt) {
      const l = this.s.loop;
      if (l.an && (pos < l.start || pos >= l.ende)) this.loopAus(false);
      this.quelleStoppen();
      this.basisPos = pos; this.slipBasis = pos;
      this.quelleStarten(pos);
    } else {
      this.basisPos = pos; this.slipBasis = pos;
      bestaetigen(this.p('pos'), pos);
    }
  }

  // CUE wie am Player: steht -> Cue setzen (bzw. vorhoeren solange gedrueckt), laeuft -> zurueck zum Cue und stehen
  cueDruck() {
    if (!this.buffer) return;
    if (this.s.spielt) {
      this.anhalten();
      this.springen(this.s.cue);
      return;
    }
    const p = this.pos();
    if (Math.abs(p - this.s.cue) > 0.02) {
      const neu = this.s.quant && this.s.track?.grid ? this.naechsterBeat(p) : p;
      bestaetigen(this.p('cue'), neu);
      this.springen(neu);
      return;
    }
    this.vorhoeren = true;
    this.spielen();
  }
  cueLos() {
    if (!this.vorhoeren) return;
    this.vorhoeren = false;
    this.anhalten();
    this.springen(this.s.cue);
  }

  quelleStarten(pos) {
    const ctx = this.ctx;
    const q = ctx.createBufferSource();
    q.buffer = this.buffer;
    q.playbackRate.value = this.rate + this.bend;
    const l = this.s.loop;
    if (l.an) { q.loop = true; q.loopStart = l.start; q.loopEnd = l.ende; }
    q.connect(this.entknack);
    const z = this.jetzt;
    this.entknack.gain.cancelScheduledValues(z);
    this.entknack.gain.setValueAtTime(0, z);
    this.entknack.gain.linearRampToValueAtTime(1, z + ENTKNACK);
    q.start(z, pos);
    const token = ++this.token;
    q.onended = () => { if (token === this.token) this.zuEnde(); };
    this.quelle = q;
    this.basisPos = pos; this.basisZeit = z;
  }

  quelleStoppen() {
    const q = this.quelle;
    if (!q) return;
    this.token++;
    const z = this.jetzt;
    this.entknack.gain.cancelScheduledValues(z);
    this.entknack.gain.setValueAtTime(this.entknack.gain.value, z);
    this.entknack.gain.linearRampToValueAtTime(0, z + ENTKNACK);
    try { q.stop(z + ENTKNACK + 0.001); } catch (e) { /* schon gestoppt */ }
    this.quelle = null;
  }

  zuEnde() {
    this.quelle = null;
    this.basisPos = this.buffer.duration; this.slipBasis = this.basisPos;
    bestaetigen(this.p('spielt'), false);
    bestaetigen(this.p('pos'), this.basisPos);
    if (this.s.loop.an) bestaetigen(this.p('loop'), { ...this.s.loop, an: false });
  }

  // ---- Tempo / Jog ---------------------------------------------------------
  tempoSetzen(prozent) {
    this.neuBasis();
    this.rate = 1 + prozent / 100;
    if (this.quelle) this.quelle.playbackRate.setValueAtTime(this.rate + this.bend, this.jetzt);
    bestaetigen(this.p('tempo'), Math.round(prozent * 1000) / 1000);
  }
  // Jog am Rand: Tempo kurz biegen (laeuft) / genau positionieren (steht)
  biegen(betrag) {
    if (!this.buffer) return;
    if (this.s.spielt) {
      this.neuBasis();
      this.bend = klemm(betrag, -0.5, 0.5);
      if (this.quelle) this.quelle.playbackRate.setValueAtTime(this.rate + this.bend, this.jetzt);
    }
  }
  schieben(sekunden) {
    if (!this.buffer || this.s.spielt) return;
    this.springen(this.pos() + sekunden);
  }

  // ---- Taktraster ----------------------------------------------------------
  beatLaenge() { return 60 / this.s.track.grid.bpm; }
  naechsterBeat(p) {
    const g = this.s.track.grid, b = 60 / g.bpm;
    return g.offset + Math.round((p - g.offset) / b) * b;
  }
  beatDavor(p) {
    const g = this.s.track.grid, b = 60 / g.bpm;
    return g.offset + Math.floor((p - g.offset) / b + 1e-6) * b;
  }
  phase(p) {
    const g = this.s.track.grid, b = 60 / g.bpm;
    const x = (p - g.offset) / b;
    return x - Math.floor(x);
  }
  phaseAngleichen(o, schwelle = 0) {
    let d = o.phase(o.pos()) - this.phase(this.pos());
    if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
    const sek = d * this.beatLaenge();
    if (Math.abs(sek) > schwelle) this.springen(this.pos() + sek);
  }

  // ---- Loops ---------------------------------------------------------------
  loopBeats(n) {
    if (!this.buffer || !this.s.track) return;
    const grid = this.s.track.grid;
    if (!grid) return this.melden('Beat-Loop braucht ein Taktraster');
    const l = this.s.loop;
    if (l.an && l.beats === n) return this.loopAus(true);
    const p = this.pos();
    const start = l.an ? l.start : (this.s.quant ? this.beatDavor(p) : p);
    const ende = Math.min(start + n * this.beatLaenge(), this.buffer.duration);
    this.loopAn(start, ende, n);
  }
  loopIn() {
    if (!this.buffer) return;
    const p = this.pos();
    const start = this.s.quant && this.s.track?.grid ? this.naechsterBeat(p) : p;
    bestaetigen(this.p('loop'), { an: false, start, ende: 0, beats: 0 });
  }
  loopOut() {
    if (!this.buffer) return;
    const l = this.s.loop;
    let ende = this.pos();
    if (this.s.quant && this.s.track?.grid) ende = this.naechsterBeat(ende);
    if (ende - l.start < 0.05) return this.melden('Loop zu kurz – zuerst IN setzen');
    this.loopAn(l.start, ende, 0);
  }
  loopUmschalten() {
    const l = this.s.loop;
    if (l.an) return this.loopAus(true);
    if (l.ende > l.start) this.loopAn(l.start, l.ende, l.beats);
  }
  loopAn(start, ende, beats) {
    this.neuBasis();
    bestaetigen(this.p('loop'), { an: true, start, ende, beats });
    if (this.quelle) {
      this.quelle.loopStart = start; this.quelle.loopEnd = ende; this.quelle.loop = true;
      if (this.basisPos >= ende) this.springen(start);
    }
  }
  loopAus(slipErlaubt) {
    const l = this.s.loop;
    if (!l.an) return;
    const slipZiel = this.slipPos();
    this.neuBasis();
    if (this.quelle) this.quelle.loop = false;
    bestaetigen(this.p('loop'), { ...l, an: false });
    if (slipErlaubt && this.s.slip && this.s.spielt) this.springen(slipZiel);
    else this.slipBasis = this.basisPos;
  }

  // Meter-Abgriff
  pegel() {
    return (state.master.meterAbgriff === 'post' ? this.meterPost : this.meterPre).lesen();
  }
}

export function faderKurve(v) { return v <= 0 ? 0 : Math.pow(v, 1.7); }

