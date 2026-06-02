import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

const GITHUB_API = 'https://api.github.com/repos/adrianosantostreina/delphi-dev/releases/latest';

export function getRagDownloadUrl(release: GitHubRelease): string | null {
  const asset = release.assets.find((a) => a.name === 'rag.db');
  return asset?.browser_download_url ?? null;
}

export async function fetchLatestRelease(): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    https.get(GITHUB_API, { headers: { 'User-Agent': 'delphi-dev-installer' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data) as GitHubRelease));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function downloadRagDb(url: string, destPath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'delphi-dev-installer' } }, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}
