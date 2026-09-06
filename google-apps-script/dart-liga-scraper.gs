/**
 * City Cafe Klagenfurt Fischl - Dart-Liga-Scraper (City Flyers)
 *
 * Holt Tabelle und Ergebnisse der beiden Hausmannschaften aus dem
 * KEDSV-Ligasystem "My Darts Tournament" und schreibt sie als dart_liga.json
 * ins GitHub-Repo. Das Dashboard (index.html) liest nur diese eine Datei und
 * fuellt damit die Erg-Spalte im Spielplan sowie den Tabellen-Slot.
 *
 * Warum ueberhaupt ein Skript dazwischen: kedsv.my-darts-tournament.at schickt
 * keinen Access-Control-Allow-Origin-Header. Ein fetch() direkt aus dem
 * Dashboard bricht der Browser deshalb ab - egal wie die URL aussieht. Serverseitig
 * (UrlFetchApp) gibt es diese Grenze nicht.
 *
 * ============================== KURZFASSUNG ==============================
 * 1. Diese Datei als neue Datei in ein Apps-Script-Projekt einfuegen. Eigenes
 *    Projekt oder das des DJ-Live-Checkers / Song-Collectors - alle drei
 *    vertragen sich (siehe Praefix-Hinweis unten).
 * 2. Script Property anlegen (Projekteinstellungen -> Skripteigenschaften):
 *      GITHUB_TOKEN = PAT mit Schreibrecht auf das Repo
 *                     (in den anderen Projekten schon vorhanden)
 * 3. Einmal dartTriggerEinrichten() ausfuehren -> legt den Trigger an.
 * 4. Zum Testen dartTestLauf() ausfuehren und ins Ausfuehrungsprotokoll schauen.
 * =========================================================================
 *
 * Alles ist mit dart/DART_ praefixiert, weil Apps Script EINEN globalen
 * Namensraum ueber alle .gs-Dateien eines Projekts teilt - ein schlichtes
 * GITHUB_REPO kollidiert sonst mit derselben Konstante im DJ-Live-Checker,
 * und das Projekt laesst sich gar nicht mehr ausfuehren. GITHUB_TOKEN ist
 * davon nicht betroffen: das ist ein Property-Schluessel, kein Bezeichner,
 * und wird bewusst mit den anderen Skripten geteilt.
 *
 * Commit-Verhalten: geschrieben wird nur, wenn sich Tabelle oder Ergebnisse
 * tatsaechlich aendern. Ausserhalb der Spieltage entstehen also gar keine
 * Commits. Gespielt wird an rund 14 Samstagen pro Saison - ein Trigger alle
 * sechs Stunden reicht dafuer bequem.
 */

const DART_GITHUB_REPO = 'motte025/City-cafe';
const DART_GITHUB_BRANCH = 'main';
const DART_DATEI = 'dart_liga.json';

const DART_BASIS = 'https://kedsv.my-darts-tournament.at/mdt/';

// Die Turnier-IDs stehen in liga_team_bewerbe.php im Abschnitt "offen" und
// wechseln jede Saison. Zum Nachschlagen: die Seite oeffnen, die Zeile der
// eigenen Liga suchen - die letzte Spalte ist die ID.
//
// WICHTIG fuer die naechste Saison: hier beide IDs neu eintragen, sonst zeigt
// das Dashboard stillschweigend die Tabelle der Vorsaison.
const DART_TEAMS = [
  { key: 'chaoten',  name: 'City-Flyers "Chaoten"',  liga: '2. Klasse C', turnierid: 317 },
  { key: 'fraggles', name: 'City-Flyers "Fraggles"', liga: '2. Klasse B', turnierid: 316 }
];

