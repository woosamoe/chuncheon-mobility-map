'use strict';
(function () {
  if (!window.L || !state.map) return;
  var a={bus:[],sales:[],facility:[],metadata:{}};
  var busLayer=L.layerGroup().addTo(state.map),marketLayer=L.layerGroup().addTo(state.map),tourLayer=L.layerGroup().addTo(state.map);
  var fmt=n=>Number(n).toLocaleString('ko-KR'),el=id=>document.getElementById(id);
  var panel=document.createElement('section'); panel.className='section';
  panel.innerHTML=[
    '<h2>사람 이동·상권·관광 참고지표</h2>',
    '<p class="activity-note">집계기간이 서로 다릅니다. 세 자료는 실제 보행 인원과 다릅니다.</p>',
    '<label class="toggle"><span class="dot" style="background:#4479bc"></span><span class="toggle-txt"><strong>버스 승하차</strong><small>춘천 정류장별 과거 승하차</small></span><input type="checkbox" id="busActivityToggle" checked></label>',
    '<p class="activity-status" id="busActivityStatus">자료 수집 확인 중</p>',
    '<label class="toggle"><span class="dot" style="background:#b47b45"></span><span class="toggle-txt"><strong>상권 활동</strong><small>읍면동별 업종 매출 기록 · 방문인원 아님</small></span><input type="checkbox" id="salesActivityToggle" checked></label>',
    '<p class="activity-status" id="salesActivityStatus">자료 수집 확인 중</p>',
    '<div class="activity-list" id="salesActivityList"></div>',
    '<label class="toggle"><span class="dot" style="background:#8864bb"></span><span class="toggle-txt"><strong>관광·시설 입장객</strong><small>월별 시설 입장객 · 관광시설만 지도 표시</small></span><input type="checkbox" id="facilityActivityToggle" checked></label>',
    '<p class="activity-status" id="facilityActivityStatus">자료 수집 확인 중</p>',
    '<label class="activity-year-label">시설 입장객 조사연도 <select id="facilityActivityYear"></select></label>',
    '<div class="activity-list" id="facilityActivityList"></div>',
    '<div class="activity-links"><a href="https://www.data.go.kr/data/15138095/fileData.do" target="_blank" rel="noopener noreferrer">버스 승하차 원자료 ↗</a><a href="https://www.data.go.kr/data/15153903/fileData.do" target="_blank" rel="noopener noreferrer">상권 원자료 ↗</a><a href="https://www.data.go.kr/data/15094385/fileData.do" target="_blank" rel="noopener noreferrer">시설 입장객 원자료 ↗</a></div>'
  ].join('');
  var priorPed=document.getElementById('pedToggle');
  if(priorPed){
    var priorRow=priorPed.closest('label');
    if(priorRow){
      var heading=priorRow.querySelector('strong'),hint=priorRow.querySelector('small');
      if(heading)heading.textContent='실측 보행량 (자료 미확보)';
      if(hint)hint.textContent='보행량 계측 수치는 아직 연결되지 않았습니다';
    }
  }
  var previous=document.querySelectorAll('.sidebar .section')[1];
  if (previous) previous.insertAdjacentElement('afterend',panel);
  else document.querySelector('.side-scroll').append(panel);
  var style=document.createElement('style');
  style.textContent=[
    '.activity-note{font-size:12px;color:#526a65;line-height:1.5;margin:5px 0 12px}',
    '.activity-status{font-size:11px;color:#667b76;line-height:1.5;margin:2px 0 12px 22px;overflow-wrap:anywhere}',
    '.activity-list{max-height:155px;overflow-y:auto;display:grid;gap:4px;margin:4px 0 13px}',
    '.activity-list>div{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;background:rgba(41,91,84,.055);border-radius:5px;font-size:12px}',
    '.activity-list span{color:#395d56;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.activity-list b{font-size:11px;white-space:nowrap}',
    '.activity-links{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}',
    '.activity-links a{font-size:11px;color:#386e67;text-decoration:underline}',
    '.activity-year-label{font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:5px;margin:4px 0 8px}',
    '.activity-year-label select{padding:4px;border-radius:4px}'
  ].join('\n'); document.head.append(style);
  function rows(id,data,unit){
    var box=el(id);box.replaceChildren();
    data.slice(0,12).forEach(pair=>{
      var row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');
      label.textContent=pair[0];value.textContent=fmt(pair[1])+unit;
      row.append(label,value);box.append(row);
    });
  }
  function drawBus(){
    busLayer.clearLayers();
    var meta=a.metadata.bus||{};
    el('busActivityStatus').textContent=a.bus.length?
      fmt(a.bus.length)+'개 위치 확인 · '+(meta.periodStart||'?')+' ~ '+(meta.periodEnd||'?')+' 기간 합계'+(meta.truncatedPossible?' · 원자료 행수 상한 주의':''):
      '위치가 연결된 자료 없음'+(meta.error?' · '+meta.error:'');
    if(!el('busActivityToggle').checked)return;
    var points=a.bus.slice().sort((x,y)=>(+y.board + +y.alight)-(+x.board + +x.alight));
    points.slice(0,850).forEach(p=>{
      if(!Number.isFinite(+p.lat)||!Number.isFinite(+p.lon))return;
      var total=Number(p.board)+Number(p.alight);
      L.circleMarker([+p.lat,+p.lon],{radius:Math.min(15,Math.max(4,3+Math.sqrt(total)/15)),
        weight:1,color:'#fff',fillColor:'#4479bc',fillOpacity:.72})
       .bindTooltip(p.name+' · '+fmt(total)+'건')
       .on('click',()=>details('버스 정류장 승하차',p.name,fmt(total)+' 건',
         '승차 '+fmt(p.board)+'건 · 하차 '+fmt(p.alight)+'건\n관측 '+p.start+' ~ '+p.end+
         ' · '+p.observedDays+'개 관측일\n일평균이 아닌 기간 합계입니다.\n출처: 춘천시 공식 승하차 CSV와 정류장 위치정보. 실제 보행자 수는 아닙니다.'))
       .addTo(busLayer);
    });
  }
  function drawMarket(){
    marketLayer.clearLayers();
    var meta=a.metadata.sales||{};
    var matched=a.sales.filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lon));
    el('salesActivityStatus').textContent=a.sales.length?
      '행정동 중심 위치 '+matched.length+'곳 / 전체 '+a.sales.length+
      '곳 · 과거 업종별 매출 기록(방문자 수 아님)':
      '상권 원자료 없음'+(meta.error?' · '+meta.error:'');
    if(!el('salesActivityToggle').checked){el('salesActivityList').replaceChildren();return;}
    rows('salesActivityList',a.sales.slice().sort((x,y)=>y.sectorCount-x.sectorCount)
       .map(p=>[p.name,p.sectorCount]),'개 업종');
    matched.forEach(p=>{
      var size=6+Math.min(6,Math.sqrt(Math.max(0,p.sectorCount||0)));
      L.circleMarker([+p.lat,+p.lon],{radius:size,weight:2,
        color:'#fff',fillColor:'#b47b45',fillOpacity:.83})
        .bindTooltip(p.name+' · '+p.sectorCount+'개 업종')
        .on('click',()=>details('상권 활동 참고자료',p.name,p.sectorCount+'개 업종',
          '과거 상권 매출원자료에 기록된 업종 종류: '+fmt(p.sectorCount)+'개'+
          '\n원자료 행 수: '+fmt(p.records)+'건'+
          '\n마커 위치: 행정동 경계의 대략적 중심(2026년 공간자료 기준)'+
          '\n해당 위치에 인파가 집중된다는 의미가 아니며 방문인원 수치도 아닙니다.'))
        .addTo(marketLayer);
    });
  }
  // These are independently verified tourist-site locations, not facility footprints.
  var sites={'소양강스카이워크':[37.89327743,127.7236633],'구곡폭포':[37.7939338,127.6092987]};
  function drawTour(){
    tourLayer.clearLayers();
    var selection=el('facilityActivityYear').value;
    var isLatest=selection==='latest';
    var rowsForPeriod=isLatest?a.facility:a.facility.filter(p=>String(p.year)===selection);
    var grouped=new Map();
    rowsForPeriod.forEach(p=>{
      var key=isLatest?p.name+'|'+p.year:p.name;
      grouped.set(key,(grouped.get(key)||0)+Number(p.visitors||0));
    });
    var shown=[];
    if(isLatest){
      var latestByName=new Map();
      a.facility.forEach(p=>{
        var old=latestByName.get(p.name);
        if(!old||p.year>old.year)latestByName.set(p.name,{name:p.name,year:p.year});
      });
      latestByName.forEach(row=>shown.push({
        name:row.name,year:row.year,people:grouped.get(row.name+'|'+row.year)||0
      }));
    }else{
      grouped.forEach((people,name)=>shown.push({name,year:Number(selection),people}));
    }
    shown.sort((x,y)=>y.people-x.people);
    var landmarkCount=Object.keys(sites).filter(name=>shown.some(p=>p.name===name)).length;
    el('facilityActivityStatus').textContent=shown.length?
      (isLatest?'시설별 최근 조사연도':selection+'년')+
      ' · 시설 '+shown.length+'곳, 관광지 위치확인 '+landmarkCount+'곳'+
      ' · 일반시설 포함 · 춘천 전체 관광객 수 아님':
      '선택 기간의 시설입장 자료 없음'+(a.metadata.facility?.error?' · '+a.metadata.facility.error:'');
    if(!el('facilityActivityToggle').checked){el('facilityActivityList').replaceChildren();return;}
    rows('facilityActivityList',shown.map(p=>[p.name+' ('+p.year+')',p.people]),'명');
    shown.filter(p=>Object.prototype.hasOwnProperty.call(sites,p.name)).forEach(p=>{
      L.circleMarker(sites[p.name],{radius:Math.min(19,Math.max(7,6+Math.sqrt(Math.max(0,p.people))/50)),
        weight:2,color:'#fff',fillColor:'#8864bb',fillOpacity:.9})
        .bindTooltip(p.name+' · '+p.year+'년 '+fmt(p.people)+'명')
        .on('click',()=>details('관광시설 입장객',p.name,fmt(p.people)+' 명',
          p.year+'년 해당 시설의 월별 공개 입장객 합계.'+
          '\n최근 조사연도는 관광시설마다 다를 수 있습니다.'+
          '\n춘천 전체 관광객 수를 나타내지 않습니다.'+
          '\n출처: 춘천도시공사 시설 입장객 정보.'))
        .addTo(tourLayer);
    });
  }
  var originalRender=render;
  render=function(){originalRender();drawBus();drawMarket();drawTour();};
  ['bus','sales','facility'].forEach(name=>el(name+'ActivityToggle').addEventListener('change',render));
  el('facilityActivityYear').addEventListener('change',render);
  fetch('./data/activity.json').then(resp=>{if(!resp.ok)throw Error('HTTP '+resp.status);return resp.json();})
    .then(json=>{
      ['bus','sales','facility'].forEach(name=>a[name]=Array.isArray(json[name])?json[name]:[]);
      a.metadata=json.metadata||{};
      var recent=document.createElement('option'); recent.value='latest'; recent.textContent='시설별 최근 기록'; el('facilityActivityYear').append(recent);
      (a.metadata.facility?.years||[]).slice().sort((x,y)=>y-x).forEach(y=>{
        var option=document.createElement('option');option.value=y;option.textContent=y+'년';el('facilityActivityYear').append(option);
      });
      render();
    }).catch(err=>{
      ['bus','sales','facility'].forEach(name=>el(name+'ActivityStatus').textContent='자료 수집 오류: '+err.message);
    });
})();