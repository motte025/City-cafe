/**
 * City Cafe Klagenfurt Fischl - DJ-Live-Status-Checker
 *
 * Prueft im Minutentakt-Trigger, welche der in dj_channels.json hinterlegten
 * DJ-Kanaele gerade live senden, und schreibt das Ergebnis als live_status.json
 * zurueck ins GitHub-Repo. Das Dashboard (index.html) liest nur diese eine Datei
 * und blendet den DJ-Live-Slot genau dann ein, wenn "live" nicht leer ist.
 *
 * Vollstaendige Einrichtung inkl. aller Zugangsdaten: DJ-LIVESTREAM-SETUP.md
 *
 * ============================== KURZFASSUNG ==============================
 * 1. Dieses Skript als neue Datei in ein Apps-Script-Projekt einfuegen. Eigenes
 *    Projekt oder das des Song-Collectors - beides geht.
 * 2. Script Properties anlegen (Projekteinstellungen -> Skripteigenschaften):
 *      GITHUB_TOKEN          = PAT mit Schreibrecht auf das Repo
 *                              (im Song-Collector-Projekt schon vorhanden)
 *      TWITCH_CLIENT_ID      = <Client-ID der Twitch-Anwendung>
 *      TWITCH_CLIENT_SECRET  = <Client-Secret der Twitch-Anwendung>
 *    Die Werte gehoeren NICHT ins Repo - dieses ist oeffentlich einsehbar.
 * 3. Einmal djTriggerEinrichten() ausfuehren -> legt den 5-Minuten-Trigger an.
 * 4. Zum Testen djTestLauf() ausfuehren und ins Ausfuehrungsprotokoll schauen.
 * =========================================================================
 *
 * Warum alles mit dj/DJ_ praefixiert ist: Apps Script teilt sich EINEN globalen
 * Namensraum ueber alle .gs-Dateien eines Projekts. Ein schlichtes GITHUB_REPO
 * kollidiert deshalb mit derselben Konstante im Song-Collector, und das Projekt
 * laesst sich gar nicht mehr ausfuehren ("Identifier has already been
 * declared"). Die Praefixe halten den Checker in jedem Projekt vertraeglich.
 * Die Script-Property-SCHLUESSEL (GITHUB_TOKEN & Co.) sind davon nicht
 * betroffen - das sind Strings, keine Bezeichner, und GITHUB_TOKEN wird mit dem
 * Song-Collector bewusst geteilt.
 *
 * Commit-Verhalten: geschrieben wird nur, wenn sich die Live-Liste tatsaechlich
 * aendert - plus ein Herzschlag alle DJ_HEARTBEAT_MINUTEN, solange jemand live ist,
 * damit checked_at im Dashboard nicht veraltet. Bei niemandem live entstehen
 * also gar keine Commits. Ohne diese Bremse haette das Repo bei einem
 * 5-Minuten-Trigger rund 8.600 Commits pro Monat.
 */

const DJ_GITHUB_REPO = 'motte025/City-cafe';
const DJ_GITHUB_BRANCH = 'main';
const DJ_KANAL_DATEI = 'dj_channels.json';
const DJ_STATUS_DATEI = 'live_status.json';

// Solange jemand live ist, wird der Zeitstempel spaetestens so oft aufgefrischt.
// Muss deutlich unter DJ_LIVE_CONFIG.maxStatusAlterMinuten (45) im Dashboard
// liegen, sonst haelt das Dashboard einen laufenden Stream faelschlich fuer alt.
const DJ_HEARTBEAT_MINUTEN = 15;

// Twitch erlaubt bis zu 100 user_login-Parameter pro Abfrage.
const DJ_TWITCH_BATCH = 100;

const DJ_TRIGGER_MINUTEN = 5; // erlaubt sind 1, 5, 10, 15 oder 30

// ===========================================================================
//  Einstieg
// ===========================================================================

