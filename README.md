# GAMBELSTRIKE 2

Free-for-All Ego-Shooter im Browser (Three.js). Vor jeder Runde drehst du **6 Glücksräder** – HP, Speed, Damage, Main Weapon, Secondary, Knife – und weißt nie, mit welchem Loadout du startest.

## Download & Starten

Fertige Builds gibt es unter **[Releases](https://github.com/erqf1/GambelStrike2/releases/latest)**:

- **`GambelStrike2-…-Windows.exe`** – doppelklicken, das Spiel öffnet sich in einem eigenen Fenster (nutzt Edge oder Chrome im App-Modus, sonst den Standardbrowser). Windows SmartScreen kann bei unsignierten Programmen warnen: *Weitere Informationen → Trotzdem ausführen*.
- **`GambelStrike2-…-offline.html`** – eine einzige Datei für jedes Betriebssystem, läuft komplett **offline** im Browser.

Aus dem Quellcode: `index.html` doppelklicken (Chrome, Edge oder Firefox). Diese Variante lädt Three.js und die Schriften beim Start aus dem Internet.

Spielstand, Tokens, Skins, Einstellungen und Statistiken werden lokal gespeichert.

## Selbst bauen

```
cd tools
npm install
npm run build
```

Ergebnis in `dist/`: die Offline-Einzeldatei und unter Windows zusätzlich die EXE (kompiliert mit dem in Windows enthaltenen C#-Compiler, keine weitere Installation nötig).

## Steuerung (frei belegbar in Settings → Controls)

| Taste | Aktion |
|---|---|
| WASD | Bewegen |
| Maus | Umsehen |
| Linke Maustaste | Schießen / Messer-Slash |
| Rechte Maustaste | Zielen / Messer-Heavy-Stab |
| R | Nachladen |
| F | Inspect |
| Space | Springen |
| Shift | Sprinten |
| Strg | Ducken |
| 1 / 2 / 3 | Main / Secondary / Knife |
| Q | Letzte Waffe |
| Tab | Scoreboard |
| Esc | Pause |

Tipp: Manche Browser schließen bei Strg+W den Tab. Im Vollbild (Settings → Graphics) fängt das Spiel das ab, alternativ Ducken auf C legen.

## Ablauf einer Runde

Hauptmenü → START → 10 oder 25 Spieler → Lobby → 6 Roulette-Spins → Round Loadout → Map-Voting → Laden → **Klick zum Deployen** → Free-for-All → Ergebnis → Token-Belohnung.

## Inhalte

- **Maps:** Neon District (Nachtstadt, Arcade, Hotel, Dachbrücke, Parkhaus) und Desert Facility (Labor, Hangar mit Catwalks, Container-Yard, Tunnel, Wachturm).
- **Waffen:** 8 Main (AR-4, Vector X, Heavy Shotgun, Phantom Rifle, Kestrel SMG, Longbow .338, Warden BR, Viper Bullpup), 5 Secondary (R9, Stinger MP, Hammer .50, Duke Revolver, Nova-17).
- **Messer:** Tactical, Flip, Combat, Talon, Shadow Blade, Fang, **Butterfly Knife**, **Karambit** – jeweils mit eigenen Draw- und Inspect-Animationen, Butterfly und Karambit mit mehreren zufälligen und seltenen Inspects.
- **Skins:** 20 Waffen-Designs in 7 Raritäten, 16 Messer-Designs. Rein kosmetisch.
- **Cases:** Origin, Neon, Vault. OPEN 1 / OPEN 5 (exakt 5× Preis, gleiche Chancen pro Öffnung).
- **Shop:** Waffen freischalten, tägliche Skin-Angebote (neu nach jedem Match), Cases.
- **Inventory:** Skins ausrüsten, doppelte Skins gegen Tokens verschrotten.

Die Gegner sind Bots (Schwierigkeit Easy/Normal/Hard im START-Menü). Jeder Bot dreht sein eigenes Roulette.

## Geheime Codes (Shop → kleiner CODE-Button oben rechts)

- `knife77` – schaltet alle Messer frei
- `freetokens` – Sandbox-Modus mit ∞ Tokens für diesen lokalen Spielstand (kein Echtgeld)

## Spielstand zurücksetzen

Settings → Game → RESET EVERYTHING.
