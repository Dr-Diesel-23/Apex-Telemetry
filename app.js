// Replace this mock adapter with fetch endpoints; retain the Driver/Standings object fields for rendering.
// Driver row: [fullName, teamName, points, wins, podiums, delta, code, driverNumber]
const data={f1:[
['Lando Norris','McLaren Mastercard F1 Team',365,7,15,'LEADER','NOR',1],
['Oscar Piastri','McLaren Mastercard F1 Team',348,6,14,'+17','PIA',81],
['Max Verstappen','Oracle Red Bull Racing',331,5,12,'+34','VER',3],
['Charles Leclerc','Scuderia Ferrari HP',296,3,11,'+69','LEC',16],
['George Russell','Mercedes-AMG PETRONAS Formula One Team',274,2,9,'+91','RUS',63],
['Lewis Hamilton','Scuderia Ferrari HP',251,2,8,'+114','HAM',44],
['Kimi Antonelli','Mercedes-AMG PETRONAS Formula One Team',214,1,6,'+151','ANT',12],
['Alexander Albon','Atlassian Williams F1 Team',148,0,2,'+217','ALB',23],
['Carlos Sainz','Atlassian Williams F1 Team',132,0,1,'+233','SAI',55],
['Fernando Alonso','Aston Martin Aramco Formula One Team',96,0,0,'+269','ALO',14],
['Pierre Gasly','BWT Alpine Formula One Team',74,0,0,'+291','GAS',10],
['Yuki Tsunoda','Visa Cash App Racing Bulls F1 Team',61,0,0,'+304','TSU',22],
['Liam Lawson','Visa Cash App Racing Bulls F1 Team',48,0,0,'+317','LAW',30],
['Esteban Ocon','TGR Haas F1 Team',41,0,0,'+324','OCO',31],
['Nico Hülkenberg','Audi Revolut F1 Team',37,0,0,'+328','HUL',27],
['Oliver Bearman','TGR Haas F1 Team',29,0,0,'+336','BEA',87],
['Gabriel Bortoleto','Audi Revolut F1 Team',24,0,0,'+341','BOR',5],
['Lance Stroll','Aston Martin Aramco Formula One Team',21,0,0,'+344','STR',18],
['Franco Colapinto','BWT Alpine Formula One Team',18,0,0,'+347','COL',43],
['Sergio Pérez','Cadillac Formula 1 Team',12,0,0,'+353','PER',11],
['Valtteri Bottas','Cadillac Formula 1 Team',8,0,0,'+357','BOT',77],
['Isack Hadjar','Oracle Red Bull Racing',6,0,0,'+359','HAD',6]
],motogp:[
['Marc Márquez','Ducati Lenovo Team',365,9,16,'LEADER','MAR',93],
['Jorge Martín','Aprilia Racing',341,4,12,'+24','JMR',89],
['Francesco Bagnaia','Ducati Lenovo Team',337,6,11,'+28','BAG',63],
['Marco Bezzecchi','Aprilia Racing',305,3,9,'+60','BEZ',72],
['Pedro Acosta','Red Bull KTM Factory Racing',282,2,7,'+83','ACO',37],
['Fabio Quartararo','Monster Energy Yamaha',210,1,4,'+155','QUA',20],
['Enea Bastianini','Red Bull KTM Factory Racing',198,1,3,'+167','BAS',23]
],news:[['Abu Dhabi 2021: final lap telemetry decoded','F1 — TELEMETRY','M. Laurent','8 MIN','photo-1503736334956-4c8f8e92946d'],['Ducati’s aerodynamic revolution','MOTOGP — TECH','P. Moretti','6 MIN','photo-1558981806-ec527fa84c39'],['Austin upgrades land in parc fermé','F1 — PADDOCK','S. Reid','5 MIN','photo-1519608487953-e999c86e7455']],feed:[['14:32','YELLOW FLAG — SECTOR 2','Race Control — Local incident reported'],['14:28','INVESTIGATION — TURN 9','Track limits — Car 4 under review'],['14:21','PIT WINDOW OPEN','Strategy desk — Undercut opportunity'],['14:17','SESSION UPDATE','Track temperature stable at 38°C']]};

