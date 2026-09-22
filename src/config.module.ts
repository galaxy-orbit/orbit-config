import { Module } from '@galaxy-stack/orbit-core';
import type { DynamicModule, Provider } from '@galaxy-stack/orbit-core';
import { ConfigService } from './config.service';
import { 
  type ConfigModuleOptions,
  type ConfigProfile, 
  type ConfigFactory,
  CONFIG_OPTIONS, 
  CONFIGURATION_TOKEN,
  CONFIG_PROFILE,
} from './config.interface';

@Module({})
export class ConfigModule {
  static forRoot(options: ConfigModuleOptions = {}): DynamicModule {
    const configProviders = ConfigModule.createConfigProviders(options);
    
    return {
      module: ConfigModule,
      global: options.isGlobal ?? false,
      providers: [
        ...configProviders,
        ConfigService,
      ],
      exports: [ConfigService, CONFIGURATION_TOKEN, CONFIG_PROFILE],
    };
  }

  static forFeature(factory: ConfigFactory): DynamicModule {
    const token = Symbol('CONFIG_FEATURE');
    
    return {
      module: ConfigModule,
      providers: [
        {
          provide: token,
          useFactory: factory,
        },
      ],
      exports: [token],
    };
  }

  private static createConfigProviders(options: ConfigModuleOptions): Provider[] {
    const providers: Provider[] = [
      {
        provide: CONFIG_OPTIONS,
        useValue: options,
      },
    ];

    const activeProfile = ConfigModule.detectProfile(options);
    
    providers.push({
      provide: CONFIG_PROFILE,
      useValue: activeProfile,
    });

    const configFactory = async () => {
      let config: Record<string, any> = {};

      const profileEnvFiles = ConfigModule.getProfileEnvFiles(activeProfile, options);
      
      if (!options.ignoreEnvFile) {
        const envPaths = options.envFilePath 
          ? (Array.isArray(options.envFilePath) ? options.envFilePath : [options.envFilePath])
          : [];
        
        const allEnvFiles = [...profileEnvFiles, ...envPaths];
        const envConfig = await ConfigModule.loadEnvFile(allEnvFiles);
        config = { ...config, ...envConfig };
      }

      if (!options.ignoreEnvVars) {
        const envVars = ConfigModule.loadEnvVars();
        config = { ...config, ...envVars };
      }

      if (options.profiles && options.profiles[activeProfile]) {
        const profileOptions = options.profiles[activeProfile];
        const profileConfig = typeof profileOptions === 'function' 
          ? await profileOptions() 
          : profileOptions;
        
        if (profileConfig.load) {
          for (const loader of profileConfig.load) {
            const loaded = await loader();
            config = { ...config, ...loaded };
          }
        }
      }

      if (options.load) {
        for (const loader of options.load) {
          const loaded = await loader();
          // registerAs() factories carry a KEY namespace — nest their result
          // under it instead of spreading flat.
          const key = (loader as { KEY?: string }).KEY;
          if (key) {
            config = { ...config, [key]: loaded };
          } else {
            config = { ...config, ...loaded };
          }
        }
      }

      if (options.expandVariables) {
        config = ConfigModule.expandVariables(config);
      }

      if (options.validate) {
        config = options.validate(config);
      }

      if (options.validationSchema) {
        config = ConfigModule.validateWithZod(config, options.validationSchema, options.validationOptions);
      }

      config.__profile = activeProfile;

      return config;
    };

    providers.push({
      provide: CONFIGURATION_TOKEN,
      useFactory: configFactory,
    });

    return providers;
  }

  private static detectProfile(options: ConfigModuleOptions): ConfigProfile {
    if (options.profile) {
      return options.profile;
    }

    const envProfile = 
      (typeof Bun !== 'undefined' && Bun.env?.BUN_ENV) ||
      (typeof Bun !== 'undefined' && Bun.env?.NODE_ENV) ||
      (typeof process !== 'undefined' && process.env?.BUN_ENV) ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV);

    if (envProfile) {
      const normalized = envProfile.toLowerCase();
      if (['development', 'dev'].includes(normalized)) return 'development';
      if (['staging', 'stage'].includes(normalized)) return 'staging';
      if (['production', 'prod'].includes(normalized)) return 'production';
      if (['test', 'testing'].includes(normalized)) return 'test';
      return normalized;
    }

    return 'development';
  }

  private static getProfileEnvFiles(profile: ConfigProfile, options: ConfigModuleOptions): string[] {
    const prefix = options.profilePrefix || '.env';
    const files: string[] = [];

    files.push(prefix);

    const profileSuffix = profile === 'development' ? 'dev' 
      : profile === 'production' ? 'prod' 
      : profile;
    
    files.push(`${prefix}.${profileSuffix}`);
    
    files.push(`${prefix}.local`);
    files.push(`${prefix}.${profileSuffix}.local`);

    return files;
  }

  private static async loadEnvFile(
    envFilePath?: string | string[]
  ): Promise<Record<string, string>> {
    const config: Record<string, string> = {};
    
    const paths = envFilePath 
      ? (Array.isArray(envFilePath) ? envFilePath : [envFilePath])
      : ['.env'];

    for (const filePath of paths) {
      try {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          const content = await file.text();
          const parsed = ConfigModule.parseEnvContent(content);
          Object.assign(config, parsed);
        }
      } catch (error) {
      }
    }

    return config;
  }

  private static parseEnvContent(content: string): Record<string, string> {
    const config: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;

      const key = trimmed.slice(0, equalIndex).trim();
      let value = trimmed.slice(equalIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      config[key] = value;
    }

    return config;
  }

  private static loadEnvVars(): Record<string, string> {
    const config: Record<string, string> = {};
    
    if (typeof Bun !== 'undefined' && Bun.env) {
      for (const [key, value] of Object.entries(Bun.env)) {
        if (value !== undefined) {
          config[key] = value;
        }
      }
    } else if (typeof process !== 'undefined' && process.env) {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          config[key] = value;
        }
      }
    }

    return config;
  }

  private static expandVariables(config: Record<string, any>): Record<string, any> {
    const result = { ...config };
    
    const expand = (value: string): string => {
      return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
        return result[key] || (typeof process !== 'undefined' ? process.env[key] : '') || '';
      });
    };

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string') {
        result[key] = expand(value);
      }
    }

    return result;
  }

  private static validateWithZod(
    config: Record<string, any>,
    schema: any,
    options?: { allowUnknown?: boolean; abortEarly?: boolean }
  ): Record<string, any> {
    try {
      if (typeof schema.parse === 'function') {
        return schema.parse(config);
      }
      if (typeof schema.safeParse === 'function') {
        const result = schema.safeParse(config);
        if (!result.success) {
          const errors = result.error.errors
            .map((e: any) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          throw new Error(`Configuration validation failed: ${errors}`);
        }
        return result.data;
      }
    } catch (error: any) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
    
    return config;
  }
}

export function registerAs<T extends Record<string, any>>(
  namespace: string,
  factory: () => T
): (() => T) & { KEY: string } {
  const fn = factory as (() => T) & { KEY: string };
  fn.KEY = namespace;
  return fn;
}
