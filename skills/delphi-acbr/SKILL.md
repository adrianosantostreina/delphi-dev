---
name: delphi-acbr
description: >
  Especialista em componentes ACBr. Auto-ativa quando detectar: ACBr, NFe, NFCe,
  NFS-e, boleto, CTe, SPED, SAT, MDF-e, Danfe, TACBrNFCe, TACBrNFe, TACBrBoleto,
  pcnConversao, TACBrDFeSSL, "emissão fiscal", "nota fiscal".
---

# Delphi ACBr

> **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`
> (MCP `delphi-dev-kb`); sem ele, leia o arquivo direto: `core/arquivo.md` em
> `~/.delphi-dev/kb-cache/current/` e, se não estiver lá, em `knowledge/` na raiz do plugin
> (a pasta ao lado de `skills/`; `~/.delphi-dev/plugin/knowledge/` so existe se o plugin foi instalado com `npx delphi-dev --target codex|opencode`).

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Referência completa
Consulte `kb:core/acbr-nfce-integracao.md` para:
- Units corretas: `pcnConversaoNFe` (não `pcnConversao`) para NFCe
- SSL=None para ambiente de simulação/homologação
- PathPDF no DANFE (não no campo Arquivos)
- IdCSC é `string`, não integer
- Extração da chave de 44 dígitos
- `ForceDirectories` com path relativo
- PIX = `fpPagamentoInstantaneo`

## Armadilhas comuns

1. **Unit errada para NFCe:** usar `pcnConversaoNFe`, não `pcnConversao`
2. **SSL em homologação:** `TACBrDFeSSL.SSLLib := libNone` para testes locais
3. **PathPDF:** configurar em `DANFE.PathPDF`, não em `Configuracoes.Arquivos.PathSalvar`
4. **IdCSC:** declarar como `string` — atribuição com número causa truncamento
