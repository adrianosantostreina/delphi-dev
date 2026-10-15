# Runtime error 217 no startup — resolver o endereço pelo `.map`

**Sintoma:** o app abre só um dialog `Error` com "Runtime error 217 at 00XXXXXX", sem log nenhum. É uma exceção não tratada **antes** do `Application.Run`, normalmente num `initialization` de unit ou num singleton criado cedo (ex.: conexão de banco aberta na criação do DataModule/singleton).

## Diagnóstico rápido (sem IDE)

1. Recompilar com map detalhado, sem mexer no `.dproj`:
   ```
   call "...\Studio\20.0\bin\rsvars.bat" && msbuild X.dproj /t:Build /p:Config=Debug /p:Platform=Win32 /p:DCC_MapFile=3
   ```
   O `.map` sai ao lado do `.exe`.
2. Rodar de novo e ler o endereço (mesma build do `.map`!). Dá para ler o dialog sem foco via UI Automation, filtrando por `ProcessIdProperty` (o dialog é classe `#32770`).
3. Offset no segmento `.text` = `endereço - $00401000` (ImageBase `$400000` + início do segmento `$1000`, Win32). Procurar no `.map`:
   - `Detailed map of segments`: linha `0001:INICIO TAMANHO ... M=Unit` que contém o offset → **unit**;
   - `Publics by Value`: maior `0001:ADDR` ≤ offset → **rotina**;
   - `Line numbers for Unit(arquivo.pas)`: maior linha ≤ offset → **linha**.

## Caso real
`FireDAC.Phys.TFDPhysConnection.RecoverConnection` → o banco não conectou no startup (config JSON apontando para caminho/porta de outra máquina). Não era bug de código: corrigir o `DATABASE_*` da config.

Complementa [writeln-sem-console-runtime-error-217.md](writeln-sem-console-runtime-error-217.md) (lá a bissecção do `uses` foi o caminho; aqui o `.map` resolveu direto porque o endereço foi lido da mesma build).
