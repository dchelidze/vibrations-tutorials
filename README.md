# Vibrations and Dynamics Interactive Tutorials

Interactive geometric courseware for Vibrations and Dynamics classes at the University of Rhode Island, developed in the [Nonlinear Dynamics Laboratory (NLD)](https://www.uri.edu/nld/) by [David Chelidze](https://web.uri.edu/nld/meet/chelidze/).

## Live Site (GitHub Pages)

- **Course Hub:** `https://dchelidze.github.io/vibrations-tutorials/`
- **Module 01 — 2-DOF Oscillations and Modal Geometry:** `https://dchelidze.github.io/vibrations-tutorials/2dof-modal-geometry/`

## Repository Layout

```text
.
├── index.html                           # Course tutorials hub landing page
├── 2dof-modal-geometry/                 # Module 01: 2-DOF energy ellipses & normal modes
│   ├── index.html
│   ├── css/styles.css
│   └── js/
├── wordpress/                           # Ready-to-paste WordPress card & JPG preview for web.uri.edu/nld
│   ├── web-uri-nld-card.html
│   └── 2dof-modal-geometry-preview.jpg
└── .nojekyll                            # Direct static serving on GitHub Pages
```

## Enabling GitHub Pages

1. Push this repository to `https://github.com/dchelidze/vibrations-tutorials`.
2. Open **Settings -> Pages** on GitHub.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, select **`main`** and **`/ (root)`**, and click **Save**.
4. Use the published URL directly in Brightspace (*Upload/Create -> Create a Link*, set to open in a new tab) and in `wordpress/web-uri-nld-card.html` on `web.uri.edu/nld`.

## Adding Future Tutorials

Create a new subfolder (for example `1dof-forced-response/` or `nnm-backbone-curves/`) containing its own `index.html`, then add a card linking to `./<folder-name>/` inside root `index.html`.

## License and Attribution

Copyright (c) 2026 David Chelidze, Nonlinear Dynamics Laboratory, University of Rhode Island. All rights reserved.
