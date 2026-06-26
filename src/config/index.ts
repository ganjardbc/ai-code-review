import 'dotenv/config';
import { configSchema, type AppConfig } from './schema.js';

function loadConfig(): Readonly<AppConfig> {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${issues}`);
  }

  return Object.freeze(result.data);
}

export const config: Readonly<AppConfig> = loadConfig();
export type { AppConfig };
