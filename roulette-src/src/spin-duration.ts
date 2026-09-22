// Timing is drawn separately from the winning pocket and never changes its odds.
export function spinDuration(mean:number,spread:number,unit:number){
 return Math.max(10,Math.min(30,mean+(Math.max(0,Math.min(1,unit))*2-1)*spread));
}
export function randomSpinDuration(mean:number,spread:number){
 return spinDuration(mean,spread,crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
}
