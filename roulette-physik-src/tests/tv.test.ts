import {test} from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_TV,tvProjection,warpTV,perceivedTV} from '../src/tv-projection';
test('55 Zoll mit 2 m Unterkante ergibt die richtige Bildschirmmitte',()=>{const p=tvProjection(DEFAULT_TV);assert.ok(Math.abs(p.height-.6849)<.001);assert.ok(Math.abs(2+p.height/2-2.3425)<.001);assert.ok(p.angle>18&&p.angle<19);});
test('Optische Rückprojektion ergibt vom Sitzplatz wieder einen Kreis',()=>{
 for(const distance of [1,3,3.5,4,10])for(const eyeHeight of [.5,1.2,1.7,2.2])for(const bottomHeight of [0,2,4]){
  const p=tvProjection({...DEFAULT_TV,distance,eyeHeight,bottomHeight});
  for(let i=0;i<360;i++){const a=i*Math.PI/180,x=Math.cos(a),y=Math.sin(a),w=warpTV(x,y,p),seen=perceivedTV(w.x,w.y,p);assert.ok(Math.abs(seen.x-p.scale*x)<1e-10);assert.ok(Math.abs(seen.y-p.scale*y)<1e-10);assert.ok(Math.abs(w.y)<=1+1e-10);}
 }
});
test('Auf Augenhöhe ist keine Entzerrung nötig',()=>{const base=tvProjection(DEFAULT_TV),p=tvProjection({...DEFAULT_TV,eyeHeight:DEFAULT_TV.bottomHeight+base.height/2});assert.equal(p.stretch,1);assert.equal(p.keystone,0);assert.equal(p.scale,1);});
