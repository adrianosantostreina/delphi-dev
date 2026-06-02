import { describe, it, expect } from 'vitest';
import { getRagDownloadUrl, type GitHubRelease } from '../src/rag';

describe('getRagDownloadUrl', () => {
  it('returns url for rag.db asset in latest release', () => {
    const release: GitHubRelease = {
      tag_name: 'v2.0.0',
      assets: [
        { name: 'rag.db', browser_download_url: 'https://github.com/releases/rag.db' },
        { name: 'other.zip', browser_download_url: 'https://github.com/releases/other.zip' },
      ],
    };
    expect(getRagDownloadUrl(release)).toBe('https://github.com/releases/rag.db');
  });

  it('returns null when no rag.db asset found', () => {
    const release: GitHubRelease = {
      tag_name: 'v2.0.0',
      assets: [{ name: 'other.zip', browser_download_url: 'https://x.com/other.zip' }],
    };
    expect(getRagDownloadUrl(release)).toBeNull();
  });

  it('returns null for empty assets', () => {
    const release: GitHubRelease = { tag_name: 'v2.0.0', assets: [] };
    expect(getRagDownloadUrl(release)).toBeNull();
  });
});
