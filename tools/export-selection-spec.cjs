/* Read the native UI contract; never modify the app to fit the website. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {app,native}=require('./native-renderer.cjs');
const files=['src/shared/ui/selection/liquid-choice-backdrop.tsx','src/features/action/ui/action-choice-label.tsx','src/features/action/ui/action-time-options.tsx','src/shared/ui/selection/use-choice-layout.ts','src/features/preferences/ui/language-picker.tsx','src/shared/ui/app-theme-palettes.ts','node_modules/react-native-reanimated/src/animation/timing.ts','node_modules/react-native-reanimated/src/animation/spring/springUtils.ts'];
const texts=files.map(file=>fs.readFileSync(path.join(app,file),'utf8'));
const shape=texts[0].match(/const d = `([^`]+)`;/)?.[1];
const spring=texts[0].match(/withSpring\(next, (\{[^}]+\})\)/)?.[1];
const duration=Number(texts[0].match(/withTiming\(target \? 1 : 0, \{ duration: (\d+) \}/)?.[1]);
const pad=texts[1].match(/paddingHorizontal: (\d+), paddingVertical: (\d+)/);
if(!shape||!spring||!pad||!duration||!texts[6].includes('easing: Easing.inOut(Easing.quad)'))throw new Error('Native selection contract changed; inspect source before exporting');
const colors=native(path.join(app,'src/shared/ui/app-theme-palettes.ts')).getAppThemeColors('oat',false);
const spec={spring:vm.runInNewContext('('+spring+')'),opacityMs:duration,padding:{x:Number(pad[1]),y:Number(pad[2])},fill:colors.selection,ink:colors.ink,muted:colors.inkSoft};
fs.writeFileSync(path.resolve(__dirname,'../docs/assets/ui/selection-spec.js'),'/* Generated from native Dayloom selection sources. */\n(function(g){\nconst spec='+JSON.stringify(spec)+';\nspec.path=([x,y,w,h])=>{const point=(px,py)=>`${x+w*px} ${y+h*py}`;return `'+shape+'`;};\ng.MARSelectionSpec=Object.freeze(spec);\n})(window);\n');
fs.writeFileSync(path.resolve(__dirname,'../architecture/native-selection-sources.json'),JSON.stringify(files.map((file,i)=>({file,sha256:crypto.createHash('sha256').update(texts[i]).digest('hex')})),null,2)+'\n');
console.log('PASS native shape, padded label, Oat palette, spring and 110ms visibility exported');
