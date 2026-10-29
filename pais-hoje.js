(() => {
  'use strict';
  const root=document.querySelector('#pais-hoje');
  const $=s=>root.querySelector(s);
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let data=null,theme='Todos',type='Tudo',limit=12,busy=false;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  function link(text,url){const a=el('a',text);try{const u=new URL(url);if(u.protocol!=='https:')return el('span',text);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{return el('span',text);}return a;}
  function render(){
    const current=data?.date===day(),items=current?data.items.filter(x=>x.type!=='Reunião'||/^(encerrad[ao]|realizad[ao]|concluid[ao]|finalizad[ao])\b/.test(String(x.status||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase())):[];
    const text=$('#pais-search').value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const selected=items.filter(x=>(theme==='Todos'||x.themes.includes(theme))&&(type==='Tudo'||x.type===type)&&(!text||(x.title+' '+x.summary+' '+x.source).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(text)));
    const priority={'Notícia':0,'Votação':1,'Reunião':2,'Proposta':3,'Despesa':4};selected.sort((a,b)=>priority[a.type]-priority[b.type]||b.date.localeCompare(a.date));
    const grid=$('#pais-cards');grid.replaceChildren();
    $('#pais-count').textContent=selected.length+' registro(s) nas fontes consultadas';
    for(const x of selected.slice(0,limit)){
      const card=el('article',null,'pais-card'),meta=el('div',null,'pais-meta');meta.append(el('span',x.type,'pill'),el('span',x.source));card.append(meta,el('h3',x.title));
      const tags=el('div',null,'pais-tags');for(const t of x.themes)tags.append(el('span',t));card.append(tags);
      if(x.scope){if(x.scope.label!=='A confirmar'){const scope=el('span','Âmbito sugerido: '+x.scope.label,'pais-scope');scope.title=x.scope.basis;scope.tabIndex=0;scope.setAttribute('aria-label','Âmbito sugerido: '+x.scope.label+'. '+x.scope.basis);tags.append(scope);}if(x.scope.place)tags.append(el('span',x.scope.place));}
      card.append(el('p',x.summary||'Consulte o registro oficial para conhecer os detalhes.'));
      if(x.status)card.append(el('p',x.status,'pais-status'));
      if(x.type==='Reunião'&&x.date.includes('T'))card.append(el('p','Horário informado: '+x.date.slice(11,16)+' · Brasília','pais-status'));
      if(x.votes?.length){const details=el('details'),summary=el('summary','Quem votou em quê · '+x.votes.length+' registros');details.append(summary);const search=el('input');search.type='search';search.placeholder='Buscar parlamentar, partido ou UF';search.setAttribute('aria-label','Buscar votos em '+x.title);details.append(search);const votes=el('div',null,'pais-votes');
        const paint=()=>{votes.replaceChildren();const q=search.value.toLocaleLowerCase('pt-BR');for(const v of x.votes.filter(v=>(v.name+' '+v.party+' '+v.uf).toLocaleLowerCase('pt-BR').includes(q))){const row=el('div');row.append(el('span',(v.name||'Nome não informado')+' · '+(v.party||'—')+'/'+(v.uf||'—')),el('strong',v.vote||'Não informado'));votes.append(row);}if(!votes.childElementCount)votes.append(el('p','Nenhum parlamentar nesta busca.'));};search.oninput=paint;details.addEventListener('toggle',()=>{if(details.open)paint();});details.append(votes);card.append(details);
      }else if(x.type==='Votação')card.append(el('p','Votos individuais não disponíveis neste retrato. Consulte a fonte oficial.','pais-status'));
      card.append(link('Ver registro completo ↗',x.url));grid.append(card);
    }
    if(!selected.length)grid.append(el('p',!current?'O retrato de hoje ainda não está disponível. Volte em breve ou consulte as fontes abaixo.':items.length?'Nenhum registro com estes filtros hoje. Tente outro tema ou tipo de atividade.':'Ainda não há registros de hoje nas fontes disponíveis. Isso não significa ausência de atividade.','pais-empty'));
    $('#pais-more').hidden=selected.length<=limit;
    root.querySelectorAll('[data-pais-theme]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.paisTheme===theme));});
    const sources=$('#pais-sources');sources.replaceChildren();for(const s of data?.sources||[]){const p=el('p');p.append(link(s.name,s.url),document.createTextNode(' · '+(!current?'aguardando dados de hoje':s.status==='ok'?s.count+' registro(s)':s.status==='unconfigured'?'aguardando configuração':'indisponível')));sources.append(p);}
  }
  async function load(){if(busy)return;busy=true;$('#pais-refresh').disabled=true;$('#pais-update').textContent='Consultando o retrato oficial…';
    try{const r=await fetch('./pais-hoje.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const next=await r.json();if(!Array.isArray(next.items)||!Array.isArray(next.sources))throw Error();data=next;
      const stale=data.date!==day();const when=new Date(data.updatedAt);const age=Date.now()-when.getTime();$('#pais-update').textContent=stale?'Aguardando a primeira atualização de hoje.':`Atualizado às ${when.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})} · Brasília${age>3*3600000?' · atualização atrasada':''}`;render();
    }catch{if(data)render();else $('#pais-cards').replaceChildren(el('p','Não foi possível carregar agora. Tente atualizar ou acesse as fontes oficiais abaixo.','pais-empty'));$('#pais-update').textContent='Consulta indisponível. Tente novamente em instantes.';}
    finally{busy=false;$('#pais-refresh').disabled=false;}
  }
  for(const label of ['Todos','Saúde','Segurança','Educação','Economia','Meio ambiente','Direitos','Política e instituições','Outros temas']){const b=el('button',label,'soft-btn');b.type='button';b.dataset.paisTheme=label;b.setAttribute('aria-pressed',String(label==='Todos'));b.onclick=()=>{theme=label;limit=12;render();};$('#pais-themes').append(b);}
  $('#pais-type').onchange=e=>{type=e.target.value;limit=12;render();};$('#pais-search').oninput=()=>{limit=12;render();};$('#pais-refresh').onclick=load;$('#pais-more').onclick=()=>{limit+=12;render();};
  function dateLabel(){$('#pais-date').textContent=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long'});}
  dateLabel();new MutationObserver(()=>{if(!document.body.classList.contains('locked')&&!data)load();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(!document.body.classList.contains('locked'))load();setInterval(()=>{dateLabel();if(!document.hidden&&!document.body.classList.contains('locked'))load();},300000);
})();
