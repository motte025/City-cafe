/**
 * Gravur „City Cafe“ in der Kugellaufbahn, im oberen Bereich zwischen den beiden oberen Rauten.
 * Reine Dekoration (Textur auf der Laufbahn, keine Geometrie): die Kugelphysik merkt davon nichts.
 * Die Schrift wird geradlinig auf ein schmales Band gezeichnet; das Modell wickelt das Band um den Kessel.
 * 1–10 sind die Entwürfe zur Auswahl, 0 = aus.
 */
export const ENGRAVING_NAMES=[
 'Aus',
 '1 · Klassisch graviert (Cinzel, Sterne)',
 '2 · Schreibschrift in Gold (Great Vibes)',
 '3 · Art déco in Gold (Limelight, Doppellinien)',
 '4 · Fein geätzt mit „Klagenfurt“ (Italiana)',
 '5 · Eine Zeile „City · Cafe · Klagenfurt“',
 '6 · Medaillon „CC“ mit Schrift links und rechts',
 '7 · Kursiv graviert mit Schwung (Playfair)',
 '8 · Kupfer-Plakette mit Rauten (Bodoni)',
 '9 · Band mit Enden (Cinzel Decorative)',
 '10 · Silber massiv mit Sternen (Abril Fatface)',
];
export const ENGRAVING_COUNT=ENGRAVING_NAMES.length-1;
export const ENGRAVING_W=2048,ENGRAVING_H=412;
const SERIF='Georgia,"Times New Roman",serif';
const FAM={cinzel:`Cinzel,${SERIF}`,vibes:`"Great Vibes",cursive`,limelight:`Limelight,${SERIF}`,italiana:`Italiana,${SERIF}`,
 play:`"Playfair Display",${SERIF}`,bodoni:`"Bodoni Moda",${SERIF}`,deco:`"Cinzel Decorative",${SERIF}`,abril:`"Abril Fatface",${SERIF}`};
