/*
 * ============================================================================
 *  KARTENTAUSCH — ZENTRALE KONFIGURATION
 *
 *  Die einzige Datei, in der du etwas eintragen musst. Sie wird sowohl vom
 *  Dashboard (index.html, TV) als auch von der Handy-Seite (kartentausch.html)
 *  geladen — dadurch stehen die Firebase-Zugangsdaten nur an einer Stelle.
 *
 *  Anleitung Schritt für Schritt: siehe KARTENTAUSCH-SETUP.md
 *
 *  Solange "databaseURL" leer ist, bleibt das Kartentausch-Widget komplett
 *  abgeschaltet: der QR-Code wird nicht eingeblendet und die Rotation läuft
 *  unverändert weiter. Das Dashboard funktioniert also auch ohne Firebase.
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
    // Muss öffentlich erreichbar sein (GitHub Pages reicht).
    mobileUrl: 'https://motte025.github.io/City-cafe/kartentausch.html',

    // --- Zeiten in Sekunden (gefahrlos anpassbar) ---
    hostSelectSeconds: 20,   // so lange wartet der TV auf die Spieleranzahl, sonst zurück in die Rotation
    lobbySeconds: 60,        // Countdown, in dem die übrigen Gäste scannen können
    turnTimeoutSeconds: 20,  // wer so lange nicht zieht, wird übersprungen
    revealSeconds: 12,       // wie lange das Ergebnis am TV stehen bleibt

    // Zum Testen: Kartentausch läuft als ERSTES Widget im Rotationszyklus an.
    // Auf false stellen, sobald nur noch der permanente QR-Code auslösen soll.
    testFirstInCycle: true
};
