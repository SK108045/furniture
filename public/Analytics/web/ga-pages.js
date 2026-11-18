(()=>{const main=document.getElementById('app');if(!main)return;const key=document.body.dataset.page;const data = window.NicooReportData;
const management = ['import', 'library'].includes(key);
let range = data.selectedRange();
let report;
let channels, pages, countries, events;
function group(dimension, metric, reportData = report) {
  return data.ranked(reportData.groups[dimension], metric);
}
function pairs(dimension, metric, reportData = report) {
  return group(dimension, metric, reportData).map(row => [
    dimension === 'page' ? data.pageNames[row.label] : row.label, row[metric],
  ]);
}
function fmt(value) { return data.number(value); }
function dateTitle() {
  return (range.days ? 'Last ' + range.days + ' days' : 'Custom') + '   ' + data.rangeLabel(range);
}
function loadReport() {
  report = data.summarize(range);
  channels = pairs('channel', 'sessions');
  pages = pairs('page', 'views');
  countries = pairs('country', 'users');
  events = group('event', 'count').map(row => [row.label, row.count, row.users]);
}
function historicalTrend(metric, label) {
  const points = data.series(range, metric);
  return line(points.map(point => point.value), label || 'Active users', 210, points.map(point => point.label));
}
function head(title,date=management ? 'Last 90 days' : dateTitle()){const initial=window.PortalSession?.initial?.()||'R';return '<div class="report-head"><div class="report-badge">'+initial+'</div><div class="report-title">'+title+'</div><button class="quality-pill" type="button" data-quality><span class="quality-dot">✓</span><span>Data quality</span></button><div class="report-spacer"></div><button class="date-pill" type="button"><b>'+date+'</b><span class="muted">'+(management ? '' : range.compare ? 'Compare: '+data.rangeLabel(data.previous(range))+' · Demo data' : 'Demo data')+'</span></button><button class="report-action" type="button" data-share aria-label="Share report">↗</button><button class="report-action" type="button" data-more aria-label="More report actions">⋮</button></div>'}function path(vals,w=650,h=190,pad=12){const max=Math.max(...vals),min=Math.min(...vals);return vals.map((v,i)=>{const x=pad+i*(w-2*pad)/Math.max(1,vals.length-1),y=pad+(max-v)/(max-min||1)*(h-2*pad);return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ')}function line(vals,label='Active users',h=210,dates=[]){return '<svg class="chart" viewBox="0 0 650 '+h+'" preserveAspectRatio="none"><g stroke="#e8eaed"><path d="M12 42H638M12 84H638M12 126H638M12 168H638"/></g><path d="'+path(vals,650,h)+'" fill="none" stroke="#1a73e8" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="legend"><span><i class="dot" style="background:#1a73e8"></i>'+label+'</span>'+(dates.length?'<span class="muted">'+dates[0]+' – '+dates[dates.length-1]+'</span>':'')+'</div>'}function bars(rows){const m=Math.max(1,...rows.map(r=>r[1]));return '<div class="bars">'+rows.map(r=>'<div class="bar-row"><span>'+r[0]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(r[1]/m*100).toFixed(1)+'%"></div></div><b>'+fmt(r[1])+'</b></div>').join('')+'</div>'}function table(headers,rows,first='Dimension'){return '<div class="ga-table-wrap"><div class="table-tools">⌕ <input class="table-search" placeholder="Search..."><span class="right">Rows per page: 10    1-'+Math.min(10,rows.length)+' of '+rows.length+'</span></div><table class="ga-table"><thead><tr><th>'+first+'</th>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map((r,i)=>'<tr><td><span class="rank">'+(i+1)+'</span> '+r[0]+'</td>'+r.slice(1).map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}function minuteBars(vals){const m=Math.max(1,...vals);return '<div class="minute-bars">'+vals.map(v=>'<i style="height:'+(v/m*100)+'%"></i>').join('')+'</div>'}function world(){return '<img class="world" src="ga-world-map.webp" alt="Active users by country map" style="object-fit:contain;background:#fff">'}function closeReportMenus(){document.querySelectorAll('.report-menu').forEach(x=>x.remove())}
function reportMenu(anchor,title,items){
  closeReportMenus();
  const r=anchor.getBoundingClientRect(),m=document.createElement('div');m.className='panel-menu report-menu';
  m.style.cssText='top:'+(r.bottom+6)+'px;right:'+Math.max(10,innerWidth-r.right)+'px;left:auto;min-width:250px';
  if(title){const h=document.createElement('div');h.style.cssText='padding:7px 10px 6px;font-size:11px;color:#5f6368;font-weight:700;text-transform:uppercase';h.textContent=title;m.appendChild(h)}
  items.forEach(item=>{
    if(item==='---'){const d=document.createElement('div');d.style.cssText='height:1px;background:#e8eaed;margin:5px 2px';m.appendChild(d);return}
    const b=document.createElement('button');b.type='button';b.innerHTML=(item.icon?'<span style="display:inline-block;width:22px">'+item.icon+'</span>':'')+'<span>'+item.label+'</span>';
    b.onclick=()=>{m.remove();item.action?.()};m.appendChild(b);
  });
  document.body.appendChild(m);
  setTimeout(()=>document.addEventListener('click',function close(e){if(!m.contains(e.target)&&e.target!==anchor){m.remove();document.removeEventListener('click',close)}},true),0);
}
function simpleModal(title,html,actions=[]){
  const back=document.createElement('div');back.className='import-modal-backdrop';
  back.innerHTML='<div class="import-modal" style="width:min(560px,calc(100vw - 40px))"><div class="import-modal-head"><h2>'+title+'</h2><button class="import-modal-close" type="button">×</button></div><div class="import-modal-body">'+html+'</div><div class="import-modal-foot"></div></div>';
  document.body.appendChild(back);const close=()=>back.remove();
  back.querySelector('.import-modal-close').onclick=close;back.addEventListener('click',e=>{if(e.target===back)close()});
  const foot=back.querySelector('.import-modal-foot');
  actions.forEach(a=>{const b=document.createElement('button');b.type='button';b.className=a.primary?'primary':'btn-secondary';b.textContent=a.label;b.onclick=()=>a.action?.(close,back);foot.appendChild(b)});
  return back;
}
function shareCurrent(){
  const data={title:document.title,text:'Nicoo Furniture Analytics report',url:location.href};
  if(navigator.share)navigator.share(data).catch(()=>{});
  else if(navigator.clipboard)navigator.clipboard.writeText(location.href).then(()=>GAToast('Report link copied')).catch(()=>GAToast('Copy the URL from the address bar'));
  else GAToast('Copy the URL from the address bar');
}
function exportCurrentTable(){
  const table=document.querySelector('.ga-table');let rows=[];
  if(table){
    rows=[...table.querySelectorAll('tr')].filter(r=>r.style.display!=='none').map(r=>[...r.children].map(c=>'"'+c.textContent.trim().replace(/"/g,'""')+'"').join(','));
  }else{
    rows.push('"Metric","Value"');
    document.querySelectorAll('.kpi').forEach(k=>{const label=k.querySelector('small')?.textContent.trim(),value=k.querySelector('strong')?.textContent.trim();if(label&&value)rows.push('"'+label.replace(/"/g,'""')+'","'+value.replace(/"/g,'""')+'"')});
    document.querySelectorAll('.bar-row').forEach(r=>{const parts=[...r.children];const label=parts[0]?.textContent.trim(),value=parts[2]?.textContent.trim();if(label&&value)rows.push('"'+label.replace(/"/g,'""')+'","'+value.replace(/"/g,'""')+'"')});
    const metric=document.querySelector('.metric,.metric-sm');if(rows.length===1&&metric)rows.push('"Report value","'+metric.textContent.trim().replace(/"/g,'""')+'"');
  }
  if(rows.length<=1){GAToast('No exportable report data found');return}
  const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(document.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'analytics-report')+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);GAToast('CSV download started');
}
function bind(){
  document.querySelectorAll('[data-quality]').forEach(b=>b.onclick=()=>simpleModal('Data quality','<div style="display:flex;gap:12px;align-items:flex-start"><div class="status-orb">✓</div><div><b>Report data is available</b><div class="sub" style="margin-top:5px">These are demo figures for Nicoo Furniture Hub.</div></div></div>',[{label:'Close',primary:true,action:c=>c()}]));
  document.querySelectorAll('[data-share]').forEach(b=>b.onclick=shareCurrent);
  document.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>reportMenu(b,'Report actions',[
    {label:'Share report',icon:'↗',action:shareCurrent},
    {label:'Download CSV',icon:'⇩',action:exportCurrentTable},
    {label:'Print / Save as PDF',icon:'▣',action:()=>window.print()},
    '---',
    {label:'Refresh report',icon:'↻',action:()=>{GAProgress?.pulse?.(650);document.querySelectorAll('.bar-fill').forEach(x=>{x.style.animation='none';void x.offsetWidth;x.style.animation='barIn .55s ease both'});GAToast('Report refreshed')}}
  ]));
  main.querySelectorAll('.date-pill').forEach(button => {
    button.onclick = () => {
      if (management) return;
      if (key === 'realtime' || key === 'realtimePages') {
        reportMenu(button, 'Date range', [5, 30, 60].map(minutes => ({
          label: 'Last ' + minutes + ' minutes',
          icon: minutes === RealtimeSim.minutes ? '✓' : '',
          action: () => RealtimeSim.setWindow(minutes),
        })));
        return;
      }
      reportMenu(button, 'Date range', [
        ...data.presets.map(days => ({
          label: 'Last ' + days + ' days', icon: range.days === days ? '✓' : '',
          action: () => selectRange(data.last(days, range.compare)),
        })),
        '---',
        { label: 'Compare to previous period', icon: range.compare ? '✓' : '',
          action: () => selectRange({ ...range, compare: !range.compare }) },
        { label: 'Custom range…', icon: '▦', action: customRange },
      ]);
    };
  });
  document.querySelectorAll('.table-search').forEach(inp=>inp.addEventListener('input',()=>{const q=inp.value.toLowerCase(),tbody=inp.closest('.ga-table-wrap').querySelector('tbody');[...tbody.rows].forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')}));
  document.querySelectorAll('[data-event-name]').forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();const name=a.dataset.eventName,row=events.find(x=>x[0]===name);
    if(!row)return;
    simpleModal('Event: '+name,'<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><small>Event count</small><strong>'+fmt(row[1])+'</strong></div><div class="kpi"><small>Total users</small><strong>'+fmt(row[2])+'</strong></div><div class="kpi"><small>Events / user</small><strong>'+data.ratio(row[1],row[2]).toFixed(2)+'</strong></div></div><div class="sub" style="margin-top:14px">This is the saved event snapshot for '+name+'.</div>',[{label:'Close',primary:true,action:c=>c()}]);
  }));
}
function selectRange(next) {
  range = next;
  data.saveRange(range);
  loadReport();
  renderers[key]();
  GAProgress?.pulse?.(420);
}
function customRange() {
  const today = data.isoDay(data.today());
  const input = (label, id, day) => '<label class="field">'+label+
    '<input type="date" id="'+id+'" value="'+data.isoDay(day)+'" max="'+today+'"></label>';
  simpleModal('Custom date range', '<div class="field-grid">'+input('Start', 'range-start', range.start)+
    input('End', 'range-end', range.end)+'<div role="alert" data-range-error></div></div>', [
    { label: 'Cancel', action: close => close() },
    { label: 'Apply', primary: true, action: (close, modal) => {
      const next = data.custom(modal.querySelector('#range-start').value, modal.querySelector('#range-end').value, range.compare);
      if (!next) {
        modal.querySelector('[data-range-error]').textContent = 'Choose a valid range of up to 366 days ending today or earlier.';
        return;
      }
      close();
      selectRange(next);
    } },
  ]);
}
const RealtimeSim={
  minutes:30,
  timer: null,
  load() {
    const saved = Number(localStorage.getItem('gaRealtimeWindow'));
    this.minutes = [5, 30, 60].includes(saved) ? saved : 30;
  },
  paint() {
    const realtime = data.realtime(this.minutes);
    const parts = {
      'rt-active': fmt(realtime.users),
      'rt-minutes': minuteBars(realtime.minuteUsers),
      'rt-source': bars(pairs('source', 'users', realtime)),
      'rt-page': bars(pairs('page', 'views', realtime)),
      'rt-event': bars(pairs('event', 'count', realtime)),
    };
    Object.entries(parts).forEach(([part, html]) => {
      const target = main.querySelector('[data-'+part+']');
      if (target) target.innerHTML = html;
    });
  },
  setWindow(minutes) {
    this.minutes = minutes;
    localStorage.setItem('gaRealtimeWindow', String(minutes));
    if (key === 'realtimePages') realtimePages();
    else this.mount();
  },
  mount(){
    const m=this.minutes;
    main.innerHTML=head('Realtime overview','Last '+m+' minutes')+
      '<div class="content"><div class="hero-grid">'+
      '<div class="card realtime-card"><h3 data-rt-title>Active users in last '+m+' minutes</h3><div class="metric" data-rt-active></div><div class="sub">Users per minute · Simulated</div><div data-rt-minutes></div></div>'+
      '<div class="card realtime-card"><h3>Active users by Country</h3>'+world()+'<div class="sub" style="margin-top:5px">Simulated realtime activity</div></div>'+
      '</div><div class="grid" style="margin-top:14px">'+
      '<div class="card" style="grid-column:span 4"><h3>Active users by First user source</h3><div data-rt-source></div></div>'+
      '<div class="card" style="grid-column:span 4"><h3>Views by Page title</h3><div data-rt-page></div></div>'+
      '<div class="card" style="grid-column:span 4"><h3>Event count by Event name</h3><div data-rt-event></div></div>'+
      '</div></div>';
    bind();
    this.paint();
    clearInterval(this.timer);
    let minute = Math.floor(Date.now()/60000);
    this.timer = setInterval(() => {
      const next = Math.floor(Date.now()/60000);
      if (!document.hidden && next !== minute) {
        minute = next;
        this.paint();
      }
    }, 5000);
  }
};
window.RealtimeSim=RealtimeSim;
function realtime(){RealtimeSim.mount()}
function realtimePages() {
  const realtime = data.realtime(RealtimeSim.minutes);
  const rows = group('page', 'views', realtime).map(row => [data.pageNames[row.label], fmt(row.views), fmt(row.users)]);
  main.innerHTML = head('Realtime pages', 'Last '+RealtimeSim.minutes+' minutes') +
    '<div class="content"><div class="kpi-grid"><div class="kpi"><small>Views</small><strong>'+fmt(realtime.views)+
    '</strong></div><div class="kpi"><small>Active users</small><strong>'+fmt(realtime.users)+
    '</strong></div><div class="kpi" style="grid-column:span 2"><small>Active users per minute</small>'+
    minuteBars(realtime.minuteUsers)+'</div></div><div style="margin-top:14px">'+
    table(['Views','Active users'],rows,'Page path and screen class')+'</div></div>';
  bind();
  clearInterval(RealtimeSim.timer);
  let minute = Math.floor(Date.now()/60000);
  RealtimeSim.timer = setInterval(() => {
    if (!document.hidden && Math.floor(Date.now()/60000) !== minute && !main.contains(document.activeElement)
      && !document.querySelector('.report-menu')) realtimePages();
  }, 5000);
}
function objective(title,type){const isLead=type==='lead';main.innerHTML=head(title)+'<div class="content"><div class="objective-head">WHAT ARE YOUR TOP RESULTS?</div><div class="grid"><div class="card" style="grid-column:span 6"><h3>Sessions by Session primary channel group</h3>'+bars(channels)+'</div><div class="card" style="grid-column:span 6"><h3>'+(isLead?'Lead events':'Purchase activity')+'</h3>'+(isLead?'<div class="no-data"><div><div class="circle">◇</div><b>No lead key events configured</b><div class="sub">Configure a key event to populate lead performance.</div></div></div>':'<div class="no-data"><div><div class="circle">▣</div><b>No ecommerce purchase data</b><div class="sub">Purchase metrics will appear after ecommerce events are collected.</div></div></div>')+'</div><div class="card" style="grid-column:span 6"><h3>New users by First user primary channel group</h3>'+bars(pairs('firstChannel','newUsers').slice(0,5))+'</div><div class="card" style="grid-column:span 6"><h3>'+(isLead?'Landing pages':'Purchase journey')+'</h3>'+(isLead?bars(pairs('page','landing').slice(0,5)):'<div class="funnel"><div class="funnel-step" style="height:100%">Session start</div><div class="funnel-step" style="height:64%">View item</div><div class="funnel-step" style="height:22%">Add to cart</div><div class="funnel-step" style="height:8%">Purchase</div></div>')+'</div></div></div>';bind()}function behavior(){main.innerHTML=head('Understand web and/or app performance')+'<div class="content"><div class="grid"><div class="card" style="grid-column:span 7"><h3>Views over time</h3>'+historicalTrend('views','Views')+'</div><div class="card" style="grid-column:span 5"><h3>Views by Page title and screen class</h3>'+bars(pages)+'</div><div class="card" style="grid-column:span 6"><h3>Event count by Event name</h3>'+bars(events.slice(0,6).map(r=>[r[0],r[1]]))+'</div><div class="card" style="grid-column:span 6"><h3>User activity over time</h3>'+historicalTrend('users')+'</div></div></div>';bind()}function engagement(){main.innerHTML=head('Engagement overview')+'<div class="content"><div class="grid"><div class="card" style="grid-column:span 7"><h3>Average engagement time per active user</h3><div class="metric-sm">'+data.time(data.ratio(report.seconds,report.users))+'</div>'+historicalTrend('avgEngagement','Engagement time')+'</div><div class="card" style="grid-column:span 5"><h3>Views by Page title</h3>'+bars(pages.slice(0,6))+'</div><div class="card" style="grid-column:span 6"><h3>Event count by Event name</h3>'+bars(events.slice(0,6).map(r=>[r[0],r[1]]))+'</div><div class="card" style="grid-column:span 6"><h3>Active users by Country</h3>'+bars(countries.slice(0,6))+'</div></div></div>';bind()}function eventsPage(){const rows=events.map(r=>['<a class="event-link" href="#event-'+encodeURIComponent(r[0])+'" data-event-name="'+r[0]+'">'+r[0]+'</a>',fmt(r[1]),fmt(r[2]),data.ratio(r[1],r[2]).toFixed(2),'KES 0.00']);main.innerHTML=head('Events: Event name')+'<div class="content"><div class="card" style="margin-bottom:14px"><h3>Event count by Event name over time</h3>'+historicalTrend('count','Event count')+'</div>'+table(['Event count','Total users','Event count per user','Total revenue'],rows,'Event name')+'</div>';bind()}function pagesPage(){const rows=group('page','views').map(r=>[data.pageNames[r.label],fmt(r.views),fmt(r.users),data.ratio(r.views,r.users).toFixed(2),data.time(data.ratio(r.seconds,r.users))]);main.innerHTML=head('Pages and screens: Page title and screen class')+'<div class="content"><div class="grid" style="margin-bottom:14px"><div class="card" style="grid-column:span 8"><h3>Views by Page title and screen class over time</h3>'+historicalTrend('views','Views')+'</div><div class="card" style="grid-column:span 4"><h3>Views by Page title</h3>'+bars(pages)+'</div></div>'+table(['Views','Active users','Views per active user','Average engagement time'],rows,'Page title and screen class')+'</div>';bind()}
function importPage(){
  const TYPES={
    'CSV':{desc:'Upload a .csv or .tsv file',fields:[['name','Data source name','Nicoo campaign costs'],['file','Campaign file','file'],['schedule','Import schedule','select:Manual|Daily|Weekly']]},
    'Google Sheets':{desc:'Connect a Google Sheets campaign table',fields:[['name','Data source name','Campaign sheet'],['sheetUrl','Google Sheets URL','https://docs.google.com/spreadsheets/...'],['range','Sheet / range','Campaigns!A:I'],['schedule','Import schedule','select:Daily|Weekly|Manual']]},
    'BigQuery':{desc:'Read campaign data from a BigQuery table',fields:[['name','Data source name','Campaign BigQuery'],['project','Project ID','my-project'],['dataset','Dataset','marketing'],['table','Table','campaign_costs'],['schedule','Import schedule','select:Daily|Weekly|Manual']]},
    'Amazon S3':{desc:'Import a CSV/TSV object from Amazon S3',fields:[['name','Data source name','Campaign S3'],['bucket','Bucket','my-campaign-data'],['object','Object path','imports/campaigns.csv'],['region','AWS region','eu-west-1'],['access','Access key ID','AKIA...'],['schedule','Import schedule','select:Daily|Weekly|Manual']]},
    'PostgreSQL':{desc:'Read campaign data from a PostgreSQL table',fields:[['name','Data source name','Campaign PostgreSQL'],['host','Host','db.example.com'],['port','Port','5432'],['database','Database','analytics'],['table','Schema.table','public.campaign_costs'],['username','Username','analytics_reader'],['password','Password','password'],['schedule','Import schedule','select:Daily|Weekly|Manual']]},
    'SFTP':{desc:'Import a CSV/TSV file over SFTP',fields:[['name','Data source name','Campaign SFTP'],['host','Host','sftp.example.com'],['port','Port','22'],['username','Username','analytics'],['password','Password','password'],['path','File path','/exports/campaigns.csv'],['schedule','Import schedule','select:Daily|Weekly|Manual']]}
  };
  const sourceKey='gaCampaignSourcesV2',historyKey='gaCampaignImportHistoryV2';
  const read=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const when=()=>new Date().toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const baseHeaders=['utm_id','utm_campaign','utm_source','utm_medium','date','impressions','clicks','cost','currency'];
  const validateHeaders=(headers)=>{
    const h=headers.map(x=>String(x).trim().toLowerCase());
    const errors=[],warnings=[];
    ['utm_source','utm_medium','date'].forEach(x=>{if(!h.includes(x))errors.push('Missing required field: '+x)});
    if(!['impressions','clicks','cost'].some(x=>h.includes(x)))errors.push('Include at least one metric: impressions, clicks, or cost');
    if(h.includes('cost')&&!h.includes('currency'))warnings.push('Cost is present without a currency column. A static currency will be required.');
    if(!h.includes('utm_id'))warnings.push('utm_id is recommended for more reliable campaign matching.');
    if(!h.includes('utm_campaign'))warnings.push('utm_campaign is recommended for readable campaign names.');
    return {errors,warnings};
  };

  function historyHtml(history){
    if(!history.length)return '<div class="empty"><div><div class="empty-icon">▤</div><b>No import history</b><div class="sub">Validation runs will appear here.</div></div></div>';
    return '<table class="ga-table"><thead><tr><th>Run</th><th>Data source</th><th>Source</th><th>Rows</th><th>Errors</th><th>Status</th></tr></thead><tbody>'+
      history.slice(0,12).map(h=>'<tr><td>'+esc(h.time)+'</td><td>'+esc(h.sourceName)+'</td><td>'+esc(h.type)+'</td><td>'+esc(h.rows)+'</td><td>'+esc(h.errors)+'</td><td><span class="history-status '+(h.status==='Success'?'ok':h.status==='Running'?'running':'bad')+'">'+(h.status==='Success'?'●':'●')+' '+esc(h.status)+'</span></td></tr>').join('')+
      '</tbody></table>';
  }

  function render(){
    const sources=read(sourceKey),history=read(historyKey),latest=sources[0];
    const counts=Object.fromEntries(Object.keys(TYPES).map(t=>[t,sources.filter(s=>s.type===t).length]));
    const sourceCards=Object.entries(TYPES).map(([type,m])=>
      '<button class="source-pill" data-source="'+esc(type)+'"><b>'+esc(type)+'</b><small>'+esc(m.desc)+(counts[type]?' · '+counts[type]+' connected':'')+'</small></button>'
    ).join('');
    const status=latest
      ? '<div class="import-status"><div class="status-orb">✓</div><div class="status-copy"><b>'+esc(latest.name)+'</b><div class="status-meta">'+esc(latest.type)+' · '+esc(latest.schedule||'Manual')+'<br>Last validated '+esc(latest.lastValidated)+'</div><span class="status">✓ Ready for import</span></div></div>'+
        '<div class="source-summary"><div><strong>Campaign schema</strong><small>'+latest.headers.length+' mapped fields · '+(latest.rows||0)+' sampled rows</small></div><span class="source-badge">'+esc(latest.type)+'</span></div>'+
        '<div class="import-actions"><button class="primary" data-run="'+latest.id+'">Run validation</button><button class="btn-secondary" data-edit="'+latest.id+'">Edit</button><button class="btn-danger" data-delete="'+latest.id+'">Delete</button></div>'
      : '<div class="empty"><div><div class="empty-icon">⇧</div><b>No campaign data imports configured</b><div class="sub">Create a data source to validate campaign fields before importing.</div><button class="empty-action" data-create style="margin-top:14px">Create data source</button></div></div>';
    main.innerHTML=head('Campaign data import validation')+
      '<div class="content"><div class="import-panel"><div class="card"><h3>Campaign data sources</h3><div class="sub">Connect an import source to validate campaign data before it is joined with Analytics.</div><div class="source-list" style="margin-top:16px">'+sourceCards+'</div></div>'+
      '<div class="card"><h3>Validation status</h3>'+status+'</div></div>'+
      '<div class="ga-table-wrap" style="margin-top:14px"><div class="table-tools"><b>Import history</b><span class="right">Recent runs · '+history.length+' runs</span></div>'+historyHtml(history)+'</div></div>';
    bind();
    main.querySelector('[data-create]')?.addEventListener('click',()=>openWizard());
    main.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',()=>openWizard(b.dataset.source)));
    main.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openWizard('',b.dataset.edit)));
    main.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{
      const list=read(sourceKey),s=list.find(x=>x.id===b.dataset.delete);
      if(!s)return;
      if(confirm('Delete '+s.name+'?')){write(sourceKey,list.filter(x=>x.id!==s.id));GAToast('Data source deleted');render()}
    }));
    main.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>runValidation(b.dataset.run)));
  }

  function fieldsFor(type,values={}){
    return TYPES[type].fields.map(([key,label,kind])=>{
      if(kind==='file')return '<div class="field full"><label>'+label+'</label><input type="file" data-field="'+key+'" accept=".csv,.tsv,text/csv,text/tab-separated-values"><small class="muted" data-file-note>'+(values.fileName?esc(values.fileName):'CSV or TSV with a header row')+'</small></div>';
      if(kind.startsWith('select:')){
        const opts=kind.slice(7).split('|');
        return '<div class="field"><label>'+label+'</label><select data-field="'+key+'">'+opts.map(o=>'<option '+((values[key]||'')===o?'selected':'')+'>'+o+'</option>').join('')+'</select></div>';
      }
      const pass=key==='password'?'password':'text';
      return '<div class="field '+(['sheetUrl','object','table','path'].includes(key)?'full':'')+'"><label>'+label+'</label><input type="'+pass+'" data-field="'+key+'" value="'+esc(values[key]||'')+'" placeholder="'+esc(kind)+'"></div>';
    }).join('');
  }

  function openWizard(preselected='',editId=''){
    const sources=read(sourceKey),editing=sources.find(x=>x.id===editId);
    const st={step:1,type:preselected||editing?.type||'',values:{...(editing?.config||{}),name:editing?.name||''},headers:editing?.headers?.slice()||[],rows:editing?.rows||0,fileName:editing?.config?.fileName||'',editId};
    const back=document.createElement('div');back.className='import-modal-backdrop';document.body.appendChild(back);
    const close=()=>back.remove();

    function collect(){
      back.querySelectorAll('[data-field]').forEach(el=>{
        if(el.type==='file')return;
        st.values[el.dataset.field]=el.value.trim();
      });
    }
    function body(){
      if(st.step===1)return '<h3 style="margin:0 0 6px">Choose an import source</h3><div class="sub" style="margin-bottom:14px">Campaign data import can connect to a file, sheet, warehouse, database, or secure file server.</div><div class="import-source-grid">'+Object.entries(TYPES).map(([t,m])=>'<button class="import-source-choice '+(st.type===t?'selected':'')+'" data-choice="'+esc(t)+'">'+esc(t)+'<small>'+esc(m.desc)+'</small></button>').join('')+'</div>';
      if(st.step===2)return '<h3 style="margin:0 0 6px">Configure '+esc(st.type)+'</h3><div class="sub" style="margin-bottom:14px">Enter the connection details Analytics would use to read your campaign data.</div><div class="field-grid">'+fieldsFor(st.type,{...st.values,fileName:st.fileName})+'</div>';
      const check=validateHeaders(st.headers.length?st.headers:baseHeaders);
      const rows=(st.headers.length?st.headers:baseHeaders).map(h=>'<div class="schema-row"><span>'+esc(h)+'</span><span>'+esc(h)+'</span><span class="'+(check.errors.some(e=>e.includes(h))?'schema-warn':'schema-ok')+'">'+(check.errors.some(e=>e.includes(h))?'Check':'Mapped')+'</span></div>').join('');
      return '<h3 style="margin:0 0 6px">Review field mapping</h3><div class="sub">Campaign source, medium and date are required. At least one campaign metric must be included.</div><div class="schema-box"><div class="schema-row head"><span>Source field</span><span>Analytics field</span><span>Status</span></div>'+rows+'</div>'+
        (check.errors.length?'<div style="margin-top:12px;color:#d93025;font-size:12px"><b>Fix before saving:</b><br>'+check.errors.map(esc).join('<br>')+'</div>':'')+
        (check.warnings.length?'<div style="margin-top:10px;color:#b06000;font-size:12px"><b>Recommendations:</b><br>'+check.warnings.map(esc).join('<br>')+'</div>':'');
    }
    function draw(){
      back.innerHTML='<div class="import-modal"><div class="import-modal-head"><h2>'+(st.editId?'Edit':'Create')+' campaign data source</h2><button class="import-modal-close">×</button></div><div class="import-steps"><i class="import-step on"></i><i class="import-step '+(st.step>=2?'on':'')+'"></i><i class="import-step '+(st.step>=3?'on':'')+'"></i></div><div class="import-modal-body">'+body()+'</div><div class="import-modal-foot">'+(st.step>1?'<button class="btn-secondary" data-back>Back</button>':'')+'<button class="btn-secondary" data-cancel>Cancel</button><button class="primary" data-next>'+(st.step===3?'Validate & save':'Next')+'</button></div></div>';
      back.querySelector('.import-modal-close').onclick=close;back.querySelector('[data-cancel]').onclick=close;
      back.querySelector('[data-back]')?.addEventListener('click',()=>{collect();st.step--;draw()});
      back.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{st.type=b.dataset.choice;draw()}));
      const file=back.querySelector('[data-field="file"]');
      if(file)file.addEventListener('change',()=>{
        const picked=file.files?.[0];if(!picked)return;
        st.fileName=picked.name;st.values.fileName=picked.name;
        const reader=new FileReader();
        reader.onload=()=>{
          const text=String(reader.result||'');
          const first=(text.split(/\r?\n/)[0]||'').trim();
          const sep=first.includes('\t')?'\t':',';
          st.headers=first.split(sep).map(x=>x.trim().replace(/^"|"$/g,'')).filter(Boolean);
          st.rows=Math.max(0,text.split(/\r?\n/).filter(Boolean).length-1);
          const note=back.querySelector('[data-file-note]');if(note)note.textContent=picked.name+' · '+st.rows+' data rows';
        };
        reader.readAsText(picked);
      });
      back.querySelector('[data-next]').onclick=()=>{
        collect();
        if(st.step===1){if(!st.type){GAToast('Choose a data source');return}st.step=2;draw();return}
        if(st.step===2){
          if(!st.values.name){GAToast('Enter a data source name');return}
          if(st.type==='CSV'&&!st.fileName&&!st.editId){GAToast('Choose a CSV or TSV file');return}
          const required={ 'Google Sheets':['sheetUrl','range'],'BigQuery':['project','dataset','table'],'Amazon S3':['bucket','object','region'],'PostgreSQL':['host','database','table','username'],'SFTP':['host','username','path'] }[st.type]||[];
          if(required.some(k=>!st.values[k])){GAToast('Complete the required connection fields');return}
          if(!st.headers.length)st.headers=baseHeaders.slice();
          st.step=3;draw();return;
        }
        const check=validateHeaders(st.headers);
        if(check.errors.length){GAToast('Schema has '+check.errors.length+' blocking issue'+(check.errors.length>1?'s':''));return}
        validateAndSave();
      };
    }
    function validateAndSave(){
      const modal=back.querySelector('.import-modal-body');
      const foot=back.querySelector('.import-modal-foot');
      foot.innerHTML='<button class="btn-secondary" disabled>Validating…</button>';
      const steps=['Connecting to '+st.type,'Reading column headers','Validating campaign schema','Checking campaign keys'];
      modal.innerHTML='<h3 style="margin:0">Validating data source</h3><div class="validation-log">'+steps.map((s,i)=>'<div data-v="'+i+'"><i class="'+(i===0?'spin':'')+'">'+(i===0?'↻':'')+'</i><span>'+esc(s)+'</span></div>').join('')+'</div>';
      let i=0;
      const tick=()=>{
        const row=modal.querySelector('[data-v="'+i+'"]');if(row){row.querySelector('i').className='';row.querySelector('i').textContent='✓'}
        i++;
        if(i<steps.length){const n=modal.querySelector('[data-v="'+i+'"] i');n.className='spin';n.textContent='↻';setTimeout(tick,360);return}
        setTimeout(()=>{
          const list=read(sourceKey),old=list.find(x=>x.id===st.editId);
          const item={id:old?.id||uid(),type:st.type,name:st.values.name,config:{...st.values,fileName:st.fileName},schedule:st.values.schedule||'Manual',status:'Ready',headers:st.headers,lastValidated:when(),rows:st.rows||old?.rows||24};
          const next=[item,...list.filter(x=>x.id!==item.id)];write(sourceKey,next);
          const hist=read(historyKey);hist.unshift({id:uid(),sourceId:item.id,sourceName:item.name,type:item.type,time:item.lastValidated,status:'Success',rows:item.rows,errors:0});write(historyKey,hist.slice(0,50));
          close();GAToast('Data source validated and saved');render();
        },420);
      };
      setTimeout(tick,360);
    }
    draw();
  }

  function runValidation(id){
    const list=read(sourceKey),s=list.find(x=>x.id===id);if(!s)return;
    window.GAProgress?.start();GAToast('Validating '+s.name+'…');
    setTimeout(()=>{
      s.lastValidated=when();write(sourceKey,[s,...list.filter(x=>x.id!==id)]);
      const hist=read(historyKey);hist.unshift({id:uid(),sourceId:s.id,sourceName:s.name,type:s.type,time:s.lastValidated,status:'Success',rows:s.rows||24,errors:0});write(historyKey,hist.slice(0,50));
      window.GAProgress?.done();GAToast('Validation successful');render();
    },900);
  }

  render();
}
function userOverview(){const realtime=data.realtime(30);main.innerHTML=head('User attributes overview')+'<div class="content"><div class="grid"><div class="card" style="grid-column:span 6"><h3>Active users by Country</h3>'+bars(countries)+'</div><div class="card" style="grid-column:span 6"><h3>Active users in last 30 minutes</h3><div class="metric">'+fmt(realtime.users)+'</div>'+minuteBars(realtime.minuteUsers)+'</div><div class="card" style="grid-column:span 4"><h3>Active users by City</h3>'+bars(pairs('city','users').slice(0,5))+'</div><div class="card" style="grid-column:span 4"><h3>Active users by Age</h3>'+bars(pairs('age','users'))+'</div><div class="card" style="grid-column:span 4"><h3>Active users by Language</h3>'+bars(pairs('language','users'))+'</div></div></div>';bind()}
function audiences(){
  const COLORS={primary:'#4292c6',compare:'#e37400',green:'#69b34c'};
  const metricMeta = { 'Users':'users', 'New Users':'newUsers', 'Sessions':'sessions', 'Pageviews':'views' };
  const grain = { Hourly:'hour', Day:'day', Week:'week', Month:'month' };
  const breakdowns = { Language:'language', Country:'country', City:'city', Browser:'browser',
    'Operating System':'system', 'Service Provider':'provider' };
  const dims = Object.fromEntries(Object.entries(breakdowns).map(([title, name]) => [
    title, group(name, 'users').map(row => [row.label, row.users, data.ratio(row.users, report.users)*100]),
  ]));
  const newShare = data.ratio(report.newUsers, report.users);
  const kpis = [
    ['Users',fmt(report.users)], ['New Users',fmt(report.newUsers)], ['Sessions',fmt(report.sessions)],
    ['Sessions / User',data.ratio(report.sessions,report.users).toFixed(2)], ['Pageviews',fmt(report.views)],
    ['Pages / Session',data.ratio(report.views,report.sessions).toFixed(2)],
    ['Avg. Session Duration',data.time(data.ratio(report.seconds,report.sessions))],
    ['Bounce Rate',data.percent(data.ratio(report.sessions-report.engaged,report.sessions))],
  ];
  let state={
    metric:localStorage.getItem('audMetric')||'Users',
    compare:localStorage.getItem('audCompare')||'',
    period:localStorage.getItem('audPeriod')||'Day',
    dim:localStorage.getItem('audDim')||'Language',
    sort:'users',dir:-1
  };
  const series = new Map();
  function metricSeries(metric, period) {
    const key = (metricMeta[metric] || 'users') + ':' + (grain[period] || 'day');
    if (!series.has(key)) series.set(key, data.series(range, metricMeta[metric] || 'users', grain[period] || 'day',
      range.compare && !state.compare ? data.previous(range) : null));
    return series.get(key);
  }
  function chartData() {
    const points = metricSeries(state.metric, state.period);
    const cmp = state.compare ? metricSeries(state.compare, state.period).map(p=>p.value) :
      range.compare ? points.map(p=>p.previous) : null;
    return { vals:points.map(p=>p.value), cmp, labels:points.map(p=>p.label) };
  }
  const spark=(seed=1)=>{
    const metric=metricMeta[kpis[seed-1][0]];
    if(!metric)return '';
    const vals=metricSeries(kpis[seed-1][0], 'Week').map(p=>p.value);
    const max=Math.max(...vals),min=Math.min(...vals);
    const pts=vals.map((v,i)=>(i*110/Math.max(1,vals.length-1))+','+(24-(v-min)/(max-min||1)*18)).join(' ');
    return '<svg class="aud-spark" viewBox="0 0 110 28" preserveAspectRatio="none"><polygon points="0,28 '+pts+' 110,28" fill="#e7f2f8"/><polyline points="'+pts+'" fill="none" stroke="#4292c6" stroke-width="1.4"/></svg>';
  };
  const chartSvg=()=>{
    const {vals,cmp,labels:dates}=chartData();
    const all=cmp?vals.concat(cmp):vals,max=Math.max(1,...all)*1.12,min=0,w=1000,h=205,pl=42,pr=12,pt=10,pb=28;
    const x=i=>vals.length===1?w-pr:pl+(w-pl-pr)*(i/(vals.length-1));
    const y=v=>pt+(h-pt-pb)*(1-v/max);
    const path=a=>a.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
    const area=path(vals)+' L'+x(vals.length-1).toFixed(1)+' '+(h-pb)+' L'+x(0).toFixed(1)+' '+(h-pb)+' Z';
    const grid=Array.from({length:4},(_,i)=>{const yy=pt+(h-pt-pb)*(i/3);const val=max*(1-i/3);return '<path d="M'+pl+' '+yy+'H'+(w-pr)+'" stroke="#e6e6e6"/><text x="'+(pl+2)+'" y="'+(yy-4)+'" font-size="10" fill="#666">'+fmt(val)+'</text>'}).join('');
    const ticks=new Set(Array.from({length:Math.min(8,dates.length)},(_,i)=>Math.round(i*(dates.length-1)/Math.max(1,Math.min(8,dates.length)-1))));
    const labels=dates.map((l,i)=>!ticks.has(i)?'':'<text x="'+x(i)+'" y="'+(h-8)+'" text-anchor="middle" font-size="10" fill="#666">'+l+'</text>').join('');
    const dots=vals.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.3" fill="'+COLORS.primary+'" data-aud-point="'+i+'"/>').join('');
    const cmpPath=cmp?'<path d="'+path(cmp)+'" fill="none" stroke="'+COLORS.compare+'" stroke-width="2" vector-effect="non-scaling-stroke"/>':'';
    return '<svg class="aud-main-chart" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+grid+'<path d="'+area+'" fill="#e7f2f8"/><path d="'+path(vals)+'" fill="none" stroke="'+COLORS.primary+'" stroke-width="2.6" vector-effect="non-scaling-stroke"/>'+cmpPath+dots+labels+'</svg>';
  };
  const renderTable=()=>{
    const rows=(dims[state.dim]||[]).slice();
    rows.sort((a,b)=>state.dir*((state.sort==='pct'?a[2]-b[2]:a[1]-b[1])));
    const q=(document.querySelector('.aud-table-search')?.value||'').toLowerCase();
    const filtered=rows.filter(r=>r[0].toLowerCase().includes(q));
    const body=document.querySelector('[data-aud-table-body]');if(!body)return;
    body.innerHTML=filtered.map((r,i)=>'<tr><td><span class="aud-rank">'+(i+1)+'.</span><span class="aud-dim-link">'+r[0]+'</span></td><td>'+fmt(r[1])+'</td><td><div class="aud-percent"><div class="aud-percent-bar" style="width:'+Math.max(2,r[2]*1.55)+'px"></div><span>'+r[2].toFixed(2)+'%</span></div></td></tr>').join('');
    const title=document.querySelector('[data-aud-table-title]');if(title)title.textContent=state.dim;
    const firstHead=document.querySelector('.aud-table thead th:first-child');if(firstHead)firstHead.textContent=state.dim;
  };
  const cmpLabel=()=>state.compare||(range.compare?'Previous period':'');
  const renderChart=()=>{
    const host=document.querySelector('[data-aud-chart]');if(!host)return;
    host.innerHTML='<div class="aud-legend" data-aud-legend></div>'+chartSvg()+'<div class="aud-chart-cursor"></div><div class="aud-chart-tooltip"></div><div class="aud-chart-hit"></div>';
    host.querySelector('[data-aud-legend]').innerHTML='<i></i><span>'+state.metric+'</span>'+(cmpLabel()?'<span class="aud-compare-chip">vs. '+cmpLabel()+'</span>':'');
    const hit=host.querySelector('.aud-chart-hit'),tip=host.querySelector('.aud-chart-tooltip'),cur=host.querySelector('.aud-chart-cursor');
    const {vals,cmp,labels}=chartData();
    hit.onmousemove=e=>{
      const r=hit.getBoundingClientRect(),p=Math.max(0,Math.min(.999,(e.clientX-r.left)/r.width)),i=Math.min(vals.length-1,Math.round(p*(vals.length-1)));
      cur.style.left=(e.clientX-r.left)+'px';cur.style.display='block';
      tip.style.left=Math.min(r.width-160,e.clientX-r.left+10)+'px';tip.style.top=Math.max(36,e.clientY-r.top)+'px';
      tip.innerHTML='<b>'+labels[i]+'</b><br>'+state.metric+': '+fmt(vals[i])+(cmp?'<br>'+cmpLabel()+': '+fmt(cmp[i]):'');tip.style.display='block';
    };
    hit.onmouseleave=()=>{tip.style.display='none';cur.style.display='none'};
  };
  const applyMetric=metric=>{
    state.metric=metric;localStorage.setItem('audMetric',metric);
    document.querySelector('.aud-select[data-metric]').value=metric;
    document.querySelectorAll('.aud-kpi').forEach(b=>b.classList.toggle('active',b.dataset.metric===metric));
    renderChart();
  };
  main.innerHTML=
    '<div class="aud-page">'+
      '<div class="aud-toolbar">'+
        '<button class="aud-select date-pill" type="button" aria-label="Change date range"><b>'+dateTitle()+'</b><small>Demo data</small></button>'+
        '<select class="aud-select" data-metric><option>Users</option><option>New Users</option><option>Sessions</option><option>Pageviews</option></select>'+
        '<span class="aud-vs">vs.</span>'+
        '<select class="aud-select" data-compare style="border:0;color:#2b78b7;padding-left:4px"><option value="">Select a metric</option><option>Users</option><option>New Users</option><option>Sessions</option><option>Pageviews</option></select>'+
        '<div class="aud-periods">'+['Hourly','Day','Week','Month'].map(p=>'<button data-period="'+p+'" class="'+(state.period===p?'active':'')+'">'+p+'</button>').join('')+'</div>'+
      '</div>'+
      '<div class="aud-chart-wrap" data-aud-chart><div class="aud-legend" data-aud-legend></div></div>'+
      '<div class="aud-mid">'+
        '<div class="aud-kpis">'+kpis.map((k,i)=>'<button class="aud-kpi '+(state.metric===k[0]?'active':'')+'" data-metric="'+k[0]+'"><div class="aud-kpi-label">'+k[0]+'</div><div class="aud-kpi-value">'+k[1]+'</div>'+spark(i+1)+'</button>').join('')+'</div>'+
        '<div class="aud-pie-panel"><div class="aud-pie-legend"><button data-visitor="new"><i style="background:#4292c6"></i>New Visitor</button><button data-visitor="return"><i style="background:#69b34c"></i>Returning Visitor</button></div><div class="aud-pie" style="background:conic-gradient(#4292c6 0 '+data.percent(newShare)+',#69b34c '+data.percent(newShare)+' 100%)"><span class="aud-pie-label new">'+data.percent(newShare)+'</span><span class="aud-pie-label return">'+data.percent(1-newShare)+'</span></div></div>'+
      '</div>'+
      '<div class="aud-bottom">'+
        '<div>'+
          '<div class="aud-dim-title">Demographics</div>'+
          '<div class="aud-dim-grid">'+['Language','Country','City'].map(d=>'<button class="aud-dim-button '+(state.dim===d?'active':'')+'" data-dim="'+d+'">'+d+'</button>').join('')+'</div>'+
          '<div class="aud-dim-title aud-system-title">System</div>'+
          '<div class="aud-dim-grid">'+['Browser','Operating System','Service Provider'].map(d=>'<button class="aud-dim-button '+(state.dim===d?'active':'')+'" data-dim="'+d+'">'+d+'</button>').join('')+'</div>'+
        '</div>'+
        '<div>'+
          '<div class="aud-table-head"><span data-aud-table-title>'+state.dim+'</span><div class="aud-table-controls"><input class="aud-table-search" placeholder="Search"><span>Users</span><span>% Users</span></div></div>'+
          '<table class="aud-table"><thead><tr><th>'+state.dim+'</th><th data-sort="users" style="cursor:pointer">Users</th><th data-sort="pct" style="cursor:pointer">% Users</th></tr></thead><tbody data-aud-table-body></tbody></table>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.querySelector('[data-metric]').value=state.metric;
  document.querySelector('[data-compare]').value=state.compare;
  renderChart();renderTable();bind();
  document.querySelector('[data-metric]').addEventListener('change',e=>applyMetric(e.target.value));
  document.querySelector('[data-compare]').addEventListener('change',e=>{state.compare=e.target.value;localStorage.setItem('audCompare',state.compare);series.clear();renderChart()});
  document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>{
    state.period=b.dataset.period;localStorage.setItem('audPeriod',state.period);
    document.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('active',x===b));renderChart();
  }));
  document.querySelectorAll('.aud-kpi[data-metric]').forEach(b=>b.addEventListener('click',()=>{if(metricMeta[b.dataset.metric])applyMetric(b.dataset.metric);else GAToast(b.dataset.metric+' is a derived metric')}));
  document.querySelectorAll('[data-dim]').forEach(b=>b.addEventListener('click',()=>{
    state.dim=b.dataset.dim;localStorage.setItem('audDim',state.dim);
    document.querySelectorAll('[data-dim]').forEach(x=>x.classList.toggle('active',x===b));renderTable();
  }));
  document.querySelector('.aud-table-search').addEventListener('input',renderTable);
  document.querySelectorAll('[data-sort]').forEach(th=>th.addEventListener('click',()=>{
    const k=th.dataset.sort;if(state.sort===k)state.dir*=-1;else{state.sort=k;state.dir=-1}renderTable();
  }));
  document.querySelectorAll('[data-visitor]').forEach(b=>b.addEventListener('click',()=>GAToast(b.dataset.visitor==='new'?'New visitors: '+data.percent(newShare):'Returning visitors: '+data.percent(1-newShare))));
}
function techOverview(){const devices=['mobile','tablet','desktop'].map(device=>report.groups.device.find(row=>row.label===device)?.users||0);const shares=devices.map(n=>data.ratio(n,report.users));main.innerHTML=head('Tech overview')+'<div class="content"><div class="grid"><div class="card" style="grid-column:span 6"><h3>Active users by Browser</h3>'+bars(pairs('browser','users'))+'</div><div class="card" style="grid-column:span 6"><h3>Active users by Device category</h3><div class="donut-wrap"><div class="donut" style="background:conic-gradient(#1a73e8 0 '+data.percent(shares[0])+',#4054d6 '+data.percent(shares[0])+' '+data.percent(shares[0]+shares[1])+',#7b2fd6 '+data.percent(shares[0]+shares[1])+' 100%)"></div><div class="donut-legend"><span><i class="dot" style="background:#1a73e8"></i>mobile <b>'+data.percent(shares[0])+'</b></span><span><i class="dot" style="background:#4054d6"></i>tablet <b>'+data.percent(shares[1])+'</b></span><span><i class="dot" style="background:#7b2fd6"></i>desktop <b>'+data.percent(shares[2])+'</b></span></div></div><a class="section-link" href="Tech details_ Device category.html">View device categories →</a></div><div class="card" style="grid-column:span 6"><h3>Active users by Screen resolution</h3>'+bars(pairs('resolution','users'))+'</div><div class="card" style="grid-column:span 6"><h3>Active users by App version</h3><div class="no-data"><div><div class="circle">▣</div>No app-version data available</div></div></div></div></div>';bind()}function library(){
  const collectionKey='gaCustomCollectionsV1',reportKey='gaCustomReportsV1';
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const customCollections=read(collectionKey),customReports=read(reportKey);
  const customCollectionCards=customCollections.map(x=>'<div class="library-card"><div class="collection-title"><h3>'+esc(x.name)+'</h3><span class="published">✓ Custom</span></div><div class="collection-items">'+esc(x.description||'Custom collection')+'</div></div>').join('');
  const customReportLines=customReports.length?customReports.map(x=>'<div style="padding:5px 0;border-bottom:1px solid #eee">'+esc(x.name)+' <span class="muted">· '+esc(x.type)+'</span></div>').join(''):'<div class="empty" style="min-height:110px"><div>No custom reports yet</div></div>';
  main.innerHTML=head('Library')+
    '<div class="content"><div class="lib-toolbar"><h2>Collections</h2><button class="primary" data-new-collection>Create new collection</button></div>'+
    '<div class="library-grid"><div class="library-card"><div class="collection-title"><h3>Business objectives</h3><span class="published">✓ Published</span></div><div class="collection-items">Generate leads<br>Drive sales<br>Understand web and/or app performance<br>View user engagement and retention</div></div>'+
    '<div class="library-card"><div class="collection-title"><h3>User</h3><span class="published">✓ Published</span></div><div class="collection-items">User attributes overview<br>Demographic details<br>Audiences<br>Tech overview<br>Tech details</div></div>'+
    '<div class="library-card"><div class="collection-title"><h3>App developer</h3><span class="published">✓ Published</span></div><div class="collection-items">Reports snapshot<br>Realtime overview<br>Realtime pages<br>Events<br>Pages and screens</div></div>'+customCollectionCards+'</div>'+
    '<div class="lib-toolbar" style="margin-top:24px"><h2>Reports</h2><button class="primary" data-new-report>Create new report</button></div>'+
    '<div class="library-grid"><div class="library-card"><h3>Detail reports</h3><div class="collection-items">Events<br>Pages and screens<br>Demographic details<br>Audiences<br>Tech details<br>Traffic acquisition</div></div>'+
    '<div class="library-card"><h3>Overview reports</h3><div class="collection-items">Reports snapshot<br>Realtime overview<br>Engagement overview<br>User attributes overview<br>Tech overview</div></div>'+
    '<div class="library-card"><h3>Custom reports</h3><div class="collection-items">'+customReportLines+'</div></div></div></div>';
  bind();
  document.querySelector('[data-new-collection]').onclick=()=>simpleModal('Create collection','<div class="field-grid"><div class="field full"><label>Collection name</label><input id="libCollectionName" placeholder="e.g. Marketing"></div><div class="field full"><label>Description</label><textarea id="libCollectionDesc" placeholder="What reports belong in this collection?"></textarea></div></div>',[
    {label:'Cancel',action:c=>c()},
    {label:'Create',primary:true,action:(close,bg)=>{const name=bg.querySelector('#libCollectionName').value.trim();if(!name){GAToast('Enter a collection name');return}const arr=read(collectionKey);arr.push({id:Date.now(),name,description:bg.querySelector('#libCollectionDesc').value.trim()});save(collectionKey,arr);close();GAToast('Collection created');library()}}
  ]);
  document.querySelector('[data-new-report]').onclick=()=>simpleModal('Create report','<div class="field-grid"><div class="field full"><label>Report name</label><input id="libReportName" placeholder="e.g. Campaign performance"></div><div class="field"><label>Report type</label><select id="libReportType"><option>Detail report</option><option>Overview report</option></select></div></div>',[
    {label:'Cancel',action:c=>c()},
    {label:'Create',primary:true,action:(close,bg)=>{const name=bg.querySelector('#libReportName').value.trim();if(!name){GAToast('Enter a report name');return}const arr=read(reportKey);arr.push({id:Date.now(),name,type:bg.querySelector('#libReportType').value});save(reportKey,arr);close();GAToast('Report created');library()}}
  ]);
}
const renderers = {
  realtime, realtimePages, leads:()=>objective('Generate leads','lead'), sales:()=>objective('Drive sales','sales'),
  behavior, engagement, events:eventsPage, pages:pagesPage, import:importPage, userOverview,
  audiences, techOverview, library,
};
const live = key === 'realtime' || key === 'realtimePages';
RealtimeSim.load();
if (!management && !live) loadReport();
renderers[key]?.();
if (!management && !live) {
  const syncRange = () => {
    const next = data.selectedRange();
    if (next.start === range.start && next.end === range.end && next.compare === range.compare && next.days === range.days) return;
    range = next;
    loadReport();
    renderers[key]();
  };
  addEventListener('pageshow', syncRange);
  addEventListener('storage', syncRange);
}
})();
