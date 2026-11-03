'use strict';
(function () {
  if (!window.L || typeof state === 'undefined' || !state.map) return;

  var map=state.map;
  var DATA_URL='./data/banner-route-lines.json';
  var OSRM_BASE='https://router.project-osrm.org/route/v1/driving/';
  var STORAGE_KEY='chuncheon-banner-route-editor-v1';
  var colors={A:'#25853a',B:'#199cc8',C:'#d39a16',D:'#d61abb',E:'#253fc3',
    F:'#8b4a28',G:'#191919',H:'#00bfc4',I:'#337c8f',X:'#f05a18'};
  var sourceData=null;
  var workingCorridors={};
  var controlPoints=[];
  var editablePoints=[];
  var drawing=false;
  var dirty=false;
  var requestNumber=0;
  var selectedControlIndex=-1;
  var editableCasing=null;
  var editableLine=null;
  var restoreMapDragging=false;
  var controlPaneName='markerPane';
  if(typeof map.getPane==='function'&&typeof map.createPane==='function'){
    controlPaneName='bannerEditorControls';
    var controlPane=map.getPane(controlPaneName)||map.createPane(controlPaneName);
    controlPane.style.zIndex='760';
  }
  var editLayer=L.layerGroup().addTo(map);
  var controlLayer=L.layerGroup().addTo(map);
  var changedLayer=L.layerGroup().addTo(map);

  var panel=document.createElement('section');
  panel.className='section banner-editor-section';
  panel.innerHTML=[
    '<div class="section-head"><h2>현수기 노선 편집</h2><span class="banner-editor-badge">내 브라우저</span></div>',
    '<p class="banner-editor-note">기존 노선을 불러와 조절점을 끌거나 새 점을 찍은 뒤 도로망에 맞출 수 있습니다.</p>',
    '<div class="banner-editor-selects">',
    '<label><span>그룹</span><select id="bannerEditorGroup"></select></label>',
    '<label><span>경로</span><select id="bannerEditorPath"></select></label>',
    '</div>',
    '<div class="banner-editor-actions two">',
    '<button type="button" id="bannerEditorLoad">선택 경로 불러오기</button>',
    '<button type="button" id="bannerEditorNew">새 경로 그리기</button>',
    '</div>',
    '<div class="banner-editor-actions three">',
    '<button type="button" id="bannerEditorUndo">마지막 점 취소</button>',
    '<button type="button" id="bannerEditorSnap" class="accent">도로에 맞추기</button>',
    '<button type="button" id="bannerEditorApply" class="apply">경로 적용</button>',
    '</div>',
    '<p id="bannerEditorStatus" class="banner-editor-status" aria-live="polite">노선 자료를 불러오는 중입니다.</p>',
    '<div class="banner-editor-actions two">',
    '<button type="button" id="bannerEditorDownload" class="download">편집 JSON 다운로드</button>',
    '<button type="button" id="bannerEditorReset">임시 편집 초기화</button>',
    '</div>',
    '<p class="banner-editor-help">새 경로: 지도에서 시작점부터 순서대로 클릭 · 기존 경로: 큰 원형 조절점을 드래그하거나 한 번 누른 뒤 지도에서 새 위치 클릭 · Esc: 그리기 종료</p>',
    '<p class="banner-editor-help">다운로드한 JSON을 이 작업에 첨부하면 공개 지도 데이터로 반영할 수 있습니다.</p>'
  ].join('');
  var bannerSection=document.getElementById('bannerRouteList')?.closest('.section');
  if(bannerSection)bannerSection.insertAdjacentElement('afterend',panel);
  else document.querySelector('.side-scroll')?.append(panel);

  var style=document.createElement('style');
  style.textContent=[
    '.banner-editor-section{border-top:3px solid #f05a18}',
    '.banner-editor-badge{font-size:9px;font-weight:800;color:#98501d;background:#fff1e7;border:1px solid #ffd5b7;border-radius:999px;padding:3px 6px}',
    '.banner-editor-note,.banner-editor-help{font-size:11px;line-height:1.5;color:#5d716d;margin:5px 0 9px}',
    '.banner-editor-help{font-size:10px;color:#74827f;margin:7px 0 0}.banner-editor-help code{font-size:9px;overflow-wrap:anywhere}',
    '.banner-editor-selects{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}',
    '.banner-editor-selects label{display:grid;gap:3px;font-size:10px;color:#667b76}',
    '.banner-editor-selects select{min-width:0;border:1px solid #cad9d5;border-radius:7px;background:#fff;padding:7px 8px;font:inherit;color:#263b37}',
    '.banner-editor-actions{display:grid;gap:6px;margin-top:6px}.banner-editor-actions.two{grid-template-columns:1fr 1fr}.banner-editor-actions.three{grid-template-columns:1fr 1fr 1fr}',
    '.banner-editor-actions button{border:1px solid #cad9d5;background:#fff;color:#365e57;border-radius:7px;padding:8px 5px;font:700 10px/1.2 system-ui,sans-serif;cursor:pointer}',
    '.banner-editor-actions button:hover{background:#f0f7f5;border-color:#80aa9f}.banner-editor-actions button:disabled{opacity:.45;cursor:not-allowed}',
    '.banner-editor-actions .accent{border-color:#e79a62;background:#fff5ed;color:#925020}',
    '.banner-editor-actions .apply{border-color:#398f73;background:#eaf8f3;color:#236c55}',
    '.banner-editor-actions .download{border-color:#376f9d;background:#eef7ff;color:#275c87}',
    '.banner-editor-status{min-height:34px;background:#f4f7f6;border-radius:7px;padding:8px;margin:8px 0 4px;font-size:11px;line-height:1.5;color:#3e625b}',
    '.banner-editor-drawing{box-shadow:0 0 0 3px #f05a1844!important;background:#f05a18!important;color:#fff!important}',
    '.banner-editor-handle{background:transparent;border:0!important;cursor:grab!important;touch-action:none!important}',
    '.banner-editor-handle:active{cursor:grabbing!important}.banner-editor-handle span{display:block;width:18px;height:18px;margin:3px;border:3px solid #fff;border-radius:50%;background:#f05a18;box-shadow:0 1px 7px #0009;pointer-events:none}',
    '.banner-editor-handle.selected span{background:#1f70b7;box-shadow:0 0 0 4px #1f70b744,0 1px 7px #0009}',
    '#map.banner-editor-map-drawing,.banner-editor-map-drawing{cursor:crosshair!important}',
    '@media(max-width:760px){.banner-editor-actions.three{grid-template-columns:1fr}.banner-editor-actions button{padding:10px 6px}}'
  ].join('\n');
  document.head.append(style);

  var el=function(id){return document.getElementById(id);};
  var groupSelect=el('bannerEditorGroup');
  var pathSelect=el('bannerEditorPath');
  var status=el('bannerEditorStatus');
  var mapContainer=typeof map.getContainer==='function'?map.getContainer():null;
  var clone=function(value){return JSON.parse(JSON.stringify(value));};
  var currentGroup=function(){return groupSelect.value;};
  var currentIndex=function(){return Math.max(0,Number(pathSelect.value)||0);};
  var colorFor=function(group){return colors[group]||'#f05a18';};

  function setDrawing(next){
    drawing=Boolean(next);
    el('bannerEditorNew').classList.toggle('banner-editor-drawing',drawing);
    el('bannerEditorNew').textContent=drawing?'그리기 종료':'새 경로 그리기';
    if(mapContainer&&mapContainer.classList)mapContainer.classList.toggle('banner-editor-map-drawing',drawing);
    if(drawing)status.textContent='지도에서 경로의 시작점부터 순서대로 클릭하세요.';
  }
  function pointDistance(a,b){
    var dy=(a[0]-b[0])*111320;
    var dx=(a[1]-b[1])*88000;
    return Math.sqrt(dx*dx+dy*dy);
  }
  function samplePath(path,limit){
    if(!Array.isArray(path)||path.length<=limit)return clone(path||[]);
    var sampled=[path[0]];
    var step=(path.length-1)/(limit-1);
    for(var i=1;i<limit-1;i++)sampled.push(path[Math.round(i*step)]);
    sampled.push(path[path.length-1]);
    return clone(sampled);
  }
  function routeLength(path){
    var total=0;
    for(var i=1;i<path.length;i++)total+=pointDistance(path[i-1],path[i]);
    return total;
  }
  function updateStatus(prefix){
    var length=routeLength(editablePoints);
    status.textContent=prefix+' · 조절점 '+controlPoints.length+'개 · 경로 '+editablePoints.length+
      '개 좌표 · 약 '+Math.round(length).toLocaleString('ko-KR')+'m';
  }
  function renderEditable(){
    editLayer.clearLayers();
    controlLayer.clearLayers();
    editableCasing=null;
    editableLine=null;
    var group=currentGroup();
    var color=colorFor(group);
    if(editablePoints.length>1){
      editableCasing=L.polyline(editablePoints,{color:'#fff',weight:10,opacity:.95,lineCap:'round',lineJoin:'round',interactive:false}).addTo(editLayer);
      editableLine=L.polyline(editablePoints,{color:color,weight:6,opacity:1,lineCap:'round',lineJoin:'round',interactive:false}).addTo(editLayer);
    }
    var icon=L.divIcon({className:'banner-editor-handle',html:'<span></span>',iconSize:[30,30],iconAnchor:[15,15]});
    controlPoints.forEach(function(point,index){
      var didDrag=false;
      var marker=L.marker(point,{
        icon:icon,draggable:true,autoPan:true,riseOnHover:true,
        zIndexOffset:3000,keyboard:false,pane:controlPaneName,title:'조절점 '+(index+1)
      }).addTo(controlLayer);
      if(marker.dragging&&typeof marker.dragging.enable==='function')marker.dragging.enable();
      if(index===selectedControlIndex&&marker._icon)marker._icon.classList.add('selected');
      marker.on('dragstart',function(){
        didDrag=false;
        selectedControlIndex=-1;
        if(map.dragging&&typeof map.dragging.enabled==='function'&&map.dragging.enabled()){
          restoreMapDragging=true;
          map.dragging.disable();
        }
      });
      marker.on('drag',function(){
        didDrag=true;
        var moved=marker.getLatLng();
        controlPoints[index]=[moved.lat,moved.lng];
        editablePoints=clone(controlPoints);
        if(editableCasing&&typeof editableCasing.setLatLngs==='function')editableCasing.setLatLngs(editablePoints);
        if(editableLine&&typeof editableLine.setLatLngs==='function')editableLine.setLatLngs(editablePoints);
        updateStatus('조절점을 드래그하는 중입니다');
      });
      marker.on('dragend',function(){
        var moved=marker.getLatLng();
        controlPoints[index]=[moved.lat,moved.lng];
        editablePoints=clone(controlPoints);
        if(restoreMapDragging&&map.dragging){
          map.dragging.enable();
          restoreMapDragging=false;
        }
        renderEditable();
        updateStatus('조절점을 옮겼습니다. 도로에 맞추기를 눌러 보정하세요');
      });
      marker.on('click',function(event){
        if(didDrag)return;
        if(event&&event.originalEvent&&L.DomEvent)L.DomEvent.stopPropagation(event.originalEvent);
        selectedControlIndex=index;
        renderEditable();
        status.textContent='조절점 '+(index+1)+'을 선택했습니다. 지도에서 옮길 위치를 클릭하세요.';
      });
      marker.on('contextmenu',function(){
        controlPoints.splice(index,1);
        editablePoints=clone(controlPoints);
        selectedControlIndex=-1;
        renderEditable();
        updateStatus('조절점을 삭제했습니다');
      });
    });
  }
  function selectedPath(){
    var paths=workingCorridors[currentGroup()]||[];
    return paths[currentIndex()]||[];
  }
  function fillPathOptions(){
    pathSelect.replaceChildren();
    var paths=workingCorridors[currentGroup()]||[];
    paths.forEach(function(path,index){
      var option=document.createElement('option');
      option.value=String(index);
      option.textContent=(index+1)+'번 경로 · '+path.length+'점';
      pathSelect.append(option);
    });
    pathSelect.value='0';
  }
  function loadSelected(){
    setDrawing(false);
    selectedControlIndex=-1;
    editablePoints=clone(selectedPath());
    controlPoints=samplePath(editablePoints,18);
    renderEditable();
    if(editablePoints.length>1)map.fitBounds(L.latLngBounds(editablePoints),{padding:[30,30],maxZoom:16});
    updateStatus(currentGroup()+' 그룹 '+(currentIndex()+1)+'번 경로를 불러왔습니다');
  }
  function renderChanged(){
    changedLayer.clearLayers();
    if(!sourceData)return;
    Object.keys(workingCorridors).forEach(function(group){
      (workingCorridors[group]||[]).forEach(function(path,index){
        var original=sourceData.corridors?.[group]?.[index];
        if(JSON.stringify(path)===JSON.stringify(original))return;
        L.polyline(path,{color:'#fff',weight:11,opacity:.75,interactive:false}).addTo(changedLayer);
        L.polyline(path,{color:colorFor(group),weight:7,opacity:.92,dashArray:'12 7',interactive:false}).addTo(changedLayer);
      });
    });
  }
  function saveDraft(){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,corridors:workingCorridors,savedAt:new Date().toISOString()}));
      return true;
    }catch(error){
      status.textContent='브라우저 임시 저장 실패: '+error.message;
      return false;
    }
  }
  function applyPath(){
    if(editablePoints.length<2){
      status.textContent='적용하려면 좌표가 2개 이상 필요합니다.';
      return;
    }
    var group=currentGroup();
    var index=currentIndex();
    workingCorridors[group][index]=clone(editablePoints);
    dirty=true;
    saveDraft();
    fillPathOptions();
    pathSelect.value=String(index);
    renderChanged();
    updateStatus(group+' 그룹 '+(index+1)+'번 경로를 적용하고 브라우저에 임시 저장했습니다');
  }
  function snapToRoad(){
    if(controlPoints.length<2){
      status.textContent='도로에 맞추려면 조절점이 2개 이상 필요합니다.';
      return;
    }
    if(controlPoints.length>25){
      status.textContent='도로 맞춤은 조절점 25개 이하에서 사용할 수 있습니다.';
      return;
    }
    var coordinates=controlPoints.map(function(point){return point[1].toFixed(6)+','+point[0].toFixed(6);}).join(';');
    var url=OSRM_BASE+coordinates+'?overview=full&geometries=geojson&steps=false';
    var ownRequest=++requestNumber;
    el('bannerEditorSnap').disabled=true;
    status.textContent='도로망을 따라 경로를 계산하는 중입니다.';
    fetch(url).then(function(response){
      if(!response.ok)throw Error('HTTP '+response.status);
      return response.json();
    }).then(function(result){
      if(ownRequest!==requestNumber)return;
      var coordinates=result.routes?.[0]?.geometry?.coordinates;
      if(!Array.isArray(coordinates)||coordinates.length<2)throw Error('경로 결과 없음');
      editablePoints=coordinates.map(function(point){return[Number(point[1]),Number(point[0])];});
      renderEditable();
      updateStatus('도로망에 맞춘 경로를 만들었습니다');
    }).catch(function(error){
      status.textContent='자동 도로 맞춤 실패: '+error.message+' · 조절점을 바꾸거나 직접 경로를 그려 주세요.';
    }).finally(function(){
      if(ownRequest===requestNumber)el('bannerEditorSnap').disabled=false;
    });
  }
  function exportData(){
    if(!sourceData)return;
    var output={
      metadata:Object.assign({},sourceData.metadata||{},{
        editedAt:new Date().toISOString(),
        editor:'Chuncheon banner route browser editor',
        coordinateOrder:'lat,lng',
        pathCount:Object.values(workingCorridors).reduce(function(sum,paths){return sum+paths.length;},0)
      }),
      corridors:workingCorridors
    };
    var blob=new Blob([JSON.stringify(output,null,2)+'\n'],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var link=document.createElement('a');
    link.href=url;
    link.download='banner-route-lines-edited.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},0);
    status.textContent='편집 JSON을 다운로드했습니다. 파일을 이 작업에 첨부하면 공개 지도에 반영할 수 있습니다.';
  }
  function resetDraft(){
    if(!sourceData)return;
    localStorage.removeItem(STORAGE_KEY);
    workingCorridors=clone(sourceData.corridors||{});
    dirty=false;
    renderChanged();
    fillPathOptions();
    loadSelected();
    status.textContent='브라우저 임시 편집을 지우고 배포된 원본으로 되돌렸습니다.';
  }

  groupSelect.addEventListener('change',function(){fillPathOptions();loadSelected();});
  pathSelect.addEventListener('change',loadSelected);
  el('bannerEditorLoad').addEventListener('click',loadSelected);
  el('bannerEditorNew').addEventListener('click',function(){
    if(drawing){setDrawing(false);return;}
    controlPoints=[];
    editablePoints=[];
    renderEditable();
    setDrawing(true);
  });
  el('bannerEditorUndo').addEventListener('click',function(){
    if(!controlPoints.length)return;
    controlPoints.pop();
    editablePoints=clone(controlPoints);
    renderEditable();
    updateStatus('마지막 조절점을 취소했습니다');
  });
  el('bannerEditorSnap').addEventListener('click',snapToRoad);
  el('bannerEditorApply').addEventListener('click',applyPath);
  el('bannerEditorDownload').addEventListener('click',exportData);
  el('bannerEditorReset').addEventListener('click',resetDraft);
  map.on('click',function(event){
    if(!drawing&&selectedControlIndex<0)return;
    if(selectedControlIndex>=0&&!drawing){
      controlPoints[selectedControlIndex]=[event.latlng.lat,event.latlng.lng];
      selectedControlIndex=-1;
      editablePoints=clone(controlPoints);
      renderEditable();
      updateStatus('선택한 조절점을 새 위치로 옮겼습니다. 도로에 맞추기를 눌러 보정하세요');
      return;
    }
    controlPoints.push([event.latlng.lat,event.latlng.lng]);
    editablePoints=clone(controlPoints);
    renderEditable();
    updateStatus('조절점을 추가했습니다');
  });
  document.addEventListener('keydown',function(event){
    if(drawing&&event.key==='Escape')setDrawing(false);
  });

  fetch(DATA_URL).then(function(response){
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
  }).then(function(data){
    sourceData=data;
    workingCorridors=clone(data.corridors||{});
    try{
      var draft=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(draft&&draft.version===1&&draft.corridors){
        workingCorridors=draft.corridors;
        dirty=true;
      }
    }catch(error){
      localStorage.removeItem(STORAGE_KEY);
    }
    Object.keys(workingCorridors).sort().forEach(function(group){
      var option=document.createElement('option');
      option.value=group;
      option.textContent=group+' 그룹';
      groupSelect.append(option);
    });
    groupSelect.value=Object.keys(workingCorridors).sort()[0]||'';
    fillPathOptions();
    renderChanged();
    loadSelected();
    if(dirty)status.textContent+=' · 이전 브라우저 임시 편집을 복원했습니다.';
  }).catch(function(error){
    status.textContent='노선 편집 자료를 불러오지 못했습니다: '+error.message;
  });
})();
