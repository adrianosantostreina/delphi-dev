# [FMX/Android] Ciclo de vida da câmera (TCameraComponent) e scanner de código de barras

## Sintoma

Ao usar `TCameraComponent` (FMX.Media) para preview/scan de código de barras no Android:

```
java.io.IOException: setPreviewTexture failed.
```

Diálogo Java estoura ao **voltar do segundo plano** com a câmera ainda ativa. Reprodução determinística:
abrir a tela → ativar a câmera → **minimizar o app** → esperar (o SO recupera o hardware da câmera e destrói a Surface) → voltar → crash.

## Causa

`TCameraComponent` no Android envolve a API legada `android.hardware.Camera`. O preview fica
ligado a um `SurfaceTexture` (é o `setPreviewTexture`). Quando o app vai para segundo plano,
o Android pausa a Activity e reclama o hardware/GL surface. Se ninguém desativa a câmera,
o FMX tenta restabelecer o preview contra um `SurfaceTexture` já inválido ao retomar → `IOException`.

O FMX **não** amarra o ciclo de vida da câmera ao foreground/background automaticamente — o app precisa fazer.

## Correção — soltar a câmera em background

Registrar um handler de `IFMXApplicationEventService` (unit `FMX.Platform`) e desativar a câmera
ao entrar em segundo plano. **Retomada manual** (não reativar às cegas em `BecameActive`) é a
opção mais segura — reativar automático pode recriar a corrida da surface em alguns aparelhos.

```pascal
uses FMX.Platform, FMX.Media;

// campo
FAppEventService: IFMXApplicationEventService;

// no FormCreate
// ATENCAO: o metodo e SupportsPlatformService (nao SupportsPlatform, que nao
// existe no Delphi 11 e da E2003 Undeclared identifier).
if TPlatformServices.Current.SupportsPlatformService(
     IFMXApplicationEventService, IInterface(FAppEventService)) then
  FAppEventService.SetApplicationEventHandler(HandleAppEvent);

// no Destroy — SEMPRE remover (handler é global; com Router4D a view pode ficar viva)
if Assigned(FAppEventService) then
  FAppEventService.SetApplicationEventHandler(nil);

function TForm.HandleAppEvent(AAppEvent: TApplicationEvent; AContext: TObject): Boolean;
begin
  Result := True;
  case AAppEvent of
    TApplicationEvent.WillBecomeInactive,
    TApplicationEvent.EnteredBackground:
      if FScanning then
        FCamera.Active := False;
  end;
end;
```

`SetApplicationEventHandler` guarda **um** handler; se várias telas registrarem, a última vence —
por isso remover no `Destroy` é obrigatório.

## Boas práticas complementares

- **Blindar a ativação e o buffer:** `try/except` em torno de `FCamera.Active := True` e dentro do
  `OnSampleBufferReady` (um frame ruim não pode derrubar o app). Guardar `if csDestroying in ComponentState then Exit`.
- **Soltar a câmera ao sair da tela** (não só no `Destroy`): com Router4D/frames a instância costuma
  ser mantida viva e o `Destroy` pode não disparar — desative a câmera no fluxo de "voltar".
- **Cancelar/desistir:** sempre oferecer um controle visível que **desative a câmera e feche o overlay**;
  parar só o preview mantendo a tela aberta confunde o usuário.
- **Frame de leitura de código de barras:** o preview deve ser um retângulo **horizontal (paisagem)**.
  A detecção usa o bitmap completo (`SampleBufferToBitmap` → `Reader.Scan`), então a orientação do
  display é só cosmética — não afeta a leitura.
- **Throttle:** processar ~2 frames/s (comparar `MilliSecondsBetween`) evita saturar a main thread.
