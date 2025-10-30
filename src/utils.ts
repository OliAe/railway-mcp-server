import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const getPackageVersion = (): string => {
  try {
    const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version ?? 'unknown';
  } catch (error) {
    console.error('Failed to read package version:', error);
    return 'unknown';
  }
};