// ---------------------------------------------------------------------------
//  Live-Fenster an den Spieltagen
// ---------------------------------------------------------------------------
// Gespielt wird immer samstags ab 19:00, ein Mannschaftsabend zieht sich bis in
// die Nacht. An genau diesen Terminen wird im Minutentakt abgerufen, sonst nur
// alle paar Stunden. Die Daten stehen fest im Spielplan - es muss also nicht
// "jeder Samstag" gepollt werden, sondern genau diese 14 Runden.
//
// Beide Mannschaften spielen an denselben Tagen; zum Saisonwechsel hier
// dieselben Daten eintragen wie in DART_CLUB in index.html.
const DART_SPIELTAGE = [
  '2026-09-05', '2026-09-26', '2026-10-10', '2026-10-31', '2026-11-07',
  '2026-11-21', '2026-12-05', '2027-01-09', '2027-01-23', '2027-02-13',
  '2027-03-20', '2027-04-10', '2027-04-24', '2027-05-08'
];
const DART_LIVE_START_STUNDE = 19;   // ab 19:00 des Spieltags
const DART_LIVE_ENDE_STUNDE = 1;     // bis 01:00 des Folgetags
const DART_ZEITZONE = 'Europe/Vienna';

const DART_RUHE_MINUTEN = 360;       // ausserhalb der Spieltage: alle 6 Stunden
const DART_TRIGGER_STUNDEN = 6;      // nur noch fuer dartTriggerEinrichtenEinfach()

// Die Zeitzone des Apps-Script-Projekts muss nicht Europe/Vienna sein - deshalb
// wird sie hier ausdruecklich gesetzt statt auf getHours() zu vertrauen. Sonst
// laege das Live-Fenster im Zweifel um Stunden daneben.
function dartWienerStunde(datum) {
  return parseInt(Utilities.formatDate(datum || new Date(), DART_ZEITZONE, 'H'), 10);
}
function dartWienerTag(datum) {
  return Utilities.formatDate(datum || new Date(), DART_ZEITZONE, 'yyyy-MM-dd');
}

/**
 * Wahr zwischen 19:00 eines Spieltags und 01:00 des Folgetags.
 * Der Abschnitt nach Mitternacht gehoert noch zum Abend davor - dort wird
 * deshalb auf den VORTAG geprueft, nicht auf den laufenden Tag.
 */
function dartImLiveFenster(jetzt) {
  const n = jetzt || new Date();
  const stunde = dartWienerStunde(n);
  if (stunde >= DART_LIVE_START_STUNDE) {
    return DART_SPIELTAGE.indexOf(dartWienerTag(n)) !== -1;
  }
  if (stunde < DART_LIVE_ENDE_STUNDE) {
    const gestern = new Date(n.getTime() - 24 * 60 * 60 * 1000);
    return DART_SPIELTAGE.indexOf(dartWienerTag(gestern)) !== -1;
  }
  return false;
}

/**
 * Haengt am Minutentrigger. Am Spielabend laeuft der volle Abruf jede Minute,
 * sonst nur alle DART_RUHE_MINUTEN. Ein Leerlauf kostet dadurch fast nichts -
 * das ist wichtig, weil Apps Script die Gesamtlaufzeit aller Trigger pro Tag
 * begrenzt und ein Minutentrigger sonst 1440 volle Laeufe pro Tag machen wuerde.
 */
function dartLiveTakt() {
  const props = PropertiesService.getScriptProperties();
  const live = dartImLiveFenster();

  if (!live) {
    const zuletzt = parseInt(props.getProperty('DART_LETZTER_LAUF') || '0', 10);
    if (zuletzt && (Date.now() - zuletzt) < DART_RUHE_MINUTEN * 60 * 1000) return;
  }

  props.setProperty('DART_LETZTER_LAUF', String(Date.now()));
  dartLigaAktualisieren();
}

// ===========================================================================
//  Hauptlauf
// ===========================================================================

