# Roteiro de release do BETA — delphi-dev 4.0.0-beta.1

Passo a passo para publicar (e depois repetir ou promover) o beta, sem precisar conhecer os
detalhes técnicos. Os comandos são para o **PowerShell** do Windows, dentro da pasta do repositório
(`D:\2.2 GitHub Adriano Santos\delphi-dev`), salvo quando dito o contrário.

> **Legenda.** Todo passo marcado como **AÇÃO DO DONO** muda algo fora do seu computador (envia
> código, cria tag, publica pacote) ou usa a sua conta. Nenhuma automação faz isso por você: rode
> só quando decidir. Os passos sem essa marca só leem ou testam.

## Regras do beta (não quebre)

1. **Não faça merge na `master` até a versão final.** O beta vive na branch
   `feature/v4.0-multi-agente` e nas tags `v4.0.0-beta.N`. A `master` continua sendo a estável
   (`npx delphi-dev` e `/plugin marketplace add adrianosantostreina/delphi-dev` instalam a partir
   dela). Um merge antecipado entrega o beta a todo mundo.
2. **Nunca publique no npm sem `--tag beta`** enquanto a versão for `4.0.0-beta.N`. Sem a tag, o
   `npx delphi-dev` (estável) pode passar a instalar o beta. Se acontecer: veja
   [Se algo deu errado](#se-algo-deu-errado).
3. **Limpe `installer\dist` antes de publicar no npm.** A pasta tem restos de uma versão antiga
   (`rag.js` e outros arquivos que não existem mais no código) e o pacote publica a pasta inteira.
4. **A extensão do VS Code não vai ao Marketplace no beta.** Ela só sai como arquivo `.vsix`
   anexado ao Release do GitHub.
5. **Versão da extensão.** O `packages/vscode/package.json` fica em `3.0.0` no beta (o empacotador
   da extensão não aceita sufixo `-beta`). A versão **final** da extensão precisa ser **3.0.1 ou
   maior**, para não colidir com o `.vsix` do beta, que também se chama 3.0.0.

## O que existe em cada lugar (visão geral)

| Parte | Como chega ao usuário | Quem faz |
|---|---|---|
| Plugin do Claude Code | tag `v4.0.0-beta.1` no GitHub; o `marketplace.json` da tag fixa o plugin nessa tag | você envia a tag |
| Instalador (`npx`) | pacote `delphi-dev@4.0.0-beta.1` no npm, com a etiqueta `beta` | você publica |
| Extensão VS Code | arquivo `.vsix` no Release (Pre-release) do GitHub | o workflow cria; você confere |
| Estável (`latest` no npm, `master`) | não muda | — |

## Passo 1 — Pré-checagens (só leitura)

Tudo precisa passar. Se algo falhar, **não continue**: corrija ou peça ajuda.

```powershell
git status                       # a árvore deve estar limpa (veja a nota abaixo)
git branch --show-current        # deve mostrar feature/v4.0-multi-agente

cd kb;               npx vitest run;  cd ..     # testes do núcleo (esperado: todos passam; 3 "skipped" é normal)
node kb/scripts/claude-surface.mjs --check --validate    # "claude surface unchanged" + dois "OK"
cd installer;        npx vitest run;  cd ..     # testes do instalador
cd packages\vscode;  npx vitest run;  cd ..\..  # testes da extensão
node runtime/kb-cli.mjs lint --root .            # "0 achado(s) de portabilidade"
```

Confira também, uma vez:

- `commands/about.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` e
  `installer/package.json` mostram a **mesma** versão `4.0.0-beta.1`, e o `marketplace.json` tem
  `"ref": "v4.0.0-beta.1"` dentro de `source`. O `lint` acima já confere isso; se reclamar de
  `version-sync`, a mensagem diz qual arquivo ajustar.
- Os testes manuais de `docs/testes-v4.0-extensao.md` e `docs/testes-v4.0-codex-opencode.md` foram
  feitos por você (principalmente o bloco "Claude Code intacto").
- **Nota sobre `git status`:** arquivos soltos que não fazem parte do beta (por exemplo
  `.github/copilot-instructions.md` e `.github/instructions/`) não vão para a tag se você não os
  adicionar. Decida se são seus antes de seguir; não precisa apagá-los.

## Passo 2 — Enviar a branch **(AÇÃO DO DONO)**

```powershell
git push -u origin feature/v4.0-multi-agente
```

Isso só envia o código; ninguém recebe o beta ainda. Abra a branch no GitHub e confirme que o último
commit é o esperado.

## Passo 3 — Criar e enviar a tag **(AÇÃO DO DONO)**

A tag é o "carimbo" do beta: o Release, o marketplace do Claude Code e o instalador usam o nome dela.
O nome tem de ser **exatamente** `v4.0.0-beta.1` (a versão do plugin com um `v` na frente).

```powershell
git tag -a v4.0.0-beta.1 -m "delphi-dev 4.0.0-beta.1 (beta)"
git push origin v4.0.0-beta.1
```

Enviar a tag **dispara o workflow** `Release beta` (próximo passo). Antes de enviar, confirme que
você está no commit certo: `git log -1 --oneline`.

## Passo 4 — O que o workflow faz sozinho

Arquivo: `.github/workflows/release-beta.yml`. Aba **Actions** do repositório, workflow
"Release beta". Em ordem:

1. Confere que a tag é `v` + a versão de `.claude-plugin/plugin.json` (senão para com erro claro).
2. Roda os testes: núcleo (`kb`), instalador, extensão VS Code e a checagem de superfície do
   Claude Code (`claude-surface --check`).
3. Gera o arquivo `delphi-dev-vscode-v4.0.0-beta.1.vsix`.
4. Cria o Release do GitHub **marcado como Pre-release** e anexa o `.vsix`.

Ele **não** publica no npm e **não** publica no Marketplace do VS Code, e não usa nenhum segredo
(só o `GITHUB_TOKEN` automático). Leva alguns minutos.

## Passo 5 — Conferir o Release (só leitura)

Em **Releases** do repositório:

- existe o Release `delphi-dev v4.0.0-beta.1 (beta)` com a etiqueta **Pre-release**;
- o arquivo `delphi-dev-vscode-v4.0.0-beta.1.vsix` está anexado;
- o texto de notas foi gerado automaticamente (pode editar para escrever "o que testar").

Se o workflow falhou, veja [Se algo deu errado](#se-algo-deu-errado).

Teste o marketplace do Claude Code **de verdade** (agora que a tag existe), num ambiente isolado que
não mexe na sua configuração:

```powershell
$env:CLAUDE_CONFIG_DIR = "$env:TEMP\cc-beta-teste"
claude plugin marketplace add adrianosantostreina/delphi-dev#v4.0.0-beta.1
claude plugin install delphi-dev@delphi-dev
claude plugin list            # deve mostrar  Version: 4.0.0-beta.1
Remove-Item Env:CLAUDE_CONFIG_DIR
Remove-Item -Recurse -Force "$env:TEMP\cc-beta-teste"
```

Se o `plugin list` mostrar outra versão (por exemplo a estável), **pare**: a tag ou o
`source.ref` do `marketplace.json` estão errados. Não anuncie o beta.

## Passo 6 — Publicar o instalador no npm com a etiqueta `beta` **(AÇÃO DO DONO)**

```powershell
npm login                                  # usa a SUA conta npm (pode pedir código de 2 fatores)
cd installer
Remove-Item -Recurse -Force dist           # limpa os restos antigos (regra 3)
npm run build                              # recria o dist do zero
npm pack --dry-run                         # lista o que iria no pacote: só dist/ e package.json; NÃO pode ter rag.*
npm publish --tag beta                     # SEMPRE com --tag beta
cd ..
```

O `npm publish` roda o build e os testes sozinho antes de publicar (`prepublishOnly`). Se o npm pedir
um código de 2 fatores: `npm publish --tag beta --otp=123456`.

Confira o resultado:

```powershell
npm view delphi-dev dist-tags
```

Esperado: `latest` ainda na versão estável antiga (a atual é `2.2.2`) e `beta: '4.0.0-beta.1'`.
Se `latest` mudou para o beta, corrija já: [Se algo deu errado](#se-algo-deu-errado).

## Passo 7 — Testar a instalação do beta numa pasta limpa

O ideal é fazer isto em outro computador, máquina virtual ou usuário do Windows, porque o instalador
escreve na configuração do usuário (`~\.claude`, `~\.codex`, `~\.config\opencode`, `~\.delphi-dev`).
Comece **sem escrever nada**:

```powershell
npx delphi-dev@beta --target all --dry-run     # mostra o que faria; não altera nada
```

Depois, de verdade (escolha o que quer testar):

```powershell
npx delphi-dev@beta                    # só Claude Code
npx delphi-dev@beta --target codex     # Codex (ou opencode, ou all)
```

O instalador imprime `Ref: v4.0.0-beta.1 (pre-release version of this package)`: é a confirmação de
que usou a tag do beta e não a `master`. Depois:

```powershell
mkdir $env:TEMP\teste-beta; cd $env:TEMP\teste-beta
claude
```

e dentro do Claude Code rode `/delphi-dev:about`: a versão deve ser `4.0.0-beta.1`. Para a extensão,
baixe o `.vsix` do Release e rode `code --install-extension delphi-dev-vscode-v4.0.0-beta.1.vsix`
(se já houver a extensão 3.0.0 instalada, acrescente `--force`). Para desfazer, use a seção "Voltando
para a versão estável" do README.

## Como publicar o `beta.2` (e os seguintes)

Cada correção do beta é uma **nova tag**; nunca mexa numa tag já enviada (quem instalou ficaria com
algo diferente do que está na tag).

1. Faça a correção na branch `feature/v4.0-multi-agente`.
2. Troque a versão `4.0.0-beta.1` por `4.0.0-beta.2` nestes quatro arquivos:
   `.claude-plugin/plugin.json` (`version`), `.claude-plugin/marketplace.json` (`version` **e**
   `source.ref`, que vira `v4.0.0-beta.2`), `commands/about.md` (as **duas** linhas `Versão:` /
   `Version:`) e `installer/package.json`. O `lint` (`node runtime/kb-cli.mjs lint --root .`) avisa
   se faltar algum.
3. Refaça o Passo 1 (pré-checagens) e commite.
4. Passos 2 e 3 com a nova tag: `git push`, `git tag -a v4.0.0-beta.2 -m "delphi-dev 4.0.0-beta.2 (beta)"`,
   `git push origin v4.0.0-beta.2`. O workflow cria o novo Release.
5. Passo 6 de novo: limpar `dist`, build, `npm publish --tag beta`. Quem usa `npx delphi-dev@beta
   update` passa para o beta.2.
6. A extensão continua `3.0.0` no `package.json`; o `.vsix` novo instala com `--force`.

## Como promover para a versão final (4.0.0)

Só depois de o beta ter sido testado e você aprovar. Tudo abaixo é **AÇÃO DO DONO**.

1. **Versão final** nos mesmos lugares (`4.0.0`, sem sufixo): `plugin.json`, `marketplace.json`,
   `commands/about.md` (as duas linhas) e `installer/package.json`.
2. **Remova** o `"ref": "v4.0.0-beta.N"` do `source` no `marketplace.json`. Se ficar, o plugin
   continuaria preso na tag do beta. O `lint` reclama se você esquecer ("stable ...: remove
   plugins[0].source.ref").
3. **Extensão:** suba `packages/vscode/package.json` para **3.0.1 ou maior** e atualize o
   `CHANGELOG.md` da extensão (regra 5).
4. **READMEs:** tire o bloco de BETA do topo e a seção "Beta: instalar, voltar e reportar" dos **dois**
   (`README.md` e `README.pt-BR.md`).
5. Refaça as pré-checagens (Passo 1) e commite.
6. **Merge na `master`** (pelo GitHub com um Pull Request, ou `git checkout master`,
   `git merge --no-ff feature/v4.0-multi-agente`, `git push`). Efeitos automáticos do push na
   `master`: o workflow `build-kb.yml` publica o release `kb-latest` da base de conhecimento (isso
   acaba com o "HTTP 404" que o `/about` mostra no beta) e o `publish-vscode.yml` publica a extensão
   no Marketplace **se** a versão do `packages/vscode/package.json` mudou — e ele precisa do segredo
   `VSCE_TOKEN` (Settings > Secrets and variables > Actions; token do publisher `adrianosantos`).
   Sem o segredo, a publicação da extensão falha sem causar dano; crie o segredo e rode o workflow
   de novo (Actions > "Publish VS Code Extension" > Run workflow, na `master`).
7. **Tag e Release finais** na `master`: `git tag -a v4.0.0 -m "delphi-dev 4.0.0"` e
   `git push origin v4.0.0` (essa tag **não** dispara o workflow de beta, que só reage a tags com
   hífen), e crie o Release normal no GitHub.
7b. **Extensão e textos que citam o canal beta:** em `packages/vscode/src/agents/presence.ts` troque
   `INSTALLER_SPEC = 'delphi-dev@beta'` por `'delphi-dev'` (e ajuste `packages/vscode/test/presence.test.ts`).
   Sem isso a extensão final continuaria mandando instalar o beta. Confira também com
   `grep -rn "@beta" packages/vscode/src commands installer/src`.
8. **npm:** `cd installer`, `Remove-Item -Recurse -Force dist`, `npm run build`, `npm publish`
   **sem** `--tag` (agora o `latest` passa a ser a 4.0.0). Confira com `npm view delphi-dev dist-tags`.
   Opcional: `npm dist-tag rm delphi-dev beta`.
9. Avise quem testou o beta como migrar: a seção "Voltando para a versão estável" do README (com o
   beta já fora do README, passe por mensagem).

## Se algo deu errado

| Sintoma | O que fazer |
|---|---|
| O workflow falhou em "A tag precisa ser v<versão do plugin>" | A versão do `plugin.json` não é a da tag. Corrija na branch, apague a tag (`git push origin :refs/tags/v4.0.0-beta.1` e `git tag -d v4.0.0-beta.1`), faça push da correção e crie a tag de novo **antes de divulgar**. Se já divulgou, use `beta.2`. |
| O workflow falhou em algum teste | Abra o log na aba Actions; rode o mesmo teste local (Passo 1). Corrija, e siga o caso acima (tag nova). |
| O workflow rodou mas o Release já existia | Ele só anexa o `.vsix` de novo (`--clobber`); nada a fazer. |
| `npm view delphi-dev dist-tags` mostra `latest` no beta | Devolva a estável: `npm dist-tag add delphi-dev@2.2.2 latest` (troque pela versão estável correta) e confira de novo. |
| Publiquei o npm com os arquivos errados | Não dá para republicar a mesma versão. Corrija e publique `4.0.0-beta.2` (com `--tag beta`); o `npm deprecate delphi-dev@4.0.0-beta.1 "use beta.2"` avisa quem instalou a anterior. |
| Plugin instalou a versão estável em vez do beta | Confira que o `marketplace.json` da tag tem `source.ref` igual ao nome da tag; sem ele o Claude Code instala o plugin da `master`. O `lint` protege isso. |
| `Cannot add marketplace "delphi-dev": its source doesn't match...` | A pessoa já tem o marketplace estável. Primeiro `/plugin marketplace remove delphi-dev`, depois o `add` com `#v4.0.0-beta.1`. |