function djPruefeLiveStatus() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) {
    Logger.log('FEHLER: Script Property GITHUB_TOKEN fehlt.');
    return;
  }

  const kanalDatei = djGithubLies(DJ_KANAL_DATEI, token);
  if (!kanalDatei) {
    Logger.log('FEHLER: ' + DJ_KANAL_DATEI + ' nicht im Repo gefunden.');
    return;
  }

  let kanaele;
  try {
    kanaele = JSON.parse(kanalDatei.text);
  } catch (fehler) {
    Logger.log('FEHLER: ' + DJ_KANAL_DATEI + ' ist kein gueltiges JSON: ' + fehler);
    return;
  }
  if (!Array.isArray(kanaele)) {
    Logger.log('FEHLER: ' + DJ_KANAL_DATEI + ' muss eine Liste sein.');
    return;
  }

  const twitchKanaele = kanaele.filter(k => k && k.platform === 'twitch' && k.channel);
  const youtubeKanaele = kanaele.filter(k => k && k.platform === 'youtube' && (k.channelId || k.handle));

  // Ein Ausfall auf einer Plattform darf nicht als "alle offline" durchgehen -
  // sonst reisst eine kurze API-Stoerung einen laufenden Stream vom Screen.
  // Dann wird lieber gar nichts geschrieben: der alte Stand bleibt stehen und
  // faellt nach 45 Minuten ueber die Altersgrenze im Dashboard von selbst aus.
  const twitchErgebnis = djPruefeTwitch(twitchKanaele, props);
  if (twitchErgebnis.fehler) {
    Logger.log('Twitch-Abfrage fehlgeschlagen (' + twitchErgebnis.fehler + ') - Lauf wird verworfen.');
    return;
  }

  const youtubeErgebnis = djPruefeYoutube(youtubeKanaele);
  if (youtubeErgebnis.fehler) {
    Logger.log('YouTube-Abfrage fehlgeschlagen (' + youtubeErgebnis.fehler + ') - Lauf wird verworfen.');
    return;
  }

  const live = twitchErgebnis.live.concat(youtubeErgebnis.live);
  Logger.log('Live: ' + live.length + ' von ' + kanaele.length + ' Kanaelen.');

  djSchreibeStatusWennNoetig(live, token);
}

// ===========================================================================
//  Twitch
// ===========================================================================

// App Access Token (Client-Credentials-Flow). Gilt rund 60 Tage, wird deshalb in
// den Script Properties zwischengespeichert und erst kurz vor Ablauf erneuert.
function djTwitchToken(props) {
  const gespeichert = props.getProperty('TWITCH_APP_TOKEN');
  const ablauf = Number(props.getProperty('TWITCH_APP_TOKEN_ABLAUF') || 0);
  // 10 Minuten Sicherheitsabstand, damit kein Lauf mitten im Ablauf steht.
  if (gespeichert && Date.now() < ablauf - 10 * 60 * 1000) return gespeichert;

  const clientId = props.getProperty('TWITCH_CLIENT_ID');
  const clientSecret = props.getProperty('TWITCH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Script Properties TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET fehlen');
  }

  const res = UrlFetchApp.fetch('https://id.twitch.tv/oauth2/token', {
    method: 'post',
    payload: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Token-Abruf HTTP ' + res.getResponseCode() + ': ' + res.getContentText());
  }

  const daten = JSON.parse(res.getContentText());
  props.setProperty('TWITCH_APP_TOKEN', daten.access_token);
  props.setProperty('TWITCH_APP_TOKEN_ABLAUF', String(Date.now() + Number(daten.expires_in || 0) * 1000));
  return daten.access_token;
}

function djPruefeTwitch(kanaele, props) {
  if (!kanaele.length) return { live: [], fehler: null };

  let token, clientId;
  try {
    token = djTwitchToken(props);
    clientId = props.getProperty('TWITCH_CLIENT_ID');
  } catch (fehler) {
    return { live: [], fehler: String(fehler) };
  }

  // Kleinschreibung, weil Twitch die Antwort ueber user_login zurueckgibt und
  // wir sie den Eintraegen aus dj_channels.json wieder zuordnen muessen.
  const nachLogin = {};
  kanaele.forEach(k => { nachLogin[String(k.channel).toLowerCase()] = k; });

  const live = [];
  const logins = Object.keys(nachLogin);

  for (let i = 0; i < logins.length; i += DJ_TWITCH_BATCH) {
    const teil = logins.slice(i, i + DJ_TWITCH_BATCH);
    const url = 'https://api.twitch.tv/helix/streams?' +
      teil.map(l => 'user_login=' + encodeURIComponent(l)).join('&');

    let res;
    try {
      res = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: { 'Client-Id': clientId, 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      });
    } catch (fehler) {
      return { live: [], fehler: String(fehler) };
    }

    if (res.getResponseCode() === 401) {
      // Token abgelaufen oder zurueckgezogen: verwerfen, naechster Lauf holt ein neues.
      props.deleteProperty('TWITCH_APP_TOKEN');
      props.deleteProperty('TWITCH_APP_TOKEN_ABLAUF');
      return { live: [], fehler: 'HTTP 401 (Token verworfen)' };
    }
    if (res.getResponseCode() !== 200) {
      return { live: [], fehler: 'HTTP ' + res.getResponseCode() + ': ' + res.getContentText() };
    }

    // Das Feld "data" enthaelt ausschliesslich Kanaele, die tatsaechlich senden -
    // ein leeres Array heisst also: alle abgefragten Kanaele sind offline.
    const daten = JSON.parse(res.getContentText()).data || [];
    daten.forEach(stream => {
      if (stream.type && stream.type !== 'live') return; // z. B. "vodcast"
      const quelle = nachLogin[String(stream.user_login).toLowerCase()];
      if (!quelle) return;
      const eintrag = { platform: 'twitch', channel: quelle.channel };
      const name = quelle.name || stream.user_name;
      if (name) eintrag.name = name;
      if (stream.title) eintrag.title = stream.title;
      if (stream.game_name) eintrag.game = stream.game_name;
      live.push(eintrag);
    });
  }

  return { live: live, fehler: null };
}

