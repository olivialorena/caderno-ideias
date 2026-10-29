import assert from 'node:assert/strict';
import {collectTransparency,paymentCard,documentDay} from './transparencia.mjs';
import {topics} from './collect-pais-hoje.mjs';
const day='2026-10-29';const key='test-only-private-key';
const today={data:'29/10/2026',documento:'TEST',fase:'Pagamento',funcao:'10 - Saúde',orgaoSuperior:'Ministério da Saúde',valor:'1.234,56',acao:'Assistência hospitalar',observacao:'Aquisição de insumos',especie:'Original'};
assert.equal(documentDay('29/10/2026'),day);
let calls=0;
const result=await collectTransparency(day,key,{pause:async()=>{},fetcher:async(url,options)=>{
  calls++;assert.equal(new URL(url).searchParams.get('dataEmissao'),'29/10/2026');assert.equal(new URL(url).searchParams.get('fase'),'3');assert.equal(options.headers['chave-api-dados'],key);
  return {ok:true,json:async()=>calls===1?[today,{...today,documento:'OLD',data:'28/10/2026'},{...today,documento:'LIQ',fase:'Liquidação'}]:[]};
}});
assert.equal(result.rows.length,1);assert.equal(calls,2);assert.equal(result.source.truncated,false);
const card=paymentCard(result.rows[0],day,topics);assert(card.themes.includes('Saúde'));assert(card.summary.includes('1.234,56'));assert(!JSON.stringify(card).includes(key));assert.equal(paymentCard({...today,data:'28/10/2026'},day,topics),null);
const limited=await collectTransparency(day,key,{maxPages:1,fetcher:async()=>({ok:true,json:async()=>[today]})});assert.equal(limited.source.truncated,true);
const denied=await collectTransparency(day,key,{fetcher:async()=>({ok:false,status:401})});assert.equal(denied.source.status,'error');assert(!JSON.stringify(denied).includes(key));
const missing=await collectTransparency(day,'',{fetcher:()=>{throw Error('Should not call')}});assert.equal(missing.source.status,'unconfigured');
console.log('OK: autenticação por header, paginação, recorte de data/fase, amostra limitada e ausência de chave na saída.');
