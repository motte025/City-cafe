import test from 'node:test';import assert from 'node:assert/strict';
import * as T from 'three';import {batchMeshes,bufferSize,shadowDue} from '../src/render-budget';import {applySettings,DEFAULT_SETTINGS} from '../src/settings';import {readFileSync} from 'node:fs';
test('Renderpuffer begrenzt Pixeldichte und erhält das Anzeigeformat',()=>{
 assert.deepEqual(bufferSize(1920,1080,2,true,1),{width:1280,height:720});assert.deepEqual(bufferSize(1280,720,2,true,.75),{width:960,height:540});assert.deepEqual(bufferSize(800,450,2,true,1),{width:800,height:450});assert.deepEqual(bufferSize(1280,720,2,false,.5),{width:2560,height:1440});
 const portrait=bufferSize(720,1280,2,true,1);assert.equal(portrait.height,720);assert.ok(Math.abs(portrait.width/portrait.height-720/1280)<.002);
});
test('Sparmodus aktualisiert Schatten begrenzt, finale Landung sofort',()=>{
 assert.equal(shadowDue(50,0,true,true,false),false);assert.equal(shadowDue(70,0,true,true,false),true);assert.equal(shadowDue(20,0,true,false,true),true);assert.equal(shadowDue(200,0,true,false,false),false);assert.equal(shadowDue(16,0,false,true,false),true);
});
test('Batching bewahrt transformierte Geometrie und Material-/Schattengrenzen',()=>{
 const group=new T.Group(),mat=new T.MeshStandardMaterial(),other=new T.MeshStandardMaterial();
 for(let i=0;i<5;i++){const m=new T.Mesh(new T.BoxGeometry(1,2,3),i===4?other:mat);m.position.set(i*2,1,-i);m.rotation.y=i*.3;m.castShadow=i!==3;group.add(m);}
 const before=new T.Box3().setFromObject(group);const triangles=group.children.reduce((n,o)=>n+(o as T.Mesh).geometry.index!.count/3,0);batchMeshes(group);const after=new T.Box3().setFromObject(group);assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);assert.equal(group.children.length,3);assert.equal(group.children.reduce((n,o)=>{const g=(o as T.Mesh).geometry;return n+(g.index?.count??g.getAttribute('position').count)/3;},0),triangles);
});
test('Leistungsoptionen validieren externe Einstellungen',()=>{assert.equal(applySettings(DEFAULT_SETTINGS,{economy:true,renderScale:.1}).renderScale,.5);assert.equal(applySettings(DEFAULT_SETTINGS,{economy:'yes'}).economy,false);assert.equal(applySettings(DEFAULT_SETTINGS,{economy:true}).economy,true);});
test('Betreiber-Schriftblock bleibt im Quell-HTML',()=>{const html=readFileSync(new URL('../remote.html',import.meta.url),'utf8');assert.match(html,/Handy-Schriften/);assert.match(html,/font-size: 54px/);assert.match(html,/grid-template-columns: repeat\(2, 1fr\)/);});
