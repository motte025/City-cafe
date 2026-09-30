import {MM_PER_UNIT} from './ball-config';

export const DEFAULT_DESIGN = {
 bowlDepth:1.15, numberSlope:22, numberSize:1, cameraTilt:16,
 /** Steghöhe zwischen den Taschen über dem Taschenboden in mm. Vorher fest ~27 mm (höher als die Kugel).
  *  11 mm = gut halb so hoch wie die Kugel (21 mm); darunter rollt die Kugel über die Stege und findet kaum Ruhe. */
 fretHeight:11,
 woodWarmth:.65, gloss:.65, metalWarmth:.3, lightContrast:.65, textScale:1,
 innerTone:1,outerTone:1,trackTone:1,innerGloss:.25,outerGloss:.25,pocketRichness:.5,grainTrack:.5,grainInner:.5,
 frontText:'DEMNÄCHST IM CITY-CAFE: HALLOWEEN PARTY',frontText2:'',woodOuter:0,woodTrack:0,woodInner:0,crossStyle:0,brass:0,ballGloss:.65,lightPlay:.4,feltBackground:.6,pocketGlow:true,goldNumbers:false,centerLogo:true,
 textFont:0,textWeight:700,textSpacing:1,textEffect:0,textOutline:.6,textSize:1,
 /** Rückseite des Innenkessels (Werbetafel): eigene Texte und eigener Schriftstil. */
 backText:'CITY-CAFE KLAGENFURT',backText2:'',backFont:0,backWeight:700,backSpacing:1,backEffect:0,backOutline:.6,backSize:1,
 fretBrass:.3,fretGloss:.72,diamondBrass:.3,diamondGloss:.43,
};
export type DesignSettings=typeof DEFAULT_DESIGN;
export type WheelShape=Pick<DesignSettings,'bowlDepth'|'numberSlope'|'numberSize'|'fretHeight'>;
export const FLOOR=.075, DIVIDER_HEIGHT=.245;
/** Oberkante der Stege (ungestreckte Einheiten, vor der 3D-Tiefe). fretHeight gilt in echten mm nach der Tiefe. */
export function dividerTop(shape:WheelShape){return FLOOR+shape.fretHeight/MM_PER_UNIT/shape.bowlDepth;}
export function numberHeight(r:number,shape:WheelShape=DEFAULT_DESIGN){return .235+(r-2.04)*Math.tan(shape.numberSlope*Math.PI/180);}
export function bowlProfile(shape:WheelShape=DEFAULT_DESIGN):number[][]{
 return [[1.53,.34],[1.585,FLOOR],[1.985,FLOOR],[2.04,.235],[2.425,numberHeight(2.425,shape)],[2.49,.44],[2.7,.60],[2.9,.75],[3.05,.80]];
}
/**
 * Innenkante der Kugellaufbahn (r 2,455): auf Höhe der Zahlenkranz-Außenkante, damit zwischen
 * Zahlen und Laufbahn keine Stufe mehr sichtbar ist (vorher fest 0,425 – bei 22° Gefälle rund
 * 5 mm höher als der Zahlenkranz). Nie höher als zuvor.
 */
export function lipHeight(shape:WheelShape=DEFAULT_DESIGN){return Math.min(.425,numberHeight(2.425,shape));}
export function trackHeight(r:number){return r<2.7?.44+(r-2.49)*(.16/.21):r<2.9?.60+(r-2.7)*(.15/.2):.75+(r-2.9)*(.05/.15);}
/**
 * Höhe der Kollisionsfläche exakt an den drei bündig abgesenkten Ringen (r 2,93/2,47/2,025) –
 * dieselben Bruchpunkte wie die Stator-/Rotor-Segmente in ball-physics.ts (buildColliders),
 * unabhängig vom Zahlenkranz-Gefälle. Bei Änderung dort auch hier anpassen.
 */
