# [Android] Achar a linha Delphi de um crash nativo (SIGSEGV) — inclusive no emulador com tradução ARM

Validado em 2026-10-01: Delphi 13, Android64 Debug, emulador x86_64 API 36 com tradução ARM.
Achou em minutos um crash que bissecção às cegas não achava.

## Sintoma
App fecha sem diálogo. `adb logcat -b crash` mostra `Fatal signal 11 (SIGSEGV) ... fault addr 0xc0`
e um backtrace inútil (`/memfd:exec (deleted)`, que é o código traduzido). Nada de símbolo.

## Receita
1. **Base de carga da lib, no MESMO processo que vai cair** (o ASLR muda a cada execução):
   ```
   P=$(adb shell pidof com.embarcadero.App)
   adb shell "run-as com.embarcadero.App cat /proc/$P/maps" | grep libApp.so | head -1
   # 7097966cb000-... r--p 00000000 ... /lib/arm64/libApp.so   <- base = 7097966cb000
   ```
2. Provoque o crash e leia o tombstone em texto (sem root):
   ```
   adb shell dumpsys dropbox --print SYSTEM_TOMBSTONE > tomb.txt
   ```
   Ache o bloco do pid (`pid: <P>, tid: <P>`). No emulador com tradução, o **`rax`** traz o
   endereço da instrução ARM que falhou (aponta para dentro do `libApp.so`). Em aparelho ARM
   real, use o `pc` do frame #00.
3. `offset = rax - base` e simbolize com o NDK sobre o `.so` **de Debug** (com símbolos), em
   `Android64\Debug\libApp.so`:
   ```
   llvm-symbolizer --obj=Android64/Debug/libApp.so --functions=linkage --demangle 0x34f2234
   # Fmx::Edit::TCustomEdit::GetOnChangeTracking()   ./FMX.Edit.pas:823
   ```
   `llvm-symbolizer.exe` fica em `%LOCALAPPDATA%\Android\Sdk\ndk\<versão>\toolchains\llvm\prebuilt\windows-x86_64\bin`.

## Dica
`fault addr` pequeno (0xc0, 0x18...) = campo de um objeto **nil ou que não é do tipo esperado**.
No caso real era `TEdit(Sender)` com `Sender` sendo o FORM: no Windows passava por sorte, no
Android caía. Procure casts sem `is`.

## Relacionado
- [android-emulador-x86-traducao-arm.md](android-emulador-x86-traducao-arm.md)
- [android-device-debug-live-adb-scrcpy.md](android-device-debug-live-adb-scrcpy.md)
