#!/usr/bin/env node
const execa = require('execa');
const commitlint = require('@commitlint/cli');

// Allow to override used bins for testing purposes
const GIT = process.env.JENKINS_COMMITLINT_GIT_BIN || 'git';
const COMMITLINT = process.env.JENKINS_COMMITLINT_BIN;

const REQUIRED = ['GIT_COMMIT'];

const COMMIT = process.env.GIT_COMMIT;
const TARGET_BRANCH = process.env.CHANGE_TARGET;
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
  validate();

  // Lint all commits on the branch if available
  if (IS_PR) {
    // HACK: Jenkins in its infinite wisdom doesn't provide (or at least document) anything we could
    // use to derive the name "origin" here. This means the commitlint-jenkins CLI will fail or
    // report the wrong results if Jenkins has been configured to use a different remote name, or in
    // cases where Jenkins is building a cross-repository change request.
    const start = await getBase({ branch: `origin/${TARGET_BRANCH}` });
    // We could lint since the last successful commit, but that would require a bunch of extra logic
    // to detect changes to commitlint.config.js or related modules.
    await lint(['--from', start, '--to', COMMIT]);
  } else {
    const input = await rawCommit(COMMIT);
    await lint([], { input });
  }
}

async function getBase({ branch, tip = 'HEAD' }) {
  const result = await execa(GIT, ['merge-base', branch, tip]);
  return result.stdout;
}

async function lint(args, options) {
  return execa(COMMITLINT || commitlint, args, {
    stdio: ['pipe', 'inherit', 'inherit'],
    ...options,
  });
}

async function rawCommit(hash) {
  const result = await execa(GIT, ['show', '--pretty=format:%B', hash]);
  return result.stdout;
}

function validate() {
  if (process.env.CI !== 'true') {
    throw new Error(`@mixmaxhq/commitlint-jenkins is intended to be used on Jenkins CI`);
  }

  const missing = REQUIRED.filter((envVar) => !(envVar in process.env));

  if (missing.length > 0) {
    const stanza = missing.length > 1 ? 'they were not' : 'it was not';
    throw new Error(`Expected ${missing.join(', ')} to be defined globally, ${stanza}.`);
  }
}
