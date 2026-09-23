export const RECORDINGS=['evian-roll.ogg','evian-hit-1.ogg','evian-hit-2.ogg','evian-hit-3.ogg'];
export function rollLevel(progress:number){return progress<.46?.38:progress<.86?.38*(.86-progress)/.4:0;}
export class Sound {
 enabled=true;ready=false;error='';
 private context:AudioContext|null=null;private master:GainNode|null=null;private fx:GainNode|null=null;private bed:GainNode|null=null;
 private background:HTMLAudioElement|null=null;
 private buffers:AudioBuffer[]=[];private loading:Promise<void>|null=null;
 private rolling:AudioBufferSourceNode|null=null;private rollGain:GainNode|null=null;private pan:StereoPannerNode|null=null;
 private shots=new Set<AudioBufferSourceNode>();private effects=.65;private atmosphere=0;private muted=false;private hitIndex=0;
 async unlock(){
  this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();
  if(!this.master){const c=this.context;this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);this.fx=c.createGain();this.bed=c.createGain();this.bed.gain.value=0;this.fx.connect(this.master);this.bed.connect(this.master);
   this.background=new Audio(new URL('audio/casino-background.ogg',document.baseURI).href);this.background.loop=true;this.background.preload='auto';
   c.createMediaElementSource(this.background).connect(this.bed);
  }
  if(this.background?.paused)await this.background.play();
  if(!this.buffers.length){
   this.loading??=Promise.all(RECORDINGS.map(async file=>{const response=await fetch(new URL(`audio/${file}`,document.baseURI),{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Audio-Datei fehlt');return this.context!.decodeAudioData(await response.arrayBuffer());})).then(buffers=>{this.buffers=buffers;});
   try{await this.loading;this.error='';}catch{this.loading=null;this.ready=false;this.error='Roulette-Aufnahme konnte nicht geladen werden. Bitte erneut versuchen.';return;}
  }
  this.ready=this.context.state==='running';this.configure(this.effects,this.atmosphere,this.muted);
 }
 configure(effects:number,ambience:number,muted:boolean){this.effects=effects;this.atmosphere=ambience;this.muted=muted;if(this.master&&this.context){const t=this.context.currentTime;this.master.gain.setTargetAtTime(muted?0:.8,t,.08);this.fx!.gain.setTargetAtTime(effects,t,.08);this.bed!.gain.setTargetAtTime(ambience,t,.25);}}
 roll(progress=0){
  if(!this.ready||!this.context||document.hidden)return;this.stop(true);if(progress>=.86)return;
  const c=this.context,source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=this.buffers[0];source.loop=true;source.loopStart=.06;source.loopEnd=this.buffers[0].duration-.06;
  gain.gain.value=0;source.connect(gain).connect(pan).connect(this.fx!);source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();};
  this.rolling=source;this.rollGain=gain;this.pan=pan;source.start(0,.1);this.update(0,progress);
 }
 update(angle:number,progress:number){if(this.context&&this.pan&&this.rolling&&this.rollGain){const t=this.context.currentTime;this.pan.pan.setTargetAtTime(Math.sin(angle)*.3,t,.04);this.rolling.playbackRate.setTargetAtTime(1.04-progress*.13,t,.15);this.rollGain.gain.setTargetAtTime(rollLevel(progress),t,.07);}}
 impact(strength=1){this.contact(.25+Math.max(0,Math.min(1,strength))*.65,false);}
 private contact(volume:number,ambient:boolean){
  if(!this.ready||!this.context||this.muted||document.hidden)return;
  const c=this.context,source=c.createBufferSource(),gain=c.createGain();source.buffer=this.buffers[1+this.hitIndex++%3];gain.gain.value=volume;source.connect(gain).connect(ambient?this.bed!:this.fx!);
  this.shots.add(source);source.onended=()=>{this.shots.delete(source);source.disconnect();gain.disconnect();};source.start();
 }
 tick(){this.contact(.2,false);}
 stop(all=false){
  if(this.rolling&&this.context){const t=this.context.currentTime;this.rollGain!.gain.cancelScheduledValues(t);this.rollGain!.gain.setTargetAtTime(0,t,.01);try{this.rolling.stop(t+.05);}catch{}this.rolling=null;this.rollGain=null;this.pan=null;}
  if(all){for(const source of this.shots){try{source.stop();}catch{}}this.shots.clear();}
 }
}
