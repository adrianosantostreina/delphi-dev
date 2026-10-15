import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureIndex } from '../src/index';
import { MIN_SCORE, searchIndex, STRONG_SCORE } from '../src/search';
import { readSnapshot } from '../src/snapshot';
import { tmpDir } from './helpers';

const KNOWLEDGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'knowledge');

const QUERIES: [string, string][] = [
  ['erro E2356 property accessor must be an instance field', 'core/class-var-vaza-para-campos-de-instancia.md'],
  ['F1026 File not found true.dpr ao compilar', 'core/dproj-dcc-debuginformation-nao-booleano.md'],
  ['acentos do .pas viraram mojibake', 'core/encoding-utf8-bom.md'],
  ['MSB6003 command line too long no build', 'core/msb6003-command-line-too-long.md'],
  ['Writeln não aparece no log do app console', 'core/console-writeln-sem-flush-nao-loga.md'],
  ['FireDAC com Firebird em app console dá access violation', 'core/firedac-console-firebird.md'],
  ['swagger do Horse com cadeado JWT', 'core/horse-gbswagger-rotas-jwt.md'],
  ['StrToFloat com separador decimal vírgula ou ponto', 'core/conversao-numerica-locale.md'],
  ['ProjectGuid inválido no dproj', 'core/dproj-projectguid-valido.md'],
  ['embutir arquivo no executável como recurso RCDATA', 'core/recursos-rcdata.md'],
  ['deploy Android E8712 IllegalArgumentException', 'fmx/android-deploy-e8712-buildtools.md'],
  ['callback do ShowModal recebe mrCancel depois do Close', 'fmx/fmx-modalresult-close.md'],
  ['Class TSkSvg not found com StyleBook', 'fmx/fmx-skia-tsksvg-stylebook.md'],
  ['OnClick do TRectangle não dispara no iOS', 'fmx/onclick-vs-ontap-mobile.md'],
  ['colunas do TStringGrid no FMX', 'fmx/fmx-stringgrid-colunas.md'],
  ['SSL TLS no Android com OpenSSL', 'fmx/ssl-tls-android.md'],
  ['identificador único do dispositivo ANDROID_ID', 'fmx/imei-device.md'],
  ['lista dinâmica com Align Top inverte a ordem', 'fmx/fmx-lista-dinamica-ordem-align-top.md'],
  ['cores ARGB no FireMonkey', 'fmx/cores-argb.md'],
  ['breaking changes do Delphi 13 no FMX', 'fmx/delphi13-breaking-changes.md'],
];

const NEGATIVES = [
  'faz o commit e o push',
  'qual a previsão do tempo amanhã',
  'renomeie a variável total para soma',
  'escreve um e-mail para o cliente',
  'atualiza o README',
];

const ENGLISH: [string, string][] = [
  ['Writeln output missing from redirected console log', 'core/console-writeln-sem-flush-nao-loga.md'],
  ['OnClick not firing on iOS rectangle', 'fmx/onclick-vs-ontap-mobile.md'],
  ['decimal separator locale StrToFloat', 'core/conversao-numerica-locale.md'],
];

let db: string;
beforeAll(() => {
  db = ensureIndex(readSnapshot(KNOWLEDGE), path.join(tmpDir(), 'kb.db'));
});

describe('calibration against knowledge/', () => {
  it('prints the score table', () => {
    for (const [q, expected] of [...QUERIES, ...ENGLISH]) {
      const hits = searchIndex(db, q, { minScore: 0, limit: 5 });
      const rank = hits.findIndex((h) => h.path === expected);
      console.log(`${rank < 0 ? 'MISS' : `#${rank + 1}`} ${hits[rank]?.score.toFixed(2) ?? '-'}  top=${hits[0]?.score.toFixed(2) ?? '-'}  ${q}`);
    }
    for (const q of NEGATIVES) {
      console.log(`NEG top=${searchIndex(db, q, { minScore: 0, limit: 1 })[0]?.score.toFixed(2) ?? '-'}  ${q}`);
    }
  });

  // Rule: MIN_SCORE sits just above the noise ceiling (negatives); STRONG_SCORE between the noise ceiling and the weakest true hit.
  it('finds at least 18 of 20 pt-BR queries in the top 3 with MIN_SCORE', () => {
    const found = QUERIES.filter(([q, expected]) =>
      searchIndex(db, q, { limit: 3, minScore: MIN_SCORE }).some((h) => h.path === expected)).length;
    expect(found).toBeGreaterThanOrEqual(18);
  });

  it('keeps every negative below STRONG_SCORE', () => {
    for (const q of NEGATIVES) expect(searchIndex(db, q, { limit: 1, minScore: STRONG_SCORE })).toEqual([]);
  });

  it('keeps STRONG_SCORE above MIN_SCORE', () => {
    expect(STRONG_SCORE).toBeGreaterThan(MIN_SCORE);
  });
});
