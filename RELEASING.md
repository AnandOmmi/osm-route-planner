# Releasing (maintainer notes)

## Check the code

```bash
npm install
npm test          # smoke test against example/map.osm
npm run example   # print a sample route
```

## Publish a new version

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Commit, tag `vX.Y.Z`, push the tag.
3. The `Publish to npm` workflow (`.github/workflows/publish.yml`) runs the tests and publishes. It needs the repo secret `NPM_TOKEN`.

Manual alternative: `npm login`, then `npm publish` (runs the tests first via `prepublishOnly`).
