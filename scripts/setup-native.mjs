import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const wav=path.join(root,'public','restx-alert.wav');

function copyFile(src,dst){
  if(!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
  return true;
}

function patchAndroidManifest(){
  const manifest=path.join(root,'android','app','src','main','AndroidManifest.xml');
  if(!fs.existsSync(manifest)) return;
  let s=fs.readFileSync(manifest,'utf8');
  const perms=[
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.VIBRATE',
    'android.permission.WAKE_LOCK',
    'android.permission.RECEIVE_BOOT_COMPLETED'
  ];
  let added='';
  for(const p of perms){
    if(!s.includes(p)) added+=`    <uses-permission android:name="${p}" />\n`;
  }
  if(added){
    s=s.replace(/<manifest[^>]*>\s*/,'$&'+added);
    fs.writeFileSync(manifest,s);
  }
}

async function patchIosProject(){
  const xcodePath=path.join(root,'ios','App','App.xcodeproj','project.pbxproj');
  const resource=path.join(root,'ios','App','App','Resources','restx_alert.wav');
  if(!fs.existsSync(xcodePath)) return;
  copyFile(wav,resource);
  try{
    const xcode=(await import('xcode')).default;
    const project=xcode.project(xcodePath);
    project.parseSync();
    const group=project.pbxGroupByName('Resources') || project.pbxGroupByName('App');
    const fileRef=project.addResourceFile(resource, {target: project.getFirstTarget().uuid}, group?.uuid);
    if(fileRef) fs.writeFileSync(xcodePath,project.writeSync());
  }catch(e){
    console.warn('iOS resource registration was not automatic:',e.message);
    console.warn('The WAV was copied to ios/App/App/Resources/restx_alert.wav. Add it to the Xcode target resources if needed.');
  }
}

const androidRaw=path.join(root,'android','app','src','main','res','raw','restx_alert.wav');
const androidDrawable=path.join(root,'android','app','src','main','res','drawable','ic_stat_restx.xml');
if(copyFile(wav,androidRaw)) console.log('Android: alert sound copied.');
if(fs.existsSync(path.dirname(androidDrawable))){
  fs.mkdirSync(path.dirname(androidDrawable),{recursive:true});
  fs.writeFileSync(androidDrawable,`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n  <path android:fillColor="#FFFFFFFF" android:pathData="M12,2A10,10 0,1 0,12 22A10,10 0,1 0,12 2M9,7L18,12L9,17Z"/>\n</vector>\n`);
}
patchAndroidManifest();
await patchIosProject();
console.log('RestX native resources prepared.');
