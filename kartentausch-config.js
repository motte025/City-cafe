/*
 * ============================================================================
 *  KARTENTAUSCH — ZENTRALE KONFIGURATION
 *
 *  Die einzige Datei, in der du etwas eintragen musst. Sie wird sowohl vom
 *  Dashboard (index.html, TV) als auch von der Handy-Seite (kartentausch.html)
 *  geladen — dadurch stehen die Firebase-Zugangsdaten nur an einer Stelle.
 *
 *  Anleitung Schritt fuer Schritt: siehe KARTENTAUSCH-SETUP.md
 *
 *  Solange "databaseURL" leer ist, bleibt das Kartentausch-Widget komplett
 *  abgeschaltet: der QR-Code wird nicht eingeblendet und die Rotation laeuft
 *  unveraendert weiter. Das Dashboard funktioniert also auch ohne Firebase.
 * ============================================================================
 */
window.KARTENTAUSCH_CONFIG = {

    // --- Aus der Firebase-Konsole: Projekt-Einstellungen -> Deine Apps -> Web-App ---
    firebase: {
        apiKey: '',
        authDomain: '',
        databaseURL: '',
        projectId: '',
        appId: ''
    },

    // Adresse der Handy-Seite. Steht im QR-Code auf dem TV.
    // Muss oeffentlich erreichbar sein (GitHub Pages reicht).
    mobileUrl: 'https://motte025.github.io/City-cafe/kartentausch.html',

    // --- Zeiten in Sekunden (gefahrlos anpassbar) ---
    hostSelectSeconds: 20,   // so lange wartet der TV auf die Spieleranzahl, sonst zurueck in die Rotation
    lobbySeconds: 60,        // Countdown, in dem die uebrigen Gaeste scannen koennen
    turnTimeoutSeconds: 20,  // wer so lange nicht zieht, wird uebersprungen
    revealSeconds: 12,       // wie lange das Ergebnis am TV stehen bleibt

    // Zum Testen: Kartentausch laeuft als ERSTES Widget im Rotationszyklus an.
    // Auf false stellen, sobald nur noch der permanente QR-Code ausloesen soll.
    testFirstInCycle: true
};
