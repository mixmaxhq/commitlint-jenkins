#!/usr/bin/env node
const execa = require('execa');
const argv = require('yargs').argv;
const commitlint = require('@commitlint/cli');
const buildSquashCommit = require('./build-squash-commit');

const IF_CI = !!argv.ifCi;
const PR_ONLY = !!argv.prOnly;
const ALLOW_SQUASH = !!argv.allowSquash;

// Allow override of used bins for testing purposes
const COMMITLINT = process.env.JENKINS_COMMITLINT_BIN;

const REQUIRED = ['GIT_COMMIT'];

const COMMIT = process.env.GIT_COMMIT;
const TARGET_BRANCH = process.env.CHANGE_TARGET;
// Set by Jenkins Multibranch pipeline
const CHANGE_ID = process.env.CHANGE_ID;
const IS_PR = !!CHANGE_ID;

if (IS_PR) {
  REQUIRED.push('CHANGE_TARGET');
}

main().catch((err) => {
  console.error((err && err.stack) || err);
  process.exit(1);
});

async function main() {
  if (!validate()) {
    return;
  }

  // Lint all commits on the branch if available
  if (IS_PR) {
    await lintPR();
  } else if (!PR_ONLY) {
    // The --pr-only flag can be useful to use semantic-commitlint on the release branch instead of
    // just linting one commit.
    const input = await rawCommit(COMMIT);
    await lint([], { input });
  }
}

/**
 * Lint the current pull request, considering two options:
 *
 * - the commits themselves are intended to be merged as-is, and we should lint them to make sure
 *   they're correct
 * - the commits themselves are just for development (e.g. for some people and especially for
 *   collaborative workflows), so lint the PR title and inline the commits under the assumption that
 *   the author will use the Squash and merge option
 *
 * This strategy has an obvious flaw: the author can take the other path; we're counting on each
 * engineer to do their best, and hopefully we can improve this workflow later.
 *
 * Note that if the squash-merge option is disabled for the repo, it will not be considered.
 *
 * @return {Promise<void>} Resolves when linting has finished; output goes to stdout/stderr.
 */
async function lintPR() {
  // We could try to only lint those commits since the last successful commit, but that would
  // require a bunch of extra logic to detect changes to commitlint.config.js or related modules.
  const range = {
    // HACK: Jenkins in its infinite wisdom doesn't provide (or at least document) anything we
    // could use to derive the name "origin" here. This means the commitlint-jenkins CLI will fail
    // or report the wrong results if Jenkins has been configured to use a different remote name,
    // or in cases where Jenkins is building a cross-repository change request.
    from: await getBase({ branch: `origin/${TARGET_BRANCH}` }),
    to: COMMIT,
  };

  // Kick off the work to figure out the appropriate squash commit. We may not use it, provided
  // the commit range itself consists of valid commits.
  const squashCommitPromise = ALLOW_SQUASH
    ? buildSquashCommit({
        pullNumber: parseInt(CHANGE_ID, 10),
        ...range,
      })
    : null;

  // Prevent unhandled rejections.
  if (squashCommitPromise) {
    squashCommitPromise.catch(() => {});
  }

  let branchCommitlintOutput;
  try {
    // TODO(Eli): Check for allow_merge_commit || allow_rebase_merge on the GitHub repository if
    // accessible.
    await execa(COMMITLINT || commitlint, ['--from', range.from, '--to', range.to], {
      all: true,
    });
    console.log(`all discovered commits on ${TARGET_BRANCH} passed linter`);
    return;
  } catch (err) {
    if (err.exitCode !== 1) {
      throw err;
    }

    if (!ALLOW_SQUASH) {
      console.error('Errors found in branch commits');
      console.group();
      console.error(err.all);
      console.groupEnd();
      throw err;
    }
    branchCommitlintOutput = err.all;
  }

  let rawSquashCommit;
  try {
    rawSquashCommit = await squashCommitPromise;
  } catch (err) {
    if (err.code === 'ENOGITHUBAUTH') {
      console.error('Unable to determine whether the squash commit would be valid');
      console.error(err);
      console.error();
      console.error(branchCommitlintOutput);
    }
    throw err;
  }

  try {
    await execa(COMMITLINT || commitlint, [], {
      input: rawSquashCommit,
      all: true,
    });
    console.log(`squash commit for ${TARGET_BRANCH} passed linter`);
    return;
  } catch (err) {
    console.error(
      'Neither the commits in the pull request nor the pull request description are valid according to commitlint'
    );
    console.error('Errors found with squash commit');
    console.group();
    console.error(err.all);
    console.groupEnd();
    console.error('Errors found in branch commits');
    console.group();
    console.error(branchCommitlintOutput);
    console.groupEnd();
    throw err;
  }
}

/**
 * Get the base commit shared by the target branch and an arbitrary ref. Generally this results in
 * the commit from which the feature branch was created, which is an accurate place to start for
 * commits that reside "on the branch."
 *
 * @param {string} branch The name/ref of the target branch.
 * @param {string=} tip The name/ref of the feature branch.
 * @return {Promise<string>} The ref of the most recent ancestor commit shared by both branches.
 */
async function getBase({ branch, tip = 'HEAD' }) {
  const result = await execa('git', ['merge-base', branch, tip]);
  return result.stdout;
}

async function lint(args, options) {
  return execa(COMMITLINT || commitlint, args, {
    stdio: ['pipe', 'inherit', 'inherit'],
    ...options,
  });
}

async function rawCommit(hash) {
  const result = await execa('git', ['show', '-s', '--pretty=format:%B', hash]);
  return result.stdout;
}

function validate() {
  if (process.env.CI !== 'true') {
    if (IF_CI) {
      return false;
    }
    throw new Error(`@mixmaxhq/commitlint-jenkins is intended to be used on Jenkins CI`);
  }

  const missing = REQUIRED.filter((envVar) => !(envVar in process.env));

  if (missing.length > 0) {
    const stanza = missing.length > 1 ? 'they were not' : 'it was not';
    throw new Error(`Expected ${missing.join(', ')} to be defined globally, ${stanza}.`);
  }

  return true;
}
