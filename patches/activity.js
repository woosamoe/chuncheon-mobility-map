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
  var previous=document.getElementById('speedToggle')?.closest('.section');
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
  // Tourist locations reference the attraction, NOT the ticket-collection point.
  // Tourism counts are observed 2017-2021 Chuncheon Urban Corporation records.
  // References: Chuncheon Urban Corporation tourism list, Chuncheon tourism portal,
  // Samaksan peak from Korea Forest/Trail POI, Cheongpyeongsa temple position.
  var sites={
    '소양강스카이워크':{point:[37.89327743,127.7236633],note:'관광지 위치'},
    '구곡폭포':{point:[37.7939338,127.6092987],note:'관광지 위치'},
    '삼악산':{point:[37.824932,127.660057],note:'삼악산 산악 지점 참고좌표 · 입장객 계측지점과 다를 수 있음'},
    '청평사':{point:[37.98639,127.80861],note:'청평사 사찰 위치 · 입장객 집계 위치와 다를 수 있음'}
  };
  var tourismPane=state.map.getPane('tourismMarkers')||state.map.createPane('tourismMarkers');
  tourismPane.style.zIndex='680';
  var tourismPins=new Map();
  var cardlist=el('facilityActivityList');
  cardlist.classList.add('tourism-list');
  var showButton=document.createElement('button');
  showButton.type='button';
  showButton.className='activity-tour-zoom';
  showButton.id='tourismActivityFocus';
  showButton.textContent='관광지 마커 지도에서 보기';
  el('facilityActivityStatus').insertAdjacentElement('afterend',showButton);
  var touristCSS=document.createElement('style');
  touristCSS.textContent=[
    '.activity-tour-zoom{display:block;width:100%;border:1px solid #8864bb;background:#f5f1fb;',
    'color:#56328f;border-radius:8px;padding:10px 9px;margin:8px 0 10px;',
    'font-size:12px;font-weight:700;cursor:pointer;text-align:center}',
    '.activity-tour-zoom:hover{background:#eadff8}',
    '.tourism-list{max-height:240px;overflow-y:auto}',
    '.tourism-list button{display:flex;justify-content:space-between;align-items:center;',
    'gap:8px;width:100%;border:1px solid #eadff6;background:#fbf8ff;border-radius:8px;',
    'color:#4c3280;padding:10px 8px;font-size:12px;text-align:left;cursor:pointer}',
    '.tourism-list button:hover{background:#eee5fa}',
    '.tourism-list .tour-place{font-weight:750}',
    '.tourism-list .tour-num{font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.tourism-list .tour-period{display:block;color:#756b80;font-size:10px;margin-top:3px}',
    '.tour-marker-root{background:transparent;border:none}',
    '.tour-marker{display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);',
    'white-space:nowrap;filter:drop-shadow(0px 2px 3px #0005);pointer-events:auto}',
    '.tour-marker-label{font-weight:750;font-size:12px;color:white;background:#7045ac;',
    'border-radius:6px 6px 3px 3px;padding:5px 8px;border:2px solid white}',
    '.tour-marker-tip{width:0;height:0;border-left:9px solid transparent;',
    'border-right:9px solid transparent;border-top:11px solid #7045ac}',
    '.tourism-empty{font-size:12px;color:#777;line-height:1.5;padding:8px}'
  ].join('\n');
  document.head.append(touristCSS);

  function focusTour(name){
    var loc=sites[name];
    if(!loc)return;
    if(!el('facilityActivityToggle').checked){
      el('facilityActivityToggle').checked=true;
      drawTour();
    }
    state.map.setView(loc.point,14,{animate:true});
    var marker=tourismPins.get(name);
    if(marker){
      marker.openPopup();
      marker.setZIndexOffset(2500);
    }
  }
  function drawTour(){
    tourLayer.clearLayers();
    tourismPins.clear();
    var selection=el('facilityActivityYear').value||'latest';
    var latest=selection==='latest';
    var visibleSites=[];
    for(var name of Object.keys(sites)){
      var candidates=a.facility.filter(p=>p.name===name&&Number.isFinite(Number(p.visitors)));
      if(!candidates.length)continue;
      var year=latest?Math.max(...candidates.map(p=>Number(p.year))):Number(selection);
      if(!Number.isFinite(year))continue;
      var yearRows=candidates.filter(p=>Number(p.year)===year);
      if(!yearRows.length)continue;
      var total=yearRows.reduce((sum,p)=>sum+Number(p.visitors||0),0);
      visibleSites.push({name:name,year:year,visitors:total});
    }
    visibleSites.sort((x,y)=>y.visitors-x.visitors);
    el('facilityActivityStatus').textContent=visibleSites.length?
      (latest?'시설별 최근 관측연도':selection+'년')+' · 관광지 '+visibleSites.length+
      '곳(실제 시설 입장객 자료) · 마지막 공개 연도 2021년':
      '선택한 기간에 관광지 입장객 자료가 없습니다. 2021년 또는 시설별 최근 기록을 선택해 주세요.';
    var enabled=el('facilityActivityToggle').checked;
    showButton.disabled=!visibleSites.length;
    showButton.textContent='관광지 '+visibleSites.length+'곳 지도에서 보기 ↗';
    cardlist.replaceChildren();
    if(!enabled){
      showButton.textContent='관광지 마커 켜고 지도에서 보기 ↗';
      return;
    }
    for(let p of visibleSites){
      var loc=sites[p.name];
      var text=p.name+' '+p.year+'년 '+fmt(p.visitors)+'명';
      // Tourist pins are separately labeled, in the top overlay pane, so traffic
      // and commercial circle markers cannot obscure them.
      var icon=L.divIcon({className:'tour-marker-root',
        iconSize:[0,0],iconAnchor:[0,0],
        html:'<div class="tour-marker"><span class="tour-marker-label">'+p.name+
          '</span><span class="tour-marker-tip"></span></div>'});
      var pin=L.marker(loc.point,{icon:icon,pane:'tourismMarkers',interactive:true,
        title:text,keyboard:true,zIndexOffset:1200});
      var popup=document.createElement('div');
      var title=document.createElement('strong');
      title.textContent=p.name;
      var body=document.createElement('p');
      body.textContent=p.year+'년 입장객 합계: '+fmt(p.visitors)+'명';
      var hint=document.createElement('small');
      hint.textContent=loc.note+' · 수치는 춘천도시공사 시설별 월별 입장객이며, 춘천 전체 관광객 수나 실시간 방문 인원이 아닙니다.';
      popup.append(title,body,hint);
      pin.bindPopup(popup).addTo(tourLayer);
      tourismPins.set(p.name,pin);

      var b=document.createElement('button');
      b.type='button';
      b.className='tourist-go';
      var main=document.createElement('span');
      main.className='tour-place';
      main.textContent=p.name;
      var meta=document.createElement('small');
      meta.className='tour-period';
      meta.textContent=p.year+'년 공개 자료 · 지도 위치로 이동';
      main.append(meta);
      var amount=document.createElement('span');
      amount.className='tour-num';
      amount.textContent=fmt(p.visitors)+'명';
      b.append(main,amount);
      b.addEventListener('click',()=>focusTour(p.name));
      cardlist.append(b);
    }
  }
  showButton.addEventListener('click',()=>{
    var locs=[...tourismPins.values()];
    if(!locs.length){
      el('facilityActivityToggle').checked=true;
      drawTour();
      locs=[...tourismPins.values()];
    }
    if(locs.length===1)state.map.setView(locs[0].getLatLng(),13,{animate:true});
    else if(locs.length>1)state.map.fitBounds(L.featureGroup(locs).getBounds().pad(0.18),{animate:true,maxZoom:12});
  });
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
