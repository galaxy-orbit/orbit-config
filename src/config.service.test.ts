import { describe, test, expect } from 'bun:test';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  test('flattens nested config objects into dot-paths', () => {
    const config = new ConfigService({
      database: { host: 'localhost', port: 5432 },
      app: { name: 'orbit' },
    });

    expect(config.get<string>('database.host')).toBe('localhost');
    expect(config.get<number>('database.port')).toBe(5432);
    expect(config.get<string>('app.name')).toBe('orbit');
  });

  test('returns defaults for missing keys', () => {
    const config = new ConfigService({ a: 1 });
    expect(config.get('missing')).toBeUndefined();
    expect(config.get<string>('missing', 'fallback')).toBe('fallback');
    expect(config.get<number>('missing.nested', 42)).toBe(42);
  });

  test('getOrThrow throws for missing keys', () => {
    const config = new ConfigService({ a: 1 });
    expect(() => config.getOrThrow('missing')).toThrow(/"missing" does not exist/);
    expect(config.getOrThrow<number>('a')).toBe(1);
  });

  test('set overrides values', () => {
    const config = new ConfigService({ a: 1 });
    config.set('a', 2);
    expect(config.get<number>('a')).toBe(2);
  });

  test('cache returns consistent values and clears on set', () => {
    const config = new ConfigService({ a: 1 });
    config.setEnableCache(true);
    expect(config.get<number>('a')).toBe(1);

    config.set('a', 99);
    expect(config.get<number>('a')).toBe(99);

    config.setEnableCache(false);
    expect(config.get<number>('a')).toBe(99);
  });

  test('profiles: default is development', () => {
    const config = new ConfigService({});
    expect(config.getProfile()).toBe('development');
    expect(config.isDevelopment()).toBe(true);
    expect(config.isProduction()).toBe(false);
  });

  test('profiles: explicit profile via constructor arg', () => {
    const config = new ConfigService({}, 'production' as any);
    expect(config.getProfile()).toBe('production');
    expect(config.isProduction()).toBe(true);
    expect(config.isProfile('production')).toBe(true);
    expect(config.isProfile(['staging', 'production'])).toBe(true);
    expect(config.isProfile('test')).toBe(false);
  });

  test('profiles: __profile key in config object', () => {
    const config = new ConfigService({ __profile: 'test' } as any);
    expect(config.getProfile()).toBe('test');
  });

  test('reads values from process.env', () => {
    process.env.ORBIT_TEST_VAR = 'hello';
    const config = new ConfigService({});
    expect(config.get<string>('ORBIT_TEST_VAR')).toBe('hello');
    delete process.env.ORBIT_TEST_VAR;
  });

  test('nested path falls back to UPPER_SNAKE env var name', () => {
    process.env.DATABASE_URL = 'postgres://x';
    const config = new ConfigService({});
    expect(config.get<string>('database.url')).toBe('postgres://x');
    delete process.env.DATABASE_URL;
  });
});
