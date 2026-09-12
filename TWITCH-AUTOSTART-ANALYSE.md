# Twitch automatisch mit Ton – belastbarer nächster Versuch

Stand: 12. September 2026. Diese Analyse ersetzt keine Messung am ODROID. **Erfolg
bedeutet ausschließlich:** Nach einem Kaltstart war keine Bedienung nötig und der
Twitch-Ton ist am Fernseher tatsächlich hörbar. `AudioContext.state`, ein
abgesetzter SDK-Befehl und `getMuted() === false` allein sind kein Tonnachweis.

## Was der vorhandene Code und die Messung bereits klären

* Das Dashboard übergibt dem SDK `autoplay: true`, die gewünschte Lautstärke und
  alle ermittelbaren `parent`-Hosts. Das nachträglich erzeugte Twitch-iframe
  erhält `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`.
* `parent` ist für die Twitch-Einbettung zwingend, gewährt aber keine
  Audio-Autoplay-Erlaubnis. Die Erlaubnis muss außerdem durch jede äußere
  iframe-Ebene delegiert werden. Ob Lumify das Dashboard in einen solchen Rahmen
  setzt, zeigt `document.permissionsPolicy.allowsFeature('autoplay')`, soweit die
  verwendete WebView diese API implementiert.
* Der beobachtete Zustand `PLAYING`, `isPaused() === false`, Lautstärke `0.35`,
  aber `getMuted() === true` nach `setMuted(false)` zeigt: Der Befehl wurde
  ausgeführt, der Twitch-Player blieb jedoch stumm. Das ist kein Timingproblem;
  weitere Verzögerungsvarianten testen dieselbe, bereits widerlegte Hypothese.
* Dass ein echter Tipp auf Twitchs Lautsprecher den Zustand zu `false` ändert,
  grenzt Fehler bei Kanal, `parent`, Netzwerk und Audioausgang stark ein. Ein
  synthetisches `element.click()` aus der Dashboard-Seite kann keine
  vertrauenswürdige Benutzeraktivierung im cross-origin Twitch-iframe erzeugen.
* Die frühere rote UA-Aussage in `autoplay-check.html` war kein Test. Die Seite
  zeigt die mobile Kennung jetzt nur als Kontext und wertet einen laufenden
  AudioContext ausdrücklich nicht mehr als Twitch-Tonfreigabe.

