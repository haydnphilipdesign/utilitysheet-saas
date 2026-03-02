import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const blockedPathPatterns = [
  /^logs_result(?:[-_.].*)?\.json$/i,
  /^screenshot_.*\.(png|jpe?g)$/i,
  /\.har$/i,
  /\.trace\.json$/i,
  /\.ndjson$/i,
];

const secretPatterns = [
  /AIza[0-9A-Za-z_-]{35}/g,
  /sk_live_[0-9A-Za-z]{20,}/g,
  /sk_test_[0-9A-Za-z]{20,}/g,
  /whsec_[0-9A-Za-z]{20,}/g,
  /re_[0-9A-Za-z]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/g,
];

const maxBytesToScan = 1024 * 1024;

function getTrackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function scan() {
  const trackedFiles = getTrackedFiles();
  const blockedFiles = [];
  const secretHits = [];

  for (const filePath of trackedFiles) {
    const exists = existsSync(filePath);
    const normalized = filePath.replace(/\\/g, '/');
    const baseName = path.basename(normalized);

    if (exists && blockedPathPatterns.some((pattern) => pattern.test(baseName))) {
      blockedFiles.push(filePath);
    }

    try {
      if (!exists) continue;
      const stats = statSync(filePath);
      if (!stats.isFile() || stats.size > maxBytesToScan) continue;

      const content = readFileSync(filePath, 'utf8');
      for (const pattern of secretPatterns) {
        const match = content.match(pattern);
        if (match?.length) {
          secretHits.push({
            filePath,
            pattern: pattern.toString(),
            sample: match[0].slice(0, 32),
          });
          break;
        }
      }
    } catch {
      // Ignore unreadable/non-text files.
    }
  }

  if (blockedFiles.length === 0 && secretHits.length === 0) {
    console.log('security:scan passed');
    return;
  }

  if (blockedFiles.length > 0) {
    console.error('Blocked artifact files detected in git-tracked files:');
    blockedFiles.forEach((entry) => console.error(` - ${entry}`));
  }

  if (secretHits.length > 0) {
    console.error('Potential secret-like values detected in tracked files:');
    secretHits.forEach((entry) =>
      console.error(` - ${entry.filePath} (pattern: ${entry.pattern}, sample: ${entry.sample}...)`)
    );
  }

  process.exit(1);
}

scan();
