/** Web Worker für die Wurfplanung. Eine neue Anfrage bricht die laufende ab. */
import {planFreeThrow,type FreeThrowRequest} from './ball-plan';
let current=0;
self.onmessage=(event:MessageEvent<{id:number;request:FreeThrowRequest}>)=>{current=event.data.id;void run(event.data.id,event.data.request);};
async function run(id:number,request:FreeThrowRequest){
 const search=planFreeThrow(request);let step=search.next();
 while(!step.done){
  const until=performance.now()+25;
  while(!step.done&&performance.now()<until)step=search.next();
  if(step.done)break;
  await new Promise(resolve=>setTimeout(resolve,0));
  if(current!==id)return;
 }
 const result=step.value;
 const transfer=result.ok?[result.pos.buffer,result.impacts.buffer,result.events.buffer]:[];
 (self as unknown as {postMessage:(message:unknown,transfer:Transferable[])=>void}).postMessage({id,result},transfer);
}
