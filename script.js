(()=>{
const W=360,H=720,WALL=34,PY=520,JT=.3;
const COLORS=['#00c2f0','#ff5c52','#4cd964','#ffcc00','#b266ff','#ff7ac8'];
const KEYS=['a','l','q','p','z','m'];
const $=id=>document.getElementById(id);
const cv=$('cv'),wrap=$('wrap'),ctx=cv.getContext('2d');cv.width=W*2;cv.height=H*2;
const PCFG={config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},{urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},{urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}]}};
const FONT='Orbitron,"Trebuchet MS",monospace',touch=matchMedia('(pointer:coarse)').matches;
let mode=null,isHost=false,peer=null,hostConn=null,lobby=[],myIdx=0,code='';
let S=null,last=0,lastSend=0,recvT=0,localN=1,tt;

const show=id=>{document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));if(id==='s-game'){fit();requestAnimationFrame(fit)}};
/* ajusta o canvas (proporção 1:2) a qualquer tela / orientação */
function fit(){const cs=getComputedStyle(wrap),aw=wrap.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),ah=wrap.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
 if(!(aw>0&&ah>0))return;const w=Math.floor(Math.min(aw,ah/2));cv.style.width=w+'px';cv.style.height=w*2+'px'}
if(window.ResizeObserver)new ResizeObserver(fit).observe(wrap);
addEventListener('resize',fit);addEventListener('orientationchange',()=>setTimeout(fit,250));
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2600)}
const myName=()=>($('nick').value.trim()||'Jogador');
const restX=s=>s?W-WALL-15:WALL+15;

/* ---------- Estado do jogo ---------- */
function newState(list){return{ph:'count',obs:[],spd:260,sc:0,since:0,gap:0,lastH:0,cnt:3,msg:'',timer:0,
 players:list.map(p=>({name:p.name,conn:p.conn||null,side:0,from:0,jump:false,t:0,cx:0,alive:true,gone:false,score:0,dist:0}))}}
function newRound(){S.obs=[];S.sc=0;S.spd=260;S.since=-250;S.gap=300;S.lastH=0;S.cnt=3;S.msg='';S.ph='count';
 S.players.forEach((p,i)=>{p.side=i%2;p.jump=false;p.t=0;p.alive=!p.gone;p.dist=0;p.cx=restX(p.side)})}
function spawn(){const r=Math.random(),w=90+Math.random()*60;let o;
 if(r<.38)o={k:0,x:WALL,y:-46,w,h:46};
 else if(r<.76)o={k:1,x:W-WALL-w,y:-46,w,h:46};
 else{const h=120+Math.random()*70;o={k:2,x:120+Math.random()*100,y:-h,w:20,h}}
 S.obs.push(o);S.since=0;S.lastH=o.h;S.gap=S.spd*(.6+Math.random()*.5)}
function tap(i){if(!S||S.ph!=='play')return;const p=S.players[i];if(p&&p.alive&&!p.jump){p.jump=true;p.from=p.side;p.t=0}}
function step(dt){
 if(S.ph==='count'){S.cnt-=dt;if(S.cnt<=0)S.ph='play';S.players.forEach(p=>p.cx=restX(p.side));return}
 if(S.ph==='over'){S.timer-=dt;if(S.timer<=0)newRound();return}
 S.spd=Math.min(520,260+S.sc/45);
 const d=S.spd*dt;S.sc+=d;S.since+=d;
 S.obs.forEach(o=>o.y+=d);S.obs=S.obs.filter(o=>o.y<H+20);
 if(S.since>=S.gap+S.lastH)spawn();
 S.players.forEach(p=>{if(!p.alive)return;
  if(p.jump){p.t+=dt/JT;if(p.t>=1){p.t=1;p.jump=false;p.side=1-p.from}}
  p.cx=p.jump?restX(p.from)+(restX(1-p.from)-restX(p.from))*p.t:restX(p.side);
  p.dist=S.sc/10|0;
  const hx=p.cx-11,hy=PY-12;
  for(const o of S.obs)if(hx<o.x+o.w-2&&hx+22>o.x+2&&hy<o.y+o.h-2&&hy+24>o.y+2){p.alive=false;break}
 });
 const act=S.players.filter(p=>!p.gone),al=act.filter(p=>p.alive);
 if(act.length<=1?al.length===0:al.length<=1){
  S.ph='over';S.timer=3.2;
  if(act.length<=1){const p=act[0];if(p){p.score=Math.max(p.score,p.dist);S.msg='Fim de jogo: '+p.dist+' m'}else S.msg='Todos saíram'}
  else if(al.length===1){al[0].score++;S.msg=al[0].name+' venceu!'}else S.msg='Empate!';
 }
}

