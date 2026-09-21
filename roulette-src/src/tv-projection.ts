export interface TVSettings {diagonal:number;bottomHeight:number;eyeHeight:number;distance:number;correction:boolean}
export const DEFAULT_TV:TVSettings={diagonal:55,bottomHeight:2,eyeHeight:1.2,distance:3.5,correction:true};
export function tvProjection(settings:TVSettings){
 const height=settings.diagonal*.0254*9/Math.sqrt(16**2+9**2);
 const offset=settings.bottomHeight+height/2-settings.eyeHeight,distance=Math.max(.5,settings.distance),length=Math.hypot(distance,offset);
 const stretch=length/distance,keystone=offset*height/(2*length*distance);
 const scale=1/(stretch+Math.abs(keystone));
 return {height,stretch,keystone,scale,angle:Math.atan2(offset,distance)*180/Math.PI};
}
// Pre-distortion for a vertical 16:9 screen, viewed centrally from below/above.
export function warpTV(x:number,y:number,p:ReturnType<typeof tvProjection>){const w=1-p.keystone*p.scale*y;return {x:p.scale*x/w,y:p.scale*p.stretch*y/w};}
export function perceivedTV(x:number,y:number,p:ReturnType<typeof tvProjection>){const d=1+(p.keystone/p.stretch)*y;return {x:x/d,y:y/(p.stretch*d)};}
