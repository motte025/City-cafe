/*
 * ============================================================================
 *  DJ-FERNBEDIENUNG — ZENTRALE KONFIGURATION
 *
 *  Wird vom Dashboard (index.html, TV) UND von der Handy-Seite
 *  (dj-fernbedienung.html) geladen, damit die Zugangsdaten nur an einer
 *  Stelle stehen.
 *
 *  Anleitung: siehe DJ-FERNBEDIENUNG-SETUP.md
 *
 *  Solange "databaseURL" leer ist, bleibt die Fernbedienung komplett
 *  abgeschaltet: der QR-Code wird nicht eingeblendet, das Dashboard laeuft
 *  unveraendert weiter. Es funktioniert also auch ohne Firebase.
 * ============================================================================
 */
window.DJ_REMOTE_CONFIG = {

    // --- Firebase ---------------------------------------------------------
    // Bewusst dasselbe Projekt wie Hos'n Obe: ein zweites anzulegen braeuchte
    // niemand, und die Pfade liegen sauber getrennt nebeneinander
    // (games/… dort, djremote/… hier). Die Regeln fuer djremote muessen in
    // der Firebase-Konsole ergaenzt werden - siehe SETUP, Abschnitt 2.
    firebase: {
        apiKey: 'AIzaSyD7iT2ACRTEmcwO5T2j1dUtFWEK04v5-rk',
        authDomain: 'hosen-obe.firebaseapp.com',
        databaseURL: 'https://hosen-obe-default-rtdb.europe-west1.firebasedatabase.app',
        projectId: 'hosen-obe',
        appId: '1:996060003217:web:a4ea0ee16dacb24386f830'
    },

    // Ein Screen = ein Raum. Mehrere Screens bekaemen je einen eigenen Namen;
    // die Handy-Seite spricht dann ueber ?raum=… genau einen davon an.
    raum: 'city-cafe',

    // Adresse der Handy-Seite. Steht im QR-Code auf dem TV.
    mobileUrl: 'https://motte025.github.io/City-cafe/dj-fernbedienung.html',

    // --- Twitch -----------------------------------------------------------
    // Client-ID der eigenen Twitch-Anwendung. Sie ist OEFFENTLICH und darf
    // hier stehen - anders als das Client-Secret, das die Fernbedienung gar
    // nicht braucht (sie meldet den Nutzer selbst an, statt im Namen der App
    // zu sprechen).
    //
    // Damit der Login funktioniert, muss die Adresse der Handy-Seite bei
    // Twitch als OAuth Redirect URL eingetragen sein:
    // dev.twitch.tv/console/apps -> eigene App -> OAuth Redirect URLs
    twitchClientId: '53mjyu59jba31g9gdf3vmmno89036g',

    // Ohne Login zeigt die Handy-Seite diese Kanaele an. Wird auch als
    // Rueckfall genutzt, wenn Twitch gerade nicht antwortet.
    kanalDatei: 'dj_channels.json',

    // --- Laufzeiten -------------------------------------------------------
    // Was auf dem Handy zur Auswahl steht. sek: -1 bedeutet "bis der Streamer
    // offline geht" - das erkennt der Player selbst am OFFLINE-Ereignis, es
    // braucht dafuer keinen API-Abruf.
    laufzeiten: [
        { sek: 120,   text: '2 Min' },
        { sek: 300,   text: '5 Min' },
        { sek: 900,   text: '15 Min' },
        { sek: 1800,  text: '30 Min' },
        { sek: 3600,  text: '1 Std' },
        { sek: 7200,  text: '2 Std' },
        { sek: 14400, text: '4 Std' },
        { sek: -1,    text: 'Bis offline' }
    ],
    laufzeitStandard: 900,

    // Was auf dem Handy an Qualitaet zur Auswahl steht. Der Wert ist die
    // Bildhoehe; 0 heisst "Twitch entscheidet".
    qualitaeten: [
        { hoehe: 0,    text: 'Auto' },
        { hoehe: 480,  text: '480p' },
        { hoehe: 720,  text: '720p' },
        { hoehe: 1080, text: '1080p' }
    ],
    qualitaetStandard: 0,

    // Wie oft die Handy-Seite den Stand vom Dashboard nachliest, falls die
    // Live-Verbindung einmal abreisst (in Sekunden).
    statusTaktSekunden: 10
};
