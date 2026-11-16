import type express from 'express';
import crypto from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN =
  /^(?:pin|room_?pin|teacher_?pin|pin_?hash|token|session_?token|teacher_?token|metrics_?token|owner_?token_?hash|authorization|password|passphrase|secret|cookie|set-cookie|api_?key|gemini_?api_?key|x-session-token|email|phone|telephone|address)$/i;

const SENSITIVE_SUBSTRING_PATTERN =
  /(?:apikey|api_key|pinhash|pin_hash|roompin|room_pin|teacherpin|teacher_pin|sessiontoken|session_token|teachertoken|teacher_token|metricstoken|metrics_token|ownertokenhash|owner_token_hash|authorization|password|secret)/i;

function resolveActiveLogLevel(explicitLevel?: LogLevel): LogLevel {
  if (explicitLevel) return explicitLevel;
  const raw = String(process.env.LOG_LEVEL || 'info')
    .trim()
    .toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

function redactSensitiveString(value: string): string {
  let sanitized = value;
  if (/^Bearer\s+\S+/i.test(sanitized)) {
    return 'Bearer [REDACTED]';
  }
  sanitized = sanitized.replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[REDACTED_API_KEY]');
  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim();
  if (!normalized) return false;
  return (
    SENSITIVE_KEY_PATTERN.test(normalized) ||
    SENSITIVE_SUBSTRING_PATTERN.test(normalized.replace(/-/g, '_'))
  );
}

export function sanitizeLogValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
  depth = 0
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      ...(value.stack ? { stack: redactSensitiveString(value.stack) } : {}),
    };
  }
  if (depth >= 6) {
    return '[TRUNCATED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, seen, depth + 1));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) {
      return '[CIRCULAR]';
    }
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitizeLogValue(val, seen, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function sanitizeLogContext(
  context?: Record<string, unknown>
): Record<string, unknown> {
  if (!context || typeof context !== 'object') {
    return {};
  }
  const sanitized = sanitizeLogValue(context);
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized as Record<string, unknown>;
  }
  return {};
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

export function formatStructuredLogLine(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  service = 'ruanglabmu-server'
): string {
  const sanitizedContext = sanitizeLogContext(context);
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message: redactSensitiveString(message),
    ...sanitizedContext,
  };
  return JSON.stringify(entry);
}

export interface LoggerInstance {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  child: (baseContext: Record<string, unknown>) => LoggerInstance;
}

export function createLogger(options?: {
  service?: string;
  level?: LogLevel;
  baseContext?: Record<string, unknown>;
  writeStdout?: (line: string) => void;
  writeStderr?: (line: string) => void;
}): LoggerInstance {
  const service = options?.service ?? 'ruanglabmu-server';
  const baseContext = options?.baseContext ?? {};
  const writeStdout =
    options?.writeStdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const writeStderr =
    options?.writeStderr ?? ((line: string) => process.stderr.write(`${line}\n`));

  const emit = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void => {
    const minLevel = resolveActiveLogLevel(options?.level);
    if (LOG_LEVEL_WEIGHT[level] < LOG_LEVEL_WEIGHT[minLevel]) {
      return;
    }
    const mergedContext = { ...baseContext, ...(context ?? {}) };
    const line = formatStructuredLogLine(level, message, mergedContext, service);
    if (level === 'warn' || level === 'error') {
      writeStderr(line);
    } else {
      writeStdout(line);
    }
  };

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (extraContext) =>
      createLogger({
        service,
        level: options?.level,
        baseContext: { ...baseContext, ...extraContext },
        writeStdout,
        writeStderr,
      }),
  };
}

export const logger = createLogger();

export function requestCorrelationMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const incomingHeader = req.headers['x-request-id'];
  const requestId =
    typeof incomingHeader === 'string' && incomingHeader.trim().length > 0
      ? incomingHeader.trim().slice(0, 128)
      : crypto.randomUUID();

  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const reqPath = req.originalUrl || req.url || req.path;
    const isHealthProbe =
      reqPath === '/healthz' || reqPath === '/readyz' || reqPath === '/api/health';

    const logPayload = {
      requestId,
      method: req.method,
      path: reqPath,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP request failed', logPayload);
    } else if (isHealthProbe) {
      logger.debug('HTTP health probe completed', logPayload);
    } else if (reqPath.startsWith('/api') || reqPath.startsWith('/metrics')) {
      logger.info('HTTP request completed', logPayload);
    }
  });

  next();
}
