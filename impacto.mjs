const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const plain=s=>clean(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const shorten=(s,n=230)=>s.length<=n?s:s.slice(0,n).replace(/\s+\S*$/,'')+'…';
const states=['Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso do Sul','Mato Grosso','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'];
export function isCompletedMeeting(item) {return item.type!=='Reunião'||/^(encerrad[ao]|realizad[ao]|concluid[ao]|finalizad[ao])\b/.test(plain(item.status));}
export function territorialScope(item) {
  // Only subject matter: the source institution and venue are not the measure's reach.
  const text=clean(item.title+' '+item.summary),s=plain(text);
  const citedStates=states.filter(state=>new RegExp('\\b(?:estado(?:s)?\\s+(?:do|da|de)\\s+|em\\s+)'+plain(state)+'\\b').test(s));
  const city=text.match(/\bmunic[ií]pio\s+(?:de|do|da)\s+([^,.;\n]{2,70})/i)?.[1]?.replace(/\s+(?:no|na|do|da)\s+Estado\b.*$/i,'').trim();
  const broad=/\b(programa nacional|politica nacional|sistema nacional|plano nacional|fundo nacional|cultura nacional|ambito nacional|abrangencia nacional|alcance nacional|todo o territorio|todo territorio|codigo penal|codigo civil|codigo de defesa do consumidor|consolidacao das leis do trabalho)\b/.test(s);
  if(broad)return {label:'Nacional',basis:'Estimativa pelo texto: menciona alcance nacional ou alteração de um código de aplicação nacional.',inferred:true,...(citedStates.length?{place:'Local citado: '+citedStates.join(', ')}:{})};
  if(city)return {label:'Municipal · '+shorten(city,50),basis:'Estimativa pelo objeto descrito: o texto identifica um município. Confira a abrangência no documento completo.',inferred:true,...(citedStates.length?{place:citedStates.join(', ')}:{})};
  if(citedStates.length){
    const targeted=/\b(ambito estadual|abrangencia estadual|exclusivamente no estado)\b/.test(s)||/\b(destina|destinar|voltado|restrito|limitado|beneficia|beneficiar)\b.{0,140}\bestado\b/.test(s);
    return targeted?{label:'Estadual · '+citedStates.join(', '),basis:'Estimativa: o texto descreve uma ação dirigida ao estado indicado. Confira o alcance no documento completo.',inferred:true}:{label:'A confirmar',place:'Estado citado: '+citedStates.join(', '),basis:'O estado é citado, mas o trecho não confirma que a abrangência da medida seja estadual.',inferred:false};
  }
  if(/\b(exterior|relacoes internacionais|relacoes diplomaticas|acordo internacional|tratado internacional)\b/.test(s))return {label:'Internacional',basis:'Estimativa pelo tema: relações com outros países ou atividade no exterior.',inferred:true};
  return {label:'A confirmar',basis:'O trecho disponível não permite determinar a abrangência territorial com segurança.',inferred:false};
}
export function describedImpact(item) {
  const text=clean(item.summary),title=clean(item.title);
  if(item.type==='Despesa')return {label:'Finalidade',text:shorten(text.match(/Finalidade:\s*(.*)/i)?.[1]||text.match(/Ação:\s*(.*)/i)?.[1]||'Documento de pagamento emitido; não comprova, por si só, o crédito ao destinatário.')};
  if(item.type==='Reunião')return {label:'Em pauta',text:shorten(text||title)};
  if(item.type==='Votação')return {label:'Decisão registrada',text:shorten(text||'Consulte o objeto e o resultado na fonte oficial.')};
  if(item.type==='Notícia')return {label:'O que foi informado',text:shorten(text||title)};
  if(item.type==='Proposta'){
    if(/^(PRL|PAR|RDF|EMR|EMP|EMC)\b/.test(title))return {label:'Efeito nesta etapa',text:'Documento da análise legislativa. Por si só, não representa aprovação final nem entrada em vigor de uma lei.'};
    if(/^(RIC|REQ|RQS|INC|PCE)\b/.test(title))return {label:'Objetivo do pedido',text:shorten(text||'Pedido em tramitação; consulte o documento completo.')};
    const verbs={Institui:'criar',Cria:'criar',Estabelece:'estabelecer',Autoriza:'autorizar',Reconhece:'reconhecer',Acrescenta:'acrescentar',Altera:'alterar',Dispõe:'definir regras',Proíbe:'proibir',Veda:'vedar',Determina:'determinar',Assegura:'assegurar'};
    const action=text.match(/\bpara\s+(instituir|estabelecer|criar|autorizar|reconhecer|acrescentar|alterar|proibir|vedar|assegurar|tipificar|garantir|ampliar|reduzir|incluir|permitir|exigir|dispor)\s+(.+)/i);
    const first=text.match(/^(Institui|Cria|Estabelece|Autoriza|Reconhece|Acrescenta|Altera|Dispõe|Proíbe|Veda|Determina|Assegura)\s+(.+)/);
    const purpose=action?(action[1].toLowerCase()==='dispor'?'definir regras':action[1].toLowerCase())+' '+action[2]:first?verbs[first[1]]+' '+first[2]:null;
    return {label:'Mudança proposta',text:purpose?shorten('Propõe '+purpose):shorten(text||'O efeito depende do conteúdo completo e da tramitação da proposta.')};
  }
  return {label:'Efeito descrito',text:shorten(text||'Consulte a fonte para avaliar os efeitos deste item.')};
}
export function annotateItem(item) {return {...item,scope:territorialScope(item),impact:describedImpact(item)};}
