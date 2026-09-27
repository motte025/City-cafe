/**
 * Siegerfeier am TV (Standard 3 Minuten): Feuerwerk und Konfetti in den
 * Kesselfarben, drehende Lichtstrahlen, goldener Pokal, Name des Siegers und
 * Siegertreppchen (Sieger in der Mitte). Danach meldet onDone das Ende – die
 * Anzeige kehrt in den normalen Zyklus zurück.
 * Pokal und Medaillen sind eigene Grafiken statt Emojis, damit sie auf jedem
 * Gerät gleich golden aussehen.
 */
export interface CelebrationInfo {title:string;name:string;detail:string;podium:{place:number;name:string;score:string}[];
 /** Endtabelle aller Spieler, letzte Zahl und Spieldauer (rechte Spalte der Karte) */
 table?:{place:number;name:string;score:number;extra:string;winner:boolean}[];last?:{number:number;color:string;by:string}|null;time?:string}
const COLORS=['#e6c26f','#f6e2a8','#b8872f','#c0283f','#0c8a55','#f3efe4'];
const TROPHY=`<svg viewBox="0 0 120 130" aria-hidden="true"><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#8a5d17"/><stop offset=".35" stop-color="#f7dc8b"/><stop offset=".55" stop-color="#fff4cf"/><stop offset=".75" stop-color="#d9a841"/><stop offset="1" stop-color="#7a5012"/></linearGradient></defs>
 <path d="M30 14h60v10c0 26-12 42-30 46-18-4-30-20-30-46z" fill="url(#cg)"/><path d="M30 22H14c0 18 8 28 20 30M90 22h16c0 18-8 28-20 30" fill="none" stroke="url(#cg)" stroke-width="7" stroke-linecap="round"/>
 <path d="M53 69h14l3 22H50z" fill="url(#cg)"/><rect x="36" y="90" width="48" height="10" rx="3" fill="url(#cg)"/><rect x="28" y="100" width="64" height="18" rx="4" fill="#3a2410" stroke="url(#cg)" stroke-width="3"/>
 <path d="M60 28l4.5 9 10 1.4-7.3 7 1.8 10L60 50.8 51 55.4l1.8-10-7.3-7 10-1.4z" fill="#fff8e0" opacity=".9"/></svg>`;
