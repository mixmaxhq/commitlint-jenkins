# commitlint-jenkins

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

A wrapper for commitlint that determines the appropriate commit range in a Jenkins build. Adapted
from `@commitlint/travis-cli`.

Only supports `git` projects, assumes a single repository (i.e. does not explicitly support cross-
repo pull requests), and doesn't support renaming the remote to something other than `origin`. We
welcome [pull requests](https://github.com/mixmaxhq/commitlint-jenkins/pulls)!

## Flags

### `--if-ci`

If `commitlint-jenkins` is run outside of a CI context, it will fail. This flag simply ignores the
failure, for use-cases where `commitlint-jenkins` should be run from a script shared with a non-CI
workflow.

### `--pr-only`

If `commitlint-jenkins` is run in CI in a build that isn't a pull request build, silently exit.
This flag is particularly handy for use with
[`@mixmaxhq/semantic-commitlint`](https://github.com/mixmaxhq/semantic-commitlint).

## Publishing a new version

```
GH_TOKEN=xxx npx semantic-release --no-ci
```
