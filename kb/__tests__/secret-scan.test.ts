import { describe, it, expect } from 'vitest';
import { scanText } from '../src/secret-scan';

describe('scanText', () => {
  it.each([
    ['private-key', '-----BEGIN RSA PRIVATE KEY-----'],
    ['aws-key', 'chave AKIAIOSFODNN7EXAMPLE aqui'],
    ['github-token', `token ghp_${'a'.repeat(36)}`],
    ['npm-token', `npm_${'b'.repeat(36)}`],
    ['jwt', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
    ['assignment', "FDConnection1.Params.Password := 'S3nh@Forte'; // senha = S3nh@Forte"],
    ['conn-string', 'Server=db01;Database=erp;User=sa;Password=Pr0d2026;'],
    ['ipv4', 'conecta em 10.20.30.40 na porta 3050'],
    ['email', 'fale com joao.silva@empresa.com.br'],
    ['cpf', 'CPF 123.456.789-09'],
    ['cnpj', 'CNPJ 12.345.678/0001-95'],
    ['abs-path', 'salvo em C:\\Users\\joao\\Documents\\proj'],
    ['abs-path', 'veja /home/maria/projetos'],
  ])('flags %s', (kind, text) => {
    expect(scanText(text).map((f) => f.kind)).toContain(kind);
  });

  it.each([
    "Password := '***';",
    'senha = <sua senha>',
    'api_key: YOUR_API_KEY',
    'Pwd=xxx;',
    'servidor em 127.0.0.1 ou 0.0.0.0 ou 192.0.2.10',
    'contato@example.com',
    'C:\\Users\\Public\\Documents',
    '%USERPROFILE%\\.delphi-dev',
    'TCliente.FNome := ANome;',
  ])('allows placeholder or documentation value: %s', (text) => {
    expect(scanText(text)).toEqual([]);
  });

  it('reports 1-based line numbers and a trimmed excerpt', () => {
    const findings = scanText('linha limpa\n   Password=Segredo123;   ');
    expect(findings).toEqual([{ line: 2, kind: 'conn-string', excerpt: 'Password=Segredo123;' }]);
  });
});
