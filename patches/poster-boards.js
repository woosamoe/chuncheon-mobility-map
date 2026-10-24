'use strict';
(function () {
  if (!window.L || !state.map) return;

  var SOURCE_URL='https://view.chuncheon.go.kr/SynapDocViewServer/viewer/doc.html?key=0ac63470590d416983a1ec92de60e8b9&convType=html&convLocale=ko_KR&contextPath=/SynapDocViewServer';
  var data={metadata:{},boards:[]};
  var markerById=new Map();
  var visibleMarkers=[];
  var boardPane=state.map.getPane('posterBoardMarkers')||state.map.createPane('posterBoardMarkers');
  boardPane.style.zIndex='695';
  var boardLayer=L.layerGroup().addTo(state.map);

  var panel=document.createElement('section');
  panel.className='section poster-board-section';
  panel.innerHTML=[
    '<div class="section-head"><h2>지정벽보게시판</h2><button id="posterBoardFocus" type="button" class="link-button">전체 위치</button></div>',
    '<label class="toggle"><span class="dot poster-board-dot"></span><span class="toggle-txt"><strong>게시판 위치</strong><small>춘천시 지정 게시판 · 관리번호/주소 검색</small></span><input id="posterBoardToggle" type="checkbox" checked></label>',
    '<p class="poster-board-status" id="posterBoardStatus">위치 자료 확인 중</p>',
    '<label class="poster-board-search-label" for="posterBoardSearch">게시판 검색</label>',
    '<input id="posterBoardSearch" class="poster-board-search" type="search" placeholder="관리번호, 주소, 위치 설명" autocomplete="off">',
    '<div class="poster-board-list" id="posterBoardList" aria-live="polite"></div>',
    '<p class="poster-board-note">좌표는 지번을 지도에서 대조한 참고 위치입니다. 현장 여건에 따라 게시판의 실제 위치와 조금 다를 수 있습니다.</p>',
    '<a class="poster-board-source" href="'+SOURCE_URL+'" target="_blank" rel="noopener noreferrer">춘천시 원문 보기 ↗</a>'
  ].join('');
  var activity=document.getElementById('facilityActivityList')?.closest('.section');
  var previous=activity||document.getElementById('speedToggle')?.closest('.section');
  if(previous)previous.insertAdjacentElement('afterend',panel);
  else document.querySelector('.side-scroll')?.append(panel);

  var style=document.createElement('style');
  style.textContent=[
    '.poster-board-dot{background:#d34878!important;box-shadow:0 0 0 2px #fff,0 0 0 3px #d34878}',
    '.poster-board-status{font-size:11px;color:#667b76;line-height:1.5;margin:3px 0 9px 22px}',
    '.poster-board-search-label{display:block;font-size:11px;font-weight:700;color:#3f5d57;margin:5px 0}',
    '.poster-board-search{width:100%;border:1px solid #c9d6d3;border-radius:7px;padding:8px 9px;font:inherit;font-size:12px;color:#173f37;background:#fff}',
    '.poster-board-search:focus{outline:2px solid #d3487855;border-color:#d34878}',
    '.poster-board-list{max-height:225px;overflow-y:auto;display:grid;gap:5px;margin:8px 0}',
    '.poster-board-item{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;width:100%;border:1px solid #ecd0da;background:#fff8fb;border-radius:8px;padding:8px;text-align:left;cursor:pointer;color:#313c39}',
    '.poster-board-item:hover,.poster-board-item:focus{background:#fbe9f0;border-color:#d34878;outline:none}',
    '.poster-board-id{grid-row:1/3;align-self:start;background:#d34878;color:#fff;border-radius:999px;padding:3px 6px;font-size:10px;font-weight:800}',
    '.poster-board-address{font-size:12px;font-weight:750}',
    '.poster-board-location{font-size:10px;color:#697a76;line-height:1.4}',
    '.poster-board-empty{font-size:12px;color:#687a76;padding:10px 3px}',
    '.poster-board-note{font-size:10px;color:#74837f;line-height:1.5;margin:8px 0 4px}',
    '.poster-board-source{font-size:11px;color:#8f3154;text-decoration:underline}',
    '.poster-board-popup strong{display:block;color:#8f3154;margin-bottom:4px}',
    '.poster-board-popup p{margin:3px 0;font-size:12px;line-height:1.45}',
    '.poster-board-popup small{display:block;color:#6f7a77;margin-top:6px;line-height:1.4}'
  ].join('\n');
  document.head.append(style);

  var toggle=document.getElementById('posterBoardToggle');
  var search=document.getElementById('posterBoardSearch');
  var status=document.getElementById('posterBoardStatus');
  var list=document.getElementById('posterBoardList');
  var focusButton=document.getElementById('posterBoardFocus');

  function dateLabel(value){
    var parts=String(value||'').split('-').map(Number);
    return parts.length===3&&parts.every(Number.isFinite)?
      parts[0]+'. '+parts[1]+'. '+parts[2]+'.':'기준일 미상';
  }
  function matches(board,query){
    if(!query)return true;
    var haystack=[board.id,board.address,board.location].join(' ').toLocaleLowerCase('ko');
    return haystack.includes(query);
  }
  function showDetails(board){
    var note='주소: '+board.address+'\n위치: '+board.location+
      '\n기준일: '+dateLabel(data.metadata.effectiveDate)+
      (board.coordinateNote?'\n좌표 참고: '+board.coordinateNote:'')+
      '\n출처: 춘천시 지정 벽보게시판 현황';
    details('지정벽보게시판',board.id,board.location,note);
  }
  function popupFor(board){
    var root=document.createElement('div');
    root.className='poster-board-popup';
    var title=document.createElement('strong');
    title.textContent=board.id;
    var address=document.createElement('p');
    address.textContent=board.address;
    var location=document.createElement('p');
    location.textContent=board.location;
    var note=document.createElement('small');
    note.textContent=dateLabel(data.metadata.effectiveDate)+' 기준'+
      (board.coordinateNote?' · '+board.coordinateNote:'');
    root.append(title,address,location,note);
    return root;
  }
  function addListItem(board){
    var button=document.createElement('button');
    button.type='button';
    button.className='poster-board-item';
    var id=document.createElement('span');
    id.className='poster-board-id';
    id.textContent=board.id;
    var address=document.createElement('span');
    address.className='poster-board-address';
    address.textContent=board.address;
    var location=document.createElement('span');
    location.className='poster-board-location';
    location.textContent=board.location;
    button.append(id,address,location);
    button.addEventListener('click',function(){
      if(!toggle.checked){toggle.checked=true;render();}
      state.map.setView([board.lat,board.lon],16,{animate:true});
      markerById.get(board.id)?.openPopup();
      showDetails(board);
    });
    list.append(button);
  }
  function render(){
    boardLayer.clearLayers();
    markerById.clear();
    visibleMarkers=[];
    list.replaceChildren();
    var query=search.value.trim().toLocaleLowerCase('ko');
    var filtered=data.boards.filter(function(board){return matches(board,query);});
    status.textContent=filtered.length+'개'+(query?' / 전체 '+data.boards.length+'개':' 위치')+
      ' · '+dateLabel(data.metadata.effectiveDate)+' 기준';
    if(!filtered.length){
      var empty=document.createElement('p');
      empty.className='poster-board-empty';
      empty.textContent='일치하는 게시판이 없습니다.';
      list.append(empty);
    }
    filtered.forEach(function(board){
      addListItem(board);
      if(!toggle.checked)return;
      var marker=L.circleMarker([board.lat,board.lon],{
        pane:'posterBoardMarkers',radius:7,weight:2,color:'#fff',
        fillColor:'#d34878',fillOpacity:.93
      }).bindTooltip(board.id+' · '+board.address)
        .bindPopup(popupFor(board))
        .on('click',function(){showDetails(board);})
        .addTo(boardLayer);
      markerById.set(board.id,marker);
      visibleMarkers.push(marker);
    });
  }
  function fitVisible(){
    if(!toggle.checked){toggle.checked=true;render();}
    if(!visibleMarkers.length)return;
    if(visibleMarkers.length===1)state.map.setView(visibleMarkers[0].getLatLng(),16,{animate:true});
    else state.map.fitBounds(L.featureGroup(visibleMarkers).getBounds().pad(.12),{animate:true,maxZoom:15});
  }

  toggle.addEventListener('change',render);
  search.addEventListener('input',render);
  focusButton.addEventListener('click',fitVisible);
  fetch('./data/poster-boards.json').then(function(response){
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
  }).then(function(json){
    data.metadata=json.metadata||{};
    data.boards=(Array.isArray(json.boards)?json.boards:[]).filter(function(board){
      return board.id&&Number.isFinite(Number(board.lat))&&Number.isFinite(Number(board.lon));
    }).map(function(board){
      board.lat=Number(board.lat);board.lon=Number(board.lon);return board;
    }).sort(function(a,b){return Number(a.order)-Number(b.order);});
    render();
  }).catch(function(error){
    status.textContent='위치 자료를 불러오지 못했습니다: '+error.message;
    list.replaceChildren();
  });
})();
