'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const elements=new Map();
class FakeNode {
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.style={};this.classList={add(){}};
    this.handlers={};this.checked=true;this.textContent='';this.className='';
    this._value='';this.innerHTML='';
  }
  set value(v){this._value=String(v);}
  get value(){return this._value||((this.children.find(n=>n.tag==='option')||{}).value||'');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  insertAdjacentElement(){ }
  addEventListener(name,callback){this.handlers[name]=callback;}
  querySelector(){return null;}
  closest(){return null;}
}
function el(id){if(!elements.has(id))elements.set(id,new FakeNode());return elements.get(id);}
const allGroups=[];
const map={
  panes:new Map(),lastView:null,fitCount:0,
  getPane(key){return this.panes.get(key);},
  createPane(key){const pane=new FakeNode();this.panes.set(key,pane);return pane;},
  setView(point,zoom){this.lastView={point,zoom};},
  fitBounds(){this.fitCount++;},
};
function group(){
  const g={
    markers:[],
    addTo(){return this;},
    clearLayers(){this.markers=[];},
    addLayer(m){this.markers.push(m);return this;}
  };
  allGroups.push(g);return g;
}
function marker(point,options={}){
  return {
    point,options,
    bindTooltip(){return this;},
    bindPopup(content){this.popup=content;return this;},
    addTo(layer){layer.addLayer(this);return this;},
    getLatLng(){return this.point;},
    openPopup(){this.opened=true;return this;},
    setZIndexOffset(){return this;},
    on(){return this;}
  };
}
const L={
  layerGroup:group,
  divIcon:opts=>opts,
  marker,
  circleMarker:marker,
  featureGroup:arr=>({getBounds(){return arr.map(x=>x.getLatLng());}})
};
const entries=[
  {name:'소양강스카이워크',year:2021,month:1,visitors:120},
  {name:'구곡폭포',year:2021,month:1,visitors:240},
  {name:'삼악산',year:2021,month:1,visitors:360},
  {name:'청평사',year:2021,month:1,visitors:480},
  {name:'공영주차장',year:2021,month:1,visitors:9999999},
];
const data={
  bus:[],sales:[],facility:entries,
  metadata:{bus:{},sales:{},facility:{years:[2017,2018,2019,2020,2021]}}
};
const document={
  createElement:tag=>new FakeNode(tag),
  getElementById:el,
  querySelectorAll:()=>[new FakeNode(),new FakeNode()],
  querySelector:()=>new FakeNode(),
  head:new FakeNode('head')
};
const ctx={
  window:{L},document,state:{map},L,render(){},
  fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve(data)}),
  details(){},console
};
const code=fs.readFileSync('site/public/activity.js','utf8');
vm.runInNewContext(code,ctx);
(async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  const touristLayer=allGroups[2];
  assert.equal(touristLayer.markers.length,4,'four tourist markers should be visible');
  const controls=el('facilityActivityList').children;
  assert.equal(controls.length,4,'four tourist buttons should be listed');
  assert(!controls.some(x=>JSON.stringify(x).includes('공영주차장')),'public parking is not tourist attraction');
  assert(touristLayer.markers.every(m=>m.options.pane==='tourismMarkers'),
    'tourism pins must render in higher-z-index layer');
  const target=controls.find(b=>JSON.stringify(b).includes('구곡폭포'));
  assert(target&&target.handlers.click,'click-to-focus tourist control missing');
  target.handlers.click();
  assert.equal(map.lastView.zoom,14,'tourist item click should zoom to tourist site');
  el('tourismActivityFocus').handlers.click();
  assert(map.fitCount>0,'tourist show-all should fit map to all attraction markers');
  console.log('Tourism marker smoke test passed: 4 tourist pins, no parking, site focus and map-fit controls.');
})().catch(err=>{console.error(err);process.exitCode=1;});