function flushHeightAt(radius:number,shape:WheelShape):number{
 if(radius===2.93)return trackHeight(radius); // Segment (2.9,.75)–(3.05,.80)
 if(radius===2.47){const lip=lipHeight(shape);return lip+(radius-2.455)*(.44-lip)/(2.49-2.455);} // Segment (2.455,Innenkante)–(2.49,.44)
 if(radius===2.025)return (FLOOR-.006)+(radius-1.985)*(.229-(FLOOR-.006))/(2.04-1.985); // Segment (1.985,FLOOR-.006)–(2.04,.229)
 throw new Error(`flushHeightAt: unbekannter Ring r=${radius}`);
}
/**
 * Drei der sechs Zierringe (r 2,93 / 2,47 / 2,025) standen 1,7–2,7 mm über die Fläche vor, über
 * die die Kugel rollen muss, und bildeten Mulden, in denen eine langsame Kugel für immer liegen
 * bliebe. Auf Wunsch des Betreibers im sichtbaren Modell bündig abgesenkt (Höhe = Fläche
 * darunter, minus Ringdicke) statt wie zuvor nur in der Kollisionsrechnung.
 * VISUAL_LIFT: optischer Sicherheitsabstand, damit Ring und Fläche nicht exakt in einer Ebene
 * liegen. 0,15 mm reichte in der Praxis nicht: am echten Gerät zeigte sich am Ring r=2,93 (der
 * äußere Rand der Laufbahn, genau dort wo die Kugel rollt) eine flackernde Linie mit Aussetzern
 * ("Z-Fighting" – zwei Flächen konkurrieren beim Rendern um denselben Bildpunkt). Jetzt 0,24 mm
 * (wird mit der Kesseltiefe skaliert, bei Standardtiefe 1,15 also gemessene 0,276 mm) – knapp
 * unter der 0,3-mm-Toleranz des Bündig-Tests, und zusätzlich polygonOffset auf dem Ring-Material
 * (wheel-model.ts) als zweite, vom Kamera-/GPU-Abstand unabhängige Absicherung. Bleibt weit unter
 * der 0,8-mm-Schwelle, an der eine Kugel hängen bliebe.
 */
const FLUSH_RINGS=[2.93,2.47,2.025];
const VISUAL_LIFT=.24/MM_PER_UNIT;
export function rimProfile(shape:WheelShape=DEFAULT_DESIGN):number[][]{
 return [[1.555,.315,.018],[2.025,.232,.016],[2.442,numberHeight(2.425,shape)+.004,.015],[2.47,.425,.018],[2.93,.765,.012],[3.02,.795,.018]]
  .map(([radius,y,tube])=>FLUSH_RINGS.includes(radius)?[radius,flushHeightAt(radius,shape)-tube+VISUAL_LIFT,tube]:[radius,y,tube]);
}
/** Sphere clearance over the radial cross-section, including sloped segments. */
export function surfaceClearance(r:number,ballRadius:number,shape:WheelShape=DEFAULT_DESIGN){
 const profile=bowlProfile(shape);let result=FLOOR*shape.bowlDepth+ballRadius;
 for(let i=1;i<profile.length;i++){
  const a=profile[i-1],b=profile[i],lo=Math.max(a[0],r-ballRadius),hi=Math.min(b[0],r+ballRadius);if(lo>hi)continue;
  const slope=(b[1]-a[1])*shape.bowlDepth/(b[0]-a[0]);
  const x=Math.max(lo,Math.min(hi,r+ballRadius*slope/Math.sqrt(1+slope*slope)));
  result=Math.max(result,a[1]*shape.bowlDepth+slope*(x-a[0])+Math.sqrt(Math.max(0,ballRadius**2-(x-r)**2)));
 }
 for(const [radius,y,tube] of rimProfile(shape)){
  const clearance=ballRadius+tube*shape.bowlDepth;
  if(Math.abs(r-radius)<clearance)result=Math.max(result,y*shape.bowlDepth+Math.sqrt(clearance**2-(r-radius)**2));
 }
 return result;
}
export function sameShape(a:WheelShape,b:WheelShape){return a.bowlDepth===b.bowlDepth&&a.numberSlope===b.numberSlope&&a.numberSize===b.numberSize&&a.fretHeight===b.fretHeight;}
