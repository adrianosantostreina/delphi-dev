# Delphi 13 (RAD Studio 37.0) — Breaking changes em FMX

Lista de quebras de API que aparecem em projetos migrados do Delphi 12.x para o 13.x.

---

## TAniCalculations.Interval removida

**Sintoma (compilando no Delphi 13 código que vinha do 12 ou anterior):**

```
[DCC Error] E2003 Undeclared identifier: 'Interval'
```

na linha que faz, por exemplo:
```pascal
ScrollBox.AniCalculations.Interval := 100; // ms
```

### Por que

No Delphi 12.x a unit `FMX.InertialMovement` expunha:

```pascal
property Interval: Word read FInterval write SetInterval default DefaultIntervalOfAni;
```

— era o intervalo (em ms) do timer interno que recalculava posição/velocidade da inércia.

No **Delphi 13** a engine foi reescrita: passou a usar um `TDisplayLinkService` que sincroniza o cálculo com o refresh rate do display (ProMotion 120Hz, etc). `FInterval` virou `Double` privado e **a propriedade pública `Interval` foi removida** — não há substituto público.

```pascal
// FMX.InertialMovement.pas no 37.0
FInterval := FDisplayLinkService.Interval;
```

### Correção

Apenas **remover a linha** — a engine nova ajusta o intervalo sozinha conforme o display. Não há propriedade equivalente para setar manualmente.

Se o código original era:
```pascal
vert.AniCalculations.Animation := True;
vert.AniCalculations.Interval := 100;
```
fica:
```pascal
vert.AniCalculations.Animation := True;
```

### Como detectar antes de compilar

```
grep -rn "AniCalculations\.Interval" .
```

Todo match precisa ser removido na migração.