/** Schriften, die der Entwurf braucht (zum Nachladen der Webschriften). */
export function engravingFonts(style:number):string[]{
 const f=({1:['cinzel'],2:['vibes'],3:['limelight'],4:['italiana','cinzel'],5:['cinzel'],6:['cinzel','play'],7:['play'],8:['bodoni'],9:['deco','cinzel'],10:['abril']} as Record<number,(keyof typeof FAM)[]>)[style]??[];
 return f.map(k=>FAM[k]);
}
type Mode='cut'|'gold'|'silver'|'copper'|'etch';
export function drawEngraving(canvas:HTMLCanvasElement,style:number,size=1){
 canvas.width=ENGRAVING_W;canvas.height=ENGRAVING_H;
 const g=canvas.getContext('2d')!,W=ENGRAVING_W,H=ENGRAVING_H,cx=W/2,cy=H/2;g.clearRect(0,0,W,H);
 if(style<1||style>ENGRAVING_COUNT)return;
 g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
 const LS=(v:number)=>{(g as unknown as {letterSpacing:string}).letterSpacing=`${v}px`;};
 const grad=(m:Mode,y:number,h:number)=>{const q=g.createLinearGradient(0,y-h/2,0,y+h/2);
  const s={gold:['#fff3c4','#e2b85a','#9a6f22','#f1d585'],silver:['#ffffff','#cfd6dc','#7d8890','#eef2f5'],copper:['#ffd9b8','#e09660','#8f4c26','#f2b88c'],cut:['#000','#000','#000','#000'],etch:['#fff','#fff','#fff','#fff']}[m];
  q.addColorStop(0,s[0]);q.addColorStop(.45,s[1]);q.addColorStop(.55,s[2]);q.addColorStop(1,s[3]);return q;};
 /** Ein Text mit Gravur- oder Einlage-Effekt. maxW: Breite, auf die er höchstens läuft. */
 const ink=(t:string,x:number,y:number,fam:string,weight:number|string,px:number,ls:number,maxW:number,m:Mode)=>{
  px*=size*1.2;g.font=`${weight} ${px}px ${fam}`;LS(ls*px);const w=g.measureText(t).width;if(w>maxW){px*=maxW/w;g.font=`${weight} ${px}px ${fam}`;LS(ls*px);}
  const k=px/100;
  if(m==='cut'){g.fillStyle='rgba(255,232,185,.78)';g.fillText(t,x+2.6*k,y+3.2*k);g.fillStyle='rgba(10,4,1,.92)';g.fillText(t,x,y);g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=2*k;g.strokeText(t,x-.8*k,y-1.2*k);}
  else if(m==='etch'){g.strokeStyle='rgba(255,228,175,.55)';g.lineWidth=3.2*k;g.strokeText(t,x+1.4*k,y+1.8*k);g.strokeStyle='rgba(12,5,2,.9)';g.lineWidth=2.2*k;g.strokeText(t,x,y);}
  else{g.strokeStyle='rgba(12,5,2,.85)';g.lineWidth=6*k;g.strokeText(t,x,y);g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=6*k;g.shadowOffsetY=3*k;g.fillStyle=grad(m,y,px*1.1);g.fillText(t,x,y);g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;g.strokeStyle='rgba(255,250,225,.5)';g.lineWidth=1.1*k;g.strokeText(t,x,y);}
  LS(0);return px;};
 const line=(x1:number,x2:number,y:number,th:number,m:Mode)=>{
  if(m==='cut'||m==='etch'){g.fillStyle='rgba(255,232,185,.78)';g.fillRect(x1,y+th*.7,x2-x1,th);g.fillStyle='rgba(10,4,1,.92)';g.fillRect(x1,y-th/2,x2-x1,th);}
  else{g.fillStyle=grad(m,y,th*3);g.fillRect(x1,y-th/2,x2-x1,th);g.strokeStyle='rgba(12,5,2,.8)';g.lineWidth=1.2;g.strokeRect(x1,y-th/2,x2-x1,th);}};
 const diamond=(x:number,y:number,r:number,m:Mode)=>{const p=()=>{g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r*.62,y);g.lineTo(x,y+r);g.lineTo(x-r*.62,y);g.closePath();};
  if(m==='cut'||m==='etch'){g.fillStyle='rgba(255,232,185,.78)';g.save();g.translate(2,2.6);p();g.fill();g.restore();g.fillStyle='rgba(10,4,1,.92)';p();g.fill();}
  else{g.fillStyle=grad(m,y,r*2);p();g.fill();g.strokeStyle='rgba(12,5,2,.8)';g.lineWidth=1.6;g.stroke();}};
 const star=(x:number,y:number,r:number,m:Mode)=>{const p=()=>{g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*.42:r;g[i?'lineTo':'moveTo'](x+Math.cos(a)*q,y+Math.sin(a)*q);}g.closePath();};
  if(m==='cut'||m==='etch'){g.fillStyle='rgba(255,232,185,.78)';g.save();g.translate(2,2.6);p();g.fill();g.restore();g.fillStyle='rgba(10,4,1,.92)';p();g.fill();}
  else{g.fillStyle=grad(m,y,r*2);p();g.fill();g.strokeStyle='rgba(12,5,2,.8)';g.lineWidth=1.6;g.stroke();}};
 const wave=(x1:number,x2:number,y:number,amp:number,m:Mode)=>{const p=()=>{g.beginPath();for(let x=x1;x<=x2;x+=6){const t=(x-x1)/(x2-x1),yy=y+Math.sin(t*Math.PI*3)*amp*Math.sin(t*Math.PI);g[x===x1?'moveTo':'lineTo'](x,yy);}};
  g.lineCap='round';if(m==='cut'||m==='etch'){g.strokeStyle='rgba(255,232,185,.78)';g.lineWidth=4;g.save();g.translate(1.5,2.4);p();g.stroke();g.restore();g.strokeStyle='rgba(10,4,1,.92)';g.lineWidth=3.6;p();g.stroke();}
  else{g.strokeStyle='rgba(12,5,2,.85)';g.lineWidth=8;p();g.stroke();g.strokeStyle=grad(m,y,amp*4);g.lineWidth=4.6;p();g.stroke();}};
 const ring=(x:number,y:number,r:number,m:Mode)=>{g.beginPath();g.arc(x,y,r,0,Math.PI*2);
  if(m==='cut'||m==='etch'){g.strokeStyle='rgba(255,232,185,.78)';g.lineWidth=5;g.save();g.translate(2,2.6);g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.restore();g.strokeStyle='rgba(10,4,1,.92)';g.lineWidth=4.2;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();}
  else{g.strokeStyle='rgba(12,5,2,.85)';g.lineWidth=9;g.stroke();g.strokeStyle=grad(m,y,r*2);g.lineWidth=5;g.stroke();}};
 const M=W-140; // nutzbare Breite
 switch(style){
  case 1:ink('CITY CAFE',cx,cy-6,FAM.cinzel,600,150,.22,M-220,'cut');star(150,cy-6,26,'cut');star(W-150,cy-6,26,'cut');line(cx-330,cx+330,cy+80,5,'cut');break;
  case 2:ink('City Cafe',cx,cy-14,FAM.vibes,400,230,.02,M-160,'gold');wave(cx-380,cx+380,cy+92,9,'gold');break;
  case 3:ink('CITY CAFE',cx,cy,FAM.limelight,400,140,.16,M-300,'gold');line(140,cx-420,cy-9,5,'gold');line(140,cx-420,cy+9,5,'gold');line(cx+420,W-140,cy-9,5,'gold');line(cx+420,W-140,cy+9,5,'gold');diamond(110,cy,20,'gold');diamond(W-110,cy,20,'gold');break;
  case 4:ink('CITY CAFE',cx,cy-38,FAM.italiana,400,150,.2,M-160,'etch');ink('KLAGENFURT',cx,cy+64,FAM.cinzel,500,52,.55,M-500,'cut');line(200,W-200,cy-118,2.4,'etch');line(200,W-200,cy+112,2.4,'etch');break;
  case 5:ink('CITY · CAFE · KLAGENFURT',cx,cy,FAM.cinzel,700,104,.16,W-300,'gold');line(160,W-160,cy-70,3,'gold');line(160,W-160,cy+70,3,'gold');break;
  case 6:ring(cx,cy,102,'gold');ring(cx,cy,88,'gold');ink('CC',cx,cy+4,FAM.play,700,112,-.05,150,'gold');ink('CITY',cx-330,cy,FAM.cinzel,700,130,.24,420,'gold');ink('CAFE',cx+330,cy,FAM.cinzel,700,130,.24,420,'gold');diamond(110,cy,18,'gold');diamond(W-110,cy,18,'gold');break;
  case 7:ink('City Cafe',cx,cy-14,FAM.play,'italic 500',190,.02,M-260,'cut');wave(cx-420,cx+420,cy+88,14,'cut');break;
  case 8:{g.strokeStyle='rgba(12,5,2,.85)';const x0=90,y0=30,w=W-180,h=H-60,r=34;const rr=()=>{g.beginPath();g.roundRect(x0,y0,w,h,r);};rr();g.lineWidth=9;g.stroke();g.strokeStyle=grad('copper',cy,h);g.lineWidth=5;rr();g.stroke();
   ink('CITY CAFE',cx,cy+2,FAM.bodoni,700,150,.2,M-380,'copper');diamond(210,cy,22,'copper');diamond(W-210,cy,22,'copper');break;}
  case 9:{const x0=170,x1=W-170,y0=cy-80,y1=cy+80,n=50;const p=()=>{g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.lineTo(x1+n,cy);g.lineTo(x1,y1);g.lineTo(x0,y1);g.lineTo(x0-n,cy);g.closePath();};
   g.fillStyle='rgba(20,8,2,.35)';p();g.fill();g.strokeStyle='rgba(255,232,185,.78)';g.lineWidth=5;g.save();g.translate(2,2.6);p();g.stroke();g.restore();g.strokeStyle='rgba(10,4,1,.92)';g.lineWidth=4.2;p();g.stroke();
   ink('CITY CAFE',cx,cy+2,FAM.deco,700,104,.14,x1-x0-100,'gold');break;}
  case 10:ink('CITY CAFE',cx,cy,FAM.abril,400,150,.08,M-320,'silver');star(190,cy,30,'silver');star(W-190,cy,30,'silver');break;
 }
}
