import { decimal, formatted, CatalogError } from './catalog.ts';
export interface LoyaltyRule {id:string;earnEvery:string;pointValue:string;maxPercent:string;createdAtMs:number}
export interface LoyaltyMeta {rule:LoyaltyRule;redeemedPoints:string;knownBalance:string;memberSince:number}
export interface LoyaltyMember {customerId:string;enrolledAtMs:number;balance:string}
export interface LoyaltyCache {rule:LoyaltyRule;members:LoyaltyMember[];asOfMs:number}
export interface LoyaltyResult extends LoyaltyMeta {earnedPoints:string;redeemedAmount:string}
export function points(value:string,signed=false):bigint {if(!(signed?/^-?(0|[1-9][0-9]{0,11})$/:/^(0|[1-9][0-9]{0,8})$/).test(value))throw new CatalogError('Cantidad de puntos inválida.');return BigInt(value);}
export function validateRule(rule:Pick<LoyaltyRule,'earnEvery'|'pointValue'|'maxPercent'>){if(points(rule.earnEvery)<1n||points(rule.pointValue)<1n||points(rule.maxPercent)<1n||points(rule.maxPercent)>100n)throw new CatalogError('Equivalencias positivas y límite entre 1% y 100%.');}
export function loyaltyCalculation(products:bigint,meta:LoyaltyMeta):LoyaltyResult{
 validateRule(meta.rule);const redeemed=points(meta.redeemedPoints);const amount=redeemed*decimal(meta.rule.pointValue);if(amount*100n>products*points(meta.rule.maxPercent))throw new CatalogError('El canje supera el límite sobre productos después de descuentos.');
 return {...meta,redeemedAmount:formatted(amount),earnedPoints:String((products-amount)/decimal(meta.rule.earnEvery))};
}
export function proportional(total:bigint,part:bigint,whole:bigint){return whole===0n?0n:(total*part+whole/2n)/whole;}

export function apportion(total:bigint,weights:bigint[]){const sum=weights.reduce((a,b)=>a+b,0n);if(!sum)return weights.map(()=>0n);const result=weights.map(w=>total*w/sum);let rest=total-result.reduce((a,b)=>a+b,0n);for(const i of weights.map((_,i)=>i).sort((a,b)=>{const x=total*weights[a]!%sum,y=total*weights[b]!%sum;return x===y?a-b:x>y?-1:1;})){if(rest<=0n)break;result[i]!++;rest--;}return result;}