/* ---------- Desenho ---------- */
function block(x,y,w,h,col){
 ctx.save();ctx.fillStyle='rgba(8,16,40,.96)';ctx.fillRect(x,y,w,h);
 ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.strokeStyle=col;ctx.lineWidth=1;ctx.globalAlpha=.2;
 for(let yy=y+12;yy<y+h;yy+=24){ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke()}
 ctx.globalAlpha=.35;for(let xx=x+10;xx<x+w;xx+=28){ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+h);ctx.stroke()}
 ctx.restore();ctx.save();ctx.strokeStyle=col;ctx.lineWidth=3;ctx.shadowColor=col;ctx.shadowBlur=14;ctx.strokeRect(x,y,w,h);ctx.restore()}
function peng(cx,y,col,dir,a){
 ctx.save();ctx.globalAlpha=a;ctx.translate(cx,y);ctx.scale(dir,1);ctx.shadowColor=col;ctx.shadowBlur=18;
 ctx.fillStyle='#0b1226';ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-13,-13,26,26,8);ctx.fill();ctx.stroke();
 ctx.shadowBlur=0;ctx.fillStyle=col;ctx.fillRect(1,-9,10,18);
 ctx.fillStyle='#fff';ctx.fillRect(5,-5,4,3);ctx.fillRect(5,2,4,3);
 ctx.fillStyle=col;ctx.globalAlpha=a*.7;ctx.beginPath();ctx.moveTo(-13,-6);ctx.lineTo(-21,0);ctx.lineTo(-13,6);ctx.fill();
 ctx.restore()}
function pill(x,y,col,txt,a){
 ctx.save();ctx.globalAlpha=a;ctx.fillStyle='rgba(5,10,25,.85)';ctx.strokeStyle=col;ctx.lineWidth=2;ctx.shadowColor=col;ctx.shadowBlur=8;
 ctx.beginPath();ctx.roundRect(x,y,108,26,6);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
 ctx.fillStyle=col;ctx.fillRect(x+8,y+8,10,10);ctx.font='700 12px '+FONT;ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(txt,x+26,y+14);ctx.restore()}
function text(t,y,sz,col){ctx.save();ctx.font='900 '+sz+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=col||'#00e5ff';ctx.shadowBlur=20;ctx.fillStyle=col||'#fff';ctx.fillText(t,W/2,y);ctx.restore()}
function draw(now){
 ctx.setTransform(2,0,0,2,0,0);
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#04060f');g.addColorStop(1,'#0b1740');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 const ex=(!isHost&&mode==='online'&&S.ph==='play')?S.spd*(now-recvT)/1000:0;
 ctx.strokeStyle='rgba(0,229,255,.09)';ctx.lineWidth=1;ctx.beginPath();
 for(let i=0;i<=W;i+=40){ctx.moveTo(i,0);ctx.lineTo(i,H)}
 for(let yy=((S.sc+ex)%40)-40;yy<H;yy+=40){ctx.moveTo(0,yy);ctx.lineTo(W,yy)}
 ctx.stroke();
 S.obs.forEach(o=>block(o.x,o.y+ex,o.w,o.h,o.k===2?'#ffd400':'#ff2d95'));
 block(-4,-4,WALL+4,H+8,'#00e5ff');block(W-WALL,-4,WALL+4,H+8,'#00e5ff');
 S.players.forEach((p,i)=>{if(p.gone||!p.alive)return;
  const dir=p.jump?(p.from?-1:1):(p.side?-1:1);peng(p.cx,PY,COLORS[i],dir,1)});
 const solo=S.players.filter(p=>!p.gone).length<=1;
 S.players.forEach((p,i)=>pill(8,8+i*31,COLORS[i],(solo?(p.alive?p.dist:p.score):p.score)+(solo?'m':'')+' '+p.name.slice(0,6),p.gone?.3:p.alive||S.ph!=='play'?1:.5));
 ctx.font='700 10px '+FONT;ctx.fillStyle='rgba(0,229,255,.7)';ctx.textAlign='left';ctx.fillText('VEL '+(S.spd|0),12,H-12);
 if(S.ph==='count')text(Math.ceil(S.cnt)||1,300,90);
 if(S.ph==='over')text(S.msg,300,22,'#ffd400');
 if(S.ph==='play'&&solo)text(S.players.find(p=>!p.gone).dist+' m',H-40,24)}

