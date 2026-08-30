/*
 * Tischrunde — Hos'n Obe: Zugangsdaten.
 *
 * Das ist die einzige Datei, die du selbst ausfuellen musst. Solange
 * `firebase.databaseURL` leer ist, laeuft das Spiel im Uebungsmodus: der
 * Spieltisch oeffnet sich, aber ohne Mitspieler. Wie du an die Werte kommst,
 * steht Schritt fuer Schritt in der README.
 *
 * Diese Werte sind keine Geheimnisse — sie stehen bei jeder Firebase-Web-App
 * im Quelltext. Den Schutz uebernehmen allein die Sicherheitsregeln, die in
 * der README unter "Sicherheitsregeln" stehen.
 *
 * Wichtig: ein EIGENES Firebase-Projekt anlegen, nicht das des Cafe-Dashboards.
 */
window.HosnObeConfig = {

    firebase: {
        apiKey: '',
        authDomain: '',
        databaseURL: '',
        projectId: '',
        appId: ''
    },

    // Laenge des Einladungscodes. Vier Ziffern reichen fuer 10 000 Tische.
    codeLength: 4,

    // Wie viele Spieler an einen Tisch passen. Die Regeln sind auf 2 bis 6 ausgelegt.
    minPlayers: 2,
    maxPlayers: 6,

    // Nach so vielen Sekunden ohne Lebenszeichen gilt ein Handy als abgemeldet
    // und wird beim Reihum uebersprungen.
    offlineGraceSeconds: 45
};
