import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {collectTransparency,paymentCard} from './transparencia.mjs';
import {annotateItem,isCompletedMeeting} from './impacto.mjs';

export function brasiliaDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function topics(text) {
  const s = text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const rules = {'Saúde':/\b(sus\b|saude|hospital|paciente|vacina|medic|terapeut|doenc|diagnostic)/,'Segurança':/\b(seguranca publica|polici|crime|criminal|penal|violencia|armas|prisao|trafico)/,'Educação':/\b(educa|escola|ensino|professor|universidad|estudant)/,'Economia':/\b(econom|tribut|imposto|fiscal|orcament|renda|emprego|salari|trabalh|previdenc|financeir|inflacao)/,'Meio ambiente':/\b(ambient|clima\b|climatic|florest|desmat|energia|sustent|amazoni|indigen)/,'Direitos':/\b(direito|mulher|crianca|idos|deficien|racis|igualdade|humano|lgbt)/,'Política e instituições':/\b(eleic|eleitor|partid|constitu|parlament|decoro|senador|deputad|governo)/};
  const matches = Object.entries(rules).filter(([,r])=>r.test(s)).map(([t])=>t);
  return matches.length ? matches : ['Outros temas'];
}
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function excerpt(text, max=340) {const s=decode(text||'');return s.length>max?s.slice(0,max).replace(/\s+\S*$/,'')+'…':s;}
const list = x => !x ? [] : Array.isArray(x) ? x : [x];
async function request(url, json=true) {
  let last;
  for(let attempt=0;attempt<3;attempt++) {try {const r=await fetch(url,{headers:{Accept:json?'application/json':'application/rss+xml, application/xml', 'User-Agent':'IdeiaClub-PaisHoje/1.0'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);return json?await r.json():await r.text();} catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}}
  throw last;
}
async function camara(path, params) {
  let url='https://dadosabertos.camara.leg.br/api/v2/'+path+'?'+new URLSearchParams({...params,itens:100});const rows=[];
  for(let page=0;url;page++){if(page>=100)throw Error('Limite de paginação');const d=await request(url);if(!Array.isArray(d.dados))throw Error('Formato inesperado');rows.push(...d.dados);url=d.links?.find(x=>x.rel==='next')?.href;}
  return rows;
}
export async function collect(day=brasiliaDay()) {
  const items=[],sources=[];const compact=day.replaceAll('-','');
  const add=(source,type,id,title,summary,url,date,status='',votes=null)=>{if(!url?.startsWith('https://')||!isCompletedMeeting({type,status}))return;items.push({id:source+':'+id,source,type,title:decode(title||type),summary:excerpt(summary),url,date,status,themes:topics(title+' '+summary),...(votes?{votes}:{})});};
  async function source(name,url,run){try{const before=items.length;await run();sources.push({name,url,status:'ok',count:items.length-before});}catch(e){sources.push({name,url,status:'error',message:'Fonte temporariamente indisponível'});console.error(name+': '+e.message);}}
  await source('Câmara · propostas','https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada',async()=>{
    const rows=await camara('proposicoes',{dataApresentacaoInicio:day,dataApresentacaoFim:day});
    for(const x of rows.filter(x=>x.dataApresentacao?.startsWith(day))) add('Câmara','Proposta',x.id,`${x.siglaTipo} ${x.numero}${x.ano?'/'+x.ano:''}`,x.ementa,'https://www.camara.leg.br/propostas-legislativas/'+x.id,x.dataApresentacao,'Apresentada hoje · ainda não é lei');
  });
  await source('Câmara · votações','https://www.camara.leg.br/atividade-legislativa/plenario/resultados',async()=>{
    const rows=await camara('votacoes',{dataInicio:day,dataFim:day});
    for(const x of rows.filter(x=>(x.data||x.dataHoraRegistro)?.startsWith(day))){let votes=null;try{votes=(await camara('votacoes/'+encodeURIComponent(x.id)+'/votos',{})).map(v=>({name:v.deputado_?.nome||v.deputado?.nome,party:v.deputado_?.siglaPartido||v.deputado?.siglaPartido,uf:v.deputado_?.siglaUf||v.deputado?.siglaUf,vote:v.tipoVoto}));}catch{votes=null;}
      add('Câmara','Votação',x.id,'Votação · '+(x.siglaOrgao||'Câmara'),x.descricao,x.uri||'https://dadosabertos.camara.leg.br/api/v2/votacoes/'+x.id,x.dataHoraRegistro||x.data,'Resultado conforme registro oficial',votes);
    }
  });
  await source('Câmara · agenda','https://www.camara.leg.br/agenda',async()=>{
    for(const x of await camara('eventos',{dataInicio:day,dataFim:day}))if(x.dataHoraInicio?.startsWith(day))add('Câmara','Reunião',x.id,x.descricaoTipo,x.descricao,x.urlRegistro||'https://www.camara.leg.br/evento-legislativo/'+x.id,x.dataHoraInicio,x.situacao||'Situação não informada');
  });
  const senate='https://legis.senado.leg.br/dadosabertos/';
  await source('Senado · propostas','https://www25.senado.leg.br/web/atividade/materias',async()=>{
    const rows=await request(senate+'processo?'+new URLSearchParams({dataInicioApresentacao:day,dataFimApresentacao:day}));if(!Array.isArray(rows))throw Error('Formato inesperado');
    for(const x of rows.filter(x=>x.dataApresentacao===day))add('Senado','Proposta',x.id,x.identificacao,x.ementa,'https://www25.senado.leg.br/web/atividade/materias/-/materia/'+x.codigoMateria,x.dataApresentacao,'Apresentada hoje · '+(x.situacaoAtual||'em tramitação'));
  });
  await source('Senado · votações','https://www25.senado.leg.br/web/atividade/votacoes-nominais',async()=>{
    const rows=await request(senate+'votacao?'+new URLSearchParams({dataInicio:day,dataFim:day}));if(!Array.isArray(rows))throw Error('Formato inesperado');
    for(const x of rows.filter(x=>x.dataSessao===day))add('Senado','Votação',x.codigoSessaoVotacao,x.identificacao,`${x.descricaoVotacao||''}. ${x.ementa||''}`,senate+'votacao?codigoSessao='+x.codigoSessao+'&idProcesso='+x.idProcesso,x.dataSessao,x.votacaoSecreta==='S'?'Votação secreta · votos individuais não públicos':'Votação nominal',x.votacaoSecreta==='S'?null:list(x.votos).map(v=>({name:v.nomeParlamentar,party:v.siglaPartidoParlamentar,uf:v.siglaUFParlamentar,vote:v.descricaoVotoParlamentar||v.siglaVotoParlamentar})));
  });
  await source('Senado · comissões','https://www25.senado.leg.br/web/atividade/comissoes',async()=>{
    const d=await request(senate+`comissao/agenda/${compact}/${compact}`);if(!d.AgendaReuniao)throw Error('Formato inesperado');
    for(const x of list(d.AgendaReuniao.reunioes?.reuniao))if(x.dataInicio?.startsWith(day))add('Senado','Reunião',x.codigo,x.colegiadoCriador?.nome||x.titulo,x.informacao||x.titulo,'https://legis.senado.leg.br/comissoes/reuniao?reuniao='+x.codigo,x.dataInicio,x.situacao||x.status||'Agendada');
  });
  await source('Senado · plenário','https://www25.senado.leg.br/web/atividade/agenda',async()=>{
    const d=await request(senate+'plenario/agenda/dia/'+compact);if(!d.AgendaPlenario)throw Error('Formato inesperado');
    for(const x of list(d.AgendaPlenario.Sessoes?.Sessao).filter(x=>x.Data===day))add('Senado','Reunião',x.CodigoSessao,x.TipoSessao||'Sessão plenária',x.Evento?.DescricaoEvento||x.TipoSessao,senate+'plenario/agenda/dia/'+compact,day+(x.Hora?'T'+x.Hora:''),x.SituacaoSessao||'Agenda prevista · consulte a fonte');
  });
  for(const [name,url] of [['Agência Brasil · Política','https://agenciabrasil.ebc.com.br/rss/politica/feed.xml'],['Planalto','https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/noticias/RSS']])await source(name,url,async()=>{
    const xml=await request(url,false);if(!/<(?:rss|rdf:RDF)\b/.test(xml))throw Error('Feed inválido');
    for(const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)){const content=match[1];const tag=n=>content.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+n+'>'))?.[1]||'';
      const date=decode(tag('pubDate')||tag('dc:date'));if(!date||!Number.isFinite(Date.parse(date))||brasiliaDay(new Date(date))!==day)continue;
      const link=decode(tag('link'));add(name,'Notícia',link,decode(tag('title')),decode(tag('description')),link,new Date(date).toISOString(),'Publicação oficial · resumo da fonte');
    }
  });
  const transparency=await collectTransparency(day,process.env.PORTAL_TRANSPARENCIA_API_KEY);
  for(const row of transparency.rows){const card=paymentCard(row,day,topics);if(card){card.summary=excerpt(card.summary,600);items.push(card);transparency.source.count++;}}
  sources.push(transparency.source);
  const unique=[...new Map(items.map(x=>[x.id,x])).values()];
  return {date:day,updatedAt:new Date().toISOString(),items:unique.map(annotateItem),sources};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const data=await collect();const output=new URL('./pais-hoje.json',import.meta.url);await mkdir(new URL('./',import.meta.url),{recursive:true});await writeFile(output,JSON.stringify(data));console.log(JSON.stringify({date:data.date,items:data.items.length,sources:data.sources}));
  if(data.sources.every(s=>s.status==='error'))process.exitCode=1;
}
