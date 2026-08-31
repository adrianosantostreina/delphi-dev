# Horse + gbswagger: geração de rotas, cadeado e ordem do JWT

Conhecimento genérico para qualquer projeto **Delphi Horse** que documenta rotas com **gbswagger** (`Horse.GBSwagger`) e protege com **Horse.JWT**.

## Como o gbswagger monta a rota Horse a partir das anotações

Controllers documentados herdam de `THorseGBSwagger` (que provê `FRequest`/`FResponse` + construtor `Create(Req,Res)`) e se registram via `THorseGBSwaggerRegister.RegisterPath(TController)` na `initialization` da unit.

A rota efetiva no Horse é montada em `THorseGBSwaggerRegister.GetPathMethod`:

```
rota = BasePath + SwagPath.Name + '/' + SwagEndPoint.Path   (depois colapsa '//' -> '/')
```

- `{id}` nas anotações vira `:id` na rota Horse (`{` -> `:`, `}` -> '').
- **`[SwagPath('Tag')]`** (construtor de 1 argumento) → `Name` fica **vazio** → a rota fica na **raiz** (ex.: `[SwagGET('cargo')]` → `/cargo`).
- **`[SwagPath(C_Prefix, 'Tag')]`** (2 argumentos) → `Name = C_Prefix` vira **segmento-prefixo** (ex.: `C_Prefix='v1'` + `[SwagGET('pessoas')]` → `/v1/pessoas`).

**Pegadinha:** ao converter um controller "procedures soltas + `Registry`" (que registra `THorse.Get('/cargo', ...)` na raiz) para o padrão de classe gbswagger, use `[SwagPath('Tag')]` **com nome vazio** para **preservar o path**. Usar `C_Prefix` muda a rota (`/cargo` → `/v1/cargo`) e quebra qualquer cliente (app mobile) que chama o path antigo.

## Cadeado (security) por-rota é automático

Com **um** esquema de segurança definido no header (`Swagger.AddSecurity('Bearer').&Type(gbApiKey)...`) e os endpoints marcados como **não-públicos** (default de `SwagEndPoint`, `APublic=False`), o `RegisterMethodAuth` aplica o cadeado em cada rota automaticamente. Para deixar um endpoint **público** (sem cadeado), passe o booleano `APublic=True`: `[SwagGET('rota', 'desc', True)]`. O cadeado do Swagger é **documental**; a proteção real continua sendo o middleware `HorseJWT`.

## Ordem do JWT vs ordem de registro das rotas (importante)

`THorse.Use(middleware)` **sem path** chama `RegisterMiddleware` no nó **raiz** da `THorseRouterTree` (`FMiddleware.Add`). Em request-time, os middlewares do nó raiz rodam para **TODA** rota — independentemente de a rota ter sido registrada **antes** (ex.: na `initialization` dos controllers gbswagger) ou **depois** do `THorse.Use`.

Consequência prática: um `THorse.Use(HorseJWT(...))` global **protege todas as rotas**, inclusive controllers gbswagger que se auto-registram na `initialization` (antes do `begin` do `.dpr`). Mover um controller de `Registry` manual (pós-`Use`) para `RegisterPath` (na `initialization`, pré-`Use`) **não desprotege** nada.

A crença comum *"middleware registrado depois de uma rota não a protege"* só vale para `Use` **com path específico** (`RegisterMiddleware(APath, ...)`), não para o `Use` global na raiz. Verificado lendo `Horse.Core.RouterTree.pas` (`RegisterMiddleware` / `ExecuteInternal` usam `FMiddleware` do nó, separado de `FRoute`/`FCallBack`).

Rotas públicas (login, version, health, swagger) continuam saindo via `THorseJWTConfig.New.SkipRoutes([...])`.

## Superfície da API — onde cada método vive (confirmado em gbswagger 3.1.0)

Erros reais observados ao escrever esse bloco **de memória**, num projeto gerado
automaticamente. Todos custam `E2003`/`E2066` em cascata no `.dpr` e são fáceis de evitar.

| Escrito de memória (errado) | Real | Onde |
|---|---|---|
| `Swagger.Title('X')` | `Swagger.Info.Title('X')` | `Title` e `Description` vivem em **`IGBSwaggerInfo`**, alcançado por `.Info` e fechado com `.&End` |
| `Swagger.Description('X')` | `Swagger.Info.Description('X')` | idem |
| `THorse.Use(Horse.GBSwagger.Middleware)` | `THorse.Use(HorseSwagger)` | **`HorseSwagger`** é função que devolve `THorseCallback`. **Não existe** `Middleware`. |

`Version`, `BasePath`, `Host`, `AddSecurity`, `AddBearerSecurity`, `Path` e `AddModel` ficam
direto em `IGBSwagger`. `Version` existe **nos dois** (`IGBSwagger` e `IGBSwaggerInfo`).

Forma que compila:

```pascal
uses
  Horse, Horse.GBSwagger, Horse.JWT;

Swagger
  .Info
    .Title('MinhaApi')
    .Description('API REST')
    .Version('1.0.0')
  .&End
  .AddBearerSecurity;

THorse
  .Use(HorseSwagger)
  .Use(HorseJWT(LSegredo,
    THorseJWTConfig.New.SkipRoutes(['/health', '/swagger/doc/html', '/swagger/doc/json'])));
```

`Swagger` é uma **variável global** `IGBSwagger` declarada na própria `Horse.GBSwagger` — não é
função nem singleton; basta ter a unit no `uses`.

### Rotas reais da UI

A UI do Swagger fica em **`/swagger/doc/html`** e o JSON em **`/swagger/doc/json`** (constantes
`PATH_HTML` / `PATH_JSON` em `Horse.GBSwagger`). Não é `/swagger` — e isso importa para o
`SkipRoutes` do JWT: pular `'/swagger'` **não** libera a UI, e o resultado é um 401 na
documentação.

### Os atributos `Swag*` exigem uma unit própria no `uses`

`SwagPath`, `SwagGET`, `SwagPOST`, `SwagPUT`, `SwagDELETE` vivem em
**`GBSwagger.Path.Attributes`**, que a `Horse.GBSwagger` **não** reexporta.

Sem essa unit no `uses`, o compilador emite apenas `warning W1074: Unknown custom attribute` —
**não é erro**. O projeto compila, sobe, e as rotas anotadas simplesmente **não existem** em
runtime. Falha silenciosa: tratar `W1074` como erro em qualquer controller gbswagger.

```pascal
uses
  Horse,
  Horse.GBSwagger,
  GBSwagger.Path.Attributes;   // <-- sem esta, os atributos viram W1074 e as rotas somem
```

### Regra geral

O `boss install` deixa o **fonte** de toda dependência em `modules/`. Antes de escrever código
contra Horse, gbswagger, horse-jwt ou qualquer lib vendorizada, **ler a interface real ali** —
a versão instalada é a única verdade, e a superfície muda entre versões.

### Banner de startup costuma anunciar a URL errada

Padrão comum no `.dpr`:

```pascal
Writeln('Swagger UI: http://localhost:' + LPorta.ToString + '/swagger');   // ERRADO
```

`/swagger` **não é rota**. Com o JWT global, essa URL devolve **401** — e é justamente a que o
usuário vê no console e cola no navegador. A UI real é `/swagger/doc/html`. Anunciar a rota certa,
e conferir que ela está no `SkipRoutes`.

(E `Writeln` em app console com stdout redirecionado não aparece sem `Flush(Output)` — ver
[`console-writeln-sem-flush-nao-loga.md`](console-writeln-sem-flush-nao-loga.md).)
