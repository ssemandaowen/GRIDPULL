/**
 * @file src/errors/ErrorClassifier.ts
 * Regex-based error classifier matching yt-dlp & network diagnostics.
 */

import { ClassifiedError } from '../types/index.js';

export class ErrorClassifier {
  public static classify(output: string): ClassifiedError {
    const text = (output || '').toLowerCase();

    if (/sign in to confirm (you('re| are))? ?not a bot|use --proxy|http error 429|too many requests|bot detection|rate.limit/i.test(text)) {
      return {
        kind: 'THROTTLED',
        message: 'Platform rate limit encountered (HTTP 429 / bot challenge). Automatic exponential backoff will engage.',
        retryable: true,
      };
    }

    if (/ssl|eof occurred in violation of protocol|_ssl\.c|handshake|certificate/i.test(text)) {
      return {
        kind: 'SSL',
        message: 'Transient TLS/SSL handshake termination. Connection retry recommended.',
        retryable: true,
      };
    }

    if (/socket\.error|timed out|connection refused|dns resolution|network is unreachable|getaddrinfo|econnreset|epipe/i.test(text)) {
      return {
        kind: 'NETWORK',
        message: 'Network socket fault or unreachable route. Verify connectivity.',
        retryable: true,
      };
    }

    if (/not available in your country|geo restriction|geoblocked|not available in your region/i.test(text)) {
      return {
        kind: 'GEO_BLOCKED',
        message: 'Geographical distribution restrictions applied to this stream.',
        retryable: false,
      };
    }

    if (/sign in to confirm your age|age[- ]restricted|this video may be inappropriate/i.test(text)) {
      return {
        kind: 'AGE_RESTRICTED',
        message: 'Content is age-restricted and requires session authentication credentials.',
        retryable: false,
      };
    }

    if (/this video is no longer available|video unavailable|private video|^unavailable/i.test(text)) {
      return {
        kind: 'UNAVAILABLE',
        message: 'Resource removed or flagged as private by platform publisher.',
        retryable: false,
      };
    }

    if (/no supported javascript runtime|missing potoken|js runtime/i.test(text)) {
      return {
        kind: 'RUNTIME',
        message: 'Missing runtime dependency (Node.js/yt-dlp core requirements).',
        retryable: false,
      };
    }

    return {
      kind: 'UNKNOWN',
      message: output.trim() || 'Execution terminated with unclassified exit code.',
      retryable: false,
    };
  }
}
