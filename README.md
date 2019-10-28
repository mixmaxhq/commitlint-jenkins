# commitlint-jenkins

A wrapper for commitlint that determines the appropriate commit range in a Jenkins build. Adapted
from `@commitlint/travis-cli`.

Only supports `git` projects, assumes a single repository (i.e. does not explicitly support cross-
repo pull requests), and doesn't support renaming the remote to something other than `origin`. We
welcome [pull requests](https://github.com/mixmaxhq/commitlint-jenkins/pulls)!
