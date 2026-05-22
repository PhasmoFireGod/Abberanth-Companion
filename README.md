# Abberanth Companion

A personal TTRPG reference site for the world of Abberanth — built as a GitHub Pages static site.

## What's inside

| Section | Description |
|---|---|
| **Timelines** | Events across multiple eras and timelines |
| **NPCs** | Non-player characters — allies, enemies, and everyone else |
| **Monsters** | The bestiary — stats and lore for creatures of Abberanth |
| **Player Characters** | Active and retired PCs |
| **Character Sheet** | Interactive sheet for the Abberanth custom system |
| **Dice Roller** | d4–d100, custom notation (e.g. `2d6+3`), available on every page |

## Data

All entries live as individual `.json` files inside `data/`:

```
data/
  monsters/       ← one .json per monster
  characters/     ← one .json per PC
  npcs/           ← one .json per NPC
  timelines/      ← one .json per timeline
```

## Running locally

Just open `index.html` in a browser, or serve the folder with any static server:

```bash
npx serve .
# or
python -m http.server 8080
```

## GitHub Pages

Push to the `main` branch. In your repo settings, set **Pages → Source** to `main / (root)`.
Your site will be live at `https://<your-username>.github.io/Abberanth-Companion/`.
