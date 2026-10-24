'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const data=JSON.parse(fs.readFileSync('site/public/data/poster-boards.json','utf8'));
const code=fs.readFileSync('site/public/poster-boards.js','utf8');
const expected=[
  '근화2','근화3','우두1','석사2','석사3','석사13','소양6','소양7',
  '운교2','조양2','중앙1','중앙3','강남1','강남4','퇴계2','퇴계3',
  '퇴계5','퇴계6','퇴계7','퇴계15','효자1','효자2','효자3','효자4',
  '효자5','효자6','후평2','후평14','동면1'
];

assert.equal(data.metadata.effectiveDate,'2026-02-17','official reference date changed');
assert.equal(data.metadata.count,29,'metadata count should be 29');
assert.equal(data.boards.length,29,'all 29 official poster boards must be bundled');
assert.deepEqual(data.boards.map(board=>board.id),expected,'management numbers or order changed');
assert.equal(new Set(expected).size,expected.length,'management numbers must be unique');
assert.equal(data.boards.filter(board=>board.coordinateNote).length,4,
  'four changed or unavailable parcel addresses need coordinate notes');
for(const board of data.boards){
  assert(board.address&&board.location,'address and location description are required');
  assert(Number.isFinite(board.lat)&&board.lat>37.7&&board.lat<38.1,
    board.id+' latitude is outside Chuncheon');
  assert(Number.isFinite(board.lon)&&board.lon>127.5&&board.lon<128,
    board.id+' longitude is outside Chuncheon');
}
for(const token of ['posterBoardToggle','posterBoardSearch','posterBoardFocus',
  'posterBoardMarkers','data/poster-boards.json']){
  assert(code.includes(token),'poster-board UI is missing '+token);
}

const elements=new Map();
class FakeNode{
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.handlers={};this.style={};
    this.checked=true;this.value='';this.textContent='';this.className='';this.innerHTML='';
  }
  set id(value){this._id=String(value);elements.set(this._id,this);}
  get id(){return this._id||'';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(name,callback){this.handlers[name]=callback;}
  insertAdjacentElement(){}
  closest(){return null;}
}
function el(id){if(!elements.has(id))elements.set(id,new FakeNode());return elements.get(id);}
const groups=[];
const map={
  panes:new Map(),lastView:null,fitCount:0,
  getPane(name){return this.panes.get(name);},
  createPane(name){const pane=new FakeNode();this.panes.set(name,pane);return pane;},
  setView(point,zoom){this.lastView={point,zoom};},
  fitBounds(){this.fitCount++;}
};
function layerGroup(){
  const group={
    markers:[],
    addTo(){return this;},
    clearLayers(){this.markers=[];},
    addLayer(marker){this.markers.push(marker);return this;}
  };
  groups.push(group);return group;
}
function circleMarker(point,options){
  return {
    point,options,handlers:{},
    bindTooltip(){return this;},
    bindPopup(content){this.popup=content;return this;},
    on(name,callback){this.handlers[name]=callback;return this;},
    addTo(layer){layer.addLayer(this);return this;},
    getLatLng(){return this.point;},
    openPopup(){this.opened=true;return this;}
  };
}
const L={
  layerGroup,
  circleMarker,
  featureGroup:markers=>({getBounds(){return{pad(){return markers.map(m=>m.point);}};}})
};
const document={
  createElement:tag=>new FakeNode(tag),
  getElementById:el,
  querySelector:()=>new FakeNode(),
  head:new FakeNode('head')
};
let detailCount=0;
const context={
  window:{L},L,document,state:{map},console,
  details(){detailCount++;},
  fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve(data)})
};
vm.runInNewContext(code,context);
(async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(groups[0].markers.length,29,'29 map markers should render');
  assert.equal(el('posterBoardList').children.length,29,'29 searchable rows should render');
  assert.match(el('posterBoardStatus').textContent,/29개 위치/,'status should show 29 locations');
  assert(groups[0].markers.every(marker=>marker.options.pane==='posterBoardMarkers'),
    'poster-board markers must render in their high-z-index pane');

  el('posterBoardSearch').value='우두동';
  el('posterBoardSearch').handlers.input();
  assert.equal(groups[0].markers.length,1,'search should filter the map markers');
  assert.equal(el('posterBoardList').children.length,1,'search should filter the list');
  el('posterBoardFocus').handlers.click();
  assert.equal(map.lastView.zoom,16,'single search result should focus at street level');
  el('posterBoardList').children[0].handlers.click();
  assert(detailCount>0,'list selection should open board details');
  console.log('Poster-board smoke test passed: 29 locations, date, marker layer, search and focus controls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
