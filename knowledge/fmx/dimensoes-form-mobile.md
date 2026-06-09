# Dimensões padrão dos forms FMX Mobile

Todo `TForm` FMX projetado para **mobile (Android/iOS)** deve ser criado no Designer com:

- **ClientWidth = 400**
- **ClientHeight = 750**

Essa é a proporção de referência usada para todas as telas do projeto. Mantê-la consistente evita retrabalho ao posicionar componentes com `Align` e `Margins`, e casa com a área útil real do viewport no device após descontar status bar / navigation bar em devices típicos.

**Sempre aplicar em forms novos**, inclusive forms herdados (os herdeiros nascem com as dimensões do pai, mas se o herdeiro sobrescrever `ClientHeight`/`ClientWidth`, manter 400 × 750).

---

## No `.fmx` o que esperar

```pascal
object ViewXxx: TViewXxx
  ClientHeight = 750
  ClientWidth = 400
  FormFactor.Width = 320
  FormFactor.Height = 480
  FormFactor.Devices = [Desktop]
  ...
end
```

`FormFactor.Width/Height` são apenas metadados de preview do Designer — não mexer. O que importa é `ClientWidth`/`ClientHeight`.

## Exceções comuns

- **Telas de Login / splash**: 800 de altura é tolerável quando há `TVertScrollBox` como conteúdo principal (p.ex. login com teclado virtual). Para forms simples, manter 750.
- **Drawer / Menu lateral**: a largura útil é menor (250–280) porque fica dentro de um `TMultiView`, mas o `.fmx` do próprio form ainda é 400 × 750 — o MultiView aparece em runtime com o width colapsado definido em `NavigationPaneOptions.CollapsedWidth`.

## Por que 400 × 750 e não o tamanho real do device

O FMX renderiza por DPI/scale — no runtime o form se adapta ao tamanho real da tela do device. 400 × 750 é a "resolução lógica de projeto" adotada como padrão. Usar sempre o mesmo valor:

1. Evita que cada desenvolvedor escolha um valor diferente
2. Permite reutilizar layouts e margens entre telas
3. Facilita revisão visual (todas as telas parecem com o mesmo "tamanho" no Designer)
