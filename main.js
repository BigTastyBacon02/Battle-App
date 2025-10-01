/* Adult Star Battle – Deluxe (Canvas) */
const WIKI=(q,size=420)=>`https://de.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=${size}&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q)}`;
const OPENVERSE=(q,n=14)=>`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&mature=true`;

const cnv=document.getElementById('game'), ctx=cnv.getContext('2d');
let DPR=1,W=0,H=0; function resize(){DPR=Math.max(1,Math.min(3,devicePixelRatio||1));W=innerWidth;H=innerHeight;cnv.width=W*DPR;cnv.height=H*DPR;cnv.style.width=W+'px';cnv.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);} addEventListener('resize',resize); resize();

// ---- starfield background ----
const stars=[]; for(let i=0;i<200;i++){stars.push({x:Math.random()*W,y:Math.random()*H,z:.2+Math.random()*1.6})}
function drawBG(t){
  ctx.fillStyle='#090814'; ctx.fillRect(0,0,W,H);
  const g=ctx.createRadialGradient(W*0.7,-120,80,W*0.7,-120,600); g.addColorStop(0,'#1a0f43'); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(W*0.7,-120,600,0,Math.PI*2); ctx.fill();
  for(const s of stars){ const tw=(t*0.02)*s.z; const x=(s.x+tw)%W; ctx.globalAlpha=0.3+0.7*s.z/2; ctx.fillStyle='#7c5cff'; ctx.fillRect(x,s.y,2*s.z,2*s.z); }
  ctx.globalAlpha=1;
}

// ---- audio: background loop + sfx ----
let audioCtx=null, musicOn=false;
function musicStart(){ if(musicOn) return; audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const A=audioCtx; const bpm=96,beat=60/bpm, seq=[0,4,7,11,12,11,7,4]; const now=A.currentTime+0.05; for(let bar=0;bar<16;bar++){ for(let i=0;i<seq.length;i++){ const t=now+(bar*seq.length+i)*beat*0.5; const o=A.createOscillator(), g=A.createGain(); o.type='triangle'; o.frequency.value=196*Math.pow(2, seq[i]/12); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.05,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+beat*0.45); o.connect(g).connect(A.destination); o.start(t); o.stop(t+beat*0.5);} } musicOn=true; }
function blip(){ try{ const A=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); audioCtx=A; const o=A.createOscillator(), g=A.createGain(); o.type='sine'; o.frequency.value=440; g.gain.value=0.06; o.connect(g).connect(A.destination); o.start(); o.frequency.exponentialRampToValueAtTime(660, A.currentTime+0.12); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime+0.14); o.stop(A.currentTime+0.15);}catch(e){} }

// ---- particles ----
const parts=[]; function burst(x,y){ for(let i=0;i<40;i++){ parts.push({x,y,vx:(Math.random()*2-1)*4,vy:(Math.random()*-4-2),g:0.18,a:1,c:['#ff6ad5','#48e0ff','#7c5cff','#64ffb0'][i%4]}); } }
function stepParts(){ for(const p of parts){ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.a-=0.02; } for(let i=parts.length-1;i>=0;i--) if(parts[i].a<=0) parts.splice(i,1); }
function drawParts(){ for(const p of parts){ ctx.globalAlpha=Math.max(0,p.a); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,6,10); } ctx.globalAlpha=1; }

// ---- game state ----
const State={TITLE:0, EDIT:1, MATCH:2, RESULT:3}; let state=State.TITLE;
let names=["Mia Malkova","Johnny Sins","Abella Danger","Riley Reid","Angela White","Violet Myers","Eva Elfie","Kendra Lust"];
let pool=[], out=[], hist=[], cur=[], target=1, total=0, t0=performance.now();

// ---- UI DOM overlays ----
const controls=document.querySelector('.controls');
const panel=document.querySelector('.ui-panel');
const toast=document.createElement('div'); toast.className='toast'; document.body.appendChild(toast);
function showToast(msg){toast.textContent=msg; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),1400);}

