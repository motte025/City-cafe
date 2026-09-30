/**
 * City-Cafe-Jetons als reine Dekoration: oben links die Bank (Jeton-Kasten), unten rechts der Tisch.
 * Rund wie echte Casino-Jetons (Plaques gibt es nur für sehr hohe Werte – rund liest sich in kleinen
 * Stapeln besser). Gezeichnet in derselben Perspektive wie der Kessel (Blickwinkel aus den Einstellungen).
 * Ständig in Bewegung: Jetons wandern zwischen Bank und Tisch, gezeichnet wird nur während einer Bewegung.
 */
type Denom={value:string;base:string;edge:string;inlay:string;ink:string;side:string};
const DENOMS:Denom[]=[
 {value:'5',base:'#9e1b2c',edge:'#f3ead2',inlay:'#f3ead2',ink:'#7a1422',side:'#7c1522'},
 {value:'25',base:'#0f6b45',edge:'#f3ead2',inlay:'#f3ead2',ink:'#0c5236',side:'#0b5034'},
 {value:'100',base:'#15181b',edge:'#e2c27a',inlay:'#e9dcbc',ink:'#15181b',side:'#0d0f11'},
 {value:'500',base:'#efe4c8',edge:'#9e1b2c',inlay:'#9e1b2c',ink:'#f3ead2',side:'#cfc2a1'},
];
/** Oberseite direkt als Vektorgrafik zeichnen (scharf in jeder Größe; vorher ein verkleinertes Bild → matschig). */
function drawFace(g:CanvasRenderingContext2D,R:number,d:number,px:number){
 const k=DENOMS[d];
 g.fillStyle=k.base;g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.fill();
 g.fillStyle=k.edge;for(let i=0;i<6;i++){g.save();g.rotate(i*Math.PI/3);g.beginPath();g.moveTo(-R*.14,-R);g.lineTo(R*.14,-R);g.lineTo(R*.1,-R*.72);g.lineTo(-R*.1,-R*.72);g.closePath();g.fill();g.restore();}
 g.strokeStyle='#d9b465';g.lineWidth=Math.max(.6,R*.045);g.beginPath();g.arc(0,0,R*.68,0,Math.PI*2);g.stroke();
 g.fillStyle=k.inlay;g.beginPath();g.arc(0,0,R*.62,0,Math.PI*2);g.fill();
 g.fillStyle=k.ink;g.textAlign='center';g.textBaseline='middle';
 // Schrift nur, wenn sie am Bildschirm lesbar groß wird (px = Bildschirmpixel je Einheit)
 if(R*px>=22){const size=R*.17,radius=R*.45,chars=[...'CITY CAFE'],step=size*.8/radius,start=-(chars.length-1)*step/2;g.font=`700 ${size}px 'DM Sans',Arial,sans-serif`;
  chars.forEach((ch,i)=>{g.save();g.rotate(start+i*step);g.translate(0,-radius);g.fillText(ch,0,0);g.restore();});}
 g.font=`600 ${R*(k.value.length>2?.36:.46)}px 'Playfair Display',Georgia,serif`;g.fillText(k.value,0,R*(R*px>=22?.12:.04));
}
interface Stack {denom:number;count:number;x:number;rot:number[];jit:number[];adding:number;removing:number}
class ChipCanvas {
 stacks:Stack[]=[];constructor(readonly canvas:HTMLCanvasElement,readonly bank:boolean,counts:number[]){
  this.stacks=counts.map((n,i)=>({denom:i%DENOMS.length,count:n,x:0,rot:[],jit:[],adding:0,removing:0}));for(const s of this.stacks)for(let k=0;k<40;k++){s.rot.push((Math.random()-.5)*.35);s.jit.push((Math.random()-.5)*.05);}
 }
 draw(tilt:number){
  const c=this.canvas,w=c.clientWidth,h=c.clientHeight;if(w<=0||h<=0)return;const dpr=Math.min(3,(devicePixelRatio||1)*1.5);
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  const g=c.getContext('2d')!;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const n=this.stacks.length,t=Math.max(.05,Math.min(1.2,tilt)),squash=Math.cos(t),side=Math.sin(t);
  const maxN=this.bank?11:8,label=this.bank?Math.max(40,h*.5):0;
  // Radius so, dass alle Stapel nebeneinander und der höchste Stapel in die Höhe passen
  const r=Math.min((w-label)/(n*2.25),h*.9/(2*squash+maxN*.19*side*2)),th=r*.19*side*2,gap=r*2.25;
  const x0=label+gap/2+r*.3,base=h*.92-r*squash;
  if(this.bank){
   // Jeton-Kasten: dunkles Holz mit Goldkante, perspektivisch wie die Stapel
   const tw=gap*n+r*.5,tx=x0-gap/2-r*.25,ty=base-r*squash*1.25,tb=base+r*squash*1.15;g.fillStyle='#1b0f0a';g.strokeStyle='#b8924d';g.lineWidth=1.2;
   g.beginPath();g.roundRect(tx,ty,tw,tb-ty,r*.25);g.fill();g.stroke();
   g.save();g.fillStyle='#e1c892';g.font=`500 ${Math.max(10,h*.12)}px 'DM Sans',Arial,sans-serif`;g.textAlign='left';g.textBaseline='middle';g.translate(2,base-r*squash*.1);g.fillText('BANK',0,0);g.restore();
  }
  this.stacks.forEach((s,i)=>{
   const cx=x0+i*gap;s.x=cx;const d=DENOMS[s.denom],total=s.count;
   const grad=g.createLinearGradient(cx-r,0,cx+r,0);grad.addColorStop(0,shade(d.side,-.45));grad.addColorStop(.38,shade(d.side,.18));grad.addColorStop(.55,d.side);grad.addColorStop(1,shade(d.side,-.55));
   for(let k=0;k<total;k++){
    let lift=0,alpha=1;
    if(k===total-1&&s.adding>0){lift=s.adding*s.adding*h*.5;alpha=1-s.adding*.6;}
    if(k===total-1&&s.removing>0){lift=s.removing*h*.4;alpha=1-s.removing;}
    const cy=base-k*th-lift,jx=s.jit[k%40]*r;g.globalAlpha=Math.max(0,alpha);
    // Seitenband mit Einlagen
    g.fillStyle=grad;g.beginPath();g.ellipse(cx+jx,cy,r,r*squash,0,0,Math.PI);g.lineTo(cx+jx-r,cy-th);g.ellipse(cx+jx,cy-th,r,r*squash,0,Math.PI,0,true);g.closePath();g.fill();
    g.fillStyle=d.edge;const rot=s.rot[k%40];
    for(let j=0;j<6;j++){const a=rot+j*Math.PI/3,cs=Math.cos(a);if(cs<=.15)continue;const x=cx+jx+r*Math.sin(a),ww=r*.26*cs;g.fillRect(x-ww/2,cy-th*.88+r*squash*cs*.98,ww,th*.76);}
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.6;g.beginPath();g.ellipse(cx+jx,cy,r,r*squash,0,0,Math.PI);g.stroke();
    if(k===total-1||(k===total-2&&(s.adding>0||s.removing>0))){
     g.save();g.translate(cx+jx,cy-th);g.scale(1,squash);g.rotate(rot);drawFace(g,r,s.denom,dpr);g.restore();
     // Glanz von oben links, wie das Licht über dem Kessel
     const gl=g.createRadialGradient(cx+jx-r*.35,cy-th-r*squash*.4,0,cx+jx,cy-th,r);gl.addColorStop(0,'rgba(255,248,225,.28)');gl.addColorStop(1,'rgba(255,248,225,0)');
     g.fillStyle=gl;g.beginPath();g.ellipse(cx+jx,cy-th,r,r*squash,0,0,Math.PI*2);g.fill();
    }
   }
   g.globalAlpha=1;
  });
 }
}
function shade(hex:string,f:number){const v=parseInt(hex.slice(1),16),ch=[v>>16,v>>8&255,v&255].map(c=>Math.round(f>=0?c+(255-c)*f:c*(1+f)));return `rgb(${ch.join(',')})`;}

