# Mapa de testes — v3.1.0 e v3.2.0

> Tudo que mudou nas duas releases de 2026-08-31, em ordem de execução.
> Marque conforme for passando. **Tempo estimado: ~50 min** (bloco A é o mais longo).
> Se algo falhar, o que importa é o **primeiro** erro — os seguintes costumam ser cascata.

---

## Bloco 0 — Preparação (3 min)

- [ ] **0.1** Atualizar o plugin: `npx delphi-dev update`
      Esperado: "Plugin updated" e "RAG updated".
- [ ] **0.2** Confirmar a versão: dentro do Claude Code, `/about`
      Esperado: **3.2.0**, e o `/e2e` aparecendo na lista de comandos.
- [ ] **0.3** `npx delphi-dev verify`
      Esperado: claude, plugin e VS Code OK. **A linha do RAG pode aparecer como ausente e isso não é erro hoje** — nada lê o `rag.db` enquanto os hooks estiverem OFF.

> Se o `/about` mostrar 3.1.0 ou o `/e2e` não aparecer, o plugin não recarregou: reinicie o Claude Code ou rode `/reload-plugins`.

---

## Bloco A — `/e2e` (a entrega principal, ~25 min)

Use um app **FMX Windows** seu, de preferência um com tela de login. Se não tiver um à mão, `D:\Temp\Projeto GT 004` serve para os testes A1–A4 (é um form com um botão que abre um `ShowMessage`).

### A1 — Ativação e recusa de plataforma
- [ ] **A1.1** Numa sessão nova, num projeto Delphi, escreva: *"abre o app e testa a tela de login"*
      Esperado: a skill `delphi-e2e` ativa (não a `delphi-tests`).
- [ ] **A1.2** Escreva: *"quero cobertura de testes unitários com DUnitX"*
      Esperado: ativa a `delphi-tests`, **não** a `delphi-e2e`. Os gatilhos têm que ser disjuntos.
      ⚠️ *Esta é a verificação que eu não consegui fazer — precisa de sessão interativa.*

### A2 — O gate de segurança
- [ ] **A2.1** `/e2e login: senha em branco, senha errada, senha correta`
      Esperado: **para e espera** antes de qualquer clique, listando os cenários, quais gravam dados, e o modo de janela.
- [ ] **A2.2** Recuse a autorização.
      Esperado: nada é clicado; os cenários que gravam saem ⏭️ PULADO.

### A3 — Execução e vereditos
- [ ] **A3.1** Autorize e deixe rodar.
      Esperado: narração passo a passo, e um relatório em tabela ao final (cenário | expectativa | resultado | evidência).
- [ ] **A3.2** Confira que os vereditos usam os quatro rótulos, não dois.
- [ ] **A3.3** **O teste que mais importa:** force um cenário a falhar por motivo externo — por exemplo, feche o app no meio da bateria.
      Esperado: o cenário seguinte sai **⛔ BLOQUEADO**, nunca ❌ FALHOU. Se sair FALHOU, é bug: o relatório está acusando o app de algo que não é culpa dele.

### A4 — Não roubar foco
- [ ] **A4.1** Enquanto a bateria roda, **digite em outra janela** (um bloco de notas).
      Esperado: nenhum caractere seu vaza para o app, e o cursor do mouse não se move sozinho.
- [ ] **A4.2** `/e2e --background <cenários>`
      Esperado: o app opera **atrás** das suas janelas e não sobe para a frente.

### A5 — Log e instrumentação
- [ ] **A5.1** Rode num app **que já tem log**.
      Esperado: o relatório correlaciona os vereditos com o que apareceu no log.
- [ ] **A5.2** Rode num app **sem log**.
      Esperado: o plugin **oferece** (não impõe) a unit de logging ou o modo `--selftest`, e **declara no relatório** que o veredito é visual.
- [ ] **A5.3** Aceite a oferta da unit de logging.
      Esperado: o código gerado segue os padrões do plugin — sem variável global (usa `class var`), um recurso por `try..finally`, prefixos corretos. **Compile.**

### A6 — Fora do Windows (se tiver acesso)
- [ ] **A6.1** Rode o `/e2e` em macOS ou Linux.
      Esperado: recusa limpa, explicando que depende do `user32.dll`. **Não pode** sugerir `adb` nem caminho Android.

---

## Bloco B — `/new-project` (~15 min)

Foi aqui que o dia começou: o comando gerava projeto que não compilava.

