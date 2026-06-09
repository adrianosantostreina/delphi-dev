# Delphi × SDK Mobile (Android & iOS) — Tabela de Compatibilidade

**Última atualização desta página:** 2026-04-30. Os prazos e versões mudam — sempre que esta página tiver mais de 2-3 meses, **revalidar** com as fontes oficiais antes de aconselhar.

---

## REGRA OBRIGATÓRIA — quando aplicar esta página

**Sempre que o usuário for buildar para Android ou iOS** (dúvidas sobre `.aab`, `.ipa`, `targetSdkVersion`, deploy em loja, atualização de SDK, escolha de versão Delphi), **antes de qualquer recomendação eu devo:**

1. Identificar a versão do Delphi em uso (perguntar se não está claro)
2. Identificar a SDK Android instalada (`%USERPROFILE%\Documents\Embarcadero\Studio\SDKs\android-XX`) e/ou o Xcode no Mac
3. Conferir contra a tabela abaixo se a combinação Delphi ↔ SDK ↔ exigência da loja está correta
4. Avisar o usuário se algo está desatualizado — mesmo que ele não tenha perguntado

---

## Mapeamento Android API Level ↔ Versão

| API | Android | Codinome | Lançamento |
|---:|---|---|---|
| 23 | 6.0 | Marshmallow | Out/2015 |
| 24-25 | 7.x | Nougat | 2016-2017 |
| 26-27 | 8.x | Oreo | 2017-2018 |
| 28 | 9 | Pie | Ago/2018 |
| 29 | 10 | Q | Set/2019 |
| 30 | 11 | R | Set/2020 |
| 31-32 | 12 / 12L | S | Out/2021 |
| 33 | 13 | Tiramisu | Ago/2022 |
| 34 | 14 | Upside Down Cake | Out/2023 |
| **35** | **15** | **Vanilla Ice Cream** | **Ago/2024** |
| 36 | 16 | Baklava | 2025 |

---

## Mapeamento iOS / iPadOS

iOS é mais simples: a versão da SDK casa com a versão do iOS de mesmo número (iOS 17 SDK ⇄ iOS 17, iOS 18 SDK ⇄ iOS 18, iOS 26 SDK ⇄ iOS 26). A versão do **Xcode** é o que define qual SDK você consegue usar; consultar [Apple Developer — Xcode Support](https://developer.apple.com/support/xcode/) para a tabela atual.

---

## Tabela de Compatibilidade Delphi × Mobile

| Delphi | Lançamento | Android API alvo (default) | Android min suportado | iOS oficialmente suportado |
|---|---|---:|---:|---|
| 11.0 Alexandria | Set/2021 | 30 (Android 11) | 19 | iOS 14 |
| 11.1 | Mar/2022 | 30 | 19 | iOS 15 |
| 11.2 | Set/2022 | 31 | 19 | iOS 15 |
| 11.3 | Mar/2023 | 33 | 23 | iOS 16 |
| 12.0 Athens | Nov/2023 | 33 | 23 | iOS 17 |
| 12.1 | Abr/2024 | 34 | 23 | iOS 17 |
| 12.2 | Set/2024 | 34 | 23 | iOS 18 |
| **12.3** | **Mar/2025** | **35** (Android 15) | **23** | **iOS 18** |
| 12.4+ | (futuro) | provável 36 | 23 | provável iOS 26 |

**Bundles do Delphi 12.3 (verificável em `Tools > Manage Platforms`):**
- NDK: `27.1.12297006`
- Android Command-line Tools: `16.0`
- targetSdkVersion default: `35`
- minSdkVersion default: `23`

---

## Exigências das lojas — estado atual

### Google Play (verificado 2026-04-30)

- **Apps novos / atualizações hoje:** precisa target API **35+** (Android 15)
- **Apps existentes** continuarem disponíveis para usuários novos em Android mais novo que o seu target: API **34+**
- **A partir de 31/ago/2026:** todo app novo ou atualização precisa target API **36** (Android 16). Wear OS, Android TV: API 35.
- Regra geral Google: target dentro de **1 ano** do último Android estável.

Fonte autoritativa: [Google Play Target API requirement](https://developer.android.com/google/play/requirements/target-sdk).

### Apple App Store (verificado 2026-04-30)

- **A partir de 28/abril/2026:** todos os apps enviados para App Store Connect precisam ser buildados com **iOS 26 SDK** (Xcode 26+).
- O *deployment target* (versão mínima de iOS rodável) continua flexível — pode deixar em iOS 16/17/18.
- **Implicação direta para Delphi 12.3:** o suporte oficial é até iOS 18. Para atender a exigência do iOS 26 SDK, precisa-se de:
  - (a) Aguardar Delphi 12.4+ com suporte oficial, **ou**
  - (b) Workaround via Mac com Xcode 26 + ajuste manual no PAServer / SDK manager (recursos da [Kastri / Delphi Worlds](https://github.com/DelphiWorlds/Kastri) ajudam)
  - (c) Não publicar/atualizar no App Store por enquanto

Fonte autoritativa: [Apple Developer — Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/).

---

## Combinações comuns — diagnóstico rápido

| Cenário do usuário | Status |
|---|---|
| Delphi 12.3 + android-35 + Google Play **hoje** | ✅ OK, pode publicar |
| Delphi 12.3 + android-34 + Google Play **hoje** | ❌ Recusado — atualizar para 35 |
| Delphi 12.3 + android-35 + Google Play **após 31/ago/2026** | ❌ Vai recusar — precisa API 36 |
| Delphi 12.2 ou mais antigo + android-35 | ⚠️ Funciona mas não é a configuração suportada |
| Delphi 12.3 + iOS 18 SDK + App Store **hoje** | ❌ Recusado — exige iOS 26 SDK desde 28/abr/2026 |

---

## Como validar a SDK Android instalada (Windows)

```
dir "%USERPROFILE%\Documents\Embarcadero\Studio\SDKs"
```

Pastas `android-XX` indicam quais API levels estão instaladas. A configuração ativa do Delphi está em `Tools > Options > Deployment > SDK Manager`, e as VerInfo do projeto em `Project > Options > Build > Version Info` (chave `targetSdkVersion`).

---

## Fontes oficiais (consultar dinamicamente — esta página fica desatualizada)

- [Embarcadero PlatformStatus](https://docwiki.embarcadero.com/PlatformStatus/en/Main_Page) — tabela mestra Embarcadero (Android e iOS)
- [Embarcadero — Supported Target Platforms (Athens)](https://docwiki.embarcadero.com/RADStudio/Athens/en/Supported_Target_Platforms)
- [Google Play Target API requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Apple Developer — Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Apple Developer — Xcode Support](https://developer.apple.com/support/xcode/) — qual Xcode aceita qual iOS SDK
- [DelphiWorlds — HowTo / AndroidLowerVersions](https://github.com/DelphiWorlds/HowTo/tree/main/Solutions/AndroidLowerVersions) — workaround para targetar APIs além do default do Delphi

---

## Histórico de revisões desta página

- 2026-04-30 — criação. Capturado: Delphi 12.3 + API 35; Google Play exige API 35 hoje, API 36 a partir de 31/ago/2026; App Store exige iOS 26 SDK desde 28/abr/2026.
