'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const publicDir=process.env.PUBLIC_DIR||'site/public';
const code=fs.readFileSync(publicDir+'/banner-route-editor.js','utf8');
const applyScript=fs.readFileSync('patches/apply.sh','utf8');
assert(applyScript.includes('banner-route-editor.js?v=editor-20261103-fullpath'),
  'published editor URL should be cache-busted after drag fixes');
for(const token of ['bannerEditorGroup','bannerEditorPath','bannerEditorFitGroup','bannerEditorSnap',
  'router.project-osrm.org','localStorage','banner-route-lines-edited.json']){
  assert(code.includes(token),'banner route editor is missing '+token);
}

const elements=new Map();
let downloads=0;
class FakeClassList{
  constructor(){this.values=new Set();}
  toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);}
}
class FakeNode{
  constructor(tag='div'){
    this.tag=tag;this.handlers={};this.children=[];this.classList=new FakeClassList();
    this.style={};this.textContent='';this.innerHTML='';this.value='';this.disabled=false;
  }
  set id(value){this._id=String(value);elements.set(this._id,this);}
  get id(){return this._id||'';}
  addEventListener(name,callback){this.handlers[name]=callback;}
  insertAdjacentElement(){}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  closest(){return new FakeNode();}
  click(){downloads++;}
  remove(){}
}
function el(id){if(!elements.has(id))elements.set(id,new FakeNode());return elements.get(id);}

const groups=[];
function layerGroup(){
  const group={items:[],addTo(){return this;},clearLayers(){this.items=[];}};
  groups.push(group);return group;
}
function polyline(points,options){
  return{points,options,addTo(layer){layer.items.push(this);return this;},
    setLatLngs(next){this.points=next;return this;}};
}
function marker(point,options){
  return{
    point,options,handlers:{},draggingEnabled:false,
    dragging:{enable(){this.owner.draggingEnabled=true;}},
    addTo(layer){layer.items.push(this);return this;},
    on(name,callback){this.handlers[name]=callback;return this;},
    getLatLng(){return{lat:this.point[0],lng:this.point[1]};}
  };
}
const mapHandlers={};
const panes={};
const map={
  on(name,callback){mapHandlers[name]=callback;},
  fitBounds(){this.fitCount=(this.fitCount||0)+1;},
  getContainer(){return new FakeNode();},
  getPane(name){return panes[name]||null;},
  createPane(name){const pane={style:{}};panes[name]=pane;return pane;},
  dragging:{active:true,enabled(){return this.active;},disable(){this.active=false;},enable(){this.active=true;}}
};
const L={layerGroup,polyline,marker(point,options){
  const value=marker(point,options);value.dragging.owner=value;return value;
},divIcon:options=>options,latLngBounds:points=>points,DomEvent:{stopPropagation(){}}};
const documentHandlers={};
const document={
  createElement:tag=>new FakeNode(tag),
  getElementById:el,
  querySelector:()=>new FakeNode(),
  addEventListener(name,callback){documentHandlers[name]=callback;},
  head:new FakeNode('head'),
  body:new FakeNode('body')
};
const storage=new Map();
const localStorage={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
const longPath=Array.from({length:30},(_,index)=>[37.88+index*0.0002,127.72+index*0.0002]);
const fixture={
  metadata:{pathCount:2},
  corridors:{A:[longPath,[[37.89,127.73],[37.895,127.735],[37.90,127.74]]]}
};
function fetch(url){
  if(String(url).includes('router.project-osrm.org')){
    return Promise.resolve({ok:true,json:()=>Promise.resolve({
      routes:[{geometry:{coordinates:[[127.72,37.88],[127.721,37.881],[127.73,37.89]]}}]
    })});
  }
  return Promise.resolve({ok:true,json:()=>Promise.resolve(fixture)});
}
const URL={createObjectURL:()=> 'blob:editor',revokeObjectURL(){}};
const context={window:{L},L,document,state:{map},localStorage,fetch,URL,Blob,console,
  setTimeout:callback=>callback()};
vm.runInNewContext(code,context);

(async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(el('bannerEditorGroup').value,'A','first route group should be selected');
  assert.equal(el('bannerEditorPath').children.length,2,'path selector should list every group path');
  assert(map.fitCount>0,'the whole selected group should be focused on the map');
  assert(groups.some(group=>group.items.some(item=>item.options?.dashArray==='8 8')),
    'other paths in the selected group should remain visible as context');
  const initialFitCount=map.fitCount;
  el('bannerEditorFitGroup').handlers.click();
  assert(map.fitCount>initialFitCount,'group overview button should fit every path in the group');
  const firstHandle=groups.flatMap(group=>group.items).find(item=>item.options?.draggable);
  assert.equal(firstHandle.options.draggable,true,'control handles should be draggable');
  assert.equal(firstHandle.options.icon.iconSize[0],38,'control handles should have a generous drag target');
  assert.equal(firstHandle.options.zIndexOffset,3000,'control handles should stay above map layers');
  assert.equal(firstHandle.options.pane,'bannerEditorControls','control handles should use their own top pane');
  assert.equal(panes.bannerEditorControls.style.zIndex,'760','control pane should stay above canvas marker layers');
  assert.equal(firstHandle.draggingEnabled,true,'marker dragging should be explicitly enabled');
  firstHandle.handlers.dragstart();
  firstHandle.point=[37.881,127.721];
  firstHandle.handlers.drag();
  assert.match(el('bannerEditorStatus').textContent,/드래그하는 중/,'route should update during drag');
  assert.match(el('bannerEditorStatus').textContent,/경로 30개 좌표/,
    'dragging one sampled control should preserve the full source path');
  const activeLine=groups.flatMap(group=>group.items).find(item=>item.options?.weight===6);
  assert.equal(activeLine.points.length,30,'the rendered path should keep all original coordinates while dragging');
  assert.equal(activeLine.points[0][0],37.881,'the dragged control should update its matching source latitude');
  assert.equal(activeLine.points[0][1],127.721,'the dragged control should update its matching source longitude');
  firstHandle.handlers.dragend();
  assert.equal(map.dragging.active,true,'map dragging should be restored after handle drag');

  el('bannerEditorNew').handlers.click();
  mapHandlers.click({latlng:{lat:37.88,lng:127.72}});
  mapHandlers.click({latlng:{lat:37.89,lng:127.73}});
  el('bannerEditorSnap').handlers.click();
  await new Promise(resolve=>setImmediate(resolve));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(el('bannerEditorStatus').textContent,/도로망에 맞춘/,'OSRM result should be applied');

  el('bannerEditorApply').handlers.click();
  assert(storage.has('chuncheon-banner-route-editor-v2'),'applied routes should persist in the new full-path draft');
  el('bannerEditorDownload').handlers.click();
  assert.equal(downloads,1,'edited JSON should be downloaded');
  console.log('Banner route editor smoke test passed: select, draw, road-snap, save and download.');
})().catch(error=>{console.error(error);process.exitCode=1;});
