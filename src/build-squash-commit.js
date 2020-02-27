const execa = require('execa');
const { Octokit } = require('@octokit/rest');
const hostedGitInfo = require('hosted-git-info');
const { version } = require('../package.json');
const { getReleaseConfig } = require('./utils');
const pick = require('lodash/pick');

// These two variables match semantic-release.
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null;

async function buildSquashCommitSubject(pullNumber) {
  const { options } = await getReleaseConfig(),
    gitInfo = hostedGitInfo.fromUrl(options.repositoryUrl, { noGitPlus: true }),
    repoParams = { owner: gitInfo.user, repo: gitInfo.project };

  const octokit = new Octokit({
    // Optional for public repositories.
    auth: GITHUB_TOKEN,
    userAgent: `mixmax-commitlint-bot v${version}`,
  });
  try {
    const { data } = await octokit.pulls.get({
      ...repoParams,
      pull_number: pullNumber,
    });
    if (!hasOwnProperty.call(data.base.repo, 'allow_squash_merge')) {
      const { data: repoData } = await octokit.repos.get(repoParams);

      Object.assign(
        data.base.repo,
        pick(repoData, 'allow_merge_commit', 'allow_rebase_merge', 'allow_squash_merge')
      );
    }
    if (!data.base.repo.allow_squash_merge) {
      throw new Error('squash merge not permitted according to repository configuration');
    }
    return `${data.title} (#${pullNumber})`;
  } catch (err) {
    if (err.status === 404) {
      throw Object.assign(
        new Error(
          'unable to retrieve pull request description: either the repository does not exist or authentication has not been configured'
        ),
        {
          code: 'ENOGITHUBAUTH',
        }
      );
    }
    throw err;
  }
}

async function buildSquashCommitBody({ from: fromRef, to: toRef }) {
  const { stdout } = await execa('git', [
    'log',
    '--format=* %B',
    '--reverse',
    `${fromRef}..${toRef}`,
  ]);
  return stdout;
}

/**
 * Build the commit that the "Squash and merge" button would produce in GitHub, so that we can lint
 * it against the commitlint config.
 *
 * @param {number} pullNumber The pull request number.
 * @param {string} from The start ref for the range of commits to include.
 * @param {string} to The end ref for the range of commits to include.
 */
async function buildSquashCommit({ pullNumber, from: fromRef, to: toRef }) {
  if (!Number.isSafeInteger(pullNumber) || pullNumber < 1) {
    throw new TypeError(`expected valid pullNumber, got ${pullNumber}`);
  }

  const [subject, body] = await Promise.all([
    buildSquashCommitSubject(pullNumber),
    buildSquashCommitBody({ from: fromRef, to: toRef }),
  ]);
  return `${subject}\n\n${body}`;
}

module.exports = buildSquashCommit;