Offizielle Grundlagen: [Twitch Video & Clips Embed](https://dev.twitch.tv/docs/embed/video-and-clips/),
[Twitch Interactive Frames](https://dev.twitch.tv/docs/embed/#interactive-frames-for-live-streams-and-vods),
[Android `WebSettings.setMediaPlaybackRequiresUserGesture`](https://developer.android.com/reference/android/webkit/WebSettings#setMediaPlaybackRequiresUserGesture(boolean)),
[Chromium Autoplay Policy](https://www.chromium.org/audio-video/autoplay/),
[Chrome Enterprise `AutoplayAllowed`](https://chromeenterprise.google/policies/#AutoplayAllowed).
Die Android-API beschreibt einen WebView-Schalter; sie erlaubt **keinen**
Rückschluss aus einem AudioContext und kann nur durch App-Code oder eine von der
App angebotene Einstellung gesetzt werden.

## Vergleich der praktisch möglichen Wege

| Lösungsweg | Voraussetzungen | Aufwand | Verbleibende Unsicherheit | Lumify bleibt erhalten |
|---|---|---:|---|---|
| Lumify-App korrigieren lassen | Lumify-Support setzt für die Dashboard-WebView `setMediaPlaybackRequiresUserGesture(false)` und delegiert `autoplay` in einem eventuellen äußeren iframe | niedrig für Betreiber, Änderung beim Anbieter | Twitch kann Entstummen trotz WebView-Freigabe weiterhin ablehnen; Konfiguration von Lumify 1.2.6 ist öffentlich nicht belastbar belegt | **ja** |
| Kontrollierter Desktop-UA-Test in einer konfigurierbaren WebView | App mit frei gesetztem UA **und** ausgeschalteter Media-Geste; identische Test-URL | mittel | UA kann Twitch-Verhalten ändern, ist aber keine Audiofreigabe und kein Erfolgsversprechen | nein; eventuell **teilweise** über Lumify-Webplayer |
| Eigener Android-WebView-Wrapper | kleines signiertes APK, Boot-Receiver/Launcher oder Geräteverwaltung, aktuelle System WebView | mittel | Twitch-SDK/cross-origin-Player kann zusätzlich eigene Regeln anwenden; OEM-Autostart und Android-15-Hintergrundregeln testen | nein; **teilweise**, falls statt Dashboard-URL ein geeigneter Lumify-Webplayer geladen wird |
| Konfigurierbarer Kiosk-Browser | Android-15-Kompatibilität, echter Schalter für User-Gesture/Autoplay, Bootstart und UA; Funktion vor Kauf testen | niedrig–mittel | Produkttexte wie „Video autoplay“ meinen oft nur stummes Video; Twitch muss am Gerät geprüft werden | nein; eventuell **teilweise** über Webplayer |
| Linux + Chromium Kiosk auf vorhandenem Mini-PC | Linux-Autostart, Chromium, Audioausgang; `--autoplay-policy=no-user-gesture-required` | mittel | Twitch kann unabhängig von Chromium stumm bleiben; Hardware-/HDMI-Wakeup | nein; eventuell **teilweise** über Webplayer |
| Betriebssystem-Eingabe auf Twitch-Lautsprecher | Accessibility Service mit bestätigter Bedienungshilfe oder ADB/MDM-Gerätesteuerung | hoch | Koordinaten ändern sich durch Werbung, Cookie-UI, Auflösung, Ladezeit und Layout; nach Reload erneut nötig | **ja**, aber fragil |

**Keine Empfehlung ohne Test:** Für Lumify 1.2.6 sind in den vorliegenden
Geräte-/CMS-Ansichten weder UA, Desktop-Modus noch Audio-Autoplay nachgewiesen.
Daher werden hier keine entsprechenden Menüpunkte erfunden. Ebenso wird keine
kostenpflichtige Kiosk-App empfohlen, bevor deren Testversion exakt den unten
beschriebenen Kaltstarttest bestanden hat.

## Aussichtsreichster nächster Versuch: eigener Wrapper als Diagnose

Der Wrapper ist nicht sofort die endgültige Ablösung, sondern der sauberste
kontrollierte Vergleich auf **derselben Box und derselben System-WebView**. Er
ändert genau eine bisher unbekannte Größe: die WebView-Einstellung
`setMediaPlaybackRequiresUserGesture(false)`. Zuerst bleibt der normale Android-UA
unverändert. Nur wenn Test 1 stumm bleibt, folgt als getrennte Hypothese Test 2
mit Desktop-UA. So erfahren wir:

1. Wird Ton mit normalem UA hörbar, fehlt Lumify sehr wahrscheinlich die
   WebView-Medienfreigabe (oder die äußere Autoplay-Delegation).
2. Bleibt normal stumm, wird aber Desktop-UA hörbar, beeinflusst Twitchs
   Gerätepfad das Ergebnis. Das beweist nicht, dass UA allein genügt.
3. Bleiben beide stumm und ein echter Tipp funktioniert, liegt die verbleibende
   Sperre im Browser-/Twitch-Wiedergabepfad; Dashboard-JavaScript kann sie nicht
   beheben.

### Minimales Android-Testprojekt

In einem leeren Android-Studio-Projekt (`minSdk 26`, `targetSdk 35`) genügt diese
Activity. Die getestete URL bleibt bewusst `twitch-ton-test.html`, nicht das
produktive Dashboard.

```kotlin
package at.citycafe.twitchprobe

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.WindowInsets
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        setContentView(web)
        web.webViewClient = WebViewClient()
        web.webChromeClient = WebChromeClient()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Test 1: diese Zeile auskommentiert lassen.
            // Test 2: ausschließlich diese Zeile zusätzlich aktivieren.
            // userAgentString = DESKTOP_UA
        }
        window.insetsController?.hide(
            WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
        )
        web.loadUrl(
            "https://motte025.github.io/City-cafe/twitch-ton-test.html" +
            "?kanal=HIER_LIVE_KANAL&modus=direkt"
        )
    }

    companion object {
        const val DESKTOP_UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    }
}
```

Manifest-Ergänzung:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<application android:usesCleartextTraffic="false" android:theme="@style/Theme.App">
    <activity android:name=".MainActivity" android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>
</application>
```

Für den späteren unbeaufsichtigten Start ist bevorzugt ein verwaltetes
Dedicated Device mit Lock Task/MDM oder ein vom ROM konfigurierter Launcher zu
verwenden. Ein gewöhnlicher `BOOT_COMPLETED`-Receiver darf unter modernen
Android-Versionen nicht beliebig Activities aus dem Hintergrund öffnen; deshalb
ist „Autostart-App installieren“ ohne realen Kaltstarttest kein belastbarer Plan.

### Exakter Testablauf ohne neue Schleife

1. Einen nachweislich live sendenden Kanal einsetzen; Medienlautstärke fest auf
   einen sicheren Wert stellen. Testseite direkt laden, keine Dashboard-Rotation.
2. App-Daten löschen, Box stromlos machen, starten, **nichts berühren**. Nach 30 s
   fotografieren/protokollieren: `READY`, `PLAYING`, `isPaused`, `getMuted`,
   `getVolume`, `userActivation`, UA und – separat – „Ton hörbar ja/nein“.
3. Nur wenn Test 1 stumm ist, dieselbe APK mit ausschließlich `DESKTOP_UA`
   wiederholen. Keine zusätzliche Verzögerung und keine zweite Entstumm-Schleife.
4. Einen positiven Befund erst danach mit fünf Betriebsfällen bestätigen:
   Kaltstart, Android-Neustart, Kanalwechsel im bestehenden SDK-Player, Rückkehr
   aus der Dashboard-Rotation und Wiederverbindung nach Netzausfall.

## Präzise Anfrage an Lumify-Support

> Lumify Player 1.2.6 (26), Android 15/API 35, ODROID-N2Plus. Eine HTTPS-Seite
> bettet den offiziellen Twitch-JavaScript-Player ein. Bild startet automatisch.
> Nach `PLAYING` liefern `isPaused() = false`, `getVolume() = 0.35`, aber
> `getMuted() = true`, obwohl `setMuted(false)` ausgeführt wurde. Ein echter Tipp
> auf Twitchs Lautsprechersymbol setzt `getMuted() = false` und Ton ist hörbar.
> Der gleiche Test zeigt `AudioContext.state = running`; wir betrachten das
> ausdrücklich nicht als Beleg für Media-Autoplay. Setzt Ihre Android-WebView
> `WebSettings.setMediaPlaybackRequiresUserGesture(false)`? Wird eine Webseite in
> einem iframe geladen, der `allow="autoplay"` delegiert? Gibt es eine
> dokumentierte, zentral verwaltbare Einstellung für User-Agent/Desktop-Modus
> oder einen Lumify-Webplayer, der diese Playlist in Chromium wiedergeben kann?
> Bitte testen Sie die URL
> `https://motte025.github.io/City-cafe/twitch-ton-test.html?kanal=LIVEKANAL&modus=direkt`
> nach Löschen der App-Daten und Neustart ohne jede Bedienung.

Zusätzlich ist konkret zu fragen, was „10 Sekunden“ bei einer Playlist mit nur
einem Eintrag bewirkt: erneutes Laden der Webressource oder bloß erneute
Disposition desselben Eintrags. Der bereits erreichte 30-Sekunden-Abschluss
widerlegt jedenfalls eine behauptete, sichere 10-Sekunden-Neuladeschleife.

## Letzte Ausweichlösung: echte Geräteeingabe

Ein Android Accessibility Service kann nach erteilter Bedienungshilfe mit
`dispatchGesture()` einen Betriebssystem-Tipp an Bildschirmkoordinaten senden.
Das ist grundlegend anders als `click()` in JavaScript: Android injiziert ein
Eingabeereignis, das Twitch als reale Aktivierung erhalten kann. Alternativ kann
`adb shell input tap X Y` nur mit dauerhaft autorisiertem ADB-Host, MDM oder
entsprechenden Systemrechten automatisiert werden. Beides ist fragil: Werbung,
Consent-Dialoge, Offline-Seite, geänderte Player-Bedienelemente, Ladezeit und
Skalierung verschieben das Ziel. Wenn überhaupt, muss die Automation erst das
Lautsprechersymbol per Accessibility-Knoten erkennen und Koordinaten nur als
Fallback nutzen; sie bleibt schlechter als eine korrekt konfigurierte
Wiedergabeumgebung.
