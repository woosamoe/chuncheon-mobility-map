'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const publicDir=process.env.PUBLIC_DIR||'site/public';
const code=fs.readFileSync(publicDir+'/roadview.js','utf8');
for(const token of ['roadviewSelect','roadviewCenter','map.kakao.com/link/roadview/','state.map.on']){
  assert(code.includes(token),'citywide roadview UI is missing '+token);
}

const elements=new Map();
class FakeClassList{
  constructor(){this.values=new Set();}
  toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);}
  contains(name){return this.values.has(name);}
}
class FakeNode{
  constructor(){this.handlers={};this.children=[];this.classList=new FakeClassList();this.textContent='';this.innerHTML='';}
  set id(value){this._id=String(value);elements.set(this._id,this);}
  get id(){return this._id||'';}
  setAttribute(name,value){this[name]=String(value);}
  addEventListener(name,callback){this.handlers[name]=callback;}
  insertAdjacentElement(){}
  prepend(){}
  append(...nodes){this.children.push(...nodes);}
  closest(){return new FakeNode();}
}
function el(id){if(!elements.has(id))elements.set(id,new FakeNode());return elements.get(id);}
const mapHandlers={};
const mapContainer=new FakeNode();
const map={
  on(name,callback){mapHandlers[name]=callback;},
  getCenter(){return{lat:37.8813153,lng:127.7299707};},
  getContainer(){return mapContainer;}
};
const documentHandlers={};
const document={
  createElement(){return new FakeNode();},
  getElementById:el,
  querySelector(){return new FakeNode();},
  addEventListener(name,callback){documentHandlers[name]=callback;},
  head:new FakeNode()
};
const opened=[];
const window={L:{},open(url,target,features){opened.push({url,target,features});return{};}};
vm.runInNewContext(code,{window,L:window.L,document,state:{map},console});

el('roadviewSelect').handlers.click();
assert.equal(el('roadviewSelect')['aria-pressed'],'true','select mode should become active');
assert(mapContainer.classList.contains('roadview-selecting'),'map should show the roadview selection cursor');
mapHandlers.click({latlng:{lat:37.9,lng:127.75}});
assert.equal(opened.length,1,'a map click should open one roadview tab');
assert.equal(opened[0].url,'https://map.kakao.com/link/roadview/37.9000000,127.7500000');
assert.equal(opened[0].target,'_blank');
assert.equal(el('roadviewSelect')['aria-pressed'],'false','select mode should end after choosing a point');

el('roadviewCenter').handlers.click();
assert.equal(opened.length,2,'center button should open roadview');
assert.equal(opened[1].url,'https://map.kakao.com/link/roadview/37.8813153,127.7299707');
console.log('Roadview smoke test passed: citywide map selection and center-point links.');
