# Git Bash/MSYS trata `foo` e `foo.exe` como o mesmo arquivo — e `bin\` costuma ser o `DCC_ExeOutput` do Win32

Vale para qualquer projeto Delphi que compile para **mais de uma plataforma** no Windows e
publique o artefato copiando arquivos por linha de comando. Bate com força em builds
**Linux64**, porque o linker do Delphi gera um ELF **sem extensão** — nome que colide com o
`.exe` do Win32 sob a emulação MSYS.

## Os dois defeitos, que se somam

### 1. MSYS resolve `foo` para `foo.exe`

`cp`, `ls`, `file`, `test -f` do Git Bash rodam sobre emulação MSYS, que por compatibilidade
com Windows considera `foo` e `foo.exe` o **mesmo** arquivo.

```bash
# destino pretendido: bin/SrvTurboMobileHorse   (ELF, sem extensão)
cp -f "Linux64/Debug/SrvTurboMobileHorse" "bin/SrvTurboMobileHorse"
```

- Se `bin/SrvTurboMobileHorse.exe` **já existe**, o `cp` sobrescreve **o `.exe`**.
- Se não existe, o `cp` pode **criar** o arquivo já com `.exe` colado no nome.

### 2. A verificação por Git Bash mascara o erro

Este é o pior detalhe: depois da cópia torta, conferir por Git Bash **confirma o sucesso**.

```bash
ls -la  bin/SrvTurboMobileHorse    # mostra o arquivo, sem .exe
file    bin/SrvTurboMobileHorse    # ELF 64-bit LSB executable, x86-64  ✓
md5sum  ...                        # hashes batem  ✓
```

Tudo verde, e o arquivo em disco chama-se `SrvTurboMobileHorse.exe`. O MSYS resolveu o nome
sem extensão para o `.exe` nas três verificações. Só ferramenta nativa mostra a verdade:

```powershell
Get-ChildItem "...\bin" -Force | Select-Object Name,Length,LastWriteTime
```

### 3. `bin\` normalmente é a saída do Win32

No `.dproj`, a config Win32 costuma trazer:

```xml
<DCC_ExeOutput>.\bin</DCC_ExeOutput>
<DCC_DcuOutput>.\bin</DCC_DcuOutput>
```

enquanto Linux64 aponta para `.\Linux64\$(Config)`. Então "copiar o binário Linux para `bin\`"
significa gravar por cima do **executável Windows** do mesmo projeto. Com o defeito 1, a
sobrescrita acontece mesmo com nomes que aparentam ser diferentes.

## Caso real (31/08/2026)

Publicando o ELF de `SrvTurboMobileHorse` (Horse/TMV) para o hub de deploy:

- staging `cp` para `Horse/bin/SrvTurboMobileHorse` → substituiu `Horse/bin/SrvTurboMobileHorse.exe`
  (PE32, 31 MB) pelo ELF de 52 MB. Executável Win32 perdido.
- cópia para o hub saiu como `SrvTurboMobileHorse.exe`. O deploy faz
  `scp "$BASE/bin/$BIN"` com `$BIN` sem extensão — teria falhado no envio.
- `ls`, `file` e `md5sum` no Git Bash reportaram tudo certo nos dois casos.

Recuperação: o `.exe` é artefato de build, então recompilar Win32 restaura
(`build.bat Debug Win32`). Confirme com `file` → `PE32 executable ... (console)`.

## Regras

1. **Copiar binário de build por PowerShell**, não por `cp` do Git Bash:
   ```powershell
   Copy-Item -LiteralPath "<proj>\Linux64\Debug\<Proj>" -Destination "<dest>\<binario>" -Force
   ```
2. **Verificar nome por `Get-ChildItem`**, nunca por `ls`/`file`. O `file` é ótimo para
   confirmar *o que* é o arquivo (ELF vs PE32), mas **não** para confirmar *como ele se chama*.
3. **Nunca gravar artefato de outra plataforma em `bin\`.** Confira antes:
   ```bash
   grep -n "DCC_ExeOutput\|DCC_DcuOutput" Projeto.dproj
   ```
   Use uma subpasta dedicada (`bin\linux64\`) — o Delphi não escreve nela.
4. Em pipeline de publicação, comparar **hash + nome** no destino, os dois por ferramenta
   nativa (`Get-FileHash` + `Get-ChildItem`).

## Relacionado

- [build-via-bat-com-log.md](build-via-bat-com-log.md) — padrão de `.bat` com log; lembrar que a
  mensagem final do `.bat` costuma dizer `.exe` fixo mesmo em Linux64, onde não há extensão.
- [horse-linux-docker-firebird.md](horse-linux-docker-firebird.md) — o que fazer com o ELF
  depois de publicado (`chmod +x`, `.ini`, VendorLib).
