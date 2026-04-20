---
name: delphi-claudeignore
description: >
  Cria e mantem automaticamente o arquivo .claudeignore na raiz de projetos Delphi,
  ignorando arquivos binarios, compilados e de configuracao de IDE que nao precisam
  ser lidos pelo Claude, economizando tokens e melhorando a performance.
  Use esta skill SEMPRE que detectar arquivos .dpr, .dproj ou .pas em um projeto
  que ainda nao possui .claudeignore. Tambem use quando o usuario mencionar:
  ".claudeignore", "ignorar arquivos delphi", "economizar tokens", "arquivos desnecessarios",
  "otimizar contexto".
---

# Skill: Gerenciador de .claudeignore para Projetos Delphi

Voce e responsavel por garantir que todo projeto Delphi tenha um `.claudeignore` adequado,
evitando que arquivos binarios, compilados e de configuracao de IDE sejam lidos desnecessariamente.

## Idioma

Detecte o idioma da primeira mensagem do usuario e responda **sempre nesse idioma**.
Padrao: portugues brasileiro (pt-BR). Idiomas suportados: pt-BR, en-US.

Honre overrides explicitos:
- "respond in English" / "in English please" → en-US
- "responda em portugues" → pt-BR

## Protocolo de Execucao Automatica

Ao detectar que o projeto contem arquivos `.dpr`, `.dproj` ou `.pas`:

### PASSO 1 — Verificar existencia
Verificar se existe `.claudeignore` na raiz do projeto.

### PASSO 2A — Se NAO existir
Criar o arquivo `.claudeignore` imediatamente com o conteudo padrao abaixo.
Em seguida, notificar o usuario no idioma selecionado.

**pt-BR:**
```
✅ .claudeignore criado automaticamente.
Arquivos ignorados para economizar tokens:
- Binarios e compilados: .dcu, .exe, .dll, .bpl, .dcp, .rsm
- Recursos: .res, .dres
- Configuracao de IDE: .dproj, .dof, .cfg, .local
- Temporarios: .~*, .map, .drc
- Saidas de compilacao: Win32/, Win64/, Android/, iOSDevice64/, OSX64/
- Historico de IDE: __history/
```

**en-US:**
```
✅ .claudeignore created automatically.
Files ignored to save tokens:
- Binaries and compiled output: .dcu, .exe, .dll, .bpl, .dcp, .rsm
- Resources: .res, .dres
- IDE configuration: .dproj, .dof, .cfg, .local
- Temporary files: .~*, .map, .drc
- Build outputs: Win32/, Win64/, Android/, iOSDevice64/, OSX64/
- IDE history: __history/
```

### PASSO 2B — Se JA existir mas incompleto
Comparar com o padrao abaixo. Se faltar entradas relevantes, sugerir atualizacao
no idioma selecionado:
- pt-BR → "Seu .claudeignore nao inclui [X]. Deseja que eu atualize?"
- en-US → "Your .claudeignore is missing [X]. Would you like me to update it?"

### PASSO 3 — Nao alterar arquivos de codigo-fonte
O `.claudeignore` nunca deve ignorar: `.pas`, `.dfm`, `.dpr`, `.dpk`, `.inc`
Esses arquivos contem o codigo-fonte e devem sempre ser lidos.

---

## Conteudo Padrao do .claudeignore

```
# =============================================
# .claudeignore — Projeto Delphi
# Gerado automaticamente pelo plugin delphi-dev
# =============================================

# --- Arquivos compilados e binarios ---
*.dcu
*.exe
*.dll
*.bpl
*.dcp
*.rsm
*.so
*.dylib
*.apk
*.ipa

# --- Recursos compilados ---
*.res
*.dres

# --- Configuracao e metadados de IDE ---
*.dproj
*.dof
*.cfg
*.local
*.identcache
*.projdata
*.tvsconfig
*.dsk

# --- Mapas e debug ---
*.map
*.drc
*.jdbg

# --- Arquivos temporarios ---
*.~*
*.bak
*.tmp
*.log

# --- Saidas de compilacao por plataforma ---
Win32/
Win64/
Android/
Android64/
iOSDevice32/
iOSDevice64/
iOSSimulator/
OSX64/
OSXARM64/
Linux64/

# --- Historico e backup de IDE ---
__history/
__recovery/

# --- Outros ---
*.svn/
.git/
node_modules/
```

---

## O que NAO ignorar (nunca adicionar ao .claudeignore)

| Extensao | Motivo |
|---|---|
| `.pas` | Codigo-fonte Pascal — principal arquivo de leitura |
| `.dfm` | Layout de formularios VCL — importante para entender a UI |
| `.dpr` | Arquivo de projeto — define as units do sistema |
| `.dpk` | Arquivo de pacote — define componentes |
| `.inc` | Includes — podem conter codigo relevante |
| `.fmx` | Layout FMX — importante para projetos FireMonkey |
