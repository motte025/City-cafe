export const DEFAULT_DESIGN = {
 bowlDepth:1.15, numberSlope:22, numberSize:1, cameraTilt:16,
 woodWarmth:.65, gloss:.65, metalWarmth:.3, lightContrast:.65, textScale:1,
 innerTone:1,outerTone:1,trackTone:1,innerGloss:.65,outerGloss:.65,pocketRichness:.5,
};
export type DesignSettings=typeof DEFAULT_DESIGN;
export type WheelShape=Pick<DesignSettings,'bowlDepth'|'numberSlope'|'numberSize'>;
export const FLOOR=.075, DIVIDER_HEIGHT=.245;
export function numberHeight(r:number,shape:WheelShape=DEFAULT_DESIGN){return .235+(r-2.04)*Math.tan(shape.numberSlope*Math.PI/180);}
export function bowlProfile(shape:WheelShape=DEFAULT_DESIGN):number[][]{
 return [[1.53,.34],[1.585,FLOOR],[1.985,FLOOR],[2.04,.235],[2.425,numberHeight(2.425,shape)],[2.49,.44],[2.7,.60],[2.9,.75],[3.05,.80]];
}
export function trackHeight(r:number){return r<2.7?.44+(r-2.49)*(.16/.21):r<2.9?.60+(r-2.7)*(.15/.2):.75+(r-2.9)*(.05/.15);}
/**
 * Höhe der Kollisionsfläche exakt an den drei bündig abgesenkten Ringen (r 2,93/2,47/2,025) –
 * dieselben Bruchpunkte wie die Stator-/Rotor-Segmente in ball-physics.ts (buildColliders),
 * unabhängig vom Zahlenkranz-Gefälle. Bei Änderung dort auch hier anpassen.
 */
function flushHeightAt(radius:number):number{
 if(radius===2.93)return trackHeight(radius); // Segment (2.9,.75)–(3.05,.80)
 if(radius===2.47)return .425+(radius-2.455)*(.44-.425)/(2.49-2.455); // Segment (2.455,.425)–(2.49,.44)
 if(radius===2.025)return (FLOOR-.006)+(radius-1.985)*(.229-(FLOOR-.006))/(2.04-1.985); // Segment (1.985,FLOOR-.006)–(2.04,.229)
 throw new Error(`flushHeightAt: unbekannter Ring r=${radius}`);
}
/**
 * Drei der sechs Zierringe (r 2,93 / 2,47 / 2,025) standen 1,7–2,7 mm über die Fläche vor, über
 * die die Kugel rollen muss, und bildeten Mulden, in denen eine langsame Kugel für immer liegen
 * bliebe. Auf Wunsch des Betreibers im sichtbaren Modell bündig abgesenkt (Höhe = Fläche
 * darunter, minus Ringdicke) statt wie zuvor nur in der Kollisionsrechnung.
 */
const FLUSH_RINGS=[2.93,2.47,2.025];
export function rimProfile(shape:WheelShape=DEFAULT_DESIGN):number[][]{
 return [[1.555,.315,.018],[2.025,.232,.016],[2.442,numberHeight(2.425,shape)+.004,.015],[2.47,.425,.018],[2.93,.765,.012],[3.02,.795,.018]]
  .map(([radius,y,tube])=>FLUSH_RINGS.includes(radius)?[radius,flushHeightAt(radius)-tube,tube]:[radius,y,tube]);
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
export function sameShape(a:WheelShape,b:WheelShape){return a.bowlDepth===b.bowlDepth&&a.numberSlope===b.numberSlope&&a.numberSize===b.numberSize;}
