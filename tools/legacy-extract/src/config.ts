import type { config as MssqlConfig } from 'mssql';

/**
 * Connection settings for the legacy Dev SQL Server. Never hard-code
 * credentials; export them in the shell that runs the extraction:
 *
 *   LEGACY_SQLSERVER_HOST=... LEGACY_SQLSERVER_USER=... \
 *   LEGACY_SQLSERVER_PASSWORD=... LEGACY_SQLSERVER_DATABASE=... \
 *   npm run legacy:extract -- all
 */
export function legacyDbConfig(env: Record<string, string | undefined> = process.env): MssqlConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) {
      throw new Error(
        `${name} is not set. Export LEGACY_SQLSERVER_{HOST,USER,PASSWORD,DATABASE} before running the extraction.`,
      );
    }
    return value;
  };

  return {
    server: required('LEGACY_SQLSERVER_HOST'),
    port: env.LEGACY_SQLSERVER_PORT ? Number(env.LEGACY_SQLSERVER_PORT) : 1433,
    user: required('LEGACY_SQLSERVER_USER'),
    password: required('LEGACY_SQLSERVER_PASSWORD'),
    database: required('LEGACY_SQLSERVER_DATABASE'),
    options: {
      encrypt: env.LEGACY_SQLSERVER_ENCRYPT !== 'false',
      trustServerCertificate: env.LEGACY_SQLSERVER_TRUST_CERT === 'true',
    },
    requestTimeout: 120_000,
  };
}

export const OUTPUT_ROOT = 'db/legacy';
