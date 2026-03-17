/* ═══════════════════════════════════════════════════════════
   CyberSec Pro — OffSec Common JS (Matrix Rain, Nav, Reveal)
   ═══════════════════════════════════════════════════════════ */

/* Mobile Menu Toggle */
function toggleMobileMenu(){
  var existing=document.querySelector('.mob-menu');
  if(existing){existing.remove();return}
  var m=document.createElement('div');
  m.className='mob-menu';
  m.style.cssText='position:fixed;top:64px;left:0;right:0;background:rgba(10,14,20,.96);backdrop-filter:blur(20px);padding:24px 32px;display:flex;flex-direction:column;gap:16px;border-bottom:1px solid rgba(159,239,0,.1);z-index:99';
  [['Features','/#features'],['Arsenal','/#tools'],['Pricing','/#pricing'],['Docs','/docs.html'],['API','/api.html'],['$ login','/dashboard/login']].forEach(function(item){
    var a=document.createElement('a');a.href=item[1];a.textContent=item[0];
    a.style.cssText='font-size:.9rem;color:#a4b1cd;font-weight:500;font-family:JetBrains Mono,monospace';
    a.onclick=function(){m.remove()};m.appendChild(a);
  });
  document.body.appendChild(m);
}

/* Auth-Aware Navigation */
(function(){
  try{
    var t=localStorage.getItem('token')||localStorage.getItem('access_token');
    if(t){
      fetch('/api/v1/auth/me',{headers:{Authorization:'Bearer '+t}}).then(function(r){
        if(r.ok){
          var cta=document.getElementById('nav-cta');
          var login=document.getElementById('nav-login');
          if(cta){cta.textContent='Dashboard';cta.href='/dashboard/';}
          if(login){login.style.display='none';}
        }
      }).catch(function(){});
    }
  }catch(e){}
})();

/* Scroll Reveal Animation */
if(window.matchMedia('(prefers-reduced-motion:no-preference)').matches){
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('v');io.unobserve(e.target)}
    });
  },{threshold:.06,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(e){io.observe(e)});
}

/* Matrix Rain */
;(function(){
  var c=document.getElementById('matrix-bg');
  if(!c)return;
  var ctx=c.getContext('2d');
  var w,h,cols,drops;
  var chars='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/{}[]|\\=+*^&$#@!~';
  var fontSize=14;
  function resize(){
    w=window.innerWidth;h=window.innerHeight;
    c.width=w;c.height=h;
    cols=Math.floor(w/fontSize);
    drops=new Array(cols).fill(1);
    for(var i=0;i<cols;i++)drops[i]=Math.random()*h/fontSize|0;
  }
  function draw(){
    ctx.fillStyle='rgba(10,14,20,.06)';
    ctx.fillRect(0,0,w,h);
    for(var i=0;i<cols;i++){
      var char=chars[Math.random()*chars.length|0];
      var x=i*fontSize;
      var y=drops[i]*fontSize;
      var r=Math.random();
      if(r<0.7){ctx.fillStyle='#9fef00'}
      else if(r<0.88){ctx.fillStyle='#00d4ff'}
      else{ctx.fillStyle='#b44aff'}
      ctx.font=fontSize+'px JetBrains Mono,monospace';
      ctx.fillText(char,x,y);
      if(y>h&&Math.random()>0.975)drops[i]=0;
      drops[i]++;
    }
  }
  resize();
  setInterval(draw,45);
  window.addEventListener('resize',resize);
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches){c.style.display='none'}
})();

/* Copy to Clipboard Utility */
function copyToClipboard(text){
  navigator.clipboard.writeText(text);
  var toast=document.createElement('div');
  toast.style.cssText='position:fixed;bottom:20px;right:20px;background:#9fef00;color:#0a0e14;padding:10px 20px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:.82rem;font-weight:700;z-index:10000;box-shadow:0 4px 20px rgba(159,239,0,.3)';
  toast.textContent='Copied to clipboard!';
  document.body.appendChild(toast);
  setTimeout(function(){toast.remove()},2000);
}
