export interface GitHubAsset {
    name: string;
    browser_download_url: string;
}
export interface GitHubRelease {
    tag_name: string;
    assets: GitHubAsset[];
}
export declare function getRagDownloadUrl(release: GitHubRelease): string | null;
export declare function fetchLatestRelease(): Promise<GitHubRelease>;
export declare function downloadRagDb(url: string, destPath: string): Promise<void>;
//# sourceMappingURL=rag.d.ts.map