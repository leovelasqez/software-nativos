import { Ajv2020 } from 'ajv/dist/2020.js';
import schema from '../contracts/orders-v2.schema.json' with { type: 'json' };
import type { OrderEvent, CommandEvent } from './orders-domain.ts';
const ajv = new Ajv2020({ strict: false });
export const isOrderEvent = ajv.compile<OrderEvent>(schema.event);
export const isCommandEvent = ajv.compile<CommandEvent>(schema.commandEvent);

import schemaV3 from '../contracts/orders-v3.schema.json' with { type: 'json' };
export const isOrderEventV3 = ajv.compile<OrderEvent>(schemaV3.event);
export const isCommandEventV3 = ajv.compile<CommandEvent>(schemaV3.commandEvent);
