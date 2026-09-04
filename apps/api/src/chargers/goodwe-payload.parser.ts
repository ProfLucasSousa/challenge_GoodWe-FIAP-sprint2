import { Injectable } from '@nestjs/common';

export interface GoodWePayloadInspection {
  acceptedTransportShape: boolean;
  topLevelFields: string[];
  redactedFieldCount: number;
  issues: Array<'EMPTY_PAYLOAD' | 'UNEXPECTED_ROOT_FORMAT' | 'SENSITIVE_FIELDS_REDACTED'>;
}

const sensitiveKey =
  /(?:password|passwd|secret|token|cookie|authorization|email|serial|device.?id|station.?id)/i;

@Injectable()
export class GoodWePayloadParser {
  /**
   * Inspects only shape and field names. Values are never retained or returned while
   * the official GoodWe schema is unconfirmed.
   */
  inspect(payload: unknown): GoodWePayloadInspection {
    if (!this.isPlainObject(payload)) {
      return {
        acceptedTransportShape: false,
        topLevelFields: [],
        redactedFieldCount: this.countSensitiveFields(payload),
        issues: ['UNEXPECTED_ROOT_FORMAT'],
      };
    }

    const fields = Object.keys(payload)
      .filter((key) => !sensitiveKey.test(key))
      .sort();
    const redactedFieldCount = this.countSensitiveFields(payload);
    const issues: GoodWePayloadInspection['issues'] = [];
    if (Object.keys(payload).length === 0) issues.push('EMPTY_PAYLOAD');
    if (redactedFieldCount > 0) issues.push('SENSITIVE_FIELDS_REDACTED');
    return { acceptedTransportShape: true, topLevelFields: fields, redactedFieldCount, issues };
  }

  private countSensitiveFields(value: unknown): number {
    if (Array.isArray(value)) {
      return value.reduce((total, item) => total + this.countSensitiveFields(item), 0);
    }
    if (!this.isPlainObject(value)) return 0;
    return Object.entries(value).reduce(
      (total, [key, child]) =>
        total + (sensitiveKey.test(key) ? 1 : 0) + this.countSensitiveFields(child),
      0,
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
