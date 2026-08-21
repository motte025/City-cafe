/**
 * City Cafe Klagenfurt Fischl - Foto-Galerie fuers Dashboard
 *
 * Liest Bilder aus den unten angegebenen Google-Drive-Ordnern (inklusive
 * aller Unterordner, beliebig tief) und liefert sie als JSON-Liste, die
 * index.html im Sidebar-Widget "view-event-gallery" anzeigt.
 *
 * Erwartetes Format pro Eintrag: { src, title, badge, date }
 * - src:   oeffentlich ladbare Bild-URL
 * - title: Dateiname (Unterstriche/Bindestriche zu Leerzeichen, IMG_1234
 *          & Co. fallen auf einen freundlichen Standardtext zurueck)
 * - badge: Name des Ordners, in dem das Foto liegt (Wurzelordner-Fotos
 *          nutzen den Namen des Wurzelordners). Einfach den Drive-Ordner
 *          umbenennen, um das Badge im Dashboard zu aendern.
 * - date:  letztes Aenderungsdatum der Datei in Drive (nicht EXIF-Datum)
 *
 * ============================== EINRICHTUNG ==============================
 * 1. script.google.com -> "Neues Projekt"
 * 2. Diesen kompletten Code einfuegen (ersetzt den Beispielcode)
 * 3. Oben rechts "Bereitstellen" -> "Neue Bereitstellung"
 *    - Typ: "Web-App"
 *    - Ausfuehren als: "Ich" (dein Konto)
 *    - Zugriff: "Alle" (Anyone) - sonst kann der Dashboard-Bildschirm
 *      nicht anonym abrufen
 * 4. Beim ersten Mal erscheint eine Google-Warnung ("Diese App wurde nicht
 *    verifiziert") - das ist normal bei eigenen Skripten. Auf "Erweitert"
 *    und dann "Zu [Projektname] (unsicher)" klicken, dann Zugriff erlauben.
 * 5. Die angezeigte /exec-URL kopieren und im Dashboard-Repo eintragen
 *    lassen (googleScriptUrl in index.html).
 *
 * WICHTIG - Freigabe der Ordner:
 * Das Skript selbst laeuft mit deinem Konto und sieht die Ordner auch bei
 * privater Freigabe. Aber die zurueckgegebenen Bild-URLs werden vom
 * Dashboard-Bildschirm ANONYM abgerufen (kein Google-Login). Deshalb muessen
 * beide Ordner (und alle Unterordner) auf "Jeder mit dem Link kann ansehen"
 * stehen - sonst zeigt das Dashboard leere/kaputte Bilder.
 * ===========================================================================
 */

// Beide Drive-Ordner werden inklusive aller Unterordner eingelesen.
const FOLDER_IDS = [
  '1D1wUuhOKFdJxNuDNAMQbmQCTCFgRQ_of',
  '1xla5o0KnQSzV1LYpbXztsbHTWDplj2AH',
];

// Nur diese Bildtypen werden aufgenommen (Drive wandelt HEIC/HEIF beim
// Thumbnail-Abruf automatisch in JPEG um, das funktioniert also mit).
const BILD_MIMETYPEN = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
];

// Sicherheitsgrenze: CacheService erlaubt max. ~100 KB pro Cache-Eintrag,
// und niemand braucht mehr als die letzten paar hundert Fotos in der Rotation.
const MAX_BILDER = 150;

const CACHE_SEKUNDEN = 300; // 5 Minuten - vermeidet einen kompletten Drive-Scan bei jedem Dashboard-Refresh

function doGet(e) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('galerie');
  if (cached) {
    return jsonAntwort(cached);
  }

  const bilder = [];
  FOLDER_IDS.forEach(id => {
    try {
      const ordner = DriveApp.getFolderById(id);
      sammleBilder(ordner, ordner.getName(), bilder);
    } catch (fehler) {
      // Ordner nicht gefunden / keine Berechtigung -> einfach ueberspringen,
      // der andere Ordner soll trotzdem funktionieren
    }
  });

  bilder.sort((a, b) => b.datumMs - a.datumMs); // neueste zuerst
  const ausgabe = bilder.slice(0, MAX_BILDER).map(b => ({
    src: b.src,
    title: b.title,
    badge: b.badge,
    date: b.date,
  }));

  const json = JSON.stringify(ausgabe);
  try {
    cache.put('galerie', json, CACHE_SEKUNDEN);
  } catch (fehler) {
    // Antwort war groesser als die Cache-Grenze - kein Problem, dann
    // wird beim naechsten Aufruf einfach erneut gescannt
  }
  return jsonAntwort(json);
}

// Durchsucht einen Ordner UND alle seine Unterordner rekursiv. "badge" ist
// der Name des jeweils naechstgelegenen Ordners - Fotos direkt im
// Wurzelordner bekommen dessen Namen, Fotos in einem Unterordner den
// Namen dieses Unterordners.
function sammleBilder(ordner, badge, out) {
  const dateien = ordner.getFiles();
  while (dateien.hasNext()) {
    const datei = dateien.next();
    if (BILD_MIMETYPEN.indexOf(datei.getMimeType()) !== -1) {
      out.push(dateiZuEintrag(datei, badge));
    }
  }

  const unterordner = ordner.getFolders();
  while (unterordner.hasNext()) {
    const sub = unterordner.next();
    sammleBilder(sub, sub.getName(), out);
  }
}

const STANDARD_TITEL = [
  'Beste Stimmung im Cafe!',
  'Zu Gast bei uns',
  'Guter Abend, gute Leute',
  'Mittendrin statt nur dabei',
];

function dateiZuEintrag(datei, badge) {
  const id = datei.getId();
  const aktualisiert = datei.getLastUpdated();
  return {
    // thumbnail-Endpunkt statt uc?export=view: liefert zuverlaessiger ein
    // direktes Bild ohne Google-Zwischenseite, auch fuer groessere Dateien
    src: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1920',
    title: freundlicherTitel(datei.getName(), id),
    badge: badge,
    date: Utilities.formatDate(aktualisiert, 'Europe/Vienna', 'dd.MM.yyyy'),
    datumMs: aktualisiert.getTime(),
  };
}

// Kamera-Dateinamen wie "IMG_1234", "DSC_0021" oder reine Zahlenfolgen sind
// fuer Gaeste bedeutungslos - dafuer springt ein freundlicher Text ein.
// Ueber die Datei-ID stabil ausgewaehlt, damit derselbe Titel bei jedem
// Cache-Refresh gleich bleibt statt bei jedem Aufruf zu wechseln.
function freundlicherTitel(dateiname, id) {
  let name = dateiname.replace(/\.[^/.]+$/, '');
  name = name.replace(/[_-]+/g, ' ').trim();

  const wirktGeneriert = /^(IMG|DSC|Foto|Photo|Bild)[\s]?\d*$/i.test(name) ||
    /^\d+$/.test(name) || name === '';

  if (wirktGeneriert) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return STANDARD_TITEL[hash % STANDARD_TITEL.length];
  }
  return name;
}

function jsonAntwort(json) {
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