// ===========================================================================
//  YouTube
// ===========================================================================
//
// Bewusst ohne API-Key: die Kanalseite /live wird serverseitig abgerufen und
// ausgewertet. Sendet der Kanal, zeigt der canonical-Link der Seite auf eine
// /watch?v=...-URL; sonst auf die normale Kanalseite. Das ist die gaengige,
// aber inoffizielle Methode - sie kann sich jederzeit aendern. Faellt sie aus,
// waere die YouTube Data API v3 (search.list mit eventType=live) der Ersatz;
// die kostet allerdings 100 Quota-Einheiten pro Aufruf bei 10.000 pro Tag, ein
// 5-Minuten-Trigger mit einem Kanal liegt damit schon bei 28.800/Tag. Dann
// muesste der Takt deutlich groeber werden (oder ein eigener Key pro Kanal her).

function djPruefeYoutube(kanaele) {
  if (!kanaele.length) return { live: [], fehler: null };

  const live = [];
  let fehlerZaehler = 0;
  let letzterFehler = '';

  kanaele.forEach(kanal => {
    const url = kanal.channelId
      ? 'https://www.youtube.com/channel/' + encodeURIComponent(kanal.channelId) + '/live'
      : 'https://www.youtube.com/@' + encodeURIComponent(String(kanal.handle).replace(/^@/, '')) + '/live';

    let html;
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        followRedirects: true,
        muteHttpExceptions: true,
        headers: {
          // Ohne gesetztes CONSENT-Cookie liefert YouTube aus der EU heraus die
          // Einwilligungs-Zwischenseite statt der Kanalseite.
          'Cookie': 'CONSENT=YES+cb',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
        }
      });
      if (res.getResponseCode() !== 200) {
        fehlerZaehler++;
        letzterFehler = 'HTTP ' + res.getResponseCode();
        return;
      }
      html = res.getContentText();
    } catch (fehler) {
      fehlerZaehler++;
      letzterFehler = String(fehler);
      return;
    }

    const videoId = djVideoIdAusSeite(html);
    if (!videoId) return;                    // nicht live - Kanalseite statt Video
    if (!djSeiteIstLive(html)) return;  // /live kann auch auf eine Aufzeichnung zeigen

    const eintrag = { platform: 'youtube', videoId: videoId };
    if (kanal.channelId) eintrag.channelId = kanal.channelId;
    if (kanal.handle) eintrag.handle = kanal.handle;
    const name = kanal.name || djFeld(html, /"author"\s*:\s*"([^"]+)"/);
    if (name) eintrag.name = name;
    const titel = djFeld(html, /<meta\s+property="og:title"\s+content="([^"]*)"/);
    if (titel) eintrag.title = djEntkommeHtml(titel);
    live.push(eintrag);
  });

  // Nur wenn ALLE YouTube-Abrufe scheitern, ist von einer echten Stoerung
  // auszugehen. Ein einzelner Aussetzer gilt als "gerade nicht live" und
  // korrigiert sich beim naechsten Lauf in wenigen Minuten von selbst.
  if (fehlerZaehler > 0 && fehlerZaehler === kanaele.length) {
    return { live: [], fehler: 'alle ' + fehlerZaehler + ' Abrufe fehlgeschlagen, zuletzt: ' + letzterFehler };
  }
  return { live: live, fehler: null };
}

function djVideoIdAusSeite(html) {
  const canonical = djFeld(html, /<link\s+rel="canonical"\s+href="([^"]+)"/);
  if (canonical) {
    const treffer = canonical.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (treffer) return treffer[1];
    return '';   // canonical zeigt auf die Kanalseite -> nicht live
  }
  // Notfall-Muster, falls YouTube den canonical-Link einmal weglaesst.
  const alternativ = html.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/);
  return alternativ ? alternativ[1] : '';
}

// /live leitet in manchen Faellen auf die zuletzt beendete Uebertragung weiter -
// die haette dann zwar eine videoId, laeuft aber nicht mehr. Deshalb zusaetzlich
// nach einem echten Live-Merkmal in der Seite suchen.
function djSeiteIstLive(html) {
  return /"isLiveNow"\s*:\s*true/.test(html) ||
         /"isLive"\s*:\s*true/.test(html) ||
         /hlsManifestUrl/.test(html);
}