export class ChipScene {
 private bank:ChipCanvas;private table:ChipCanvas;private tilt=16*Math.PI/180;private raf=0;private timer=0;private moving=false;
 constructor(bankCanvas:HTMLCanvasElement,tableCanvas:HTMLCanvasElement){
  this.bank=new ChipCanvas(bankCanvas,true,[9,7,8,6]);this.table=new ChipCanvas(tableCanvas,false,[4,3,5,3]);
  addEventListener('resize',()=>this.redraw());void document.fonts?.ready.then(()=>this.redraw());
  this.redraw();this.schedule();
 }
 setTilt(deg:number){const t=deg*Math.PI/180;if(Math.abs(t-this.tilt)<.001)return;this.tilt=t;this.redraw();}
 private redraw(){this.bank.draw(this.tilt);this.table.draw(this.tilt);}
 private schedule(){clearTimeout(this.timer);this.timer=window.setTimeout(()=>this.move(),1400+Math.random()*2600);}
 /** Ein paar Jetons einer Farbe wandern von der Bank zum Tisch oder zurück – einer nach dem anderen. */
 private move(){
  if(document.hidden||this.moving){this.schedule();return;}
  const d=Math.floor(Math.random()*DENOMS.length),bs=this.bank.stacks[d],ts=this.table.stacks[d];
  const toTable=ts.count<=2?true:bs.count<=4?false:Math.random()<.5,amount=1+Math.floor(Math.random()*3);
  const from=toTable?bs:ts,to=toTable?ts:bs,fromC=toTable?this.bank:this.table,toC=toTable?this.table:this.bank;
  let left=Math.min(amount,from.count-(toTable?4:2),(toTable?8:11)-to.count);if(left<=0){this.schedule();return;}
  this.moving=true;
  const step=()=>{if(left<=0){this.moving=false;this.schedule();return;}left--;
   this.animate(fromC,from,'removing',()=>{from.count--;to.count++;to.adding=1;this.animate(toC,to,'adding',()=>setTimeout(step,120));});};
  step();
 }
 private animate(c:ChipCanvas,s:Stack,key:'adding'|'removing',done:()=>void){
  const dur=key==='adding'?360:280,start=performance.now();if(key==='removing')s.removing=0;
  const tick=(now:number)=>{const u=Math.min(1,(now-start)/dur);if(key==='adding')s.adding=(1-u)**2;else s.removing=u;
   c.draw(this.tilt);
   if(u<1)this.raf=requestAnimationFrame(tick);else{s.adding=0;s.removing=0;c.draw(this.tilt);done();}};
  this.raf=requestAnimationFrame(tick);
 }
}
