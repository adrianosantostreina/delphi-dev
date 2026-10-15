# [FMX] Propriedade não publicada no `.fmx` quebra o form inteiro em runtime

## Sintoma

Ao abrir a tela no device (ou no desktop), um diálogo:

```
Error reading <Componente>.<Propriedade>: Property <Propriedade> does not exist
```

O form **não termina de carregar** — costuma aparecer como tela cinza/vazia. O
projeto **compila normalmente**: o erro é de _streaming_, resolvido só em runtime
quando o leitor de forms percorre o `.fmx`.

## Causa

O `.fmx` contém uma propriedade que a classe daquele componente **não publica**.
Isso acontece quando o arquivo é editado à mão (ou por script) em vez de pelo
Object Inspector — o Designer nunca gravaria uma propriedade inexistente.

Herdar de `TControl` **não** significa que a propriedade esteja publicada: em
FMX, cada classe concreta escolhe o que republicar na sua seção `published`.

## Caso concreto: `TListBoxItem` não publica `Enabled`

`FMX.ListBox.pas` (Delphi 11 / Studio 23.0), seção `published` de `TListBoxItem`:

```pascal
published
  property AutoTranslate default True;
  ...
  property Selectable: Boolean ...;
  property IsChecked: Boolean ...;
  property IsSelected: Boolean ...;
  property StyleLookup;
  property Text;
  property Visible;        // <- publicada
  ...
                           // Enabled NAO aparece
```

Ou seja:

```
object LstItem: TListBoxItem
  Enabled = False     // quebra o form ao carregar
  Visible = False     // correto
end
```

Para "desligar" visualmente um item de `TListBox`, use `Visible = False` no
design, ou atribua `Enabled` **em código** (é acessível como propriedade pública
em runtime — o que não existe é a versão _publicada_, que é a que o streaming lê).

## Como verificar antes de editar um `.fmx` à mão

Ler a seção `published` da classe na fonte da RTL:

```
C:\Program Files (x86)\Embarcadero\Studio\<versao>\source\fmx\FMX.<Unit>.pas
```

Se a propriedade não estiver listada lá (nem herdada de um ancestral que a
publique), ela não pode ir para o `.fmx`.

## Regra prática

- Preferir sempre o Object Inspector para mexer em propriedades de design.
- Ao editar `.fmx` por script/à mão, conferir a seção `published` da classe alvo.
- Sintoma "tela cinza + Error reading X.Y" = quase sempre isto, não lógica de
  negócio. Não perder tempo depurando o `FormCreate`.

## Ver também

- [componentes-designer-vs-runtime.md](componentes-designer-vs-runtime.md)
- [dfm-fmx-sem-bom.md](dfm-fmx-sem-bom.md)
- [campos-orfaos-fmx.md](campos-orfaos-fmx.md)
