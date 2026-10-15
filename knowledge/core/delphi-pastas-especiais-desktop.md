# Pastas especiais: privadas no mobile, COMPARTILHADAS no desktop

## A armadilha

`TPath.GetDocumentsPath` e `TPath.GetCachePath` são **privados por aplicativo**
no Android e no iOS. No **Windows** não são:

| Chamada | Android | Windows |
|---|---|---|
| `TPath.GetDocumentsPath` | sandbox do app | `C:\Users\<user>\Documents` (compartilhada) |
| `TPath.GetCachePath` | cache privado do app | **raiz** de `C:\Users\<user>\AppData\Local` |

Código escrito para mobile que grava `config.ini` ou `foto_123.jpg` "na pasta do
app" funciona no aparelho e **colide com outros programas** no desktop. Como um
app mobile em desenvolvimento roda no Windows o tempo todo, isso deixou de ser
hipótese.

## Dois casos reais, no mesmo projeto

**1. `config.ini` sobrescrito por outro app.** Dois apps de força de vendas na
mesma máquina, ambos gravando em `Documents\config.ini`. O segundo sobrescreveu
servidor, porta e usuário do primeiro. O sintoma foi cruel: o app passou a
autenticar contra a **API errada**, que respondeu 404, e a tela mostrou
*"usuário ou senha não encontrado"* — sem nenhuma pista do motivo real. As
credenciais estavam certas; o destino é que não.

**2. Cache de fotos na raiz do `AppData\Local`.** As imagens eram gravadas como
`produto_<id>.jpg` direto ali. Pior que sujar a pasta: a rotina de limpeza fazia

```pascal
for LArquivo in TDirectory.GetFiles(TPath.GetCachePath, 'produto_*.jpg') do
  TFile.Delete(LArquivo);
```

ou seja, **apagaria arquivos de qualquer outro programa** que casassem com o
padrão.

## A regra

Sempre uma **subpasta com o nome do app**, criada sob demanda:

```pascal
function PastaDoApp(const ABase: string): string;
begin
  Result := TPath.Combine(ABase, 'MeuApp');
  if not TDirectory.Exists(Result) then
    TDirectory.CreateDirectory(Result);
end;

// config:  PastaDoApp(TPath.GetDocumentsPath) + 'config.ini'
// cache:   PastaDoApp(TPath.GetCachePath)     + 'foto_1.jpg'
```

Custa três linhas e vale em todas as plataformas — no mobile a subpasta é
inofensiva, no desktop ela é o que separa seu app dos outros.

## Detalhe que evita um falso alarme

`TDirectory.CreateDirectory` chama `ForceDirectories`, que **devolve `True` se o
diretório já existe** — não levanta. Portanto o par
`if not Exists then CreateDirectory` é seguro mesmo chamado de várias threads em
paralelo (caso típico: N downloads de miniatura ao mesmo tempo).

## Relacionado

- [firedac-sqlite-mobile-beforeconnect.md](firedac-sqlite-mobile-beforeconnect.md) — caminho do `.db` por plataforma
- [fmx-automacao-windows-sem-foco.md](fmx-automacao-windows-sem-foco.md) — rodar app mobile no desktop
