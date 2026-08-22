import {
  digestJson,
  validateCapabilityResponse,
  validateChallenge,
} from './capability-security.mjs';
import { parseNamedArgs, readAssessmentInputs } from './assessment-io.mjs';

const args = parseNamedArgs(
  process.argv.slice(2),
  new Set(['--bundle', '--challenge', '--response'])
);
const { challenge, response } = readAssessmentInputs(args, ['challenge', 'response']);
validateChallenge(challenge);
validateCapabilityResponse(response, challenge);
process.stdout.write(
  `${JSON.stringify({ valid: true, challengeId: challenge.challengeId, responseDigest: digestJson(response) }, null, 2)}\n`
);
