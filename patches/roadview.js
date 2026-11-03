'use strict';
(function () {
  if (!window.L || !state.map) return;

  var ROADVIEW_BASE='https://map.kakao.com/link/roadview/';
  var selecting=false;

  var panel=document.createElement('section');
  panel.className='section roadview-section';
  panel.innerHTML=[
    '<h2>춘천시 전체 로드뷰</h2>',
    '<p class="roadview-note">춘천 지도에서 원하는 도로를 선택하면 가장 가까운 카카오 로드뷰를 새 탭에서 엽니다.</p>',
    '<button id="roadviewSelect" class="roadview-primary" type="button" aria-pressed="false">지도에서 위치 선택</button>',
    '<button id="roadviewCenter" class="roadview-secondary" type="button">현재 지도 중심 로드뷰 ↗</button>',
    '<p id="roadviewStatus" class="roadview-status" aria-live="polite">춘천시 전역에서 이용할 수 있습니다.</p>',
    '<p class="roadview-privacy">선택한 좌표는 로드뷰를 열 때 카카오 지도로 전달됩니다.</p>'
  ].join('');
  var layerSection=document.getElementById('speedToggle')?.closest('.section');
  if(layerSection)layerSection.insertAdjacentElement('afterend',panel);
  else document.querySelector('.side-scroll')?.prepend(panel);

  var style=document.createElement('style');
  style.textContent=[
    '.roadview-note{font-size:12px;color:#526a65;line-height:1.5;margin:5px 0 10px}',
    '.roadview-primary,.roadview-secondary{display:block;width:100%;border-radius:8px;padding:10px 9px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}',
    '.roadview-primary{border:1px solid #2d776c;background:#e8f5f2;color:#205e55}',
    '.roadview-primary:hover,.roadview-primary[aria-pressed="true"]{background:#2d776c;color:#fff}',
    '.roadview-primary[aria-pressed="true"]{box-shadow:0 0 0 3px #2d776c33}',
    '.roadview-secondary{border:1px solid #c9d6d3;background:#fff;color:#385e57;margin-top:6px}',
    '.roadview-secondary:hover{background:#f2f7f6;border-color:#6f948d}',
    '.roadview-status{font-size:11px;color:#526a65;line-height:1.45;margin:8px 2px 3px}',
    '.roadview-privacy{font-size:10px;color:#7a8885;line-height:1.4;margin:3px 2px 0}',
    '#map.roadview-selecting,.roadview-selecting{cursor:crosshair!important}',
    '#map.roadview-selecting .leaflet-interactive{cursor:crosshair!important}'
  ].join('\n');
  document.head.append(style);

  var selectButton=document.getElementById('roadviewSelect');
  var centerButton=document.getElementById('roadviewCenter');
  var status=document.getElementById('roadviewStatus');
  var mapContainer=typeof state.map.getContainer==='function'?state.map.getContainer():null;

  function roadviewUrl(latlng){
    var lat=Number(latlng&&latlng.lat),lon=Number(latlng&&latlng.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return '';
    return ROADVIEW_BASE+lat.toFixed(7)+','+lon.toFixed(7);
  }
  function setSelecting(next){
    selecting=Boolean(next);
    selectButton.setAttribute('aria-pressed',String(selecting));
    selectButton.textContent=selecting?'선택 취소':'지도에서 위치 선택';
    if(mapContainer&&mapContainer.classList)mapContainer.classList.toggle('roadview-selecting',selecting);
    status.textContent=selecting?
      '지도에서 로드뷰로 확인할 위치를 클릭하세요.':'춘천시 전역에서 이용할 수 있습니다.';
  }
  function openRoadview(latlng){
    var url=roadviewUrl(latlng);
    if(!url){
      status.textContent='선택한 위치의 좌표를 확인할 수 없습니다.';
      return false;
    }
    var opened=window.open(url,'_blank','noopener,noreferrer');
    if(opened)opened.opener=null;
    status.textContent='선택한 위치의 카카오 로드뷰를 새 탭에서 열었습니다.';
    return true;
  }

  selectButton.addEventListener('click',function(){setSelecting(!selecting);});
  centerButton.addEventListener('click',function(){openRoadview(state.map.getCenter());});
  state.map.on('click',function(event){
    if(!selecting)return;
    setSelecting(false);
    openRoadview(event.latlng);
  });
  document.addEventListener('keydown',function(event){
    if(selecting&&event.key==='Escape')setSelecting(false);
  });
})();
