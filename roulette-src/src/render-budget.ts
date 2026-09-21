import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Merge only siblings with identical material AND shadow flags. Rotor stays separate. */
export function batchMeshes(group:T.Group){
 const buckets=new Map<string,T.Mesh[]>();
 for(const child of group.children){if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;const key=`${child.material.uuid}/${child.castShadow}/${child.receiveShadow}/${child.renderOrder}`;const list=buckets.get(key)??[];list.push(child);buckets.set(key,list);}
 for(const meshes of buckets.values()){
  if(meshes.length<2)continue;
  const parts=meshes.map(mesh=>{mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));g.clearGroups();return g;});
  const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geometry)throw new Error('Geometrien konnten nicht zusammengefasst werden');
  geometry.computeBoundingSphere();const first=meshes[0],merged=new T.Mesh(geometry,first.material);merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;merged.renderOrder=first.renderOrder;
  group.add(merged);meshes.forEach(mesh=>{group.remove(mesh);mesh.geometry.dispose();});
 }
}
export function bufferSize(width:number,height:number,dpr:number,economy:boolean,scale:number){
 const ratio=economy?Math.min(1,1280/width,720/height)*Math.max(.5,Math.min(1,scale)):Math.min(Math.max(1,dpr),2);
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
/** Shadow cadence follows wall time; visual motion remains sampled at every frame. */
export function shadowDue(now:number,last:number,economy:boolean,moving:boolean,dirty:boolean){return dirty||(moving&&(!economy||now-last>=1000/15));}
