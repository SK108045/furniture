(() => {
  const data = window.NicooReportData;
  const { number, percent, ratio, time } = data;
  const metricKeys = { 'Total users': 'users', 'New users': 'newUsers', 'Engaged sessions': 'engaged', 'Average engagement time': 'avgEngagement' };
  const underlines = { 'Total users': [292,116], 'New users': [458,116], 'Engaged sessions': [610,132], 'Average engagement time': [790,190] };
  const devices = ['mobile', 'tablet', 'desktop'];
  const chartChannels = ['Organic Search', 'Direct', 'Organic Social', 'Referral', 'Paid Search', 'Email'];
  const trafficY = [653,686,719,751,784,817];
  let canvas, ui, layout, makeBox, page, range, report, previousReport;
  let selectedMetric = 'Engaged sessions';
  let chartScale = { min: 0, max: 1 };
  let trafficPage = 0;
  let query = '';
  const nodes = new Map();

  function at(x, y, cls = 't') { return nodes.get([cls, x, y].join(':')); }
  function write(x, y, value, field = '') {
    const el = at(x,y);
    if (!el) return;
    el.textContent = value;
    if (field) el.dataset.reportField = field;
  }
  function width(x, y, value, originalWidth) {
    const el = at(x,y,'b');
    if (!el) return;
    const base = Number(el.dataset.reportWidth) || parseFloat(el.style.width) / originalWidth;
    el.dataset.reportWidth = base;
    el.style.width = (base * value * originalWidth) + 'px';
  }
  function bars(x, y, value, maxValue, limit) {
    const el = at(x,y,'b');
    if (el) el.style.width = Math.min(limit, limit * ratio(value,maxValue)) * layout.point(x,y).scale + 'px';
  }
  function ranked(dimension, metric) { return data.ranked(report.groups[dimension],metric); }
  function changed(value, before) {
    if (!before || !range.compare) return '—';
    const change = (value-before)/before;
    return (change < 0 ? '↓ ' : change > 0 ? '↑ ' : '') + percent(change);
  }
  function formatChart(value) { return selectedMetric === 'Average engagement time' && page === 'snapshot' ? time(value) : number(value); }
  function keyForRange() { return range.days ? 'Last '+range.days+' days' : 'Custom'; }
  function formatDateRange() { return data.rangeLabel(range); }
  function exportReport(headers, rows, name) {
    ui.setExport([...headers, 'Date range', 'Data source'], rows.map(row => [...row,formatDateRange(),'Demo data']), name);
  }
  function ticks(positions, labels, count, x0, x1) {
    const total = Math.min(count, labels.length);
    positions.forEach(([x,y],i) => {
      const el = at(x,y);
      if (!el) return;
      const index = total === 1 ? labels.length - 1 : Math.round(i*(labels.length-1)/Math.max(1,total-1));
      el.style.display = i < total ? '' : 'none';
      if (i >= total) return;
      el.textContent = labels[index];
      el.dataset.reportTick = String(index);
      const rawX = total === 1 ? x1 : x0+(x1-x0)*index/Math.max(1,labels.length-1);
      el.style.left = layout.point(rawX,y).x + 'px';
    });
  }
  function chart(series, axes, tickNodes, graph) {
    const [x0,x1,yTop,yBottom,tickCount] = graph;
    const max = Math.max(1,...series.flatMap(points=>points?.map(p=>p.value)||[]));
    const unit = Math.pow(10,Math.floor(Math.log10(max/Math.max(1,axes.length-1))));
    const step = Math.max(1,Math.ceil(max/Math.max(1,axes.length-1)/unit)*unit);
    chartScale = { min:0,max:step*(axes.length-1) };
    const paths = [...canvas.querySelectorAll('svg path[data-chart-series]')];
    paths.forEach((path,i) => {
      const points = series[i];
      path.style.display = points ? '' : 'none';
      if (points) {
        const coords = points.map((p,j)=>{
          const x = points.length===1 ? x1 : x0+(x1-x0)*j/(points.length-1);
          const y = yBottom-(yBottom-yTop)*p.value/chartScale.max;
          return [x.toFixed(1),y.toFixed(1)];
        });
        path.setAttribute('d',coords.length===1 ? 'M'+coords[0].join(' ')+'h0.1' :
          coords.map((p,i)=>(i?'L':'M')+p.join(' ')).join(''));
      }
    });
    axes.forEach(([x,y],i)=>write(x,y,formatChart(step*(axes.length-1-i))));
    const points = series.find(Boolean);
    ticks(tickNodes,points.map(p=>p.label),tickCount,x0,x1);
  }
  function snapshotChart() {
    const points = data.series(range,metricKeys[selectedMetric],'day',range.compare ? data.previous(range) : null);
    const preceding = range.compare ? points.map(p=>({label:p.label,value:p.previous})) : null;
    chart([preceding,points],[[1008,360],[1008,406],[1008,457],[1008,492]],
      [300,368,446,526,599,677,758,840,916,987].map(x=>[x,512]),[298,988,360,492,10]);
    const [x,w] = underlines[selectedMetric];
    const underline = at(632,227,'b');
    if (underline) {
      underline.style.left = layout.point(x,227).x+'px';
      underline.style.width = w+'px';
    }
    const compareLegend = at(428,545);
    if (compareLegend) compareLegend.style.visibility = range.compare ? '' : 'hidden';
  }
  function snapshot() {
    const activeValues = [report.users,report.newUsers,report.engaged,ratio(report.seconds,report.users)];
    const previousValues = [previousReport.users,previousReport.newUsers,previousReport.engaged,ratio(previousReport.seconds,previousReport.users)];
    const labels = Object.keys(metricKeys);
    const metrics = [298,465,615,795].map((x,i)=>{
      const value = i===3 ? time(activeValues[i]) : number(activeValues[i]);
      const change = changed(activeValues[i],previousValues[i]);
      write(x,284,value,metricKeys[labels[i]]);
      write(x,315,change);
      const changeNode=at(x,315);
      if (changeNode) changeNode.style.color=change.startsWith('↓')?'#b3261e':'#188038';
      return [labels[i],value,change];
    });
    const countries = ranked('country','users').slice(0,7);
    countries.forEach((row,i)=>{
      const y=320+i*27.9;
      write(1355,y,row.label,'country-name');
      write(1557,y+(i===4?3:0),number(row.users),'country-users');
      bars(1355,y+11,row.users,countries[0].users,122);
    });
    const first = ranked('firstChannel','newUsers');
    first.forEach((row,i)=>{
      const y=[672,698,724,750,776,802,829][i];
      write(295,y,row.label);write(694,y,number(row.newUsers));
      bars(404,y-9,row.newUsers,first[0].newUsers,219);
    });
    const channels = ranked('channel','sessions');
    channels.forEach((row,i)=>{
      const y=678+i*26.6;
      const change=changed(row.sessions,previousReport.groups.channel.find(r=>r.label===row.label)?.sessions);
      write(765,y,row.label);write(1045,y,number(row.sessions));write(1138,y,change);
      const changeNode=at(1138,y);
      if(changeNode) changeNode.style.color=change.startsWith('↓')?'#b3261e':'#188038';
    });
    const pages = ranked('page','views');
    pages.forEach((row,i)=>{
      const y=678+i*26.7;
      write(1205,y,data.pageNames[row.label]);
      write(1575,y,number(row.views));
      const fills=[...canvas.querySelectorAll('.b[data-report-x="1450"]')];
      const bar=fills.find(el=>Number(el.dataset.reportY)===y+7);
      if(bar)bar.style.width=78*ratio(row.views,pages[0].views)+'px';
    });
    write(315,545,keyForRange());
    snapshotChart();
    exportReport(['Metric','Value','Change'],metrics,'reports-snapshot');
  }
  function engagementValues(r) {
    return [number(r.users),number(r.newUsers),number(r.engaged),percent(ratio(r.engaged,r.sessions)),
      ratio(r.engaged,r.users).toFixed(2),time(ratio(r.seconds,r.users))];
  }
  const engagementHeaders = ['Users','New users','Engaged sessions','Engagement rate','Engaged sessions per user','Average engagement time'];
  function demographics() {
    const rows=ranked('country','users');
    engagementValues(report).forEach((value,i)=>write([737,891,1043,1177,1330,1485][i],338,value,engagementHeaders[i]));
    rows.forEach((row,i)=>{
      const y=381+i*44.9+22;
      write(402,y,row.label,'country-name');
      engagementValues(row).forEach((value,j)=>write([695,848,999,1177,1330,1482][j],y+(j<3?-2:1),value,j===0?'country-users':''));
    });
    const blankY=381+rows.length*44.9+22;
    [362,402,695,848,999,1177,1330,1482].forEach((x,i)=>write(x,blankY+(i>1?(i<5?-2:1):0),''));
    write(1376,180,'1–'+rows.length+' of '+rows.length);
    exportReport(['Country',...engagementHeaders],rows.map(row=>[row.label,...engagementValues(row)]),'demographic-details-country');
  }
  function device() {
    const rows=ranked('device','users');
    const totalCoords=[[762,720],[889,720],[1043,720],[1161,716],[1299,716],[1440,716]];
    engagementValues(report).forEach((value,i)=>write(...totalCoords[i],value,engagementHeaders[i]));
    rows.forEach((row,i)=>{
      const y=[775,812,849][i];
      write(449,y,row.label);
      engagementValues(row).forEach((value,j)=>write([729,848,1003,1161,1300,1440][j],y+(j<3?-(i===1?3:1):j===3?(i===1?3:1):0),value));
    });
    const max=rows[0]?.users||1;
    const scale=Math.ceil(max/400)*400;
    devices.forEach((name,i)=>{
      const row=report.groups.device.find(r=>r.label===name);
      const y=263+72*i;
      bars(1155,y,row?.users||0,scale,310);
      const val=at([1429,1204,1185][i],y+28);
      if(val) {
        val.textContent=number(row?.users||0);
        val.style.left=layout.point(1155+Math.min(278,310*ratio(row?.users,scale))+8,y).x+'px';
      }
    });
    [1155,1233,1311,1388,1466].forEach((x,i)=>write(x,513,number(scale*i/4)));
    [405,456,685,865].forEach(x=>write(x,507,''));
    chart(devices.map(name=>data.series(range,'users','day',null,'device',name)),
      [[980,242],[980,299],[980,358],[980,420],[980,473]],
      [404,456,503,548,594,639,685,730,775,820,865,911,955].map(x=>[x,494]),[397,973,234,466,8]);
    exportReport(['Device category',...engagementHeaders],rows.map(row=>[row.label,...engagementValues(row)]),'tech-details-device-category');
  }
  function trafficValues(row) {
    return [number(row.users),number(row.sessions),number(row.engaged),time(ratio(row.seconds,row.sessions)),
      ratio(row.engaged,row.users).toFixed(2),ratio(row.count,row.sessions).toFixed(1)];
  }
  function trafficRows() {
    const rows=ranked('channel','users');
    const start=trafficPage*trafficY.length;
    trafficY.forEach((y,i)=>{
      const row=rows[start+i];
      write(427,y,row?start+i+1:'');
      write(464,y,row?.label||'');
      [806,910,1030,1174,1306,1428].forEach((x,j)=>write(x,y,row?trafficValues(row)[j]:''));
    });
    write(1373,469,(start+1)+'–'+Math.min(start+trafficY.length,rows.length)+' of '+rows.length);
    write(1289,466,String(trafficPage+1));
    search(query);
  }
  function traffic() {
    trafficValues(report).forEach((value,i)=>write([806,910,1030,1174,1306,1428][i],601,value,
      ['Users','Sessions','Engaged sessions','Average engagement time per session','Engaged sessions per user','Events per session'][i]));
    trafficRows();
    const channels=ranked('channel','sessions');
    const scale=Math.max(4,Math.ceil(channels[0].sessions/400)*400);
    [149,182,217,251,285,319].forEach((y,i)=>{
      write(1178,y+15,channels[i].label);
      bars(1199,y,channels[i].sessions,scale,253);
    });
    [1199,1262,1326,1389,1452].forEach((x,i)=>write(x,374,number(scale*i/4)));
    write(404,376,'');write(689,377,'');write(943,412,'Email');
    chart(chartChannels.map(name=>data.series(range,'sessions','day',null,'channel',name)),
      [[1016,155],[1016,202],[1016,249],[1016,297],[1016,348]],
      [410,542,689,834,976].map(x=>[x,363]),[402,982,155,348,5]);
    exportReport(['Session default channel group','Users','Sessions','Engaged sessions','Average engagement time per session','Engaged sessions per user','Events per session'],
      ranked('channel','users').map(row=>[row.label,...trafficValues(row)]),'traffic-acquisition');
  }
  function cohorts() {
    const rows=data.cohorts(range);
    const xs=[1065,1133,1202,1270,1340,1409], widths=[66,67,66,68,67,69];
    const colors=['#e8f0fe','#d2e3fc','#aecbfa','#8ab4f8','#3b82f6','#0b57d0'];
    for(let i=0;i<6;i++){
      const y=752+i*20;
      const row=rows[i];
      write(940,y,row?.label||'');
      for(let j=0;j<6;j++){
        const cell=at(xs[j],y-9,'b');
        const value=row?.periods[j];
        if (value==null) {
          if(cell)cell.style.display='none';
          continue;
        }
        const point=layout.point(xs[j],y-9);
        const el=cell||makeBox(point.x,y-9,widths[j]*point.scale,19,'transparent');
        if(!cell)nodes.set(['b',xs[j],y-9].join(':'),el);
        el.style.display='';
        el.style.background=colors[value===1?5:Math.min(4,Math.floor(value*20))];
        el.title=percent(value);
      }
    }
    [1097,1167,1235,1304,1373,1446].forEach((x,i)=>{
      const values=rows.map(row=>row.periods[i]).filter(v=>v!=null);
      write(x,731,values.length?percent(values.reduce((s,v)=>s+v,0)/values.length):'—');
    });
  }
  function campaigns() {
    const channels=ranked('channel','sessions');
    channels.slice(0,6).forEach((row,i)=>{
      const y=291+i*35.8;
      write(337,y,row.label);write(720,y+3,number(row.sessions));
      bars(337,y+14,row.sessions,channels[0].sessions,287);
    });
    const countries=ranked('country','users');
    for (let i=0;i<11;i++) {
      const y=279+i*25.8;
      const row=countries[i];
      write(1219,y,row?.label||'','country-name');
      write(1493,y+7,row?number(row.users):'','country-users');
      bars(1219,y+11,row?.users||0,countries[0].users,184);
    }
    const series=[30,7,1].map(days=>data.activitySeries(range,days));
    [742,793,846].forEach((y,i)=>write(828,y,number(series[i].at(-1).value)));
    [375,503,631].forEach(x=>write(x,848,''));
    chart(series,[[751,703],[751,734],[751,764],[751,795],[751,825]],
      [375,503,631].map(x=>[x,835]),[332,733,700,825,3]);
    cohorts();
    exportReport(['Channel','Sessions'],channels.map(row=>[row.label,number(row.sessions)]),'campaigns-and-cohorts');
  }

  function search(value) {
    query=value;
    const settings={
      demographics:[ranked('country','users'), 0, Array.from({length:10},(_,i)=>381+i*44.9+22)],
      device:[ranked('device','users'),0,[775,812,849]],
      traffic:[ranked('channel','users'),trafficPage*trafficY.length,trafficY],
    }[page];
    if(!settings)return;
    const [rows,offset,ys]=settings;
    ui.filterRows(query,ys.map((y,i)=>[rows[i+offset]?.label||'',y]));
  }
  function update(next) {
    range=next;
    report=data.summarize(range);
    previousReport=page==='snapshot'?data.summarize(data.previous(range)):null;
    const dates={snapshot:[1146,171],demographics:[1052,115],device:[1140,99],traffic:[1122,93],campaigns:[1080,101]};
    const el=at(...dates[page]);
    if(el){
      el.textContent=keyForRange()+'   '+formatDateRange();
      el.title='Demo data';
      el.dataset.reportField='date-range';
    }
    const comparisonCoords={snapshot:[1146,193],traffic:[1122,115]}[page];
    if(comparisonCoords)write(...comparisonCoords,range.compare?'Compare: '+data.rangeLabel(data.previous(range)):'');
    ({snapshot,demographics,device,traffic,campaigns})[page]();
    if (query) search(query);
  }
  function pick(next) {
    trafficPage=0;
    data.saveRange(next);
    update(next);
    ui.toast('Date range applied across reports');
    ui.animate();
  }
  function custom() {
    const input=(label,id,day)=>'<label>'+label+'<br><input id="'+id+'" type="date" style="width:100%;margin-top:5px;padding:8px;border:1px solid #dadce0;border-radius:6px" value="'+data.isoDay(day)+'" max="'+data.isoDay(data.today())+'"></label>';
    ui.modal('Custom date range','<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      input('Start','gaStart',range.start)+input('End','gaEnd',range.end)+'</div><div role="alert" data-range-error></div>',[
      {label:'Cancel',action:close=>close()},
      {label:'Apply',primary:true,action:(close,modal)=>{
        const next=data.custom(modal.querySelector('#gaStart').value,modal.querySelector('#gaEnd').value,range.compare);
        if(!next){modal.querySelector('[data-range-error]').textContent='Choose a valid range of up to 366 days ending today or earlier.';return;}
        close();pick(next);
      }},
    ]);
  }
  function mount(kind,root,controls,reportLayout,makeText,box) {
    page=kind;canvas=root;ui=controls;layout=reportLayout;makeBox=box;
    root.querySelectorAll('[data-report-x]').forEach(el=>{
      const cls=el.classList.contains('t')?'t':'b';
      nodes.set([cls,el.dataset.reportX,el.dataset.reportY].join(':'),el);
    });
    [1450].forEach(x=>{
      root.querySelectorAll('.b[data-report-x="'+x+'"]').forEach(el=>{
        if(el.style.height==='2px')nodes.set(['b',x,el.dataset.reportY].join(':'),el);
      });
    });
    const savedMetric=localStorage.getItem('nicooGaMetric');
    if(metricKeys[savedMetric])selectedMetric=savedMetric;
    ui.range=(x,y)=>ui.pop(x,y,[
      ...data.presets.map(days=>({label:'Last '+days+' days',icon:range.days===days?'✓':'',selected:range.days===days,action:()=>pick(data.last(days,range.compare))})),
      '---',
      {label:(range.compare?'✓ ':'')+'Compare to previous period',icon:'≋',action:()=>pick({...range,compare:!range.compare})},
      {label:'Custom range…',icon:'▦',action:custom},
    ],'Date range','Changing the range persists across reports',292);
    ui.pagesModal=()=>{
      const rows=ranked('page','views');
      ui.modal('Pages and screens','<div style="display:grid;grid-template-columns:1fr auto;gap:9px 18px">'+
        rows.map(r=>'<div>'+data.pageNames[r.label]+'</div><div style="font-weight:500">'+number(r.views)+'</div>').join('')+
        '</div><small>Demo data</small>',[{label:'Close',action:close=>close()}]);
    };
    const sync=()=>{
      const next=data.selectedRange();
      if(range&&next.start===range.start&&next.end===range.end&&next.days===range.days&&next.compare===range.compare)return;
      update(next);
    };
    if(kind==='traffic'){
      ui.hit(layout.point(1333,451).x,451,34,34,()=>{if(trafficPage){trafficPage--;trafficRows();}},'Previous page');
      ui.hit(layout.point(1430,451).x,451,34,34,()=>{if(!trafficPage){trafficPage++;trafficRows();}},'Next page');
    }
    sync();
    addEventListener('pageshow',sync);
    addEventListener('storage',sync);
  }
  window.LegacyReport={
    mount,search,formatChart,get scale(){return chartScale;},
    selectMetric(metric){
      if(!metricKeys[metric])return;
      selectedMetric=metric;localStorage.setItem('nicooGaMetric',metric);
      snapshotChart();ui.toast(metric+' chart selected');ui.animate();
    },
    next(){ui.toast('All countries are shown');},
  };
})();