function clearPanel(){panel.innerHTML='';}
function chip(text){const d=document.createElement('div'); d.className='chip'; d.textContent=text; return d;}
function button(label,cls,fn){const b=document.createElement('button'); b.className='btn'+(cls?' '+cls:''); b.textContent=label; b.onclick=fn; return b;}
function inputRow(ph, val, on){const wrap=document.createElement('div'); wrap.className='chip'; const inp=document.createElement('input'); inp.placeholder=ph; inp.value=val||''; inp.onchange=()=>on(inp.value); wrap.appendChild(inp); return wrap; }

function buildTitle(){
  clearPanel();
  panel.append(chip('Adult Star Battle – Deluxe'), button('🎵 Musik', 'alt', ()=>musicStart()), button('Start (Demo)', '', ()=>{ startFrom(names,1); }), button('Eigene Liste', 'alt', ()=>{ state=State.EDIT; buildEdit(); }));
}
function buildEdit(){
  clearPanel();
  const n=inputRow('Namen (durch Komma oder Zeilen)', names.join(', '), v=>{ names = v.includes('\n')? v.split(/\r?\n/): v.split(','); names=names.map(s=>s.trim()).filter(Boolean); });
  const t=inputRow('Ziel', String(target), v=>{ const x=parseInt(v||'1',10); target=Math.max(1,x); });
  panel.append(n,t, button('Start', '', ()=>{ startFrom(names,target); }), button('Zurück','alt',()=>{ state=State.TITLE; buildTitle(); }));
}

