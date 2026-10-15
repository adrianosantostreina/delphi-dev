import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isOffline, LOG_MAX_BYTES, logError, readConfig, readState, writeConfig, writeState } from '../src/prefs';
import { tmpDir } from './helpers';

describe('prefs', () => {
  it('returns defaults when files are missing or corrupt', () => {
    const data = tmpDir();
    expect(readConfig(data)).toEqual({ suggestions: 'on', offline: false });
    fs.writeFileSync(path.join(data, 'config.json'), '{not json');
    expect(readConfig(data)).toEqual({ suggestions: 'on', offline: false });
    expect(readState(data)).toEqual({ lastCheck: null, lastResult: null, remoteCommit: null, remotePluginVersion: null });
  });

  it('normalizes unexpected values', () => {
    const data = tmpDir();
    fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify({ suggestions: 'maybe', offline: 'yes' }));
    expect(readConfig(data)).toEqual({ suggestions: 'on', offline: false });
  });

  it('merges patches when writing', () => {
    const data = path.join(tmpDir(), 'nested');
    writeConfig(data, { suggestions: 'off' });
    expect(writeConfig(data, { offline: true })).toEqual({ suggestions: 'off', offline: true });
    writeState(data, { lastCheck: '2026-10-14T00:00:00.000Z' });
    expect(writeState(data, { lastResult: 'up-to-date' })).toMatchObject({
      lastCheck: '2026-10-14T00:00:00.000Z', lastResult: 'up-to-date',
    });
  });

  it('is offline by env or by config', () => {
    const data = tmpDir();
    expect(isOffline(data, {})).toBe(false);
    expect(isOffline(data, { DELPHI_DEV_KB_OFFLINE: '1' })).toBe(true);
    writeConfig(data, { offline: true });
    expect(isOffline(data, {})).toBe(true);
  });

  it('appends to the log and rotates past the size limit', () => {
    const data = tmpDir();
    const log = path.join(data, 'logs', 'kb.log');
    logError(data, 'test', new Error('boom'));
    expect(fs.readFileSync(log, 'utf8')).toContain('[test] Error: boom');
    fs.writeFileSync(log, 'x'.repeat(LOG_MAX_BYTES + 1));
    logError(data, 'test', 'again');
    expect(fs.existsSync(`${log}.1`)).toBe(true);
    expect(fs.readFileSync(log, 'utf8')).toContain('[test] again');
  });

  it('never throws when logging is impossible', () => {
    const file = path.join(tmpDir(), 'a-file');
    fs.writeFileSync(file, '');
    expect(() => logError(file, 'test', 'x')).not.toThrow();
  });
});
