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

const DART_TRIGGER_STUNDEN = 6;

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
    teams[t.key] = {
      turnierid: t.turnierid,
      liga: t.liga,
      tabelle: tabelle,
      ergebnisse: ergebnisse
    };
    Logger.log(t.name + ': ' + tabelle.length + ' Tabellenplaetze, ' +
               Object.keys(ergebnisse).length + ' Runden, ' +
               dartGespielte(ergebnisse) + ' davon gespielt.');
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
    if (dartSchluessel(heim) === eigen || dartSchluessel(aus) === eigen) {
      ergebnisse[String(runde)] = { heim: parseInt(m[1], 10), auswaerts: parseInt(m[2], 10) };
    }
  });
  return ergebnisse;
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

function dartTriggerEinrichten() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dartLigaAktualisieren') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dartLigaAktualisieren').timeBased().everyHours(DART_TRIGGER_STUNDEN).create();
  Logger.log('Trigger angelegt: dartLigaAktualisieren alle ' + DART_TRIGGER_STUNDEN + ' Stunden.');
}

function dartTriggerEntfernen() {
  let anzahl = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dartLigaAktualisieren') { ScriptApp.deleteTrigger(t); anzahl++; }
  });
  Logger.log(anzahl + ' Trigger entfernt.');
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

    Logger.log('Runden: ' + Object.keys(ergebnisse).length + ', gespielt: ' + dartGespielte(ergebnisse));
    Object.keys(ergebnisse).sort(function (a, b) { return a - b; }).forEach(function (r) {
      Logger.log('  Runde ' + r + ': ' + ergebnisse[r].heim + ':' + ergebnisse[r].auswaerts);
    });
  });
}