function startFrom(list, tgt){
  pool=[...new Set(list)]; out=[]; hist=[]; total=pool.length; target=Math.max(1, tgt||1);
  if(pool.length<2 || target>=pool.length){ showToast('Mind. 2 Namen & Ziel kleiner als Anzahl'); return; }
  state=State.MATCH; startMatch(); clearPanel(); // URL setter chips
  panel.append(chip('Tipp: Bild‑URL einfügen'),
               button('Setze links', 'alt', ()=>{ const u=prompt('Bild‑URL für '+cur[0]); if(u && /^https?:\/\//i.test(u)) { L.img.src=u; showToast('Bild gesetzt'); } }),
               button('Setze rechts', 'alt', ()=>{ const u=prompt('Bild‑URL für '+cur[1]); if(u && /^https?:\/\//i.test(u)) { R.img.src=u; showToast('Bild gesetzt'); } }),
               button('↩︎ Rückgängig','alt',()=>undo()),
               button('Neu mischen','alt',()=>startMatch())
              );
  musicStart();
}

async function wikiThumb(q){ try{const r=await fetch(WIKI(q)); const j=await r.json(); if(j&&j.query&&j.query.pages){ const v=Object.values(j.query.pages)[0]; if(v&&v.thumbnail) return v.thumbnail.source; } }catch(e){} return null; }
async function openverseList(q,n=12){ try{const r=await fetch(OPENVERSE(q,n)); const j=await r.json(); return (j.results||[]).map(it=>it.thumbnail||it.url); }catch(e){ return []; } }
function loadPortrait(name){ const img=new Image(); img.src='assets/placeholder.png'; (async()=>{ const w=await wikiThumb(name); if(w) img.src=w; const ov=await openverseList(name,14); if(ov[0]) img.src=ov[0]; })(); return img; }

const L={x:0,y:0,img:new Image(),name:''}, R={x:0,y:0,img:new Image(),name:''};
function layout(){ L.x=W*0.3; L.y=H*0.52; R.x=W*0.7; R.y=H*0.52; }
function startMatch(){ if(pool.length<=1) return; const a=Math.floor(Math.random()*pool.length); let b=Math.floor(Math.random()*pool.length); while(b===a) b=Math.floor(Math.random()*pool.length); cur=[pool[a],pool[b]]; L.name=cur[0]; R.name=cur[1]; L.img=loadPortrait(L.name); R.img=loadPortrait(R.name); }

function choose(side){
  if(state!==State.MATCH) return;
  blip();
  const w=cur[side], l=cur[1-side]; pool = pool.filter(n=>n!==w && n!==l); pool.push(w); out.push(l); hist.push({w,l});
  burst(side?R.x:L.x, side?R.y:L.y);
  if(pool.length<=target){ state=State.RESULT; clearPanel(); panel.append(button('Nochmal', '', ()=>{ state=State.TITLE; buildTitle(); })); }
  else startMatch();
}
function undo(){ const h=hist.pop(); if(!h) return; pool = pool.filter(n=>n!==h.w); const j=out.lastIndexOf(h.l); if(j>-1) out.splice(j,1); pool.push(h.w,h.l); startMatch(); }

// touch swipe
let sx=0,sy=0; cnv.addEventListener('touchstart',e=>{const t=e.touches[0]; sx=t.clientX; sy=t.clientY; }, {passive:true});
cnv.addEventListener('touchend',e=>{const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; if(Math.abs(dx)>50 && Math.abs(dy)<60){ if(dx>0) choose(1); else choose(0);} });

// buttons
document.querySelector('.controls').addEventListener('click', e=>{
  if(e.target.matches('.btn')){
    const txt=e.target.textContent;
    if(txt.includes('Links')) choose(0);
    else if(txt.includes('Rechts')) choose(1);
    else if(txt.includes('Rückgängig')) undo();
  }
});

// main loop
function draw(t){
  drawBG(t);
  if(state===State.TITLE){
    ctx.textAlign='center'; ctx.fillStyle='#cfe6ff'; ctx.font='800 30px system-ui'; ctx.fillText('Adult Star Battle – Deluxe', W/2, H*0.28);
    ctx.fillStyle='#9eb4ff'; ctx.font='16px system-ui'; ctx.fillText('Wische links/rechts um zu wählen • Musik aktivieren für Vibes', W/2, H*0.34);
  } else if(state===State.EDIT){
    ctx.textAlign='center'; ctx.fillStyle='#cfe6ff'; ctx.font='800 24px system-ui'; ctx.fillText('Eigene Liste & Ziel im Panel oben', W/2, H*0.2);
  } else if(state===State.MATCH){
    layout();
    // cards
    drawCard(L); drawCard(R);
    // names
    ctx.textAlign='center'; ctx.fillStyle='#eae8ff'; ctx.font='900 18px system-ui'; ctx.fillText(L.name, W*0.3, H*0.78);
    ctx.fillText(R.name, W*0.7, H*0.78);
    // status
    ctx.fillStyle='#9eb4ff'; ctx.font='12px system-ui'; ctx.fillText(`${pool.length} aktiv • Ziel ${target}`, W/2, 26);
  } else if(state===State.RESULT){
    ctx.textAlign='center'; ctx.fillStyle='#eae8ff'; ctx.font='900 28px system-ui'; ctx.fillText('🏆 Übrig', W/2, H*0.25);
    ctx.font='16px system-ui'; ctx.fillStyle='#9eb4ff';
    for(let i=0;i<pool.length;i++){ ctx.fillText(pool[i], W/2, H*0.32+i*22); }
  }
  stepParts(); drawParts();
  requestAnimationFrame(draw);
}

function drawCard(o){
  const w=240,h=240;
  // glow ring
  ctx.save(); ctx.translate(o.x,o.y);
  ctx.fillStyle='rgba(255,106,213,0.12)'; ctx.beginPath(); ctx.arc(0,0,w*0.58,0,Math.PI*2); ctx.fill();
  // image
  try{ ctx.drawImage(o.img, -w/2, -h/2, w, h); }catch(e){}
  // frame
  ctx.strokeStyle='rgba(124,242,255,0.6)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0, w*0.52, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

// init
buildTitle();
requestAnimationFrame(draw);
