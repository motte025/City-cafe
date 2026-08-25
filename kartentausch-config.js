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
        apiKey: 'AIzaSyD7iT2ACRTEmcwO5T2j1dUtFWEK04v5-rk',
        authDomain: 'hosen-obe.firebaseapp.com',
        databaseURL: 'https://hosen-obe-default-rtdb.europe-west1.firebasedatabase.app',
        projectId: 'hosen-obe',
        appId: '1:996060003217:web:a4ea0ee16dacb24386f830'
    },

    // Adresse der Handy-Seite. Steht im QR-Code auf dem TV.
    // Muss öffentlich erreichbar sein (GitHub Pages reicht).
    mobileUrl: 'https://motte025.github.io/City-cafe/kartentausch.html',

    // --- Zeiten in Sekunden (gefahrlos anpassbar) ---
    hostSelectSeconds: 20,   // so lange wartet der TV auf die Spieleranzahl, sonst zurück in die Rotation
    lobbySeconds: 60,        // Countdown, in dem die übrigen Gäste scannen können
    turnTimeoutSeconds: 120, // wer zwei Minuten nicht zieht, wird übersprungen
    revealSeconds: 12,       // wie lange das Ergebnis am TV stehen bleibt

    // --- Computer-Runde (Vorführmodus) ---
    botPlayerCount: 3,       // so viele Plätze besetzt der Computer
    botMoveSeconds: 3,       // Denkpause zwischen zwei Computer-Zügen
    botIdleStartSeconds: 60, // so lange bleibt es still, bevor der Computer von selbst spielt

    // Zum Testen: Kartentausch läuft als ERSTES Widget im Rotationszyklus an.
    // Auf false stellen, sobald nur noch der permanente QR-Code auslösen soll.
    testFirstInCycle: true
};
