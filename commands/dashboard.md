---
description: GitHub repository dashboard — shows stars, forks, issues, PRs, commits, releases, contributors and activity
---

Detect the user's language from the first message and render the matching block below.
Default: pt-BR. Supported: pt-BR, en-US.

Honor explicit overrides:
- "respond in English" / "in English please" → en-US
- "responda em português" → pt-BR

---

## How `/dashboard` works

Show a dashboard with public GitHub metrics for a repository.

**Argument resolution (in order):**
1. If the user passed `<owner>/<repo>` as argument, use it.
2. Otherwise, run `git remote get-url origin` and parse the URL to extract `owner/repo`.
   - SSH form: `git@github.com:owner/repo.git` → `owner/repo`
   - HTTPS form: `https://github.com/owner/repo.git` → `owner/repo`
   - Strip the trailing `.git` if present.
3. If neither works (no git remote and no argument), show the error message from the language block below and stop.

**Prerequisite:** `gh` CLI must be installed and authenticated. If `gh` is missing, show the missing-gh error from the language block.

---

## Data collection

Run these commands and capture each output. If any single command fails, fall back to "—" for that field but keep going.

### 1. Repository metadata (single call)
```bash
gh repo view <owner>/<repo> --json name,owner,description,url,stargazerCount,forkCount,watchers,latestRelease,defaultBranchRef,createdAt,updatedAt,pushedAt,primaryLanguage,licenseInfo,homepageUrl,isArchived,diskUsage
```

Extract from the JSON:
- `stargazerCount` → stars
- `forkCount` → forks
- `watchers.totalCount` → watchers
- `defaultBranchRef.name` → default branch
- `createdAt`, `updatedAt`, `pushedAt` → ISO 8601 timestamps
- `primaryLanguage.name` → language (often `null` for docs/markdown repos — render `—`)
- `licenseInfo.name` (fallback to `licenseInfo.spdxId`) → license
- `description` → description
- `homepageUrl` → homepage
- `latestRelease.tagName` and `latestRelease.publishedAt` → latest release tag and date
- `diskUsage` → repo size in KB
- `isArchived` → if true, prepend `🗄️ ARCHIVED` warning

> **Do NOT** rely on `issues.totalCount` or `pullRequests.totalCount` from `gh repo view` — those fields don't return real totals. Always use the search API queries below (steps 4 and 5) for issue and PR counts.

### 2. Total commits on default branch
```bash
gh api "repos/<owner>/<repo>/commits?per_page=100" --paginate -q 'length' | awk '{s+=$1} END {print s}'
```

### 3. Total releases
```bash
gh api "repos/<owner>/<repo>/releases?per_page=100" --paginate -q 'length' | awk '{s+=$1} END {print s}'
```

### 4. Issue counts (excluding PRs)
```bash
gh api "search/issues?q=repo:<owner>/<repo>+is:issue+state:open&per_page=1" -q '.total_count'
gh api "search/issues?q=repo:<owner>/<repo>+is:issue+state:closed&per_page=1" -q '.total_count'
```

### 5. Pull request counts
```bash
gh api "search/issues?q=repo:<owner>/<repo>+is:pr+state:open&per_page=1" -q '.total_count'
gh api "search/issues?q=repo:<owner>/<repo>+is:pr+is:merged&per_page=1" -q '.total_count'
```

### 6. Contributors count
```bash
gh api "repos/<owner>/<repo>/contributors?per_page=100&anon=true" --paginate -q 'length' | awk '{s+=$1} END {print s}'
```

### 7. Top 3 contributors (by commit count)
```bash
gh api "repos/<owner>/<repo>/contributors?per_page=3" -q '.[] | "\(.login):\(.contributions)"'
```

### 8. Open milestones (optional)
```bash
gh api "repos/<owner>/<repo>/milestones?state=open&per_page=5" -q '.[] | .title'
```

### 9. Latest 3 commits (short)
```bash
gh api "repos/<owner>/<repo>/commits?per_page=3" -q '.[] | "\(.sha[0:7])  \(.commit.author.date[0:10])  \(.commit.message | split("\n")[0])"'
```

### 10. Latest 3 closed releases (tag, date)
```bash
gh api "repos/<owner>/<repo>/releases?per_page=3" -q '.[] | "\(.tag_name)  \(.published_at[0:10])  \(.name // "")"'
```

---

## Formatting rules

