/**
 * Hauptthread-Seite der Wurfplanung: rechnet im Web Worker (ball-worker.ts),
 * damit die Darstellung auch auf der TV-Box flüssig bleibt. Ohne Worker läuft
 * dieselbe Suche gestückelt im Hauptthread. Jede neue Anfrage ersetzt die alte.
 */
import type {FreeThrowRequest,PlanResult} from './ball-plan';

export interface PlanTicket {id:number;request:FreeThrowRequest;result:PlanResult|null;started:number;finished:number}

export class BallPlanner {
 current:PlanTicket|null=null;
 onResult:((ticket:PlanTicket)=>void)|null=null;
 private worker:Worker|null=null;private workerFailed=false;private seq=0;
 request(request:FreeThrowRequest):PlanTicket{
  const ticket:PlanTicket={id:++this.seq,request,result:null,started:performance.now(),finished:0};this.current=ticket;
  if(!this.workerFailed){
   try{this.ensureWorker();this.worker!.postMessage({id:ticket.id,request});return ticket;}
   catch{this.workerFailed=true;this.worker=null;}
  }
  void this.runLocal(ticket);return ticket;
 }
 private finish(ticket:PlanTicket,result:PlanResult){
  if(this.current!==ticket||ticket.result)return;
  ticket.result=result;ticket.finished=performance.now();this.onResult?.(ticket);
 }
 private ensureWorker(){
  if(this.worker)return;
  const worker=new Worker(new URL('./ball-worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=(event:MessageEvent<{id:number;result:PlanResult}>)=>{const t=this.current;if(t&&t.id===event.data.id)this.finish(t,event.data.result);};
  worker.onerror=()=>{this.workerFailed=true;worker.terminate();this.worker=null;const t=this.current;if(t&&!t.result)void this.runLocal(t);};
  this.worker=worker;
 }
 /** Notlösung ohne Worker: Suche in Scheiben von wenigen Millisekunden. */
 private async runLocal(ticket:PlanTicket){
  const {planFreeThrow}=await import('./ball-plan');
  const search=planFreeThrow(ticket.request);
  const slice=()=>{
   if(this.current!==ticket)return;
   const until=performance.now()+5;let step=search.next();
   while(!step.done&&performance.now()<until)step=search.next();
   if(step.done)this.finish(ticket,step.value);else setTimeout(slice,0);
  };
  slice();
 }
}
