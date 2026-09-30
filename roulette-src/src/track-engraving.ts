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
export interface EngravingOptions{size:number;text:string;font:number;weight:number;spacing:number;effect:number;depth:number;color:number;y:number;text2:string;font2:number;weight2:number;size2:number;spacing2:number;effect2:number;color2:number}
export const ENGRAVING_DEFAULTS:EngravingOptions={size:1,text:'',font:0,weight:0,spacing:1,effect:0,depth:1,color:0,y:0,text2:'',font2:0,weight2:0,size2:1,spacing2:1,effect2:0,color2:0};
export const ENGRAVING_FONT_NAMES=['Wie Entwurf','Georgia (klassisch)','Playfair Display (elegant)','Cinzel (römische Kapitalen)','Cormorant Garamond (fein)','Bodoni Moda (Casino)','Great Vibes (Schreibschrift)','Limelight (Art déco)','Italiana (schlank, edel)','Abril Fatface (fett, plakativ)','Cinzel Decorative (verziert)'];
export const ENGRAVING_WEIGHT_NAMES=['Wie Entwurf','400 · normal','500','600','700 · fett','800','900 · extrafett'];
export const ENGRAVING_EFFECT_NAMES=['Wie Entwurf','Eingeschnitten (dunkel)','Gold eingelegt','Silber eingelegt','Kupfer eingelegt','Fein geätzt (Linie)'];
export const ENGRAVING_FONT2_NAMES=['Wie Zeile 1',...ENGRAVING_FONT_NAMES.slice(1)];
export const ENGRAVING_WEIGHT2_NAMES=['Wie Zeile 1',...ENGRAVING_WEIGHT_NAMES.slice(1)];
export const ENGRAVING_EFFECT2_NAMES=['Wie Zeile 1',...ENGRAVING_EFFECT_NAMES.slice(1)];
export const ENGRAVING_COLOR2_NAMES=['Wie Zeile 1',...['Weiß','Rot','Grün','Blau','Orange','Violett']];
export const ENGRAVING_COLOR_NAMES=['Wie Effekt','Weiß','Rot','Grün','Blau','Orange','Violett'];
const OVERRIDE_FAMS=['Georgia,"Times New Roman",serif','"Playfair Display",Georgia,serif','Cinzel,Georgia,serif','"Cormorant Garamond",Georgia,serif','"Bodoni Moda",Georgia,serif','"Great Vibes",cursive','Limelight,Georgia,serif','Italiana,Georgia,serif','"Abril Fatface",Georgia,serif','"Cinzel Decorative",Georgia,serif'];
export const ENGRAVING_COUNT=ENGRAVING_NAMES.length-1;
export const ENGRAVING_W=2048,ENGRAVING_H=412;
const SERIF='Georgia,"Times New Roman",serif';
const FAM={cinzel:`Cinzel,${SERIF}`,vibes:`"Great Vibes",cursive`,limelight:`Limelight,${SERIF}`,italiana:`Italiana,${SERIF}`,
 play:`"Playfair Display",${SERIF}`,bodoni:`"Bodoni Moda",${SERIF}`,deco:`"Cinzel Decorative",${SERIF}`,abril:`"Abril Fatface",${SERIF}`};