// Constructor rows: [name, points, gapToLeader, colorHex]
const constructors={f1:[
['McLaren Mastercard F1 Team',713,0,'#FF8000'],
['Scuderia Ferrari HP',547,166,'#E8002D'],
['Mercedes-AMG PETRONAS Formula One Team',488,225,'#27F4D2'],
['Oracle Red Bull Racing',337,376,'#3671C6'],
['Atlassian Williams F1 Team',280,433,'#64C4FF'],
['Aston Martin Aramco Formula One Team',117,596,'#229971'],
['Visa Cash App Racing Bulls F1 Team',109,604,'#6692FF'],
['BWT Alpine Formula One Team',92,621,'#FF87BC'],
['TGR Haas F1 Team',70,643,'#B6BABD'],
['Audi Revolut F1 Team',61,652,'#BB0A30'],
['Cadillac Formula 1 Team',20,693,'#C8A24A']
],motogp:[
['Ducati Lenovo Team',702,0,'#CC0000'],
['Aprilia Racing',646,56,'#00A0DE'],
['Red Bull KTM Factory Racing',480,222,'#FF6600'],
['Monster Energy Yamaha',310,392,'#0033A0'],
['Honda HRC',240,462,'#E10600'],
['Trackhouse Racing',150,552,'#00A19C'],
['Gresini Racing',120,582,'#7B2D8E'],
['VR46 Racing Team',110,592,'#FFD400']
]};

let page='overview',series='f1',key=2,ckey=1,ascending=false,standingsView='drivers';
const $=s=>document.querySelector(s),content=$('#content');

