
/* v0.0.40.1 · Фоновая космическая музыка без плавающего дока: управление живёт только
   в «Настройки → 🎵 Музыка» (взаимоисключающе с треками сцен). Ключ localStorage прежний —
   пользовательские настройки громкости сохраняются. */
(function(){
 'use strict';
 var audio=document.getElementById('voronia-ambient-audio');
 if(!audio||audio.dataset.ready==='1')return;
 audio.dataset.ready='1';
 var KEY='voronia_music_settings_v0386', cfg={volume:0.20,enabled:false};
 try{var saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object'){cfg.volume=Math.max(0,Math.min(.5,Number(saved.volume)||0));cfg.enabled=!!saved.enabled;}}catch(e){}
 audio.src='music/voronia_ambient.mp3';audio.volume=cfg.volume;
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){}}
 function fade(target,ms){
   var from=audio.volume,start=performance.now(),duration=Math.max(150,ms||700);
   if(audio._fadeRAF)cancelAnimationFrame(audio._fadeRAF);
   function step(now){var t=Math.min(1,(now-start)/duration);audio.volume=Math.max(0,Math.min(.5,from+(target-from)*t));if(t<1)audio._fadeRAF=requestAnimationFrame(step);else audio._fadeRAF=0;}
   audio._fadeRAF=requestAnimationFrame(step);
 }
 function sync(){
   var t=document.getElementById('ambient-settings-toggle'),r=document.getElementById('ambient-settings-volume');
   var on=cfg.enabled&&!audio.paused;
   if(t){t.textContent=on?'ВКЛ':'ВЫКЛ';t.classList.toggle('on',on);}
   if(r&&document.activeElement!==r)r.value=String(Math.round(cfg.volume*100));
 }
 function start(){
   cfg.enabled=true;persist();
   try{
     audio.volume=0;
     var p=audio.play();
     if(p&&p.then)p.then(function(){fade(cfg.volume,900);sync();}).catch(function(){cfg.enabled=false;persist();sync();try{window.showToast&&window.showToast('🎵 Не удалось запустить музыку — нажмите ещё раз','warn',4000);}catch(e){}});
     else sync();
   }catch(e){cfg.enabled=false;persist();sync();}
 }
 function stop(){cfg.enabled=false;persist();fade(0,450);setTimeout(function(){if(!cfg.enabled){try{audio.pause();audio.currentTime=0;}catch(e){}}},480);sync();}
 audio.addEventListener('error',function(){cfg.enabled=false;persist();sync();try{window.showToast&&window.showToast('🎵 Музыка временно недоступна','warn',4500);}catch(e){}});
 document.addEventListener('visibilitychange',function(){if(document.hidden&&!audio.paused){fade(0,300);setTimeout(function(){if(document.hidden){try{audio.pause();}catch(e){}}},320);}else if(!document.hidden&&cfg.enabled&&audio.paused){var p=audio.play();if(p&&p.then)p.then(function(){fade(cfg.volume,500);}).catch(function(){});}});
 if(cfg.enabled){cfg.enabled=false;persist();}
 var settingsToggle=document.getElementById('ambient-settings-toggle');
 var settingsRange=document.getElementById('ambient-settings-volume');
 if(settingsToggle)settingsToggle.addEventListener('click',function(){
   if(audio.paused){
     try{var st0=window.__V&&window.__V.settings,nt0=document.getElementById('set-music-toggle');if(st0&&st0.music&&nt0)nt0.click();}catch(e){}
     start();
   }else stop();
   setTimeout(sync,60);
 });
 if(settingsRange)settingsRange.addEventListener('input',function(){cfg.volume=Math.max(0,Math.min(.5,Number(settingsRange.value)/100));persist();if(!audio.paused)fade(cfg.volume,120);sync();});
 audio.addEventListener('play',sync);audio.addEventListener('pause',sync);
 var nativeMusicToggle=document.getElementById('set-music-toggle');
 if(nativeMusicToggle)nativeMusicToggle.addEventListener('click',function(){setTimeout(function(){try{var st1=window.__V&&window.__V.settings;if(st1&&st1.music&&!audio.paused)stop();}catch(e){}},0);});
 sync();
})();
