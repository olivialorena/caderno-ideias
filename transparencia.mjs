const API='https://api.portaldatransparencia.gov.br/api-de-dados/despesas/documentos';
export const transparencyScope='Documentos de pagamento emitidos hoje, gestão 00001. Listagem de até 150 documentos; não representa o total dos gastos do Governo Federal. A emissão do documento não confirma o crédito ao destinatário.';
export function documentDay(value) {
  const match=String(value||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match?`${match[3]}-${match[2]}-${match[1]}`:String(value||'').slice(0,10);
}
export function paymentCard(row,day,classify) {
  if(documentDay(row.data)!==day||!row.documento||row.fase!=='Pagamento')return null;
  const area=String(row.funcao||'').replace(/^\d+\s*-\s*/,'').trim();
  const summary=[`Valor do documento: R$ ${row.valor||'não informado'}.`,row.orgaoSuperior&&`Órgão: ${row.orgaoSuperior}.`,row.acao&&`Ação: ${row.acao}.`,row.observacao&&`Finalidade: ${row.observacao}`].filter(Boolean).join(' ');
  return {id:'Portal da Transparência:'+row.documento,source:'Portal da Transparência',type:'Despesa',title:'Documento de pagamento · '+(area||'Governo Federal'),summary,
    url:'https://portaldatransparencia.gov.br/despesas/documento/pagamento/'+encodeURIComponent(row.documento),date:day,
    status:'Emitido hoje · '+(row.especie||'espécie não informada')+' · amostra da gestão 00001',themes:classify([row.funcao,row.subfuncao,row.programa,row.acao].filter(Boolean).join(' '))};
}
export async function collectTransparency(day,key,{fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms)),maxPages=10}={}) {
  const name='Portal da Transparência · documentos de pagamento';
  const url='https://portaldatransparencia.gov.br/despesas/favorecido';
  const base={name,url,count:0,scope:transparencyScope};
  if(!key)return {rows:[],source:{...base,status:'unconfigured',message:'Consulta aguardando configuração da credencial.'}};
  const rows=[];const date=day.split('-').reverse().join('/');let truncated=false;
  try{
    for(let page=1;page<=maxPages;page++){
      if(page>1)await pause(850);
      const query=new URLSearchParams({dataEmissao:date,fase:'3',gestao:'00001',pagina:String(page)});
      const response=await fetcher(API+'?'+query,{headers:{Accept:'application/json','chave-api-dados':key},signal:AbortSignal.timeout(20000)});
      if(!response.ok)return {rows:[],source:{...base,status:'error',message:response.status===401||response.status===403?'A fonte recusou a credencial.':response.status===429?'Limite temporário de consultas da fonte.':'Fonte temporariamente indisponível.'}};
      const data=await response.json();if(!Array.isArray(data))throw Error('Formato inesperado');
      rows.push(...data.filter(x=>documentDay(x.data)===day&&x.fase==='Pagamento'));
      if(data.length===0)break;
      if(page===maxPages)truncated=true;
    }
    return {rows:[...new Map(rows.filter(x=>x.documento).map(x=>[x.documento,x])).values()],source:{...base,status:'ok',truncated,message:rows.length?(truncated?'Amostra limitada às primeiras páginas da consulta.':'Documentos disponíveis na consulta de hoje.'):'Ainda sem documentos emitidos hoje nesta consulta. A publicação da fonte pode ter atraso; isso não significa ausência de pagamentos.'}};
  }catch{return {rows:[],source:{...base,status:'error',message:'Não foi possível consultar a fonte nesta atualização.'}};}
}
