# ScoutCode

ScoutCode is a Windows-first, local-first football (soccer) video analysis workstation.

This repository currently implements the M0-M2 vertical slice:

- Electron desktop shell with a safe preload API.
- React + TypeScript + Vite renderer.
- Local `.scoutcode` project folders with `project.json`, `project.sqlite`, media folders, exports, backups, and logs.
- SQLite persistence for projects, media assets, events, default templates, template buttons, and settings.
- Video import in copy/link mode, local media protocol playback, and optional `ffprobe` metadata probing.
- Default football coding template, keyboard shortcuts, event creation/editing/soft delete, phase filtering, and timeline selection.

## Scripts

```bash
npm run desktop:dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke:electron
```

`npm run desktop:dev` starts Vite and then opens Electron. The renderer can also be viewed with `npm run dev`, but real project, media, and SQLite behavior requires Electron.

## MVP Boundary

Windows installer packaging and full video export are intentionally left as M3+ work in this slice.

## License

Apache-2.0. See `LICENSE`.
