---
name: contribute-kb
description: |
  Empacota os aprendizados locais do usuário (knowledge/local/) e abre um Pull Request
  no repositório delphi-dev para contribuir com a base de conhecimento comunitária.
  Usa: /contribute-kb, "quero contribuir", "enviar conhecimento", "contribute knowledge"
---

## Idioma de saída
Detecte o idioma da primeira mensagem do usuário. Padrão: pt-BR. Honor: "respond in English" → en-US.

## O que este comando faz

Coleta os arquivos de `knowledge/local/` gerados pelos hooks nas últimas sessões,
sanitiza dados sensíveis e abre um Pull Request no repositório GitHub do plugin
para que o autor possa revisar e mesclar o conhecimento com a base comunitária.

## Fluxo

### pt-BR

1. Verificar se há arquivos em `knowledge/local/` nos últimos 30 dias
   - Se vazio: informar que não há aprendizados para contribuir e sugerir usar o plugin em mais sessões Delphi
   - Se houver arquivos: listar os arquivos encontrados com data e número de chunks

2. Mostrar preview dos primeiros 3 chunks de cada arquivo e perguntar:
   "Quer contribuir estes X aprendizados para a base de conhecimento comunitária? (s/n)"

3. Se confirmado:
   - Sanitizar: remover paths absolutos do usuário, substituir por `~/...`
   - Remover qualquer nome de empresa, CPF, CNPJ, IP de produção (regex)
   - Copiar arquivos sanitizados para `knowledge/community/YYYY-MM-DD-contrib-{hash}.md`
   - Commitar a mudança
   - Abrir PR via `gh pr create`:
     ```
     Título: kb: add community learnings ({N} chunks, {date})
     Body: Contribuição automática via /contribute-kb. Revisar antes de mesclar.
     ```

4. Exibir URL do PR criado

5. Edge case — `knowledge/local/` vazio:
   **pt-BR:** "Não encontrei aprendizados recentes para contribuir. Continue usando o plugin em sessões Delphi — os hooks capturam automaticamente o que você aprende."
   **en-US:** "No recent learnings found to contribute. Keep using the plugin in Delphi sessions — hooks automatically capture what you learn."

### en-US

1. Check for files in `knowledge/local/` from the last 30 days
   - If empty: inform user and suggest more Delphi sessions
   - If files exist: list them with date and chunk count

2. Show preview of first 3 chunks per file and ask:
   "Contribute these X learnings to the community knowledge base? (y/n)"

3. If confirmed:
   - Sanitize: replace absolute paths with `~/...`, remove company names, IPs, CPF/CNPJ
   - Copy to `knowledge/community/YYYY-MM-DD-contrib-{hash}.md`
   - Commit and open PR via `gh pr create`

4. Display PR URL

## Pré-requisitos
- `gh` CLI instalado e autenticado (`gh auth status`)
- git configurado com remote origin

## Flags
- `--dry-run` — mostra o que seria enviado sem criar PR
