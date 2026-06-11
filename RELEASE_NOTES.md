# AI Data Shield — Release v1.5

Release date: 2026-06-11

Summary:
- Remove stray runtime token that caused "TypeScript is not defined" errors.
- Remove unused `activeTab` permission from manifests to comply with Web Store policy.
- Produce extension package in `DIST/` and created `ai-data-shield-DIST.zip` for upload.

Files included in this release:
- `DIST/manifest.json` (permissions reduced to `storage`)
- `DIST/content.js` (rebuilt, no stray token)
- `ai-data-shield-DIST.zip` (packaged extension for Chrome Web Store)

Notes for reviewers:
- The reported issues (Red Potassium, Purple Potassium) were fixed by removing the stray token and removing `activeTab`.
- Build was produced with Vite into `DIST/` and verified locally.

How to upload:
1. Unzip locally and verify in Chrome via "Load unpacked" using the `DIST/` folder.
2. On the Chrome Web Store Developer Dashboard, create a new item and upload `ai-data-shield-DIST.zip`.

Suggested GitHub release actions (if you want me to push the tag to remote, provide credentials or run remotely):
- Create a GitHub release for tag `v1.5` and attach `ai-data-shield-DIST.zip`.
