export type Phase='countdown'|'spinning'|'paused'|'complete';
export class Cycle {
 phase:Phase='countdown';total:number|null=12;completed=0;countdown=8;delay=8;running=true;history:number[]=[];
 private serial=0;active:number|null=null;private pending:{total:number|null}|null=null;
 onSpin:((id:number)=>void)|null=null;
 get remaining(){return this.total===null?null:Math.max(0,this.total-this.completed)}
 start(total:number|null){if(total!==null&&(!Number.isInteger(total)||total<1||total>10000))return false;if(this.active!==null){this.pending={total};this.running=true;return true;}this.total=total;this.completed=0;this.running=true;this.countdown=this.delay;this.phase='countdown';return true;}
 tick(dt:number){if(!this.running||this.phase!=='countdown')return;this.countdown=Math.max(0,this.countdown-Math.max(0,dt));if(this.countdown===0)this.spinNow();}
 spinNow(){if(this.active!==null||this.remaining===0)return false;this.active=++this.serial;this.phase='spinning';this.onSpin?.(this.active);return true;}
 land(id:number,n:number){if(this.active!==id||!Number.isInteger(n)||n<0||n>36)return false;this.active=null;this.completed++;this.history.unshift(n);this.history=this.history.slice(0,10);
 if(this.pending){const next=this.pending;this.pending=null;this.start(next.total);return true;}
 this.countdown=this.delay;if(this.remaining===0){this.phase='complete';this.running=false;}else this.phase=this.running?'countdown':'paused';return true;}
 pause(){this.pending=null;this.running=false;if(this.active===null)this.phase=this.remaining===0?'complete':'paused';}
 resume(){if(this.remaining===0)return false;this.running=true;if(this.active===null)this.phase='countdown';return true;}
 stop(){this.pending=null;this.pause();this.countdown=this.delay;}
 setDelay(seconds:number){if(!Number.isFinite(seconds)||seconds<3||seconds>60)return false;this.delay=seconds;if(this.active===null)this.countdown=seconds;return true;}
}
