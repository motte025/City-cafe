type Snapshot={val:()=>any};
type Ref={on:(event:string,fn:(s:Snapshot)=>void,error?:(e:unknown)=>void)=>void;off:()=>void;set:(value:unknown)=>Promise<void>};
type Connection={db:{ref:(path:string)=>Ref}};
type Legacy=Window&{DJ_REMOTE_NET?:{bereit:()=>Promise<Connection|null>}};
let ready:Promise<Connection|null>|null=null;
function script(src:string){return new Promise<void>((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=()=>resolve();el.onerror=()=>reject(new Error('Verbindung konnte nicht geladen werden'));document.head.append(el);});}
function connectFirebase(){return ready??= (async()=>{for(const url of ['https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js','https://motte025.github.io/City-cafe/dj-fernbedienung-config.js','https://motte025.github.io/City-cafe/dj-fernbedienung-net.js'])await script(url);return (window as Legacy).DJ_REMOTE_NET!.bereit();})();}
export class Relay {
 connected=false;private connection:Connection|null=null;private room='';private incoming:Ref|null=null;private online:Ref|null=null;private seen=new Set<string>();private offset=0;private offsetRef:Ref|null=null;
 onMessage:((body:unknown,id:string)=>void)|null=null;onConnection:((connected:boolean)=>void)|null=null;
 /** Seltenes vom TV (Einstellungen, letztes Spiel): eigener Kanal, damit es nicht jede Sekunde mitgeschickt werden muss. */
 onSlow:((body:unknown)=>void)|null=null;private slowRef:Ref|null=null;
 constructor(private role:'tv'|'remote'){}
 async connect(room:string){
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(room))throw new Error('Ungültiger Screenname');this.close();this.room=room;
  try{const connection=await connectFirebase();if(!connection)throw new Error('Firebase nicht erreichbar');this.connection=connection;
   this.online=connection.db.ref('.info/connected');this.online.on('value',snap=>{this.connected=!!snap.val();this.onConnection?.(this.connected);});
   // Uhren von TV und Handy gehen oft auseinander: Alter immer an der Firebase-Serverzeit messen.
   this.offsetRef=connection.db.ref('.info/serverTimeOffset');this.offsetRef.on('value',snap=>{const v=Number(snap.val());this.offset=Number.isFinite(v)?v:0;});
   this.incoming=connection.db.ref(`djremote/${room}/roulette/${this.role==='tv'?'befehl':'status'}`);
   this.incoming.on('value',snap=>{const v=snap.val();if(!v||typeof v.id!=='string'||this.seen.has(v.id)||!Number.isFinite(v.ts)||Math.abs(Date.now()+this.offset-v.ts)>30000)return;this.seen.add(v.id);if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);try{this.onMessage?.(typeof v.payload==='string'?JSON.parse(v.payload):v.body,v.id);}catch{}},()=>{this.connected=false;this.onConnection?.(false);});
   // Ohne Altersprüfung: der Wert gilt, bis der TV einen neuen schreibt (er schreibt ihn bei jeder Verbindung neu).
   if(this.role==='remote'){this.slowRef=connection.db.ref(`djremote/${room}/roulette/selten`);this.slowRef.on('value',snap=>{const v=snap.val();if(!v||typeof v.payload!=='string')return;try{this.onSlow?.(JSON.parse(v.payload));}catch{}});}
  }catch{this.connected=false;this.onConnection?.(false);}
 }
 async send(body:unknown){if(!this.connected||!this.connection)return null;const id=crypto.randomUUID();try{await this.connection.db.ref(`djremote/${this.room}/roulette/${this.role==='tv'?'status':'befehl'}`).set({id,ts:{'.sv':'timestamp'},payload:JSON.stringify(body)});return id;}catch{this.onConnection?.(false);return null;}}
 async sendSlow(body:unknown){if(this.role!=='tv'||!this.connected||!this.connection)return false;try{await this.connection.db.ref(`djremote/${this.room}/roulette/selten`).set({ts:{'.sv':'timestamp'},payload:JSON.stringify(body)});return true;}catch{return false;}}
 close(){this.slowRef?.off();this.slowRef=null;this.incoming?.off();this.online?.off();this.offsetRef?.off();this.offsetRef=null;this.incoming=null;this.online=null;this.connection=null;this.connected=false;}
}