- Dates: use `YYYY-MM-DD`. For "last commit", "last release", and "last update", append a relative-time suffix in parentheses if the date is within 365 days: `(3 days ago)` / `(há 3 dias)`, `(2 months ago)` / `(há 2 meses)`. Compute relative time from current date.
- Numbers ≥ 1000: format with thousand separator (`1,234` for en-US, `1.234` for pt-BR).
- Repo size: convert KB → MB if ≥ 1024 KB; show 1 decimal.
- Truncate descriptions longer than 100 chars with `…`.
- Replace empty fields with `—`.
- Render the dashboard inside a single fenced code block (` ``` `) for monospace alignment.

---

## en-US — render this block when the user's language is English

```
📊 Dashboard — <owner>/<repo>
<description (truncated)>

🔗 <url>
🔤 <language>  ·  📜 <license>  ·  🌿 default: <defaultBranch>  ·  💾 <size>

📈 Popularity
   ⭐ Stars:           <stargazerCount>
   🍴 Forks:           <forkCount>
   👀 Watchers:        <watchers>
   👥 Contributors:    <totalContributors>

🐛 Issues                          🔀 Pull Requests
   📋 Open:    <openIssues>           📂 Open:      <openPRs>
   ✅ Closed:  <closedIssues>          ✅ Merged:    <mergedPRs>

📝 Activity
   Total commits:     <totalCommits>
   Last commit:       <lastCommitDate> (<relative>)
   Latest release:    <latestReleaseTag> — <latestReleaseDate> (<relative>)
   Total releases:    <totalReleases>

🏆 Top contributors
   1. <login1> — <contributions1> commits
   2. <login2> — <contributions2> commits
   3. <login3> — <contributions3> commits

📅 Timeline
   Created:        <createdAt>
   Last updated:   <updatedAt> (<relative>)
   Last push:      <pushedAt> (<relative>)
```

If `latestRelease` is null, render `Latest release: — (no releases yet)` and `Total releases: 0`.
If milestones list is non-empty, append a section before "Timeline":
```
🎯 Open milestones
   • <title1>
   • <title2>
```

**Errors (en-US):**
- No git remote: `❌ Could not detect a GitHub repository. Pass an explicit argument: /dashboard owner/repo`
- gh missing: `❌ The 'gh' CLI is not installed. Install it from https://cli.github.com/ and run 'gh auth login' before using /dashboard.`
- gh not authenticated: `❌ The 'gh' CLI is installed but not authenticated. Run 'gh auth login' and try again.`
- Repo not found / no access: `❌ Repository <owner>/<repo> not found or not accessible with current credentials.`

---

## pt-BR — exiba este bloco quando o idioma do usuário for português

```
📊 Dashboard — <owner>/<repo>
<descricao (truncada)>

🔗 <url>
🔤 <linguagem>  ·  📜 <licenca>  ·  🌿 branch padrão: <defaultBranch>  ·  💾 <tamanho>

📈 Popularidade
   ⭐ Estrelas:        <stargazerCount>
   🍴 Forks:           <forkCount>
   👀 Watchers:        <watchers>
   👥 Contribuidores:  <totalContributors>

🐛 Issues                          🔀 Pull Requests
   📋 Abertas:  <openIssues>           📂 Abertos:    <openPRs>
   ✅ Fechadas: <closedIssues>          ✅ Mesclados:  <mergedPRs>

📝 Atividade
   Commits totais:     <totalCommits>
   Último commit:      <lastCommitDate> (<relative>)
   Última release:     <latestReleaseTag> — <latestReleaseDate> (<relative>)
   Total releases:     <totalReleases>

🏆 Top contribuidores
   1. <login1> — <contributions1> commits
   2. <login2> — <contributions2> commits
   3. <login3> — <contributions3> commits

📅 Linha do tempo
   Criado em:           <createdAt>
   Última atualização:  <updatedAt> (<relative>)
   Último push:         <pushedAt> (<relative>)
```

Se `latestRelease` for null, renderize `Última release: — (sem releases ainda)` e `Total releases: 0`.
Se a lista de milestones não estiver vazia, adicione uma seção antes de "Linha do tempo":
```
🎯 Milestones abertos
   • <titulo1>
   • <titulo2>
```

**Erros (pt-BR):**
- Sem git remote: `❌ Não foi possível detectar um repositório GitHub. Passe argumento explícito: /dashboard owner/repo`
- gh ausente: `❌ A CLI 'gh' não está instalada. Instale em https://cli.github.com/ e rode 'gh auth login' antes de usar /dashboard.`
- gh não autenticado: `❌ A CLI 'gh' está instalada mas não autenticada. Rode 'gh auth login' e tente novamente.`
- Repo não encontrado / sem acesso: `❌ Repositório <owner>/<repo> não encontrado ou inacessível com as credenciais atuais.`

---

## Examples

- `/dashboard` — uses current repo (via `git remote`)
- `/dashboard adrianosantostreina/delphi-dev` — explicit repo
- `/dashboard microsoft/TypeScript` — any public repo
