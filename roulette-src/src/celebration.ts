/**
 * Siegerfeier am TV: Konfetti in den Kesselfarben, Lichtstrahlen, Pokal,
 * Name des Siegers und Siegertreppchen. Blendet sich nach einer Weile von
 * selbst aus; die Punktetafel links zeigt den Sieger danach weiter.
 */
export interface CelebrationInfo {title:string;name:string;detail:string;podium:{place:number;name:string;score:string}[]}
const COLORS=['#e6c26f','#f6e2a8','#b8872f','#c0283f','#0c8a55','#f3efe4','#1b1b1b'];
export class Celebration {
 private root:HTMLElement;private canvas:HTMLCanvasElement;private raf=0;private timer=0;private parts:{x:number;y:number;vx:number;vy:number;r:number;w:number;h:number;spin:number;c:string;sway:number}[]=[];private last=0;
 constructor(host:HTMLElement,private seconds=30){
  this.root=document.createElement('div');this.root.className='celebration';this.root.hidden=true;
  this.root.innerHTML=`<canvas class="celebration-confetti"></canvas><div class="celebration-rays"></div><div class="celebration-card"><div class="celebration-trophy">🏆</div><div class="celebration-title"></div><h2 class="celebration-name"></h2><p class="celebration-detail"></p><ol class="celebration-podium"></ol></div>`;
  host.append(this.root);this.canvas=this.root.querySelector('canvas')!;
 }
 get active(){return !this.root.hidden;}
 show(info:CelebrationInfo,economy=false){
  const q=(s:string)=>this.root.querySelector<HTMLElement>(s)!;
  q('.celebration-title').textContent=info.title;q('.celebration-name').textContent=info.name;q('.celebration-detail').textContent=info.detail;
  const medal=['🥇','🥈','🥉'];q('.celebration-podium').innerHTML='';
  for(const p of info.podium){const li=document.createElement('li');li.className=`place-${p.place}`;li.innerHTML='<span></span><b></b><em></em>';li.children[0].textContent=medal[p.place-1]??`${p.place}.`;li.children[1].textContent=p.name;li.children[2].textContent=p.score;q('.celebration-podium').append(li);}
  this.root.hidden=false;this.root.classList.remove('play');void this.root.offsetWidth;this.root.classList.add('play');
  this.resize();const w=this.canvas.width,count=economy?110:220;
  this.parts=Array.from({length:count},()=>this.particle(w,(Math.random()*1.4-.6)*this.canvas.height));
  cancelAnimationFrame(this.raf);this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));
  clearTimeout(this.timer);this.timer=window.setTimeout(()=>this.hide(),this.seconds*1000);
 }
 hide(){this.root.hidden=true;cancelAnimationFrame(this.raf);clearTimeout(this.timer);this.parts=[];}
 private resize(){const s=Math.min(1,devicePixelRatio||1);this.canvas.width=Math.round(innerWidth*s);this.canvas.height=Math.round(innerHeight*s);}
 private particle(w:number,y:number){const u=this.canvas.height/1080;return {x:Math.random()*w,y,vx:(Math.random()-.5)*60*u,vy:(90+Math.random()*140)*u,r:Math.random()*Math.PI,w:(8+Math.random()*10)*u,h:(4+Math.random()*6)*u,spin:(Math.random()-.5)*8,c:COLORS[Math.floor(Math.random()*COLORS.length)],sway:Math.random()*Math.PI*2};}
 private frame(time:number){
  if(this.root.hidden)return;const dt=this.last?Math.min(.05,(time-this.last)/1000):0;this.last=time;
  const ctx=this.canvas.getContext('2d');if(!ctx)return;const {width:w,height:h}=this.canvas;ctx.clearRect(0,0,w,h);
  for(const p of this.parts){p.sway+=dt*2;p.x+=(p.vx+Math.sin(p.sway)*30)*dt;p.y+=p.vy*dt;p.r+=p.spin*dt;
   if(p.y>h+20)Object.assign(p,this.particle(w,-20));
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.scale(1,Math.cos(p.sway*1.7));ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();}
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
}
