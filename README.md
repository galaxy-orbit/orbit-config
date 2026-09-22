# @galaxy-stack/orbit-config

[![npm version](https://img.shields.io/npm/v/@galaxy-stack/orbit-config.svg)](https://www.npmjs.com/package/@galaxy-stack/orbit-config)
[![docs](https://img.shields.io/badge/docs-galaxy--orbit--framework.vercel.app-blue)](https://galaxy-orbit-framework.vercel.app)

Part of the [Orbit framework](https://github.com/galaxy-orbit/orbit) — a NestJS-style backend framework for [Bun](https://bun.sh).

## Installation

```bash
bun add @galaxy-stack/orbit-config
```

# @galaxy-stack/orbit-config

## Mô tả
Module quản lý cấu hình cho Orbit với hỗ trợ environment variables và Zod validation.

## Tính năng chính

### 1. ConfigService
```typescript
import { ConfigService } from '@galaxy-stack/orbit-config';

class MyService {
  constructor(private config: ConfigService) {}

  getDatabaseUrl() {
    return this.config.get<string>('DATABASE_URL');
  }

  getPort() {
    return this.config.get<number>('PORT', 3000);  // Với default value
  }
}
```

### 2. Zod Validation
```typescript
import { z } from 'zod';
import { ConfigModule } from '@galaxy-stack/orbit-config';

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      schema: configSchema,
      envFile: '.env',
    }),
  ],
})
class AppModule {}
```

### 3. Namespace Configuration
```typescript
import { registerAs } from '@galaxy-stack/orbit-config';

// database.config.ts
export default registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  name: process.env.DB_NAME,
}));

// Sử dụng
const dbConfig = this.config.get('database');
console.log(dbConfig.host);
```

## Cấu hình Module

### Basic
```typescript
ConfigModule.forRoot({
  envFile: '.env',
  isGlobal: true,
})
```

### With Validation
```typescript
ConfigModule.forRoot({
  schema: z.object({
    PORT: z.coerce.number(),
    API_KEY: z.string(),
  }),
  envFile: '.env',
})
```

### Async
```typescript
ConfigModule.forRootAsync({
  useFactory: async () => ({
    envFile: '.env',
    schema: mySchema,
  }),
})
```

## Environment Files
- `.env` - Default
- `.env.local` - Local overrides
- `.env.development` - Development
- `.env.production` - Production
- `.env.test` - Testing

## Config Methods

```typescript
interface ConfigService {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  getOrThrow<T>(key: string): T;
  has(key: string): boolean;
}
```

## Typed Config

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
}

const dbConfig = config.get<DatabaseConfig>('database');
```
