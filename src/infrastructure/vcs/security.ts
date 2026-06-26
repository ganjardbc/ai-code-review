import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGithubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const provided = Buffer.from(signatureHeader.slice(7), 'hex');

  const expected = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
    'hex',
  );

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function verifyGitlabToken(
  tokenHeader: string | undefined,
  secret: string,
): boolean {
  if (!tokenHeader) {
    return false;
  }

  const provided = Buffer.from(tokenHeader);
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

const BRANCH_PATTERN = /^[a-zA-Z0-9_\-\/\.:]+$/;

export function isSafeBranchName(branch: string): boolean {
  return BRANCH_PATTERN.test(branch);
}
