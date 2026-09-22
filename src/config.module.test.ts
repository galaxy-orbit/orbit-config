import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, registerAs } from './config.module';
import { ConfigService } from './config.service';
import { CONFIGURATION_TOKEN, CONFIG_PROFILE } from './config.interface';

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

async function instantiate(dynamicModule: any, profile?: string) {
  // resolve the factory provider the way the container would
  const configProvider = dynamicModule.providers.find(
    (p: any) => p.provide === CONFIGURATION_TOKEN,
  );
  return configProvider.useFactory();
}

describe('ConfigModule.forRoot', () => {
  test('returns a DynamicModule exporting ConfigService and config tokens', () => {
    const dm = ConfigModule.forRoot();
    expect(dm.module).toBe(ConfigModule);
    expect(dm.global).toBe(false);
    expect(dm.providers).toContain(ConfigService);
    expect(dm.exports).toContain(ConfigService);
    expect(dm.exports).toContain(CONFIGURATION_TOKEN);
  });

  test('isGlobal option propagates', () => {
    expect(ConfigModule.forRoot({ isGlobal: true }).global).toBe(true);
  });

  test('load factories merge into the config', async () => {
    const dm = ConfigModule.forRoot({
      ignoreEnvVars: true,
      profile: 'development',
      load: [
        registerAs('db', () => ({ host: 'localhost', port: 5432 })),
        () => ({ feature: { flag: true } }),
      ],
    });

    const config = await instantiate(dm);
    expect(config.db).toEqual({ host: 'localhost', port: 5432 });
    expect(config.feature.flag).toBe(true);
    expect(config.__profile).toBe('development');
  });

  test('expandVariables resolves ${VAR} references', async () => {
    process.env.ORBIT_EXPAND_TEST = 'resolved';
    const dm = ConfigModule.forRoot({
      ignoreEnvVars: true,
      load: [() => ({ url: 'http://${ORBIT_EXPAND_TEST}:8080', ref: '${ORBIT_EXPAND_TEST}' })],
      expandVariables: true,
    });

    const config = await instantiate(dm);
    expect(config.url).toBe('http://resolved:8080');
    expect(config.ref).toBe('resolved');
    delete process.env.ORBIT_EXPAND_TEST;
  });

  test('validate callback normalizes config', async () => {
    const dm = ConfigModule.forRoot({
      ignoreEnvVars: true,
      load: [() => ({ port: '3000' })],
      validate: (cfg: any) => ({ ...cfg, port: Number(cfg.port) }),
    });

    const config = await instantiate(dm);
    expect(config.port).toBe(3000);
  });

  test('profile from options selects profile-specific env files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbit-cfg-'));
    roots.push(dir);
    process.chdir(dir);

    writeFileSync(join(dir, '.env'), 'BASE=1\n');
    writeFileSync(join(dir, '.env.prod'), 'MODE=prod\n');
    writeFileSync(join(dir, '.env.prod.local'), 'SECRET=local\n');

    const dm = ConfigModule.forRoot({ profile: 'production', ignoreEnvVars: true });
    const config = await instantiate(dm);

    expect(config.BASE).toBe('1');
    expect(config.MODE).toBe('prod');
    expect(config.SECRET).toBe('local');
    expect(config.__profile).toBe('production');
    process.chdir('/Users/buitronghieu/Desktop/Project/galaxy/galaxy-bun/bungalaxy');
  });

  test('env file parsing: quotes, comments, malformed lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbit-cfg-'));
    roots.push(dir);
    process.chdir(dir);

    writeFileSync(join(dir, '.env'), [
      '# a comment',
      '',
      'PLAIN=value',
      'QUOTED="double quoted"',
      "SINGLE='single quoted'",
      'no equals sign here',
      '  SPACED  =  padded  ',
    ].join('\n'));

    const dm = ConfigModule.forRoot({ ignoreEnvVars: true });
    const config = await instantiate(dm);

    expect(config.PLAIN).toBe('value');
    expect(config.QUOTED).toBe('double quoted');
    expect(config.SINGLE).toBe('single quoted');
    expect(config.SPACED).toBe('padded');
    expect(config['no equals sign here']).toBeUndefined();
    process.chdir('/Users/buitronghieu/Desktop/Project/galaxy/galaxy-bun/bungalaxy');
  });

  test('ignoreEnvFile skips env files entirely', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbit-cfg-'));
    roots.push(dir);
    process.chdir(dir);
    writeFileSync(join(dir, '.env'), 'SHOULD_NOT_LOAD=yes\n');

    const dm = ConfigModule.forRoot({ ignoreEnvFile: true, ignoreEnvVars: true });
    const config = await instantiate(dm);
    expect(config.SHOULD_NOT_LOAD).toBeUndefined();
    process.chdir('/Users/buitronghieu/Desktop/Project/galaxy/galaxy-bun/bungalaxy');
  });

  test('profile-specific load functions run for the active profile', async () => {
    const dm = ConfigModule.forRoot({
      ignoreEnvVars: true,
      profile: 'production',
      profiles: {
        production: {
          load: [() => ({ fromProdProfile: true })],
        },
      },
    });

    const config = await instantiate(dm);
    expect(config.fromProdProfile).toBe(true);
  });

  test('forFeature exposes a feature token with the factory result', async () => {
    const feature = ConfigModule.forFeature(() => ({ scoped: true }));
    const providers = feature.providers ?? [];
    const provider = providers.find((p: any) => p.useFactory) as any;
    expect(await provider.useFactory()).toEqual({ scoped: true });
    expect(feature.exports).toContain((providers[0] as any).provide);
  });
});

describe('registerAs', () => {
  test('attaches KEY to the factory function', () => {
    const factory = registerAs('jwt', () => ({ secret: 's' }));
    expect(factory.KEY).toBe('jwt');
    expect(factory()).toEqual({ secret: 's' });
  });
});