const medal=(place:number)=>`<svg viewBox="0 0 40 52" class="medal m${Math.min(place,4)}" aria-hidden="true"><path d="M10 0h8l6 18h-8zM30 0h-8l-6 18h8z" fill="#9c2439"/><circle cx="20" cy="33" r="16"/><text x="20" y="39" text-anchor="middle">${place}</text></svg>`;
type Bit={x:number;y:number;vx:number;vy:number;r:number;w:number;h:number;spin:number;c:string;sway:number;life:number;spark:boolean};
export class Celebration {
 private root:HTMLElement;private canvas:HTMLCanvasElement;private raf=0;private timer=0;private bits:Bit[]=[];private last=0;private nextBurst=0;private economy=false;
 constructor(host:HTMLElement,private seconds=180,private onDone:()=>void=()=>{}){
  this.root=document.createElement('div');this.root.className='celebration';this.root.hidden=true;
  this.root.innerHTML=`<canvas class="celebration-confetti"></canvas><div class="celebration-rays"></div><div class="celebration-card"><div class="celebration-main"><div class="celebration-trophy">${TROPHY}</div><div class="celebration-title"></div><h2 class="celebration-name"></h2><p class="celebration-detail"></p><ol class="celebration-podium"></ol></div><aside class="celebration-side" hidden><div class="celebration-side-head"><span>ENDSTAND</span><em class="celebration-time"></em></div><table class="celebration-table"><tbody></tbody></table><div class="celebration-last"><span>LETZTE ZAHL</span><b class="celebration-last-chip"></b><em class="celebration-last-by"></em></div></aside></div>`;
  host.append(this.root);this.canvas=this.root.querySelector('canvas')!;
 }
 get active(){return !this.root.hidden;}
 show(info:CelebrationInfo,economy=false){
  const q=(s:string)=>this.root.querySelector<HTMLElement>(s)!;this.economy=economy;
  q('.celebration-title').textContent=info.title;q('.celebration-name').textContent=info.name;q('.celebration-detail').textContent=info.detail;
  // Treppchen: Zweiter links, Sieger in der Mitte, Dritter rechts – nach Rangfolge, nicht nach Platzziffer (Gleichstand!).
  const podium=q('.celebration-podium');podium.innerHTML='';
  info.podium.forEach((p,rank)=>{const li=document.createElement('li');li.className=`step-${rank+1}`;li.innerHTML=`${medal(p.place)}<b></b><em></em>`;li.querySelector('b')!.textContent=p.name;li.querySelector('em')!.textContent=p.score;podium.append(li);});
  const side=q('.celebration-side'),rows=info.table??[];side.hidden=rows.length===0;
  const body=q('.celebration-table tbody');body.innerHTML='';for(const r of rows){const tr=document.createElement('tr');if(r.winner)tr.className='winner';tr.innerHTML='<td></td><th></th><td></td><td></td>';const c=tr.children;c[0].textContent=`${r.place}.`;c[1].textContent=r.name;c[2].textContent=String(r.score);c[3].textContent=r.extra;body.append(tr);}
  side.style.setProperty('--rows',String(Math.max(4,rows.length)));q('.celebration-time').textContent=info.time?`Spielzeit ${info.time}`:'';
  const chip=q('.celebration-last-chip');q('.celebration-last').hidden=!info.last;if(info.last){chip.textContent=String(info.last.number);chip.className=`celebration-last-chip ${info.last.color}`;q('.celebration-last-by').textContent=info.last.by;}
  this.root.hidden=false;this.root.classList.remove('play');void this.root.offsetWidth;this.root.classList.add('play');
  this.resize();const {width:w,height:h}=this.canvas;
  this.bits=Array.from({length:economy?120:260},()=>this.confetti(w,(Math.random()*1.4-.6)*h));
  this.nextBurst=0;cancelAnimationFrame(this.raf);this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));
  clearTimeout(this.timer);this.timer=window.setTimeout(()=>{this.hide();this.onDone();},this.seconds*1000);
 }
 /** Feier sofort beenden (ohne onDone), z. B. bei neuem Spiel oder „Spiel beenden“. */
 hide(){this.root.hidden=true;cancelAnimationFrame(this.raf);clearTimeout(this.timer);this.bits=[];}
 private resize(){const s=Math.min(1,devicePixelRatio||1);this.canvas.width=Math.round(innerWidth*s);this.canvas.height=Math.round(innerHeight*s);}
 private confetti(w:number,y:number):Bit{const u=this.canvas.height/1080;return {x:Math.random()*w,y,vx:(Math.random()-.5)*60*u,vy:(90+Math.random()*150)*u,r:Math.random()*Math.PI,w:(9+Math.random()*11)*u,h:(4+Math.random()*7)*u,spin:(Math.random()-.5)*8,c:COLORS[Math.floor(Math.random()*COLORS.length)],sway:Math.random()*Math.PI*2,life:Infinity,spark:false};}
 /** Feuerwerk: ein Ring glühender Funken, die unter Schwerkraft verglühen. */
 private burst(){
  const {width:w,height:h}=this.canvas,u=h/1080,x=w*(.12+Math.random()*.76),y=h*(.12+Math.random()*.35),c=COLORS[Math.floor(Math.random()*4)],n=this.economy?40:80,speed=(220+Math.random()*160)*u;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,v=speed*(.55+Math.random()*.45);this.bits.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:0,w:3.2*u,h:3.2*u,spin:0,c,sway:0,life:1.4+Math.random()*.6,spark:true});}
 }
 private frame(time:number){
  if(this.root.hidden)return;const dt=this.last?Math.min(.05,(time-this.last)/1000):0;this.last=time;
  const ctx=this.canvas.getContext('2d');if(!ctx)return;const {width:w,height:h}=this.canvas,u=h/1080;ctx.clearRect(0,0,w,h);
  this.nextBurst-=dt;if(this.nextBurst<=0){this.burst();if(Math.random()<.4)this.burst();this.nextBurst=.6+Math.random()*1.1;}
  ctx.globalCompositeOperation='lighter';
  this.bits=this.bits.filter(p=>{
   if(p.spark){p.life-=dt;if(p.life<=0)return false;p.vx*=1-1.6*dt;p.vy=p.vy*(1-1.6*dt)+160*u*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.min(1,p.life);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.w,0,Math.PI*2);ctx.fill();return true;}
   return true;});
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  for(const p of this.bits){if(p.spark)continue;p.sway+=dt*2;p.x+=(p.vx+Math.sin(p.sway)*30)*dt;p.y+=p.vy*dt;p.r+=p.spin*dt;
   if(p.y>h+20)Object.assign(p,this.confetti(w,-20));
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.scale(1,Math.cos(p.sway*1.7));ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();}
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
}