function djFeld(html, muster) {
  const treffer = html.match(muster);
  return treffer ? treffer[1] : '';
}

function djEntkommeHtml(text) {
  return String(text)
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// ===========================================================================
//  Ergebnis ins Repo schreiben
// ===========================================================================

// Vergleichsschluessel: nur die Identitaet des Streams, nicht Titel oder
// Kategorie. Sonst loeste jede Titelaenderung des DJs einen Commit aus.
function djLiveSchluessel(live) {
  return live
    .map(e => [e.platform, e.channel || '', e.channelId || '', e.handle || '', e.videoId || ''].join('|'))
    .sort()
    .join(';');
}

function djSchreibeStatusWennNoetig(live, token) {
  const vorhanden = djGithubLies(DJ_STATUS_DATEI, token);
  let alt = null;
  if (vorhanden) {
    try { alt = JSON.parse(vorhanden.text); } catch (fehler) { alt = null; }
  }

  const alteListe = (alt && Array.isArray(alt.live)) ? alt.live : [];
  const geaendert = djLiveSchluessel(alteListe) !== djLiveSchluessel(live);

  // Herzschlag: das Dashboard verwirft einen Stand, der aelter als 45 Minuten
  // ist. Solange jemand live ist, muss checked_at also regelmaessig nachziehen -
  // auch wenn sich an der Liste selbst nichts aendert.
  let herzschlagFaellig = false;
  if (!geaendert && live.length > 0) {
    const zuletzt = alt && alt.checked_at ? new Date(alt.checked_at).getTime() : 0;
    herzschlagFaellig = !zuletzt || (Date.now() - zuletzt) > DJ_HEARTBEAT_MINUTEN * 60 * 1000;
  }

  if (!geaendert && !herzschlagFaellig) {
    Logger.log('Keine Aenderung - kein Commit.');
    return;
  }

  const inhalt = JSON.stringify({
    checked_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    live: live
  }, null, 2) + '\n';

  const nachricht = geaendert
    ? 'Auto: DJ-Live-Status aktualisiert (' + live.length + ' live)'
    : 'Auto: DJ-Live-Status Herzschlag (' + live.length + ' live)';

  djGithubSchreibe(DJ_STATUS_DATEI, inhalt, vorhanden ? vorhanden.sha : null, nachricht, token);
  Logger.log(nachricht);
}

// ===========================================================================
//  GitHub Contents API
// ===========================================================================

function djGithubKopf(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function djGithubLies(pfad, token) {
  const url = 'https://api.github.com/repos/' + DJ_GITHUB_REPO + '/contents/' + pfad +
              '?ref=' + encodeURIComponent(DJ_GITHUB_BRANCH);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: djGithubKopf(token),
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

function djGithubSchreibe(pfad, text, sha, nachricht, token) {
  const nutzlast = {
    message: nachricht,
    content: Utilities.base64Encode(text, Utilities.Charset.UTF_8),
    branch: DJ_GITHUB_BRANCH
  };
  if (sha) nutzlast.sha = sha;   // ohne sha legt die API die Datei neu an

  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + DJ_GITHUB_REPO + '/contents/' + pfad, {
    method: 'put',
    contentType: 'application/json',
    headers: djGithubKopf(token),
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

function djTriggerEinrichten() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'djPruefeLiveStatus') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('djPruefeLiveStatus').timeBased().everyMinutes(DJ_TRIGGER_MINUTEN).create();
  Logger.log('Trigger angelegt: djPruefeLiveStatus alle ' + DJ_TRIGGER_MINUTEN + ' Minuten.');
}

function djTriggerEntfernen() {
  let anzahl = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'djPruefeLiveStatus') { ScriptApp.deleteTrigger(t); anzahl++; }
  });
  Logger.log(anzahl + ' Trigger entfernt.');
}

// Zeigt, was der Checker gerade sehen wuerde - ohne irgendetwas zu committen.
function djTestLauf() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('GITHUB_TOKEN fehlt.'); return; }

  const datei = djGithubLies(DJ_KANAL_DATEI, token);
  if (!datei) { Logger.log(DJ_KANAL_DATEI + ' nicht gefunden.'); return; }

  const kanaele = JSON.parse(datei.text);
  Logger.log('Kanaele in ' + DJ_KANAL_DATEI + ': ' + kanaele.length);

  const twitch = djPruefeTwitch(kanaele.filter(k => k && k.platform === 'twitch' && k.channel), props);
  Logger.log('Twitch -> ' + JSON.stringify(twitch));

  const youtube = djPruefeYoutube(kanaele.filter(k => k && k.platform === 'youtube' && (k.channelId || k.handle)));
  Logger.log('YouTube -> ' + JSON.stringify(youtube));
}