/** Schriften, die der Entwurf braucht (zum Nachladen der Webschriften). */
export function engravingFonts(style:number,font=0,font2=0):string[]{
 if(font2>0)return [OVERRIDE_FAMS[font2-1],...engravingFonts(style,font)];
 if(font>0)return [OVERRIDE_FAMS[font-1]];
 const f=({1:['cinzel'],2:['vibes'],3:['limelight'],4:['italiana','cinzel'],5:['cinzel'],6:['cinzel','play'],7:['play'],8:['bodoni'],9:['deco','cinzel'],10:['abril']} as Record<number,(keyof typeof FAM)[]>)[style]??[];
 return f.map(k=>FAM[k]);
}
type Mode='cut'|'gold'|'silver'|'copper'|'etch';
const TINTS=[['#ffffff','#d6d6d6'],['#ff8a8a','#a31424'],['#8ff0a4','#1f8a45'],['#8fc4ff','#2a5fb8'],['#ffbf7a','#d1621b'],['#d3a8ff','#6b3bb0']];
export function drawEngraving(canvas:HTMLCanvasElement,style:number,o:EngravingOptions=ENGRAVING_DEFAULTS){
 const size=o.size;
 canvas.width=ENGRAVING_W;canvas.height=ENGRAVING_H;
 const g=canvas.getContext('2d')!,W=ENGRAVING_W,H=ENGRAVING_H,cx=W/2,cy=H/2;g.clearRect(0,0,W,H);
 if(style<1||style>ENGRAVING_COUNT)return;
 g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.translate(0,o.y*70);
 let cur=o;const EFF:Mode[]=['cut','cut','gold','silver','copper','etch'],DEP=o.depth,tint=()=>cur.color>0?TINTS[cur.color-1]:null;
 /** Effekt-Übersteuerung; mit Farbe werden Gravur/Ätzung zur farbigen Einlage. */
 const Mo=(m:Mode):Mode=>{const r=cur.effect>0?EFF[cur.effect]:m;return tint()&&(r==='cut'||r==='etch')?'gold':r;};
 const A=(a:number)=>Math.min(1,a*DEP);
 const LS=(v:number)=>{(g as unknown as {letterSpacing:string}).letterSpacing=`${v}px`;};
 const grad=(m:Mode,y:number,h:number)=>{const q=g.createLinearGradient(0,y-h/2,0,y+h/2);
  const TINT=tint();if(TINT){q.addColorStop(0,TINT[0]);q.addColorStop(.5,TINT[1]);q.addColorStop(1,TINT[0]);return q;}
  const s={gold:['#fff3c4','#e2b85a','#9a6f22','#f1d585'],silver:['#ffffff','#cfd6dc','#7d8890','#eef2f5'],copper:['#ffd9b8','#e09660','#8f4c26','#f2b88c'],cut:['#000','#000','#000','#000'],etch:['#fff','#fff','#fff','#fff']}[m];
  q.addColorStop(0,s[0]);q.addColorStop(.45,s[1]);q.addColorStop(.55,s[2]);q.addColorStop(1,s[3]);return q;};
 /** Ein Text mit Gravur- oder Einlage-Effekt. maxW: Breite, auf die er höchstens läuft. */
 const ink=(t:string,x:number,y:number,fam:string,weight:number|string,px:number,ls:number,maxW:number,m0:Mode)=>{
  const m=Mo(m0);if(cur.font>0)fam=OVERRIDE_FAMS[cur.font-1];if(cur.weight>0)weight=300+cur.weight*100;ls*=cur.spacing;px*=cur.size*1.2;g.font=`${weight} ${px}px ${fam}`;LS(ls*px);const w=g.measureText(t).width;if(w>maxW){px*=maxW/w;g.font=`${weight} ${px}px ${fam}`;LS(ls*px);}
  const k=px/100;
  if(m==='cut'){g.fillStyle=`rgba(255,232,185,${A(.78)})`;g.fillText(t,x+2.6*k,y+3.2*k);g.fillStyle=`rgba(10,4,1,${A(.92)})`;g.fillText(t,x,y);g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=2*k;g.strokeText(t,x-.8*k,y-1.2*k);}
  else if(m==='etch'){g.strokeStyle='rgba(255,228,175,.55)';g.lineWidth=3.2*k;g.strokeText(t,x+1.4*k,y+1.8*k);g.strokeStyle='rgba(12,5,2,.9)';g.lineWidth=2.2*k;g.strokeText(t,x,y);}
  else{g.strokeStyle='rgba(12,5,2,.85)';g.lineWidth=6*k;g.strokeText(t,x,y);g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=6*k;g.shadowOffsetY=3*k;g.fillStyle=grad(m,y,px*1.1);g.fillText(t,x,y);g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;g.strokeStyle='rgba(255,250,225,.5)';g.lineWidth=1.1*k;g.strokeText(t,x,y);}
  LS(0);return px;};
 const line=(x1:number,x2:number,y:number,th:number,m0:Mode)=>{const m=Mo(m0);
  if(m==='cut'||m==='etch'){g.fillStyle=`rgba(255,232,185,${A(.78)})`;g.fillRect(x1,y+th*.7,x2-x1,th);g.fillStyle=`rgba(10,4,1,${A(.92)})`;g.fillRect(x1,y-th/2,x2-x1,th);}
  else{g.fillStyle=grad(m,y,th*3);g.fillRect(x1,y-th/2,x2-x1,th);g.strokeStyle='rgba(12,5,2,.8)';g.lineWidth=1.2;g.strokeRect(x1,y-th/2,x2-x1,th);}};
 const diamond=(x:number,y:number,r:number,m0:Mode)=>{const m=Mo(m0);const p=()=>{g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r*.62,y);g.lineTo(x,y+r);g.lineTo(x-r*.62,y);g.closePath();};
  if(m==='cut'||m==='etch'){g.fillStyle=`rgba(255,232,185,${A(.78)})`;g.save();g.translate(2,2.6);p();g.fill();g.restore();g.fillStyle=`rgba(10,4,1,${A(.92)})`;p();g.fill();}
  else{g.fillStyle=grad(m,y,r*2);p();g.fill();g.strokeStyle='rgba(12,5,2,.8)';g.lineWidth=1.6;g.stroke();}};
 const star=(x:number,y:number,r:number,m0:Mode)=>{const m=Mo(m0);const p=()=>{g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*.42:r;g[i?'lineTo':'moveTo'](x+Math.cos(a)*q,y+Math.sin(a)*q);}g.closePath();};
  if(m==='cut'||m==='etch'){g.fillStyle=`rgba(255,232,185,${A(.78)})`;g.save();g.translate(2,2.6);p();g.fill();g.restore();g.fillStyle=`rgba(10,4,1,${A(.92)})`;p();g.fill();}
  else{g.fillStyle=grad(m,y,r*2);p();g.fill();g.strokeStyle='rgba(12,5,2,.8)';g.lineWidth=1.6;g.stroke();}};
 const wave=(x1:number,x2:number,y:number,amp:number,m0:Mode)=>{const m=Mo(m0);const p=()=>{g.beginPath();for(let x=x1;x<=x2;x+=6){const t=(x-x1)/(x2-x1),yy=y+Math.sin(t*Math.PI*3)*amp*Math.sin(t*Math.PI);g[x===x1?'moveTo':'lineTo'](x,yy);}};
  g.lineCap='round';if(m==='cut'||m==='etch'){g.strokeStyle=`rgba(255,232,185,${A(.78)})`;g.lineWidth=4;g.save();g.translate(1.5,2.4);p();g.stroke();g.restore();g.strokeStyle=`rgba(10,4,1,${A(.92)})`;g.lineWidth=3.6;p();g.stroke();}
  else{g.strokeStyle='rgba(12,5,2,.85)';g.lineWidth=8;p();g.stroke();g.strokeStyle=grad(m,y,amp*4);g.lineWidth=4.6;p();g.stroke();}};
 const ring=(x:number,y:number,r:number,m0:Mode)=>{const m=Mo(m0);g.beginPath();g.arc(x,y,r,0,Math.PI*2);
  if(m==='cut'||m==='etch'){g.strokeStyle=`rgba(255,232,185,${A(.78)})`;g.lineWidth=5;g.save();g.translate(2,2.6);g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.restore();g.strokeStyle=`rgba(10,4,1,${A(.92)})`;g.lineWidth=4.2;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();}
  else{g.strokeStyle='rgba(12,5,2,.85)';g.lineWidth=9;g.stroke();g.strokeStyle=grad(m,y,r*2);g.lineWidth=5;g.stroke();}};
 const M=W-140,TX2=o.text2.trim(),TX=o.text.trim(),words=TX.split(/\s+/);
 const two=!!TX2&&style!==4;g.save();if(two){g.translate(cx,cy-74);g.scale(.72,.72);g.translate(-cx,-cy);}
 switch(style){
  case 1:ink(TX||'CITY CAFE',cx,cy-6,FAM.cinzel,600,150,.22,M-220,'cut');star(150,cy-6,26,'cut');star(W-150,cy-6,26,'cut');line(cx-330,cx+330,cy+80,5,'cut');break;
  case 2:ink(TX||'City Cafe',cx,cy-14,FAM.vibes,400,230,.02,M-160,'gold');wave(cx-380,cx+380,cy+92,9,'gold');break;
  case 3:ink(TX||'CITY CAFE',cx,cy,FAM.limelight,400,140,.16,M-300,'gold');line(140,cx-420,cy-9,5,'gold');line(140,cx-420,cy+9,5,'gold');line(cx+420,W-140,cy-9,5,'gold');line(cx+420,W-140,cy+9,5,'gold');diamond(110,cy,20,'gold');diamond(W-110,cy,20,'gold');break;
  case 4:ink(TX||'CITY CAFE',cx,cy-38,FAM.italiana,400,150,.2,M-160,'etch');if(!TX2)ink('KLAGENFURT',cx,cy+64,FAM.cinzel,500,52,.55,M-500,'cut');line(200,W-200,cy-118,2.4,'etch');line(200,W-200,cy+112,2.4,'etch');break;
  case 5:ink(TX||'CITY · CAFE · KLAGENFURT',cx,cy,FAM.cinzel,700,104,.16,W-300,'gold');line(160,W-160,cy-70,3,'gold');line(160,W-160,cy+70,3,'gold');break;
  case 6:ring(cx,cy,102,'gold');ring(cx,cy,88,'gold');ink(TX?words.map(w=>w[0]).join('').slice(0,3):'CC',cx,cy+4,FAM.play,700,112,-.05,150,'gold');ink(TX?words[0]:'CITY',cx-330,cy,FAM.cinzel,700,130,.24,420,'gold');ink(TX?words.slice(1).join(' ')||words[0]:'CAFE',cx+330,cy,FAM.cinzel,700,130,.24,420,'gold');diamond(110,cy,18,'gold');diamond(W-110,cy,18,'gold');break;
  case 7:ink(TX||'City Cafe',cx,cy-14,FAM.play,'italic 500',190,.02,M-260,'cut');wave(cx-420,cx+420,cy+88,14,'cut');break;
  case 8:{g.strokeStyle='rgba(12,5,2,.85)';const x0=90,y0=30,w=W-180,h=H-60,r=34;const rr=()=>{g.beginPath();g.roundRect(x0,y0,w,h,r);};rr();g.lineWidth=9;g.stroke();g.strokeStyle=grad('copper',cy,h);g.lineWidth=5;rr();g.stroke();
   ink(TX||'CITY CAFE',cx,cy+2,FAM.bodoni,700,150,.2,M-380,'copper');diamond(210,cy,22,'copper');diamond(W-210,cy,22,'copper');break;}
  case 9:{const x0=170,x1=W-170,y0=cy-80,y1=cy+80,n=50;const p=()=>{g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.lineTo(x1+n,cy);g.lineTo(x1,y1);g.lineTo(x0,y1);g.lineTo(x0-n,cy);g.closePath();};
   g.fillStyle='rgba(20,8,2,.35)';p();g.fill();g.strokeStyle=`rgba(255,232,185,${A(.78)})`;g.lineWidth=5;g.save();g.translate(2,2.6);p();g.stroke();g.restore();g.strokeStyle=`rgba(10,4,1,${A(.92)})`;g.lineWidth=4.2;p();g.stroke();
   ink(TX||'CITY CAFE',cx,cy+2,FAM.deco,700,104,.14,x1-x0-100,'gold');break;}
  case 10:ink(TX||'CITY CAFE',cx,cy,FAM.abril,400,150,.08,M-320,'silver');star(190,cy,30,'silver');star(W-190,cy,30,'silver');break;
 }
 g.restore();
 if(TX2){
  // Zeile 2: erbt Schrift, Effekt und Farbe von Zeile 1, sofern nicht eigens gewählt.
  const MAIN:Record<number,Mode>={1:'cut',2:'gold',3:'gold',4:'cut',5:'gold',6:'gold',7:'cut',8:'copper',9:'gold',10:'silver'};
  cur={...o,size:o.size2,font:o.font2||o.font,weight:o.weight2||o.weight,spacing:o.spacing2,effect:o.effect2||o.effect,color:o.color2||o.color};
  const y2=style===4?cy+64:cy+78;
  ink(TX2,cx,y2,FAM.cinzel,500,style===4?52:72,.3,M-420,MAIN[style]??'cut');
  cur=o;
 }
}
