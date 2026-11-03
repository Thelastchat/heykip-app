// Bundle a test that uses the app’s money code, with phone-only packages stubbed out (they can’t run in Node).
// Usage: node tests/bundle.cjs <entry.ts> [out.js]  — with no out file it bundles to a temp file and runs it.
const path=require('path'),fs=require('fs'),os=require('os');const [,,entry,given]=process.argv;const out=given||path.join(os.tmpdir(),'heykip-'+path.basename(entry)+'.js');const root=process.cwd();
const stub=`const p=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:k===Symbol.toPrimitive?(()=>''):p,apply:()=>p,construct:()=>p});
const names=['Platform','StyleSheet','Dimensions','AppState','Appearance','NativeModules','Linking','I18nManager','getLocales','getCalendars','default','useColorScheme','PixelRatio','Image','View','Text','Animated','Easing','requireNativeModule','requireOptionalNativeModule','EventEmitter','NativeModulesProxy','useLocales','processColor','TurboModuleRegistry','DeviceEventEmitter','createClient'];
const o={__esModule:true};for(const n of names)o[n]=p;o.Platform={OS:'web',select:x=>x.web??x.default};o.StyleSheet={create:x=>x,absoluteFill:{},hairlineWidth:1,flatten:x=>x};o.getLocales=()=>[{languageCode:'en',languageTag:'en-US'}];o.getCalendars=()=>[{calendar:'gregory'}];o.Appearance={getColorScheme:()=>'light',addChangeListener:()=>({remove(){}})};o.Dimensions={get:()=>({width:390,height:844}),addEventListener:()=>({remove(){}})};
o.default=Object.assign({},o);module.exports=o;`;
require('esbuild').build({entryPoints:[entry],bundle:true,platform:'node',outfile:out,logLevel:'error',define:{__DEV__:'false'},loader:{'.png':'empty','.ttf':'empty'},
plugins:[{name:'stub',setup(b){
 b.onResolve({filter:/^@\/lib\/supabase$/},()=>({path:'supabase',namespace:'stub'}));
 b.onResolve({filter:/^@\//},a=>({path:['.ts','.tsx','/index.ts'].map(e=>path.join(root,'src',a.path.slice(2))+e).find(f=>fs.existsSync(f))}));
 b.onResolve({filter:/^(react-native|expo|@expo|@react-native|@react-native-async-storage|phosphor-react-native|@supabase)/},a=>({path:a.path,namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:stub,loader:'js'}));
}}]}).then(()=>{if(!given)require(out)}).catch(e=>{console.log(e.message);process.exit(1)});
