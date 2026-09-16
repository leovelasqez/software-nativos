import { Ajv2020 } from 'ajv/dist/2020.js';
import payloadSchema from '../contracts/pos-payload-v1.schema.json' with { type: 'json' };
import snapshotSchema from '../contracts/pos-snapshot-v1.schema.json' with { type: 'json' };
import type { PosEvent, Snapshot } from './pos-domain.ts';
const ajv = new Ajv2020({ strict: false });
export const isPosEvent = ajv.compile<PosEvent>(payloadSchema);
export const isSnapshot = ajv.compile<Snapshot>(snapshotSchema);