/* ---------- Controles: zonas de toque na tela inteira + teclado ---------- */
const rgba=(h,a)=>{const n=parseInt(h.slice(1),16);return'rgba('+(n>>16)+','+(n>>8&255)+','+(n&255)+','+a+')'};
function ripple(z,e,col){const r=z.getBoundingClientRect(),d=document.createElement('span');d.className='rip';
 d.style.left=(e.clientX-r.left)+'px';d.style.top=(e.clientY-r.top)+'px';d.style.borderColor=col;d.style.background=rgba(col,.25);
 z.appendChild(d);d.addEventListener('animationend',()=>d.remove())}
function buildCtrl(){const z=$('zones');z.innerHTML='';
 const local=mode==='local',n=local?S.players.length:1,cols=n<=3?n:Math.ceil(n/2),rows=n<=3?1:2;
 z.style.gridTemplateColumns='repeat('+(n===5?6:cols)+',1fr)';z.style.gridTemplateRows='repeat('+rows+',1fr)';
 for(let k=0;k<n;k++){const idx=local?k:myIdx,col=COLORS[idx],el=document.createElement('div');
  el.className='zone'+(n===1?' solo':'');
  el.style.setProperty('--c',col);el.style.setProperty('--t',rgba(col,.2));el.style.setProperty('--t2',rgba(col,.05));el.style.setProperty('--b',rgba(col,.45));
  if(n===5)el.style.gridColumn='span '+(k<3?2:3);
  const lab=document.createElement('span');lab.className='lab';
  lab.innerHTML='<i></i>'+(local&&n>1?'J'+(k+1)+(touch?'':' <small>'+KEYS[k].toUpperCase()+'</small>'):(touch?'TOQUE PARA INVERTER':'CLIQUE OU ESPAÇO'));
  el.appendChild(lab);
  el.addEventListener('pointerdown',e=>{e.preventDefault();ripple(el,e,col);press(idx)});
  z.appendChild(el)}
 z.oncontextmenu=e=>e.preventDefault();
 try{navigator.wakeLock&&navigator.wakeLock.request('screen')}catch(e){}}
function press(i){if(mode==='local')tap(i);else if(isHost)tap(0);else if(hostConn&&hostConn.open)hostConn.send({t:'tap'})}
addEventListener('keydown',e=>{if(!S||!$('s-game').classList.contains('active')||e.repeat)return;
 if(mode==='local'){
  if(S.players.length===1&&[' ','ArrowUp','Enter'].includes(e.key)){e.preventDefault();tap(0);return}
  const i=KEYS.indexOf(e.key.toLowerCase());if(i>=0&&i<S.players.length)tap(i)}
 else if([' ','ArrowUp','Enter'].includes(e.key)){e.preventDefault();press(myIdx)}});

/* ---------- Fluxo de telas ---------- */
function reset(){try{peer&&peer.destroy()}catch(e){}peer=null;hostConn=null;lobby=[];S=null;mode=null;isHost=false}
document.querySelectorAll('.back').forEach(b=>b.onclick=()=>{reset();show('s-menu')});
$('b-exit').onclick=()=>{reset();show('s-menu')};
$('b-online').onclick=()=>show('s-online');
$('b-local').onclick=()=>show('s-local');
const nums=$('nums');
for(let i=1;i<=6;i++){const b=document.createElement('button');b.textContent=i;b.onclick=()=>{localN=i;upd()};nums.appendChild(b)}
function upd(){[...nums.children].forEach((b,i)=>b.classList.toggle('on',i+1===localN));
 $('keyhint').textContent=localN===1?'Toque na tela, ESPAÇO ou A':'Teclas: '+KEYS.slice(0,localN).map((k,i)=>'J'+(i+1)+'='+k.toUpperCase()).join('  ')+' (ou toque na sua zona colorida da tela)'}
upd();
$('b-play').onclick=()=>{mode='local';isHost=false;S=newState(Array.from({length:localN},(_,i)=>({name:'J'+(i+1)})));newRound();buildCtrl();show('s-game')};

/* ---------- Online (PeerJS, host autoritativo) ---------- */
const rcode=()=>Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('');
function lobbyUI(names,you){$('roomcode').textContent=code;$('plist').innerHTML=names.map((n,i)=>'<li><i style="background:'+COLORS[i]+';color:'+COLORS[i]+'"></i>'+n.replace(/</g,'&lt;')+(i===you?' (você)':'')+'</li>').join('');
 $('b-start').style.display=isHost?'':'none';$('wait').style.display=isHost?'none':''}
