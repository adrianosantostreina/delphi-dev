# Deployment de arquivos extras (config.ini, .db, .json, assets)

Arquivos que precisam ir junto do APK/IPA e estar acessíveis em runtime via `TPath.GetDocumentsPath`.

## Passo no IDE
**Project → Deployment** → botão "Add Files" → selecionar o arquivo → ajustar **Remote Path** conforme plataforma.

## Remote Path por plataforma

| Plataforma | Remote Path |
|---|---|
| Android (todas variantes) | `.\assets\internal\` |
| iOS (Device/Simulator) | `StartUp\Documents\` |

Ambos caem, em runtime, em `TPath.GetDocumentsPath`.

## Como acessar em runtime

```pascal
uses
  System.IOUtils;

var
  LPath: string;
begin
  LPath := TPath.Combine(TPath.GetDocumentsPath, 'config.ini');
  // LPath no Android: /data/data/<package>/files/config.ini (via GetDocumentsPath)
  // LPath no iOS:     {sandbox}/Documents/config.ini
end;
```

## Onde o Delphi persiste

No `.dproj` (XML), dentro de `<ProjectExtensions>/<BorlandProject>/<Deployment>`:

```xml
<DeployFile LocalName="config.ini" Configuration="Debug" Class="ProjectFile">
    <Platform Name="Android64">
        <RemoteDir>assets\internal\</RemoteDir>
        <Operation>0</Operation>
    </Platform>
    <Platform Name="iOSDevice64">
        <RemoteDir>StartUp\Documents\</RemoteDir>
        <Operation>1</Operation>
    </Platform>
</DeployFile>
```

## Campo `Operation` — **MUITO IMPORTANTE**

| Valor | Comportamento |
|---|---|
| `0` | **Sempre sobrescreve** no device a cada deploy. Use para assets read-only (imagens, JSONs de lookup). |
| `1` | **Só copia se não existir**. Use para arquivos **editáveis em runtime** (config.ini, FacilVendas.db) — senão o deploy apaga dados do usuário. |

No IDE isso aparece na coluna "Overwrite" (Always / IfNotExist).

## Cuidado ao fazer update sem desinstalar
Se o usuário atualiza o APK (sem desinstalar) e a `Operation=1`, arquivos antigos do device permanecem. Se você mudar o schema do SQLite ou adicionar campos no config.ini, precisa de uma estratégia de migração em runtime (ver `imei-device.md` + TMigrations do padrão Inforsys).

## Lembretes de configuração

1. Aplicar em **TODAS** as Build Configurations (Debug + Release + Application Store etc) — o IDE replica, mas vale conferir.
2. No Android, `.\assets\internal\` é o único Remote Path que o `TPath.GetDocumentsPath` enxerga direto. Outras pastas como `.\assets\` (sem `internal`) vão para paths diferentes e exigem APIs Java para ler.
3. Arquivos deployados por `Class="ProjectFile"` funcionam para qualquer tipo (texto, binário, DB). Não precisa criar classe customizada.
4. Após adicionar, **fazer clean + deploy** — às vezes o Delphi não detecta arquivos adicionados ao deployment numa build incremental.
