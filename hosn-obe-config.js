/*
 * ============================================================================
 *  HOSN_OBE — ZENTRALE KONFIGURATION
 *
 *  Die einzige Datei, in der du etwas eintragen musst. Sie wird sowohl vom
 *  Dashboard (index.html, TV) als auch von der Handy-Seite (hosn-obe.html)
 *  geladen — dadurch stehen die Firebase-Zugangsdaten nur an einer Stelle.
 *
 *  Anleitung Schritt für Schritt: siehe HOSN-OBE-SETUP.md
 *
 *  Solange "databaseURL" leer ist, bleibt das Hos’n Obe-Widget komplett
 *  abgeschaltet: der QR-Code wird nicht eingeblendet und die Rotation läuft
 *  unverändert weiter. Das Dashboard funktioniert also auch ohne Firebase.
 * ============================================================================
 */
window.HOSN_OBE_CONFIG = {

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
    mobileUrl: 'https://motte025.github.io/City-cafe/hosn-obe.html',

    // --- Zeiten in Sekunden (gefahrlos anpassbar) ---
    hostSelectSeconds: 20,   // so lange wartet der TV auf die Spieleranzahl, sonst zurück in die Rotation
    lobbySeconds: 60,        // Countdown, in dem die übrigen Gäste scannen können
    turnTimeoutSeconds: 120, // wer zwei Minuten nicht zieht, wird übersprungen
    revealSeconds: 30,       // wie lange das Ergebnis am TV stehen bleibt
    starterSeconds: 7,       // Anzeige „wer beginnt“: jeder zieht eine Karte, die höchste fängt an
    swapWindowSeconds: 6,    // nach dem Tausch bleibt so lange Zeit zum Aufgehen
    roundTargetSeconds: 95,  // Ziel-Spieldauer einer Runde; danach wird aufgedeckt

    // --- Wie oft kommen hohe Karten ins Spiel? ---
    // Feuer (gleiche Farbe, exakt 31) braucht ein Ass UND zwei Karten mit
    // 10 Punkten (Zehn, Bube, Dame, König) derselben Farbe. Bei gleicher
    // Chance für alle 32 Karten endete rund jede dritte Runde mit Feuer.
    // Punkte und Regeln bleiben unverändert — hohe Karten bleiben nur öfter
    // im ungenutzten Rest des Stapels liegen (pro Runde werden je nach
    // Spieleranzahl nur 11 bis 27 der 32 Karten überhaupt ausgeteilt).
    //   1.0 = wie ein normales Deck, jede Karte gleich oft  → ~35 % Feuer
    //   0.7 = ~27 % Feuer     0.5 = ~20 % Feuer     0.35 = ~15 % Feuer
    // Kleiner heißt seltener Feuer; der Durchschnitts-Handwert bleibt dabei
    // fast gleich, das Spiel wird also nicht flacher.
    aceDrawChance: 0.5,      // Asse
    highCardDrawChance: 0.5, // Zehn, Bube, Dame, König

    // --- Computer-Runde (Vorführmodus) ---
    botPlayerCount: 6,       // so viele Plätze besetzt der Computer
    botMoveSeconds: 6,       // Denkpause zwischen zwei Computer-Zügen (Gäste sollen mitkommen)
    botIdleStartSeconds: 60, // Countdown im Zyklus; danach spielt der Computer von selbst
    botLobbySeconds: 45,     // „Computer spielt, Gäste bekommen Karten“: so lange kann gescannt werden

    // Zum Testen: Hos’n Obe läuft als ERSTES Widget im Rotationszyklus an.
    // Auf false stellen, sobald nur noch der permanente QR-Code auslösen soll.
    testFirstInCycle: true
};
