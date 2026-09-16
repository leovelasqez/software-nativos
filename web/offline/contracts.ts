import * as shape from './generated/validators.js';
import identity from '../../contracts/identity-v1.schema.json' with {type:'json'};
import type { Principal,OfflineGrant,Operation,Action } from '../../src/contracts.ts';
export const WEEK_MS=7*24*3600_000;
export const isPrincipal=(v:unknown):v is Principal=>shape.principal(v);
export const isGrant=(v:unknown):v is OfflineGrant=>shape.grant(v)&&(v as OfflineGrant).expiresAtMs>(v as OfflineGrant).validatedAtMs&&(v as OfflineGrant).expiresAtMs-(v as OfflineGrant).validatedAtMs<=WEEK_MS;
export const isOperation=(v:unknown):v is Operation=>shape.operation(v)&&((v as Operation).sequence===1?(v as Operation).previousOperationId===null:!!(v as Operation).previousOperationId&&(v as Operation).previousOperationId!==(v as Operation).operationId);
export const isId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(v);
export const isAction=(v:unknown):v is Action=>typeof v==='string'&&identity.properties.actions.items.enum.includes(v);
