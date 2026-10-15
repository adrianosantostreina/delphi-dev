# FMX: item de lista dinâmica como TForm é lento — trocar por TFrame + TVertScrollBox

**[FMX/Mobile]**

## Problema

Um padrão comum (e ruim) para "card" de item numa listagem dinâmica em FMX é
um `TForm` criado por instância (`TCompItem.Create(nil)`), com um
`TListBoxItem` interno que é reparentado (`AddObject`) para dentro de um
`TListBox`. Cada `TForm`, mesmo nunca exibido como janela própria, cria um
**handle de janela nativa** — caro para criar, caro para destruir. Numa
lista de ~150 itens isso é perceptível (medido em projeto real: 11s para
0.93s trocando a técnica, 4-12x).

## Técnica: TFrame + TVertScrollBox, posicionamento absoluto manual

1. **`TForm` → `TFrame`**. `TFrame` não cria handle nativo — é só uma árvore
   de controles FMX comuns. O resto do item (labels, imagem, botões)
   continua igual.
2. **`TListBox` → `TVertScrollBox`**. Sem essa troca não há ganho: o
   `TListBox` tem seu próprio mecanismo de item (`TListBoxItem`) que
   também tem custo. `TVertScrollBox` é um container de rolagem genérico,
   mais barato, mas **não empilha os filhos sozinho** como o `TListBox`
   fazia — é o preço da técnica.
3. **Posicionamento manual, absoluto**: quem chama acumula uma posição Y
   (altura do card + espaçamento) e passa para o componente antes de
   parentar:
   ```pascal
   function TCompItem.New(const AConteiner: TVertScrollBox): TFmxObject;
   begin
     Result := LytApoio;               // o layout raiz do conteudo do item
     LytApoio.Parent := AConteiner;    // Parent := ScrollBox (nao .Content) --
                                        // o TVertScrollBox redireciona sozinho
                                        // pro conteudo interno (mesma tecnica
                                        // usada em qualquer TScrollBox.Parent)
     LytApoio.Width    := AConteiner.Width - 32;
     LytApoio.Position.X := 16;
     LytApoio.Position.Y := FPosicaoY;  // setado antes via .Position(Y)
   end;
   ```
   Sem virtualização/reciclagem de células — a lista acumula um `TFrame`
   por item até a próxima busca/reset limpar tudo. Aceitável quando a
   paginação (scroll infinito) já limita quantos itens existem por vez;
   não serve para listas de milhares de itens sempre montados.

4. **HitTest em cascata**: sem isso, arrastar o dedo sobre o card tenta
   "clicar" nele em vez de rolar a lista — o `TVertScrollBox` só recebe o
   gesto de arrasto se ele não for capturado por um filho com
   `HitTest=True` no caminho. Deixar `HitTest=False` em TODO controle não
   clicável do card, e `HitTest=True` só nos poucos realmente clicáveis.
   Esquecer um controle novo aqui quebra o scroll **silenciosamente**, sem
   erro nenhum — fácil de não notar em teste rápido.

## Armadilha de ownership: `Parent` ≠ `Owner`

Reparentar visualmente (`Parent := AConteiner`) **não transfere posse**. Se
o `TFrame` foi criado com `Create(nil)`, ninguém libera sua memória
automaticamente — nem o `TVertScrollBox` (ele só teria o filho VISUAL,
`LytApoio`, não o `TFrame` inteiro), nem qualquer outro mecanismo. É preciso
uma lista dona explícita do lado de quem cria:

```pascal
FComponentes := TObjectList<TObject>.Create(True);  // OwnsObjects = True
...
FComponentes.Add(LComponente);
LComponente.Position(Y).New(AConteiner);
```

Ao limpar a lista para uma nova busca/página, a ordem importa: **desanexar
da árvore visual primeiro, liberar a memória depois** — não o contrário nem
os dois ao mesmo tempo (chamar `.Free` de dentro do próprio componente E
depois `FComponentes.Clear` com `OwnsObjects=True` libera o mesmo objeto
duas vezes, access violation intermitente e difícil de reproduzir). Um
método `RemoveItem` que só desanexa (`LytApoio.Parent := nil`) — sem
`Free` — mantém a responsabilidade de liberar exclusivamente na lista dona:

```pascal
procedure TCompItem.RemoveItem;
begin
  LytApoio.Parent := nil;   // so desanexa -- quem libera e o dono real
end;

procedure TView.LimparLista;
var I: Integer;
begin
  for I := 0 to FComponentes.Count - 1 do
    TCompItem(FComponentes[I]).RemoveItem;
  FComponentes.Clear;       // OwnsObjects=True libera de verdade aqui
end;
```

## Ver também

`fmx-scrollbox-scroll-vs-toque.md` — o dilema HitTest em mais detalhe, com
outras soluções (gesto manual, helper OnTap→OnClick).
