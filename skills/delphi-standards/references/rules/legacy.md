# Rule: Trabalhando com Código Legado

## Princípio fundamental
Não quebre o que funciona. Modernize apenas o escopo da tarefa atual.

## Estratégia incremental

1. **Entenda antes de tocar** — leia o método inteiro, entenda o fluxo. Não assuma.

2. **Adicione testes antes de refatorar**
   Código sem teste = caixa preta. Adicione testes de caracterização primeiro:
   ```delphi
   // Teste que documenta o comportamento atual (mesmo que "errado")
   procedure TesteLegado_CalcularDesconto_ComportamentoAtual;
   begin
     Assert.AreEqual(10.0, LServico.CalcularDesconto(100.0)); // captura o atual
   end;
   ```

3. **Extraia interfaces antes de substituir implementações**
   Antes de trocar `TClienteDAODireto` por `TClienteRepository`, crie `IClienteDAO`
   e faça ambos implementarem.

4. **Modernize só o escopo da tarefa**
   Se foi pedir para corrigir um bug em `CalcularTotal`, não refatore `ProcessarPedido`
   enquanto está lá.

5. **Documente decisões de não-modernização**
   ```delphi
   // LEGACY: este método usa concatenação SQL por compatibilidade com o relatório X
   // que não pode ser alterado sem testes de regressão completos (pendente sprint Y)
   ```

## Sinais de código legado Delphi
- `String[N]` (ShortString) → substituir por `string`
- `AnsiString` → verificar se ainda necessário para APIs externas
- `Real` → substituir por `Double` ou `Currency`
- `with` em todo lugar → remover gradualmente
- Sem interfaces → adicionar antes de qualquer teste
- SQL concatenado → parametrizar um por vez
- Sem `try..finally` → adicionar ao tocar o código

## Quando NÃO modernizar
- Código que interfere com relatórios legados validados pelo cliente
- Interfaces COM/DLL com ABI fixo
- Código de integração com sistemas externos que tem contrato de bytes
