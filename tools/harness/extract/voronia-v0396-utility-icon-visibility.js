
(()=>{
 'use strict';
 const body=document.body;
 const isVisible=el=>{
   if(!el||!el.isConnected)return false;
   const cs=getComputedStyle(el);
   if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
   const r=el.getBoundingClientRect();
   return r.width>0&&r.height>0;
 };
 function modalIsOpen(){
   if(body.classList.contains('modal-open'))return true;
   // The game uses .modal plus several dedicated overlays; only visible ones count.
   const selectors=['.modal','.modal-overlay','[role="dialog"]','#onb-overlay','#offline-overlay','#tutorial-overlay','#settings-overlay'];
   for(const sel of selectors){
     let nodes=[];try{nodes=document.querySelectorAll(sel)}catch(e){}
     for(const el of nodes){
       if(el.id==='nx-panel')continue;
       if(isVisible(el)){
         // Ignore modal shells that are merely present but explicitly marked closed.
         if(el.getAttribute('aria-hidden')==='true')continue;
         if(el.classList.contains('hidden')||el.classList.contains('is-hidden'))continue;
         return true;
       }
     }
   }
   return false;
 }
 function update(){
   const hide=modalIsOpen();
   body.classList.toggle('voronia-utility-icons-hidden',hide);
   if(hide){
     const panel=document.getElementById('nx-panel');
     if(panel)panel.classList.remove('on');
   }
 }
 let dirty=true;const observer=new MutationObserver(()=>{dirty=true});
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-hidden','open']});
 document.addEventListener('click',()=>setTimeout(update,0),true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setTimeout(update,0)},true);
 window.addEventListener('resize',update,{passive:true});
 setInterval(()=>{if(dirty){dirty=false;update()}},400);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
})();
