export type ConfigProfile = 'development' | 'staging' | 'production' | 'test' | string;

export interface ConfigModuleOptions {
  isGlobal?: boolean;
  envFilePath?: string | string[];
  ignoreEnvFile?: boolean;
  ignoreEnvVars?: boolean;
  validate?: (config: Record<string, any>) => Record<string, any>;
  validationSchema?: any;
  validationOptions?: {
    allowUnknown?: boolean;
    abortEarly?: boolean;
  };
  load?: Array<() => Record<string, any> | Promise<Record<string, any>>>;
  expandVariables?: boolean;
  cache?: boolean;
  profile?: ConfigProfile;
  profilePrefix?: string;
  profiles?: {
    [key: string]: ConfigModuleOptions | (() => ConfigModuleOptions | Promise<ConfigModuleOptions>);
  };
}

export interface ProfileConfig {
  profile: ConfigProfile;
  envFilePattern?: string;
  overrides?: Record<string, any>;
}

export interface ConfigFactory<T = Record<string, any>> {
  (): T | Promise<T>;
}

export interface ConfigNamespace<T = Record<string, any>> {
  KEY: string;
  asProvider(): {
    provide: string;
    useFactory: () => T | Promise<T>;
  };
}

export const CONFIG_OPTIONS = Symbol('CONFIG_OPTIONS');
export const CONFIGURATION_TOKEN = Symbol('CONFIGURATION_TOKEN');
export const CONFIGURATION_SERVICE_TOKEN = Symbol('ConfigService');
export const CONFIG_PROFILE = Symbol('CONFIG_PROFILE');
