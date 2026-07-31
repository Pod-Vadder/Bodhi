/**
 * Explicit DI tokens. The API deliberately avoids emitDecoratorMetadata
 * (unsupported by esbuild-based runners), so every injection site names its
 * token instead of relying on reflected parameter types.
 */
export const ENV = 'ENV';
export const DB = 'DB';
export const REDIS = 'REDIS';
export const AUTH_SERVICE = 'AUTH_SERVICE';
export const TOKEN_SERVICE = 'TOKEN_SERVICE';
export const USER_REPO = 'USER_REPO';
export const REFRESH_TOKEN_STORE = 'REFRESH_TOKEN_STORE';
export const AUDIT_SINK = 'AUDIT_SINK';
export const CLOCK = 'CLOCK';
export const ATTEMPT_SERVICE = 'ATTEMPT_SERVICE';
export const ATTEMPT_REPO = 'ATTEMPT_REPO';
export const MODULE_PROGRESS_REPO = 'MODULE_PROGRESS_REPO';
export const ASSESSMENT_REPO = 'ASSESSMENT_REPO';
export const QUESTION_REPO = 'QUESTION_REPO';
export const RESPONSE_REPO = 'RESPONSE_REPO';
export const TIMER_STORE = 'TIMER_STORE';
export const DEV_SEED = 'DEV_SEED';
