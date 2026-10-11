const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const {createCanvas,Path2D,ImageData}=require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const docs=path.resolve(__dirname,'../docs');
const s={console,Path2D,ImageData,document:{createElement:()=>createCanvas(1,1)},performance};s.window=s;vm.createContext(s);
for(const name of ['drawn-app.js','v3/native-landscape.js','v3/pet.js','v4/room.js','v4/screen.js','v5/journey.js'])vm.runInContext(fs.readFileSync(path.join(docs,'assets',name),'utf8'),s);
const world=createCanvas(1600,1000),ctx=world.getContext('2d'),room=s.MARHeroRoom(),screen=s.MARHeroScreen();
for(const tod of [0,2,0]){room.draw(ctx,{width:1600,height:1000,time:1,paused:true,tod,lightOn:tod===2});assert(ctx.getImageData(800,500,1,1).data[3]===255);for(const progress of [0,.4,.65,1,0]){screen.draw({progress,worldCanvas:world,elapsedSeconds:540});assert(screen.canvas.width===1560);}}
const m=s.MARJourney.makeMachine(false);m.entry(.35);m.tick(1900);assert(m.state().phase==='completion');m.pause(true);const frozen=m.state().time;m.tick(1000);assert(m.state().time===frozen);m.pause(false);m.entry(0,true);assert(m.state().done);m.entry(.8);m.tick(50);assert(m.state().done);m.replay();assert(!m.state().done);for(const p of [0,1,0]){m.seek(p);assert(Number.isFinite(m.state().time));}
const doc=fs.readFileSync(path.join(docs,'index.html'),'utf8');for(const match of doc.matchAll(/(?:src|href)="(\/(?!\/)[^"?#]+)(?:[?#][^"]*)?"/g)){const file=path.join(docs,match[1]);if(/\.(js|css|png|webp|svg|otf|glb)$/.test(file))assert(fs.existsSync(file),file);}
assert(!doc.includes('data-routine='));assert(!doc.includes('data-theme='));assert(doc.includes('웹사이트 개인정보 안내'));assert(doc.includes('boseung@myanimalroom.com'));
console.log('PASS native room day/night, screen phases, journey pause/skip/replay, static assets and click-free semantics');
