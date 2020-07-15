let getConfig = null,
  getLogger = null;
try {
  getConfig = require('semantic-release/lib/get-config');
  getLogger = require('semantic-release/lib/get-logger');
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
}
const { Writable } = require('stream');

const devNull = () =>
  new Writable({
    write(chunk, encoding, cb) {
      cb();
    },
  });

/**
 * Get the semantic-release configuration.
 *
 * @return {Promise<Object>} The configuration object, which includes an options field among others.
 */
async function getReleaseConfig() {
  if (!getLogger || !getConfig) {
    throw new Error('cannot get release config - semantic-release not available');
  }

  const context = {
    cwd: process.cwd(),
    // The logger logs a bunch of unhelpful stuff when loading plugins, and we're only loading
    // config data to get the repository URL in a way that's consistent with semantic-release, so
    // any info related to how we've configured plugins are unhelpful.
    stdout: devNull(),
    stderr: process.stderr,
    logger: undefined,
  };
  context.logger = getLogger(context);
  return getConfig(context, {});
}

module.exports = {
  getReleaseConfig,
};
