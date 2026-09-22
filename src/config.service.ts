import { Injectable, Inject, Optional } from '@galaxy-stack/orbit-core';
import { CONFIGURATION_TOKEN, CONFIG_PROFILE, type ConfigProfile } from './config.interface';

@Injectable()
export class ConfigService<K = Record<string, any>> {
  private readonly internalConfig: Map<string, any> = new Map();
  private readonly cache: Map<string, any> = new Map();
  private isCacheEnabled = false;
  private readonly activeProfile: ConfigProfile;

  constructor(
    @Optional() @Inject(CONFIGURATION_TOKEN) 
    private readonly config: Record<string, any> = {},
    @Optional() @Inject(CONFIG_PROFILE)
    profile?: ConfigProfile
  ) {
    this.activeProfile = profile || config?.__profile || 'development';
    this.loadFromEnv();
    this.loadFromConfig();
  }

  private loadFromEnv(): void {
    if (typeof process !== 'undefined' && process.env) {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          this.internalConfig.set(key, value);
        }
      }
    }
    
    if (typeof Bun !== 'undefined' && Bun.env) {
      for (const [key, value] of Object.entries(Bun.env)) {
        if (value !== undefined) {
          this.internalConfig.set(key, value);
        }
      }
    }
  }

  private loadFromConfig(): void {
    if (this.config) {
      this.flattenObject(this.config, '');
    }
  }

  private flattenObject(obj: Record<string, any>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === '__profile') continue;
      
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.flattenObject(value, fullKey);
      } else {
        this.internalConfig.set(fullKey, value);
      }
    }
  }

  get<T = any>(propertyPath: string): T | undefined;
  get<T = any>(propertyPath: string, defaultValue: T): T;
  get<T = any>(propertyPath: string, defaultValue?: T): T | undefined {
    if (this.isCacheEnabled && this.cache.has(propertyPath)) {
      return this.cache.get(propertyPath);
    }

    let value = this.internalConfig.get(propertyPath);
    
    if (value === undefined) {
      value = this.getNestedValue(this.config, propertyPath);
    }
    
    if (value === undefined) {
      value = this.internalConfig.get(propertyPath.toUpperCase().replace(/\./g, '_'));
    }

    const result = value !== undefined ? value : defaultValue;

    if (this.isCacheEnabled && result !== undefined) {
      this.cache.set(propertyPath, result);
    }

    return result as T;
  }

  getOrThrow<T = any>(propertyPath: string): T {
    const value = this.get<T>(propertyPath);
    if (value === undefined) {
      throw new Error(`Configuration key "${propertyPath}" does not exist`);
    }
    return value;
  }

  getProfile(): ConfigProfile {
    return this.activeProfile;
  }

  isProfile(profile: ConfigProfile | ConfigProfile[]): boolean {
    const profiles = Array.isArray(profile) ? profile : [profile];
    return profiles.includes(this.activeProfile);
  }

  isDevelopment(): boolean {
    return this.activeProfile === 'development';
  }

  isProduction(): boolean {
    return this.activeProfile === 'production';
  }

  isStaging(): boolean {
    return this.activeProfile === 'staging';
  }

  isTest(): boolean {
    return this.activeProfile === 'test';
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    if (!obj) return undefined;
    
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  set(propertyPath: string, value: any): void {
    this.internalConfig.set(propertyPath, value);
    if (this.isCacheEnabled) {
      this.cache.delete(propertyPath);
    }
  }

  setEnableCache(enabled: boolean): void {
    this.isCacheEnabled = enabled;
    if (!enabled) {
      this.cache.clear();
    }
  }
}
