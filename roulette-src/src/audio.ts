export class Sound {
 enabled=true;ready=false;private context:AudioContext|null=null;private master:GainNode|null=null;private fx:GainNode|null=null;private bed:GainNode|null=null;
 private rollSource:AudioBufferSourceNode|null=null;private rollGain:GainNode|null=null;private pan:StereoPannerNode|null=null;private timer:number|null=null;
 private effects=.65;private atmosphere=0;private muted=false;
 async unlock(){this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();if(!this.master){const c=this.context;this.master=c.createGain();this.master.connect(c.destination);this.fx=c.createGain();this.bed=c.createGain();this.fx.connect(this.master);this.bed.connect(this.master);this.startAmbience();}this.ready=this.context.state==='running';this.configure(this.effects,this.atmosphere,this.muted);}
 configure(effects:number,ambience:number,muted:boolean){this.effects=effects;this.atmosphere=ambience;this.muted=muted;if(this.master&&this.context){const t=this.context.currentTime;this.master.gain.setTargetAtTime(muted?0:.75,t,.15);this.fx!.gain.setTargetAtTime(effects,t,.1);this.bed!.gain.setTargetAtTime(ambience,t,.2);}}
 private startAmbience(){
  // Only occasional quiet table/chip taps: no looping noise or fake voices.
  this.timer=window.setInterval(()=>{if(!this.ready||this.muted||this.atmosphere===0||document.hidden)return;this.click(.025+Math.random()*.025,true,1300+Math.random()*900);},2700);
 }
 roll(){
  if(!this.ready||!this.context)return;this.stop();const c=this.context;
  const buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);
  // Tiny damped contacts form a quiet rolling texture instead of broadband hiss.
  for(let start=0;start<data.length;start+=Math.floor(c.sampleRate*(.012+Math.random()*.008))){
   const pitch=380+Math.random()*220,level=.06+Math.random()*.04;
   for(let j=0;j<c.sampleRate*.016&&start+j<data.length;j++){const t=j/c.sampleRate;data[start+j]+=level*Math.exp(-t*420)*(Math.sin(2*Math.PI*pitch*t)+.25*Math.sin(2*Math.PI*pitch*2.7*t));}
  }
  this.rollSource=c.createBufferSource();this.rollSource.buffer=buffer;this.rollSource.loop=true;
  this.rollGain=c.createGain();this.rollGain.gain.value=.28;this.pan=c.createStereoPanner();
  this.rollSource.connect(this.rollGain).connect(this.pan).connect(this.fx!);this.rollSource.start();
 }
 update(angle:number,progress:number){if(this.context&&this.pan&&this.rollSource&&this.rollGain){const t=this.context.currentTime;this.pan.pan.setTargetAtTime(Math.sin(angle)*.7,t,.025);this.rollSource.playbackRate.setTargetAtTime(1.3-Math.min(1,progress)*.85,t,.1);this.rollGain.gain.setTargetAtTime(progress>.65?.08:.28,t,.15);}}
 impact(strength=1){this.click(.12+strength*.28,false,700+strength*1100);if(strength<.5)window.setTimeout(()=>this.click(strength*.12,false,950),65);}
 private click(volume:number,ambient:boolean,pitch:number){
  if(!this.ready||!this.context||document.hidden)return;const c=this.context,t=c.currentTime;
  for(const [ratio,level,decay] of [[1,1,.065],[2.37,.3,.025]]){const source=c.createOscillator(),gain=c.createGain();source.type='sine';source.frequency.setValueAtTime(pitch*ratio,t);source.frequency.exponentialRampToValueAtTime(pitch*ratio*.68,t+.035);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*level),t+.001);gain.gain.exponentialRampToValueAtTime(.0001,t+decay);source.connect(gain).connect(ambient?this.bed!:this.fx!);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(t);source.stop(t+decay+.01);}
 }
 tick(pitch=1200){this.click(.15,false,pitch);}
 stop(){try{this.rollSource?.stop();}catch{}this.rollSource?.disconnect();this.rollGain?.disconnect();this.pan?.disconnect();this.rollSource=null;this.rollGain=null;this.pan=null;}
}
