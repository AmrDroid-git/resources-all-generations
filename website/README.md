# Student Resources Static Website

A static, multilingual website for collecting student resources from JSON files.

## What this version does

- French, light mode, and `classic` style are the defaults.
- The selected language/theme/style are saved in browser `localStorage`.
- Style presets are scalable: `normal`, `classic`, `bold`, `hacking`, `modern`, `academic`, `minimal`, `glass`.
- App/config files stay in `/data`.
- Resource/link JSON files stay in `/data/link/`.
- Resource files are discovered automatically from `/data/link/`.
- No `index.json` file is required anymore.
- University/category names are generated from the JSON filename only.
  - `iseah.json` becomes `ISEAH`.
  - `prepa.json` becomes `PREPA`.
  - `my-university.json` becomes `MY UNIVERSITY`.
- Counts and resource types are calculated from the real JSON files on page load.
- TXT download is generated directly in the browser.

## Project structure

```txt
.
├── index.html
├── home/index.html
├── resources/index.html
├── download/index.html
├── collaborate/index.html
├── about/index.html
├── 404.html
├── assets/
│   ├── css/styles.css
│   └── js/app.js
├── data/
│   ├── config.json
│   ├── i18n.json
│   ├── about.json
│   └── link/
│       ├── ensi.json
│       ├── prepa.json
│       ├── bac.json
│       └── ...other university/resource JSON files
├── netlify.toml
├── vercel.json
└── README.md
```

## Important note about auto-discovery

The browser can only discover files in `/data/link/` if the server exposes a directory listing for that folder.

This works with simple local static servers such as:

```bash
python -m http.server 8000
```

Then open:

```txt
http://localhost:8000/home/
```

If your production host blocks directory listing for `/data/link/`, no frontend-only JavaScript can magically know which files exist. In that case you need either:

- a server/API endpoint that lists the files, or
- a build step that generates a file list before deployment.

This version follows your requested no-index frontend discovery approach.

## Config defaults

Edit `data/config.json`:

```json
{
  "last_modification_date": "18/06/2026",
  "resources_directory": "/data/link/",
  "share_resources_link": "https://docs.google.com/forms/...",
  "defaults": {
    "language": "fr",
    "theme": "light",
    "style": "classic",
    "default_university": "ensi"
  }
}
```

`resources_directory` tells the JS where to discover resource JSON files.

## How to add a new university/resource category

Add one JSON file directly inside `data/link/`:

```txt
data/link/new-university.json
```

Use this format:

```json
[
  {
    "link": "https://drive.google.com/...",
    "name": "Resource name",
    "owner": "community",
    "description": "Useful description",
    "type": "folder"
  }
]
```

That is all. No index file. No JS change.

The displayed name comes from the filename:

```txt
new-university.json → NEW UNIVERSITY
iseah.json → ISEAH
```

## How to rename a university/category

Rename the file.

Example:

```txt
data/link/iseah.json → data/link/iseah-mahdia.json
```

The label changes automatically:

```txt
ISEAH → ISEAH MAHDIA
```

## How to add a new style preset

1. Add it to `data/config.json` under `appearance.styles`.
2. Add matching CSS variables in `assets/css/styles.css`.

Example:

```css
body[data-style="my-style"][data-theme="light"] {
  --bg: #f7f7f7;
  --card: #ffffff;
  --brand: #2563eb;
  --brand-dark: #1d4ed8;
  --brand-soft: #dbeafe;
  --brand-soft-2: #eff6ff;
  --brand-rgb: 37 99 235;
}

body[data-style="my-style"][data-theme="dark"] {
  --bg: #0f172a;
  --card: #1e293b;
  --brand: #60a5fa;
  --brand-dark: #bfdbfe;
  --brand-soft: #172d4d;
  --brand-soft-2: #13243b;
  --brand-rgb: 96 165 250;
}
```

## How translations work

Interface text is in:

```txt
data/i18n.json
```

The resource JSON content itself is shown as provided.
