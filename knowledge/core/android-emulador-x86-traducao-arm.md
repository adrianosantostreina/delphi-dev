# [Android] Testar APK Delphi no emulador x86_64 (tradução ARM) — sem aparelho físico

O Delphi gera só binário **ARM** (Android32 = armeabi-v7a, Android64 = arm64-v8a) e a Embarcadero
**não suporta oficialmente** o emulador. Mesmo assim, imagens **x86_64 API 30+ (Android 11+)** do
emulador Google trazem tradução ARM (`libndk_translation`) e rodam o APK. Validado em 2026-10-01:
Delphi 13 (37.0), Android64 Debug, AVD API 36.1 x86_64 Google Play — app FMX abriu até o Login.

## Conferir se a imagem traduz ARM
```
adb shell getprop ro.product.cpu.abilist          # precisa listar arm64-v8a (ex.: x86_64,arm64-v8a)
adb shell getprop ro.dalvik.vm.native.bridge      # libndk_translation.so
```

## Gerar o APK pela linha de comando (sem IDE)
O `/t:Build` só compila o `.so`; o empacotamento vem do target **Deploy**:
```
call "C:\Program Files (x86)\Embarcadero\Studio\37.0\bin\rsvars.bat"
msbuild Projeto.dproj /t:Build;Deploy /p:Config=Debug /p:Platform=Android64
```
APK em `Android64\Debug\<Projeto>\bin\<Projeto>.apk`. Package default: `com.embarcadero.<Projeto>`
(ou o que estiver no `AndroidManifest.xml` gerado em `Android64\Debug`).

## Subir emulador, instalar, abrir, capturar
```
%LOCALAPPDATA%\Android\Sdk\emulator\emulator -avd <AVD> -no-boot-anim     (em background)
adb shell getprop sys.boot_completed                                       (esperar = 1)
adb install -r -g Projeto.apk
adb shell monkey -p com.embarcadero.Projeto -c android.intent.category.LAUNCHER 1
adb exec-out screencap -p > tela.png
adb logcat -d --pid=<pid>
```

## Armadilhas / o que esperar
- **Inicialização lenta** pela tradução: splash por 15–30 s antes da 1ª tela. Não confundir com travamento —
  confirmar com `adb shell pidof <pkg>` e `dumpsys activity activities | grep topResumedActivity`.
- `E MESA: Failed to open rendernode` no logcat é ruído do GPU emulado, não é erro do app.
- Desempenho e bugs específicos de tradução **não** valem como medição — validação final sempre em aparelho ARM.
- No emulador, `10.0.2.2` é o `localhost` do PC host (para apontar o app para um Horse local).

## Armadilhas achadas numa bateria completa (2026-10-01)
- **`INSTALL_FAILED_INSUFFICIENT_STORAGE` com centenas de MB livres:** o Android reserva uma
  folga mínima, e um app Delphi Debug tem `.so` de ~220 MB descompactado. `adb install -r`
  precisa das duas cópias ao mesmo tempo. Saída: `adb uninstall` e depois
  `adb install --no-incremental -g app.apk`, que instalou onde o streamed/incremental falhava.
  A reinstalação zera os dados do app: reinjete o `config.ini` com
  `adb push x /data/local/tmp/ && adb shell "cat /data/local/tmp/x | run-as <pkg> sh -c 'cat > files/x'"`.
- **Rodar sem atrapalhar o usuário:** `emulator -avd <AVD> -no-window -no-boot-anim -no-audio` e
  telas via `adb exec-out screencap -p`. Para ler, reduza a imagem à metade e multiplique por 2
  as coordenadas do `input tap`.
- **Emulador em inglês:** `FormatSettings` vem en-US e o app mostra `R$ 4.27`. Fixe pt-BR na
  inicialização com campos explícitos (DecimalSeparator etc.), não só
  `TFormatSettings.Create('pt-BR')`.
- **Crash nativo sem pista:** ver [android-crash-nativo-simbolizar-tombstone.md](android-crash-nativo-simbolizar-tombstone.md).
