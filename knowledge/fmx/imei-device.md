# Identificador único do dispositivo (IMEI / ANDROID_ID / UUID iOS)

Como pegar um identificador estável do device para enviar em headers de API (`X-Device-IMEI` etc.).

## Importantes
- **Android 10 (API 29)+**: `TelephonyManager.getDeviceId()` foi **removido** — lança `SecurityException` e exige permissão especial que apps comuns não recebem. Usar **ANDROID_ID** como fallback (ou estratégia principal).
- `ANDROID_ID` é estável por combinação de app-signing-key + user + device. Reinstalar o mesmo APK mantém o ID; desinstalar/reinstalar outro APK muda.
- **iOS**: `identifierForVendor.UUIDString` é estável enquanto existir qualquer app do mesmo vendor instalado. `uniqueIdentifier` foi removido há anos pela Apple — não usar.
- **Windows**: não há equivalente mobile; use stub ou MAC address se precisar.

## Uses necessárias

```pascal
{$IFDEF ANDROID}
  Androidapi.Helpers,                        // SharedActivity, SharedActivityContext
  Androidapi.JNIBridge,                      // ILocalObject (OBRIGATÓRIO para (obj as ILocalObject))
  Androidapi.JNI.JavaTypes,                  // JObject, JStringToString
  Androidapi.JNI.GraphicsContentViewText,    // TJContext (TELEPHONY_SERVICE)
  Androidapi.JNI.Telephony,                  // TJTelephonyManager
  Androidapi.JNI.Provider,                   // TJSettings_Secure (ANDROID_ID)
  Androidapi.JNI.Os,                         // TJBuild_VERSION (opcional)
{$ENDIF}
{$IFDEF IOS}
  iOSapi.UIKit,                              // UIDevice
  Macapi.Helpers,                            // NSStrToStr
{$ENDIF}
```

> **Erro típico se esquecer `Androidapi.JNIBridge`:** `E2003 Undeclared identifier: 'ILocalObject'`. O cast `(LObj as ILocalObject).GetObjectID` depende dessa interface.

## Snippet pronto (Android/iOS + stub Windows)

```pascal
class function TLib.GetIMEI: string;
{$IFDEF ANDROID}
var
  LObj: JObject;
  LTM: JTelephonyManager;
  LDeviceId: string;
{$ENDIF}
{$IFDEF IOS}
var
  LDevice: UIDevice;
{$ENDIF}
begin
  Result := 'SEM_IMEI';

  {$IFDEF MSWINDOWS}
  Result := 'WINDOWS';
  Exit;
  {$ENDIF}

  {$IFDEF ANDROID}
  try
    LObj := SharedActivityContext.getSystemService(TJContext.JavaClass.TELEPHONY_SERVICE);
    if LObj <> nil then
    begin
      LTM := TJTelephonyManager.Wrap((LObj as ILocalObject).GetObjectID);
      if LTM <> nil then
        LDeviceId := JStringToString(LTM.getDeviceId);
    end;
  except
    LDeviceId := '';  // Android 10+ ou permissão negada → vai no fallback
  end;

  if LDeviceId = '' then
    LDeviceId := JStringToString(
      TJSettings_Secure.JavaClass.getString(
        SharedActivity.getContentResolver,
        TJSettings_Secure.JavaClass.ANDROID_ID
      ));

  if LDeviceId <> '' then
    Result := LDeviceId;
  {$ENDIF}

  {$IFDEF IOS}
  LDevice := TUIDevice.Wrap(TUIDevice.OCClass.currentDevice);
  if LDevice <> nil then
    Result := NSStrToStr(LDevice.identifierForVendor.UUIDString);
  {$ENDIF}
end;
```

## Permissão Android (opcional, só se quiser `getDeviceId` real)

No `AndroidManifest.template.xml`:
```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
```
E em tempo de execução, usando `TPermissionsService`:
```pascal
PermissionsService.RequestPermissions(['android.permission.READ_PHONE_STATE'], ...);
```

Mas na prática para APIs modernas, **prefira ANDROID_ID direto** — não precisa de permissão e é o que sobra em Android 10+.
