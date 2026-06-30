# commitlint-jenkins — repo card

> A map, not a manual. Keep it ~1 screen; point to detail, don't inline it.

## What it is
A Jenkins-aware CLI wrapper for `@commitlint/cli` (`@mixmaxhq/commitlint-jenkins`) that determines the correct commit range to lint in a Jenkins Multibranch Pipeline. Adapted from `@commitlint/travis-cli` but tailored to Jenkins env vars (`GIT_COMMIT`, `CHANGE_TARGET`, `CHANGE_ID`).

## serves
role: Jenkins CI commit linting — lints PR commits or squash-commit candidates during Jenkins builds
referenced-by: [any Mixmax repo with a Jenkinsfile that runs commit linting]

## Code map
- CLI entry point   -> `src/index.js` (shebang, `bin: commitlint-jenkins`)
- Squash-commit builder -> `src/build-squash-commit.js`
- Utilities         -> `src/utils.js`

## Conventions
- CommonJS (`require`/`module.exports`) throughout — match this style for any edits.
- Reads Jenkins env vars: `GIT_COMMIT`, `CHANGE_TARGET` (base branch), `CHANGE_ID` (PR number). `CI=true` must be set or the tool exits/throws unless `--if-ci` is passed.
- Published to npm as a public scoped package; releases are automated via `semantic-release` — do NOT publish manually; use `GH_TOKEN=xxx npx semantic-release --no-ci`.

## Gotchas
- Hardcodes remote name `origin` — does not support renamed remotes or cross-repo PRs.
- `--allow-squash` requires a GitHub token (via `GITHUB_TOKEN` env var) to fetch the PR title for the synthetic squash commit; missing auth raises `ENOGITHUBAUTH`.
- No unit tests exist (`npm test` exits 1); CI runs only ESLint (`npm run lint`).

## Run / test
```bash
npm install
npm run lint          # ESLint only (no unit tests)
node . --if-ci        # dry-run outside CI (exits silently)
```

## Load the matching domain card
This repo is cross-cutting CI tooling — it owns no product domain, so there is no domain card to load. When working here, load the card of the consuming service/domain if the change is driven by its needs.