function dartLigaAktualisieren() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Script Property GITHUB_TOKEN fehlt.');

  const teams = {};
  DART_TEAMS.forEach(function (t) {
    const tabelle = dartHoleTabelle(t.turnierid);
    const ergebnisse = dartHoleErgebnisse(t.turnierid, t.name);

    // Ein leeres Ergebnis ist fast immer eine Stoerung (Seite umgebaut, Turnier-ID
    // veraltet, Server weg) und kein echter Leerstand. Lieber diese Mannschaft
    // ueberspringen und den alten Stand behalten, als eine leere Tabelle
    // aufs Dashboard schreiben.
    if (!tabelle.length) {
      Logger.log('WARNUNG: keine Tabelle fuer ' + t.name + ' (Turnier ' + t.turnierid + ') - Mannschaft uebersprungen.');
      return;
    }
    const einzel = dartParseEinzelwertung(dartSeiteHolen('team_einzelwertung.php', t.turnierid));
    const kader = dartParseKader(dartSeiteHolen('spieler.php', t.turnierid), t.name);

    // Letzter Mannschaftsabend samt seinen zehn Paarungen. Kostet zwei
    // zusaetzliche Abrufe (Session + Detailseite) und wird deshalb nur geholt,
    // wenn ueberhaupt schon gespielt wurde.
    let letztes = null;
    const runde = dartLetzteGespielteRunde(ergebnisse);
    if (runde !== null && ergebnisse[String(runde)].id) {
      const paarungen = dartHoleSpielDetail(t.turnierid, ergebnisse[String(runde)].id);
      if (paarungen.length) {
        letztes = {
          runde: runde,
          heim: ergebnisse[String(runde)].heim,
          auswaerts: ergebnisse[String(runde)].auswaerts,
          paarungen: paarungen
        };
      }
    }

    teams[t.key] = {
      turnierid: t.turnierid,
      liga: t.liga,
      tabelle: tabelle,
      ergebnisse: ergebnisse,
      einzelwertung: einzel,
      kader: kader,
      letztes_spiel: letztes
    };
    Logger.log(t.name + ': ' + tabelle.length + ' Tabellenplaetze, ' +
               Object.keys(ergebnisse).length + ' Runden mit Gegner, ' +
               dartGespielte(ergebnisse) + ' davon gespielt, ' +
               einzel.length + ' in der Einzelwertung, ' +
               kader.length + ' im Kader' +
               (letztes ? ', letztes Spiel Runde ' + letztes.runde + ' mit ' + letztes.paarungen.length + ' Paarungen.'
                        : ', noch kein Spiel-Detail.'));
  });

  if (!Object.keys(teams).length) {
    Logger.log('Nichts abrufbar - kein Commit.');
    return;
  }

  dartSchreibeWennNoetig(teams, token);
}

function dartGespielte(ergebnisse) {
  return Object.keys(ergebnisse).filter(function (r) {
    return ergebnisse[r].heim + ergebnisse[r].auswaerts > 0;
  }).length;
}

// ===========================================================================
//  Abruf + Auswertung der MDT-Seiten
// ===========================================================================
//
// Die Turnierauswahl laeuft ueber den Query-Parameter "turnierid" - derselbe
// Name, den liga_team_bewerbe.php in seinen Zeilen-Klicks benutzt
// (onclick=...spieler.php?turnierid=317). Mit "id" oder "tid" antwortet der
// Server dagegen mit einem Default-Turnier ("Training"), ohne zu meckern -
// eine falsch benannte Variable faellt hier also nicht als Fehler auf,
// sondern als stillschweigend falsche Tabelle.
//
// Eine Session oder ein Cookie wird nicht gebraucht: tabelle.php?turnierid=317
// liefert die richtige Tabelle auch beim allerersten Aufruf.

function dartSeiteHolen(seite, turnierid) {
  const url = DART_BASIS + seite + '?turnierid=' + encodeURIComponent(turnierid);
  const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('Abruf fehlgeschlagen (' + res.getResponseCode() + '): ' + url);
    return '';
  }
  return res.getContentText('UTF-8');
}

function dartHoleTabelle(turnierid) {
  return dartParseTabelle(dartSeiteHolen('tabelle.php', turnierid));
}

function dartHoleErgebnisse(turnierid, eigenerName) {
  return dartParseVorrunde(dartSeiteHolen('vorrunde.php', turnierid), eigenerName);
}

// ---------------------------------------------------------------------------
//  HTML-Werkzeug
// ---------------------------------------------------------------------------

function dartEntitaeten(t) {
  return String(t)
    .replace(/&nbsp;/g, ' ')
    // MDT schreibt Anfuehrungszeichen als &#34; - ohne den numerischen Zweig
    // landet 'ASKÖ DC Wolfsberg &#34;Dolphins&#34;' roh in der Tabelle.
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    // &amp; zuletzt, sonst wuerde '&amp;quot;' vorzeitig zu einem echten
    // Anfuehrungszeichen statt zum Text '&quot;'.
    .replace(/&amp;/g, '&');
}

