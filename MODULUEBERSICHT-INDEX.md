# LMG Modulübersicht - Index

**Leibniz-Montessori-Gymnasium Düsseldorf**
Schuljahr 2025/2026

## Struktur der Modulübersichten

Die Modulübersichten sind in **JSON-Dateien nach Klassenstufen** organisiert:

### Dateien

| Klassenstufe | Dateiname | Pfad |
|--------------|-----------|------|
| Klasse 5 | `moduluebersicht-5.json` | `/Users/sim/Documents/lmg-ai-main/moduluebersicht-5.json` |
| Klasse 6 | `moduluebersicht-6.json` | `/Users/sim/Documents/lmg-ai-main/moduluebersicht-6.json` |
| Klasse 7 | `moduluebersicht-7.json` | `/Users/sim/Documents/lmg-ai-main/moduluebersicht-7.json` |
| Klasse 8 | `moduluebersicht-8.json` | `/Users/sim/Documents/lmg-ai-main/moduluebersicht-8.json` |
| Klasse 9 | `moduluebersicht-9.json` | `/Users/sim/Documents/lmg-ai-main/moduluebersicht-9.json` |
| Klasse 10 | `moduluebersicht-10.json` | `/Users/sim/Documents/lmg-ai-main/moduluebersicht-10.json` |

## JSON-Struktur

Jede JSON-Datei folgt dieser Struktur:

```json
{
  "jahrgang": 5,
  "schuljahr": "2025/2026",
  "abgabefrist_1hj": "letzter Schultag vor den Weihnachtsferien",
  "abgabefrist_2hj": "Freitag, 19.06.2026 (sofern nicht anders angegeben)",
  "halbjahre": {
    "1": {
      "bezeichnung": "1. Halbjahr (5.1)",
      "faecher": {
        "D": {
          "fachname": "Deutsch",
          "module": [
            {
              "name": "Modulname",
              "sozialform": "Einzelarbeit / Partnerarbeit",
              "zeitraum": "1. Halbjahr",
              "dauer": 4,
              "dauer_einheit": "UE",
              "ergebnis": "Abgabe bei der Fachlehrkraft",
              "hinweise": ["Fachraum-Pflicht", "Digitales Endgerät"]
            }
          ]
        }
      }
    },
    "2": {
      "bezeichnung": "2. Halbjahr (5.2)",
      "faecher": { ... }
    }
  }
}
```

## Fachkürzel

| Kürzel | Fach |
|--------|------|
| D | Deutsch |
| E | Englisch |
| M | Mathematik |
| BI | Biologie |
| CH | Chemie |
| PH | Physik |
| KU | Kunst |
| MU | Musik |
| EK | Erdkunde |
| GE | Geschichte |
| PK | Politik |
| OR | Orthodoxe Religion |
| ER | Evangelische Religion |
| KR | Katholische Religion |
| PPL | Praktische Philosophie |
| L | Latein |
| F | Französisch |
| GR | Griechisch (Neugriechisch) |
| I Diff | Italienisch Differenzierung |
| IF Diff | Informatik Differenzierung |
| PK/W Diff | Politik/Wirtschaft Differenzierung |
| NaWi Diff | Naturwissenschaften Differenzierung |
| Th Diff | Theater Differenzierung |
| MU Diff | Musik Differenzierung |

## Hinweise

Mögliche Hinweise in den Modulen:
- **Fachraum-Pflicht**: Modul muss komplett im Fachraum bearbeitet werden
- **Digitales Endgerät**: Modul benötigt iPad oder Computer
- **LogineoNRW**: Modul wird über die Lernplattform LogineoNRW bearbeitet

## Verwendung für den Bot

**So greift der Bot auf Modulinformationen zu:**

1. **Jahrgang identifizieren**: Aus der Schülerfrage den Jahrgang erkennen (z.B. "Klasse 5", "5. Klasse", "Jahrgang 5")
2. **JSON-Datei laden**: Entsprechende Datei öffnen (z.B. `moduluebersicht-5.json`)
3. **Halbjahr bestimmen**: Falls angegeben, 1. oder 2. Halbjahr
4. **Fach/Modul suchen**: Im JSON-Objekt navigieren

### Beispiel-Anfragen

**Frage:** "Welche Module hat Klasse 5 in Deutsch im 1. Halbjahr?"
- Datei: `moduluebersicht-5.json`
- Pfad: `halbjahre["1"].faecher["D"].module`

**Frage:** "Wie lange dauert das Modul 'Tierbuch' in Klasse 5?"
- Datei: `moduluebersicht-5.json`
- Suche: In allen Fächern nach `name: "Tierbuch"` suchen
- Antwort: `dauer` + `dauer_einheit`

**Frage:** "Welche Sozialform hat das Modul 'Atlasführerschein'?"
- Datei: `moduluebersicht-5.json`
- Suche: Nach `name: "Atlasführerschein"` im Fach EK
- Antwort: `sozialform`

## Quelle

Alle Daten stammen aus den offiziellen Modulübersichten (PDF-Dokumente) des Leibniz-Montessori-Gymnasiums für das Schuljahr 2025/2026.

**Stand:** Januar 2026