function lobbySend(){const names=lobby.map(p=>p.name);lobby.forEach((p,i)=>p.conn&&p.conn.send({t:'lobby',names,you:i,code}));lobbyUI(names,0)}
function hostRoom(){
 code=rcode();peer=new Peer('gravityrun-'+code,PCFG);
 peer.on('open',()=>{mode='online';isHost=true;myIdx=0;lobby=[{name:myName(),conn:null}];lobbySend();show('s-lobby')});
 peer.on('error',e=>{if(e.type==='unavailable-id'){try{peer.destroy()}catch(x){}hostRoom()}else toast('Erro de conexão: '+e.type)});
 peer.on('connection',c=>{
  c.on('open',()=>{if(S||lobby.length>=6){c.send({t:'full'});setTimeout(()=>c.close(),400);return}lobby.push({name:'Jogador',conn:c});lobbySend()});
  c.on('data',m=>{
   if(m.t==='join'){const p=lobby.find(x=>x.conn===c);if(p){p.name=String(m.name||'Jogador').slice(0,12);lobbySend()}}
   if(m.t==='tap'&&S){tap(S.players.findIndex(p=>p.conn===c))}});
  c.on('close',()=>{
   if(S){const p=S.players.find(x=>x.conn===c);if(p){p.gone=true;p.alive=false;p.name+=' (saiu)'}}
   else{lobby=lobby.filter(p=>p.conn!==c);lobbySend()}})})}
$('b-create').onclick=()=>{toast('Criando sala…');hostRoom()};
$('b-join').onclick=()=>{
 const c=$('code').value.trim().toUpperCase();if(c.length!==4)return toast('Digite o código de 4 letras');
 reset();code=c;peer=new Peer(undefined,PCFG);
 const to=setTimeout(()=>{toast('Sala não encontrada');reset()},9000);
 peer.on('error',e=>{clearTimeout(to);toast(e.type==='peer-unavailable'?'Sala não encontrada':'Erro: '+e.type)});
 peer.on('open',()=>{hostConn=peer.connect('gravityrun-'+c,{reliable:true});
  hostConn.on('open',()=>{clearTimeout(to);mode='online';isHost=false;hostConn.send({t:'join',name:myName()})});
  hostConn.on('data',onHost);
  hostConn.on('close',()=>{if(mode){toast('O host desconectou');reset();show('s-menu')}})})};
function onHost(m){
 if(m.t==='full'){toast('Sala cheia ou já iniciada');reset();show('s-menu')}
 else if(m.t==='lobby'){myIdx=m.you;code=m.code;lobbyUI(m.names,m.you);show('s-lobby')}
 else if(m.t==='start'){S=newState(m.names.map(n=>({name:n})));myIdx=m.you;buildCtrl();show('s-game')}
 else if(m.t==='s'&&S){S.ph=m.ph;S.cnt=m.cnt;S.spd=m.spd;S.sc=m.sc;S.msg=m.msg;recvT=performance.now();
  S.obs=m.o.map(a=>({k:a[0],x:a[1],y:a[2],w:a[3],h:a[4]}));
  m.p.forEach((a,i)=>{const p=S.players[i];if(p){p.cx=a[0];p.side=a[1];p.jump=!!a[2];p.alive=!!a[3];p.score=a[4];p.dist=a[5];p.from=a[6];p.gone=!!a[7];p.name=a[8]}})}}
$('b-start').onclick=()=>{S=newState(lobby);const names=lobby.map(p=>p.name);
 lobby.forEach((p,i)=>p.conn&&p.conn.send({t:'start',names,you:i}));newRound();buildCtrl();show('s-game')};
function broadcast(){const m={t:'s',ph:S.ph,cnt:S.cnt,spd:S.spd,sc:S.sc,msg:S.msg,
 o:S.obs.map(o=>[o.k,o.x|0,o.y|0,o.w|0,o.h|0]),
 p:S.players.map(p=>[p.cx|0,p.side,p.jump?1:0,p.alive?1:0,p.score,p.dist,p.from,p.gone?1:0,p.name])};
 S.players.forEach(p=>p.conn&&p.conn.open&&p.conn.send(m))}

$('b-copy').onclick=async()=>{const u=location.href.split('?')[0].split('#')[0]+'?sala='+code;
 try{if(navigator.share)await navigator.share({title:'Gravity Run',text:'Entre na minha sala! Código '+code,url:u});else{await navigator.clipboard.writeText(u);toast('Link copiado!')}}catch(e){}};
const q=new URLSearchParams(location.search).get('sala');
if(q){$('code').value=q.slice(0,4).toUpperCase();show('s-online');toast('Toque em Entrar na sala')}
/* ---------- Loop ---------- */
function loop(ts){requestAnimationFrame(loop);const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
 if(!S||!$('s-game').classList.contains('active'))return;
 if(mode==='local'||isHost){step(dt);if(isHost&&ts-lastSend>40){lastSend=ts;broadcast()}}
 draw(ts)}
requestAnimationFrame(loop);
})();