function dartText(html) {
  return dartEntitaeten(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function dartTabellenZeilen(html) {
  return String(html).match(/<tr[\s\S]*?<\/tr>/gi) || [];
}

function dartZellen(zeile) {
  const roh = zeile.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
  return roh.map(dartText);
}

// Namen aus MDT und aus dem Dashboard vergleichbar machen: der Server benutzt
// deutsche Anfuehrungszeichen („Waddling Arrows“), die Aushaenge gerade.
function dartSchluessel(name) {
  return String(name || '')
    .replace(/[„“”«»‚‘’]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
//  tabelle.php
// ---------------------------------------------------------------------------
// Spalten: Rang | Team | Spiele | Siege | Unentsch. | Niederlage | Sets+ |
//          Sets- | Sets+/- | Legs+ | Legs- | Legs+/- | Score-Diff | S/B | Punkte
// Uebernommen wird nur, was das Dashboard zeigt - Punkte stehen ganz hinten.

function dartParseTabelle(html) {
  const out = [];
  dartTabellenZeilen(html).forEach(function (z) {
    if (/<th[\s>]/i.test(z)) return;           // Kopfzeile
    const c = dartZellen(z);
    if (c.length < 15) return;
    const rang = parseInt(c[0], 10);
    if (!isFinite(rang) || !c[1]) return;
    out.push({
      rang: rang,
      team: c[1],
      spiele: parseInt(c[2], 10) || 0,
      siege: parseInt(c[3], 10) || 0,
      unentschieden: parseInt(c[4], 10) || 0,
      niederlagen: parseInt(c[5], 10) || 0,
      punkte: parseInt(c[14], 10) || 0
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
//  vorrunde.php
// ---------------------------------------------------------------------------
// Aufbau: vor jeder Runde eine Trennzeile ("2026-09-05 - Runde 1"), darunter
// die vier Begegnungen.
//
// Das HTML ist an einer Stelle kaputt: die Ergebniszelle oeffnet ein zweites
// <td> fuer den Gastverein, ohne das erste zu schliessen -
//     <td>0&nbsp;:&nbsp;0<td>Askö DC Sonne 2</td>
// Spielstand und Gastverein landen dadurch in derselben Zelle, und die
// Spaltennummern verschieben sich. Deshalb wird nicht nach fester Position
// gesucht, sondern nach der Zelle, die mit einem Spielstand beginnt: davor
// steht der Heimverein, im Rest derselben Zelle der Gast.

function dartParseVorrunde(html, eigenerName) {
  const ergebnisse = {};
  const eigen = dartSchluessel(eigenerName);
  let runde = null;

  dartTabellenZeilen(html).forEach(function (z) {
    const c = dartZellen(z);
    if (!c.length) return;

    const kopf = c[0] && c[0].match(/(\d{4}-\d{2}-\d{2})\s*-\s*Runde\s*(\d+)/);
    if (kopf) { runde = parseInt(kopf[2], 10); return; }
    if (runde === null) return;

    let i = -1, m = null;
    for (let k = 1; k < c.length; k++) {
      const t = c[k].match(/^(\d+)\s*:\s*(\d+)\s*(.*)$/);
      if (t && t[3]) { i = k; m = t; break; }
    }
    if (i < 1) return;

    const heim = c[i - 1], aus = m[3];
    if (dartSchluessel(heim) !== eigen && dartSchluessel(aus) !== eigen) return;

    // Freilos-Runden gar nicht erst aufnehmen. MDT bucht dem spielfreien Team
    // ein 10:0 - das ist kein Ergebnis, sondern eine Verrechnung. Im Dashboard
    // steht bei diesen Runden ohnehin "spielfrei"; wuerden sie hier landen,
    // zaehlte jede Diagnose sie als gespieltes Match mit.
    if (dartIstFreilos(heim) || dartIstFreilos(aus)) return;

    const eintrag = { heim: parseInt(m[1], 10), auswaerts: parseInt(m[2], 10) };
    // Die teamSpielId steht im onclick des "Spiele"-Knopfes derselben Zeile.
    // Ueber sie kommt spaeter die Detailseite mit den zehn Paarungen.
    const id = z.match(/teamSpielId=(\d+)/);
    if (id) eintrag.id = parseInt(id[1], 10);
    ergebnisse[String(runde)] = eintrag;
  });
  return ergebnisse;
}

// ---------------------------------------------------------------------------
//  team_einzelwertung.php - Einzelwertung der ganzen Klasse
// ---------------------------------------------------------------------------
// Spalten: # | Spieler | S | Sieg | NL | L+ | L- | +/- | D | P
// Die Liste umfasst ALLE Spieler der Klasse, nicht nur die eigenen - wer zu
// uns gehoert, entscheidet der Kader aus spieler.php.
function dartParseEinzelwertung(html) {
  const out = [];
  dartTabellenZeilen(html).forEach(function (z) {
    if (/<th[\s>]/i.test(z)) return;
    const c = dartZellen(z);
    if (c.length < 10) return;
    const rang = parseInt(c[0], 10);
    if (!isFinite(rang) || !c[1]) return;
    out.push({
      rang: rang,
      spieler: c[1],
      spiele: parseInt(c[2], 10) || 0,
      siege: parseInt(c[3], 10) || 0,
      niederlagen: parseInt(c[4], 10) || 0,
      legs_plus: parseInt(c[5], 10) || 0,
      legs_minus: parseInt(c[6], 10) || 0,
      punkte: parseInt(c[9], 10) || 0
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
//  spieler.php - Kader je Verein
// ---------------------------------------------------------------------------
// Die Seite listet alle Vereine der Klasse untereinander: eine Zeile mit dem
// Vereinsnamen, darunter dessen Spieler - jeweils als einzelne Zelle. Gesucht
// sind nur die Namen unter der eigenen Mannschaft, bis der naechste Verein
// beginnt.
function dartParseKader(html, eigenerName) {
  const eigen = dartSchluessel(eigenerName);
  const kader = [];
  let drin = false;

  dartTabellenZeilen(html).forEach(function (z) {
    if (/<th[\s>]/i.test(z)) return;
    const c = dartZellen(z);
    if (c.length !== 1 || !c[0]) return;
    const wert = c[0];

    // Ein Spielername ist "NACHNAME Vorname" - alles andere ist ein Verein.
    if (dartIstSpielername(wert)) {
      if (drin) kader.push(wert);
    } else {
      drin = (dartSchluessel(wert) === eigen);
    }
  });
  return kader;
}

// "NACHNAME Vorname": genau zwei Woerter, das erste ohne Kleinbuchstaben.
// Das ss-Zeichen zaehlt dabei nicht als Kleinbuchstabe - sonst fiele
// "FRIEssNEGGER Gerhard" durch und der Spieler waere ploetzlich ein Verein.
function dartIstSpielername(wert) {
  const w = String(wert).trim().split(/\s+/);
  return w.length === 2 && !/[a-zäöü]/.test(w[0]) && /[a-zäöü]/.test(w[1]);
}

// ---------------------------------------------------------------------------
//  Spiel-Detailseite - die zehn Paarungen eines Mannschaftsabends
// ---------------------------------------------------------------------------
// Diese eine Seite hoert NICHT auf turnierid, sondern nur auf die Session:
// ein direkter Aufruf liefert die Kopfzeile und sonst nichts, weil der Server
// dann das Default-Turnier ("Training") annimmt. Erst ein vorheriger Aufruf
// von spieler.php?turnierid=<id> mit demselben Cookie stellt das Turnier ein.
//
// UrlFetchApp fuehrt kein Cookie-Glas mit - das Set-Cookie der ersten Antwort
// muss deshalb von Hand in den Header der zweiten wandern.
function dartSessionCookie(turnierid) {
  const res = UrlFetchApp.fetch(DART_BASIS + 'spieler.php?turnierid=' + encodeURIComponent(turnierid),
    { method: 'get', muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return '';

  const kopf = res.getAllHeaders();
  let roh = kopf['Set-Cookie'] || kopf['set-cookie'] || [];
  if (!Array.isArray(roh)) roh = [roh];
  return roh.map(function (c) { return String(c).split(';')[0]; }).join('; ');
}

/**
 * Holt die Paarungen eines Mannschaftsspiels.
 * Ohne Cookie oder bei leerer Seite kommt ein leeres Array zurueck - der
 * Slot faellt dann aus, statt eine leere Tabelle zu zeigen.
 */
function dartHoleSpielDetail(turnierid, spielId) {
  const cookie = dartSessionCookie(turnierid);
  if (!cookie) {
    Logger.log('WARNUNG: keine Session fuer Turnier ' + turnierid + ' - Spiel-Detail uebersprungen.');
    return [];
  }
  const url = DART_BASIS + 'vorrunde.php?teamSpielId=' + encodeURIComponent(spielId) +
              '&turnierId=' + encodeURIComponent(turnierid) + '&route=vorrunde.php';
  const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, headers: { Cookie: cookie } });
  if (res.getResponseCode() !== 200) return [];
  return dartParseSpielDetail(res.getContentText('UTF-8'));
}

// Spalten: # | (leer) | (leer) | Spieler 1 | Erg | Spieler 2 | Schreiber | Diff | Bof | B
// Die Kennung sieht aus wie "100101.H_DE1 - G_DE1"; die zwei Buchstaben darin
// nennen die Disziplin: DE Damen-Einzel, HE Herren-Einzel, OE Offen-Einzel,
// MD Mixed-Doppel, OD Offen-Doppel.
function dartParseSpielDetail(html) {
  const out = [];
  dartTabellenZeilen(html).forEach(function (z) {
    if (/<th[\s>]/i.test(z)) return;
    const c = dartZellen(z);
    if (c.length < 6) return;
    if (!c[3] || !c[5]) return;

    const erg = String(c[4]).match(/^(\d+)\s*:\s*(\d+)$/);
    if (!erg) return;

    const art = String(c[0]).match(/\.[HG]_([A-Z]{2})/);
    out.push({
      art: art ? art[1] : '',
      spieler1: c[3],
      spieler2: c[5],
      legs1: parseInt(erg[1], 10),
      legs2: parseInt(erg[2], 10)
    });
  });
  return out;
}

// Hoechste Runde, in der wirklich gespielt wurde - das ist der letzte
// Mannschaftsabend. Freilos-Runden stehen gar nicht erst in ergebnisse.
function dartLetzteGespielteRunde(ergebnisse) {
  let beste = null;
  Object.keys(ergebnisse).forEach(function (r) {
    const e = ergebnisse[r];
    if (e.heim + e.auswaerts <= 0) return;
    const n = parseInt(r, 10);
    if (beste === null || n > beste) beste = n;
  });
  return beste;
}

// Die spielfreie Runde heisst im KEDSV-System "Freilos" mit angehaengter
// Gruppennummer ("Freilos 2", "Freilos 3").
function dartIstFreilos(name) {
  return /^freilos\b/.test(dartSchluessel(name));
}

// ===========================================================================
//  Schreiben ins Repo
// ===========================================================================

function dartSchreibeWennNoetig(teams, token) {
  const vorhanden = dartGithubLies(DART_DATEI, token);
  let alt = null;
  if (vorhanden) {
    try { alt = JSON.parse(vorhanden.text); } catch (fehler) { alt = null; }
  }

  // Nur der Inhalt zaehlt fuer den Vergleich - "aktualisiert" aendert sich bei
  // jedem Lauf und wuerde sonst alle sechs Stunden einen Commit ausloesen.
  const neuJson = JSON.stringify(teams);
  const altJson = alt && alt.teams ? JSON.stringify(alt.teams) : '';
  if (neuJson === altJson) {
    Logger.log('Keine Aenderung - kein Commit.');
    return;
  }

  const inhalt = JSON.stringify({
    aktualisiert: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    quelle: DART_BASIS,
    teams: teams
  }, null, 2) + '\n';

  const gespielt = Object.keys(teams).map(function (k) {
    return k + ' ' + dartGespielte(teams[k].ergebnisse);
  }).join(', ');

  const nachricht = 'Auto: Dart-Liga aktualisiert (' + gespielt + ')';
  dartGithubSchreibe(DART_DATEI, inhalt, vorhanden ? vorhanden.sha : null, nachricht, token);
  Logger.log(nachricht);
}

// ===========================================================================
//  GitHub Contents API
// ===========================================================================

function dartGithubKopf(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function dartGithubLies(pfad, token) {
  const url = 'https://api.github.com/repos/' + DART_GITHUB_REPO + '/contents/' + pfad +
              '?ref=' + encodeURIComponent(DART_GITHUB_BRANCH);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: dartGithubKopf(token),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) {
    throw new Error('GitHub-Lesefehler ' + res.getResponseCode() + ': ' + res.getContentText());
  }

  const body = JSON.parse(res.getContentText());
  // Die API liefert Base64 mit eingestreuten Zeilenumbruechen - die stoeren den Decoder.
  const roh = Utilities.base64Decode(String(body.content).replace(/\s/g, ''));
  return { sha: body.sha, text: Utilities.newBlob(roh).getDataAsString('UTF-8') };
}

function dartGithubSchreibe(pfad, text, sha, nachricht, token) {
  const nutzlast = {
    message: nachricht,
    content: Utilities.base64Encode(text, Utilities.Charset.UTF_8),
    branch: DART_GITHUB_BRANCH
  };
  if (sha) nutzlast.sha = sha;   // ohne sha legt die API die Datei neu an

  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + DART_GITHUB_REPO + '/contents/' + pfad, {
    method: 'put',
    contentType: 'application/json',
    headers: dartGithubKopf(token),
    payload: JSON.stringify(nutzlast),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub-Schreibfehler ' + code + ': ' + res.getContentText());
  }
}

// ===========================================================================
//  Einrichtung / Test - einmal von Hand ausfuehren
// ===========================================================================

/**
 * Legt den Minutentrigger an. dartLiveTakt() entscheidet bei jedem Aufruf
 * selbst, ob wirklich abgerufen wird - am Spielabend jede Minute, sonst alle
 * sechs Stunden.
 */
function dartTriggerEinrichten() {
  dartTriggerEntfernen();
  ScriptApp.newTrigger('dartLiveTakt').timeBased().everyMinutes(1).create();
  Logger.log('Trigger angelegt: dartLiveTakt jede Minute.');
  Logger.log('Live-Fenster: ' + DART_SPIELTAGE.length + ' Spieltage, jeweils ' +
             DART_LIVE_START_STUNDE + ':00 bis ' + DART_LIVE_ENDE_STUNDE + ':00 (' + DART_ZEITZONE + ').');
  Logger.log('Ausserhalb davon laeuft der Abruf alle ' + (DART_RUHE_MINUTEN / 60) + ' Stunden.');
}

function dartTriggerEntfernen() {
  let anzahl = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const f = t.getHandlerFunction();
    if (f === 'dartLiveTakt' || f === 'dartLigaAktualisieren') { ScriptApp.deleteTrigger(t); anzahl++; }
  });
  if (anzahl) Logger.log(anzahl + ' Trigger entfernt.');
}

/**
 * Trockenlauf: ruft beide Turniere ab und schreibt das Ergebnis nur ins
 * Protokoll - kein Commit. Erste Anlaufstelle, wenn im Dashboard eine
 * Tabelle fehlt oder veraltet aussieht.
 */
function dartTestLauf() {
  DART_TEAMS.forEach(function (t) {
    const tabelle = dartHoleTabelle(t.turnierid);
    const ergebnisse = dartHoleErgebnisse(t.turnierid, t.name);

    Logger.log('--- ' + t.name + ' (' + t.liga + ', Turnier ' + t.turnierid + ') ---');
    Logger.log('Tabelle: ' + tabelle.length + ' Zeilen');
    tabelle.forEach(function (r) {
      Logger.log('  ' + r.rang + '. ' + r.team + '  Sp ' + r.spiele +
                 ' / S ' + r.siege + ' / U ' + r.unentschieden +
                 ' / N ' + r.niederlagen + ' / Pkt ' + r.punkte);
    });

    const eigene = tabelle.filter(function (r) { return dartSchluessel(r.team) === dartSchluessel(t.name); });
    Logger.log(eigene.length ? 'Eigene Mannschaft auf Rang ' + eigene[0].rang
                             : 'ACHTUNG: eigene Mannschaft nicht in der Tabelle - Turnier-ID pruefen!');

    // "mit Gegner": die beiden Freilos-Runden je Mannschaft stehen bewusst
    // nicht drin, sonst zaehlten sie hier als gespieltes Match mit.
    Logger.log('Runden mit Gegner: ' + Object.keys(ergebnisse).length +
               ', davon gespielt: ' + dartGespielte(ergebnisse));
    Object.keys(ergebnisse).sort(function (a, b) { return a - b; }).forEach(function (r) {
      Logger.log('  Runde ' + r + ': ' + ergebnisse[r].heim + ':' + ergebnisse[r].auswaerts);
    });
  });
}