function driverTable(){
  const rows=[...data[series]];
  rows.sort((a,b)=>ascending?(a[key]>b[key]?1:-1):(a[key]<b[key]?1:-1));
  const head=['RANK','DRIVER / TEAM','POINTS','WINS','PODIUMS','DELTA'];
  return '<div class="table-wrap"><table class="table"><thead><tr>'+
    head.map((x,i)=>'<th data-k="'+[0,0,2,3,4,5][i]+'">'+x+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map((r,i)=>{
      const code=r[6]||'';
      const id=code?(code+(r[7]!=null?'-'+r[7]:'')):'';
      return '<tr><td>'+String(i+1).padStart(2,'0')+'</td>'+
        '<td><b>'+r[0]+'</b>'+(id?' <span class="driver-id">('+id+')</span>':'')+
        '<small class="team-line">'+r[1]+'</small></td>'+
        '<td>'+r[2]+'</td><td>'+r[3]+'</td><td>'+r[4]+'</td>'+
        '<td class="delta">'+r[5]+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}

function constructorTable(){
  const rows=[...(constructors[series]||[])];
  const ck=[0,1,2].includes(ckey)?ckey:1;
  rows.sort((a,b)=>ascending?(a[ck]>b[ck]?1:-1):(a[ck]<b[ck]?1:-1));
  const head=['RANK','CONSTRUCTOR','POINTS','DELTA'];
  return '<div class="table-wrap"><table class="table"><thead><tr>'+
    head.map((x,i)=>'<th data-ck="'+[0,0,1,2][i]+'">'+x+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map((r,i)=>{
      const delta=i===0||Number(r[2])===0?'LEADER':'+'+r[2];
      const logo=typeof window.apexTeamLogo==='function'?window.apexTeamLogo(r[0]):null;
      const crest=logo?'<span class="team-logo-chip"><img class="team-logo" src="'+logo.logo+'" alt="" loading="lazy" data-fallback="'+logo.fallback+'" onerror="this.onerror=null;this.src=this.dataset.fallback"></span>':'';
      return '<tr><td>'+String(i+1).padStart(2,'0')+'</td>'+
        '<td><b class="constructor-name" style="border-left-color:'+(r[3]||'#ff3e32')+'">'+crest+'<span>'+r[0]+'</span></b></td>'+
        '<td>'+r[1]+'</td><td class="delta">'+delta+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}

function standings(){
  const seriesTabs='<div class="tabs">'+['f1','motogp'].map(s=>'<button data-s="'+s+'" class="'+(s===series?'active':'')+'">'+s.toUpperCase()+'</button>').join('')+'</div>';
  const viewTabs='<div class="tabs seg">'+['drivers','constructors'].map(v=>'<button data-v="'+v+'" class="'+(v===standingsView?'active':'')+'">'+v.toUpperCase()+'</button>').join('')+'</div>';
  return '<section class="panel standings-panel"><div class="standings-head"><h2>CHAMPIONSHIP STANDINGS</h2>'+seriesTabs+'</div>'+viewTabs+(standingsView==='drivers'?driverTable():constructorTable())+'</section>';
}

const TYRE_CLASS={S:'s',M:'m',H:'h',I:'i',W:'w',U:'u'};
function tyrePill(code){return '<i class="tyre-pill '+(TYRE_CLASS[code]||'u')+'">'+(code||'U')+'</i>'}
function tyreRowHtml(d){let stints=Array.isArray(d.stints)?d.stints:[];let chain=stints.map(s=>'<span class="tyre-stint">'+tyrePill(s.compound)+'<em>'+s.laps+'</em></span>').join('<span class="tyre-arrow">›</span>');let pitCount=Number(d.pitCount)||0;let pitLabel=pitCount===0?'NO STOP':pitCount+(pitCount===1?' STOP':' STOPS');let lastStop=Array.isArray(d.pitStops)&&d.pitStops.length?d.pitStops[d.pitStops.length-1]:null;let last=stints.length?stints[stints.length-1]:null;let pos=Number(d.position)||99;let id=d.code?(d.code+(d.driverNumber!=null?'-'+d.driverNumber:'')):'';return '<div class="tyre-row"><span class="tyre-pos">'+(pos<10?'0':'')+pos+'</span><b class="tyre-code">'+id+'</b><span class="tyre-team">'+String(d.teamName||'').toUpperCase()+'</span><span class="tyre-chain">'+(chain||'<span class="kicker">NO STINT DATA</span>')+'</span><span class="tyre-age">'+(last?(Number(d.currentTyreLaps)||last.laps)+' LAPS ON '+last.compound:'—')+'</span><span class="tyre-pit">'+pitLabel+(lastStop&&lastStop.durationSeconds?' · '+lastStop.durationSeconds+'S':'')+'</span></div>'}
const TYRE_SAMPLE=[{position:1,code:'VER',driverNumber:3,teamName:'Oracle Red Bull Racing',currentTyreLaps:25,pitCount:2,pitStops:[{}, {durationSeconds:22.4}],stints:[{compound:'S',laps:13},{compound:'S',laps:18},{compound:'M',laps:25}]},{position:2,code:'NOR',driverNumber:1,teamName:'McLaren Mastercard F1 Team',currentTyreLaps:40,pitCount:1,pitStops:[{durationSeconds:23.1}],stints:[{compound:'M',laps:16},{compound:'H',laps:40}]},{position:3,code:'LEC',driverNumber:16,teamName:'Scuderia Ferrari HP',currentTyreLaps:17,pitCount:2,pitStops:[{}, {durationSeconds:24.2}],stints:[{compound:'S',laps:15},{compound:'M',laps:24},{compound:'H',laps:17}]}];
function tyrePanel(){return '<section class="panel tyre-panel"><div class="tyre-head"><h2>TYRE STRATEGY — <span id="tyre-circuit">AUSTIN</span></h2><div class="tyre-legend"><span>'+tyrePill('S')+' SOFT</span><span>'+tyrePill('M')+' MEDIUM</span><span>'+tyrePill('H')+' HARD</span><span>'+tyrePill('I')+' INTER</span><span>'+tyrePill('W')+' WET</span></div></div><div class="tyre-rows" id="tyre-rows">'+TYRE_SAMPLE.map(tyreRowHtml).join('')+'</div><small class="kicker" id="tyre-meta">STINT HISTORY — COMPOUND — LAPS — PIT STOPS</small></section>'}
function nextRaceBar(){return '<div class="next-race" id="next-race"><span class="kicker">NEXT RACE</span><img id="next-flag" class="next-flag" alt="" width="26" height="18" hidden><b id="next-name">MEXICO CITY GRAND PRIX</b><span id="next-circuit">AUTÓDROMO HERMANOS RODRÍGUEZ — MEXICO</span><span id="next-date">01 NOV 2026</span><strong id="next-countdown">IN 3D 08H</strong></div>'}
function feed(){return '<section class="panel"><h2>RACE CONTROL — SAMPLE DATA</h2><div class="feed">'+data.feed.map(x=>'<p><code>'+x[0]+'</code> &nbsp; '+x[1]+'<small>'+x[2]+'</small></p>').join('')+'</div></section>'}
function circuitLayout(key){const c=window.APEX_CIRCUITS&&window.APEX_CIRCUITS[key];return c||null}
function circuit(){const c=circuitLayout('silverstone');const d=c?c.path:'M20 50 L80 50';return '<section class="panel circuit-panel" id="circuit-panel" data-circuit="'+(c?c.key:'')+'"><svg class="corner-art" viewBox="0 0 100 100" aria-hidden="true"><path d="'+(c?c.corner:'')+'" fill="none" stroke="#ff3e32" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg><h2>CIRCUIT PROFILE - <span id="circuit-name">SILVERSTONE</span></h2><svg class="track" viewBox="0 0 100 100" role="img" aria-label="Circuit layout"><path id="circuit-path" d="'+d+'" fill="none" stroke="#ff3e32" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg><div class="trackinfo"><span id="circuit-len">5.891 KM TRACK</span><span id="circuit-country">UNITED KINGDOM</span><span id="circuit-layout">SILVERSTONE</span></div></section>'}
function preds(){let p=window.apexPredictions&&window.apexPredictions.length?window.apexPredictions:[['VER-3','Verstappen',48],['NOR-1','Norris',32],['HAM-44','Hamilton',20]];return '<section class="panel"><h2>AI WIN PROBABILITY</h2>'+p.map(x=>'<div class="driver"><span class="initial">'+x[0]+'</span><div>'+x[1]+'<div class="bar"><i style="width:'+x[2]*2+'%"></i></div></div><b>'+x[2]+'%</b></div>').join('')+'<small class="kicker">MODEL — PACE + PIT STRATEGY</small></section>'}
function live(){return '<section class="panel"><div class="live-head"><h2>LIVE TELEMETRY <span id="live-series">F1</span></h2><small class="kicker" id="live-status">CONNECTING TO FEED...</small></div><div id="live-strip"><p class="kicker">Waiting for the 2 Hz feed...</p></div><small class="kicker">SAMPLE RATE 2 HZ / SPEED / THROTTLE / GEAR</small></section>'}
function overview(){return '<div class="heading"><div><small>RACE INTELLIGENCE / 01</small><h1>OVERVIEW</h1><p>Your cross-series race desk. One view, every signal.</p></div><span class="kicker" id="overview-mode">LIVE DATA FEED</span></div>'+nextRaceBar()+'<div style="margin-bottom:13px">'+live()+'</div><div class="grid two"><section class="panel"><h2 id="event-title">UP NEXT — BRITISH GRAND PRIX</h2><div class="event"><img id="event-photo" class="event-photo" alt="" hidden><div><small id="event-circuit">SILVERSTONE CIRCUIT — UNITED KINGDOM</small><h2 id="event-name">SILVERSTONE</h2><div class="stats"><b id="event-len">5.891 km<small>TRACK</small></b><b id="event-type">RACE<small>SESSION</small></b><b id="event-start">10:00 UTC<small>GREEN FLAG</small></b></div><small class="photo-credit" id="event-credit"></small></div><div class="count"><small id="event-label">NEXT SESSION — RACE START</small><strong id="countdown">01D 04H 22M</strong><small id="event-mode">SESSION MODE — LIVE</small><div class="stats"><b><span id="wx-track">38°</span><small>TRACK</small></b><b><span id="wx-air">22°</span><small>AIR</small></b><b><span id="wx-rain">15%</span><small>RAIN</small></b></div></div></div></section>'+preds()+'</div><div style="margin:13px 0">'+standings()+'</div><div class="grid half">'+feed()+circuit()+'</div>'}
function discipline(p){let m=p==='motogp',n=m?'MOTOGP':'FORMULA 1';return '<div class="heading"><div><small>'+n+' / SERIES CONTROL</small><h1 class="accent">'+n+'</h1><p>Session telemetry, standings, and strategy intelligence.</p></div><span class="kicker" id="series-mode">LIVE DATA FEED</span></div>'+nextRaceBar()+'<div class="metrics"><div class="panel"><small>'+ (m?'TOP SPEED':'FASTEST LAP')+'</small><b>'+(m?'363.6 km/h':'1:28.092')+'</b><small>SESSION BEST</small></div><div class="panel"><small>'+(m?'LEAN ANGLE':'WIN MODEL')+'</small><b>'+(m?'64°':'VER — 48%')+'</b><small>'+(m?'TURN 9':'PREDICTED')+'</small></div><div class="panel"><small>'+(m?'TIRE ALLOCATION':'PIT STOPS')+'</small><b>'+(m?'F-H / R-S':'1 — 22.4s')+'</b><small>RACE WEEKEND HUB</small></div></div><div style="margin-bottom:13px">'+live()+'</div><div class="grid two" style="margin-bottom:13px"><section class="panel"><h2>SESSION TELEMETRY — '+(m?'SPRINT + MAIN RACE':'BRITISH GRAND PRIX')+'</h2><p>01 &nbsp; '+(m?'J. MARTÍN':'VERSTAPPEN')+' <code>1:28.092</code> &nbsp; SOFT</p><p>02 &nbsp; '+(m?'F. BAGNAIA':'NORRIS')+' <code>+0.432s</code> &nbsp; MEDIUM</p><p>03 &nbsp; '+(m?'M. MÁRQUEZ':'LECLERC')+' <code>+0.867s</code> &nbsp; HARD</p><small class="kicker">SECTOR TIMES — PIT STOPS — TIRE COMPOUNDS</small></section>'+preds()+'</div><div style="margin-bottom:13px">'+standings()+'</div>'+(m?'':'<div style="margin-bottom:13px">'+tyrePanel()+'</div>')+'<div class="grid half">'+feed()+circuit()+'</div>'}
function render(){let titles={overview:'OVERVIEW',f1:'FORMULA 1',motogp:'MOTOGP',settings:'API CONFIG'};$('#crumb').textContent=titles[page];content.innerHTML=page==='overview'?overview():page==='settings'?'<div class="heading"><div><small>SYSTEM / CONFIGURATION</small><h1>LIVE API CONFIG</h1><p>Point the dashboard at your telemetry backend.</p></div></div><section class="panel form"><label>API BASE URL<input id="url" placeholder="https://api.example.com/v1"></label><label>API KEY<input id="token" type="password" placeholder="Stored in this browser"></label><button id="save" class="red">Save configuration</button><p class="kicker">Defaults to http://localhost:4000/api/v1. Mock data is the offline fallback.</p></section>':discipline(page);content.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{key=+x.dataset.k;ascending=!ascending;render()});content.querySelectorAll('[data-ck]').forEach(x=>x.onclick=()=>{ckey=+x.dataset.ck;ascending=!ascending;render()});content.querySelectorAll('[data-v]').forEach(x=>x.onclick=()=>{standingsView=x.dataset.v;key=2;ckey=1;ascending=false;render()});content.querySelectorAll('[data-s]').forEach(x=>x.onclick=()=>{series=x.dataset.s;render();document.dispatchEvent(new CustomEvent('apex:series',{detail:series}))});$('#filter').value=['f1','motogp'].includes(page)?page:'all';if($('#save'))$('#save').onclick=()=>{localStorage.setItem('apex-url',$('#url').value);localStorage.setItem('apex-key',$('#token').value);$('#save').textContent='Saved locally ✓'}}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=e=>{e.preventDefault();page=b.dataset.page;if(['f1','motogp'].includes(page))series=page;else if(page==='overview')series='f1';render();document.dispatchEvent(new CustomEvent('apex:page',{detail:page}));history.replaceState(null,'','#dashboard'+(page==='overview'?'':'?category='+page))});$('#filter').onchange=e=>{page=e.target.value==='all'?'overview':e.target.value;if(page!=='overview')series=page;else series='f1';render();document.dispatchEvent(new CustomEvent('apex:series',{detail:page==='overview'?'f1':page}))};$('#clock').textContent=new Date().toLocaleTimeString('en-GB',{timeZone:'UTC'});setInterval(()=>$('#clock').textContent=new Date().toLocaleTimeString('en-GB',{timeZone:'UTC'}),1000);

// Populate the overview as soon as the dashboard opens.
render();

// Bridge for the live adapter (live.js): mock data is the offline fallback,
// the adapter overwrites it with API responses when the backend is reachable.
window.apexData=data;window.apexConstructors=constructors;window.apexRender=render;window.apexSeries=()=>series;window.apexView=()=>standingsView;window.apexTyreRow=tyreRowHtml;window.apexTyrePill=tyrePill;
