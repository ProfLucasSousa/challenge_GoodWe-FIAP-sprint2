import { Injectable } from '@nestjs/common';
import type { ExternalCharger } from './charger-provider';
import type { GoodWePayloadInspection } from './goodwe-payload.parser';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

@Injectable()
export class GoodWeMapper {
  /** Mapping remains deliberately blocked until GoodWe supplies an official schema. */
  mapCharger(_inspection: GoodWePayloadInspection): ExternalCharger {
    throw new ProviderCapabilityNotSupportedError(
      'listChargers',
      'goodwe',
      'o schema oficial do payload HCA G2 ainda não foi confirmado',
    );
  }
}