- [ ] **B1** `/new-project` → API REST com Horse, em pasta nova.
- [ ] **B2** Esperado: ele **não entrega e para**. Tem que rodar o build e iterar até `Build OK`, e só então apresentar o projeto.
- [ ] **B3** Se o build falhar, esperado: ele **diz que falhou** em vez de fingir sucesso.
- [ ] **B4** Confira o `.dproj` gerado: `DCC_DebugInformation` tem que ser **numérico** (`0`/`2`), não `true`/`false`.
      *Era isso que quebrava com `F1026: File not found: 'true.dpr'`.*
- [ ] **B5** Confira as classes geradas: nenhuma pode ter `class var` na mesma seção de visibilidade que campos de instância.
      *Era isso que dava 6× `E2356`.*
- [ ] **B6** Confira o código de framework (Horse/GBSwagger): tem que bater com a API real que o `boss` instalou em `modules/`, não com a de memória.
- [ ] **B7** Rode o `.exe` gerado. Esperado: o `config.ini` está **ao lado do executável**, e o banner do console anuncia a URL **real** do Swagger (`/swagger/doc/html`, não `/swagger`).
- [ ] **B8** Repita com **VCL** e com **Library**. Esperado: consulta a KB nos dois casos (antes só o ramo FMX consultava).

---

## Bloco C — Base de conhecimento (~5 min)

Seis arquivos entraram em `knowledge/core/` e um em `knowledge/fmx/`.

- [ ] **C1** Peça: *"por que meu build morre com `File not found: 'true.dpr'`?"*
      Esperado: ele explica o `DCC_DebugInformation` sem você precisar dar contexto.
- [ ] **C2** Peça: *"minha propriedade dá `E2356 Property accessor must be an instance field`"*
      Esperado: ele identifica o vazamento de `class var`.
- [ ] **C3** Peça: *"meu app console Delphi não gera log nenhum"*
      Esperado: ele fala do `Flush(Output)` e do buffer descartado ao matar o processo.

> ⚠️ **Esses três só funcionam se o Claude ler os arquivos do plugin.** Como os hooks estão OFF, não há injeção automática — a skill é que carrega. Se ele não souber, não é bug da KB: é o efeito de os hooks estarem desligados.

---

## Bloco D — RAG (código, ~2 min)

As correções do RAG **não têm efeito visível para o usuário** hoje, porque nada lê o `rag.db` sem hooks. O que dá para testar é o código.

- [ ] **D1** No checkout do repo: `cd scripts && npm test`
      Esperado: **47 testes verdes** (30 antigos + 17 novos).
- [ ] **D2** `cd scripts && npm run build`
      Esperado: build limpo, sem erro de tipo.

---

## Bloco E — Documentação e release (~5 min)

- [ ] **E1** Abra o `README.md` e o `README.pt-BR.md`. Esperado: seção do `/e2e` em cada um, **no idioma certo**, com os quatro vereditos.
- [ ] **E2** `/about` — esperado: `/e2e` listado nas duas tabelas de idioma.
- [ ] **E3** Release: <https://github.com/adrianosantostreina/delphi-dev/releases/tag/v3.2.0>
      Esperado: **Latest**, não-draft, com o asset `rag.db`.
- [ ] **E4** Numa máquina limpa (ou VM): `npx delphi-dev`
      Esperado: instala sem erro e **sem mensagem de erro a cada prompt** — foi o sintoma que motivou o hotfix v2.2.2.

---

## O que eu NÃO consegui verificar

Registro honesto do que ficou sem prova, para você priorizar:

| # | O quê | Por quê | Risco |
|---|---|---|---|
| 1 | Auto-ativação da skill em sessão nova (**A1**) | exige `/plugin install` + sessão interativa | **Baixo** — o `/e2e` é a porta primária e carrega a skill explicitamente |
| 2 | `/e2e` de ponta a ponta num projeto real (**A2–A5**) | não tenho um app seu com login/log | **Alto** — é o caminho completo do produto |
| 3 | `/new-project` depois das correções (**B**) | corrigi o comando, mas não gerei um projeto novo com ele | **Médio** |
| 4 | Recusa fora do Windows (**A6**) | só tenho Windows | Baixo |

O harness em si foi exercitado contra app FMX real (clique, digitação, captura sob oclusão, diálogo `#32770`, modo ao fundo, log sob lock), e o Pascal dos dois templates foi **compilado** com `dcc32`. O que falta é o comando inteiro amarrando tudo.
