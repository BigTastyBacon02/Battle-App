/* Adult Star Battle – Retro 80s */
const WIKI=(q,size=420)=>`https://de.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=${size}&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q)}`;
const OPENVERSE=(q,n=14)=>`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&mature=true`;

const cnv=document.getElementById('game'), ctx=cnv.getContext('2d');
let DPR=1,W=0,H=0; function resize(){DPR=Math.max(1,Math.min(3,devicePixelRatio||1));W=innerWidth;H=innerHeight;cnv.width=W*DPR;cnv.height=H*DPR;cnv.style.width=W+'px';cnv.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);} addEventListener('resize',resize); resize();

// ---- retro background: sun + grid ----
function drawBG(t){
  ctx.fillStyle='#0b0820'; ctx.fillRect(0,0,W,H);
  // Sun
  const x=W*0.5, y=H*0.28, R=140;
  const grd=ctx.createLinearGradient(0,y-R,0,y+R);
  grd.addColorStop(0,'#ff9a00'); grd.addColorStop(0.5,'#ff378a'); grd.addColorStop(1,'#8a00ff');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2); ctx.fill();
  // Scanlines on sun
  ctx.fillStyle='#0b0820';
  for(let yy=y-R; yy<y+R; yy+=10){ const w=Math.sqrt(Math.max(0, R*R - (yy-y)*(yy-y))); ctx.fillRect(x-w, yy, 2*w, 4); }
  // Horizon grid
  const gy=H*0.55;
  const ggrad=ctx.createLinearGradient(0,gy,0,H);
  ggrad.addColorStop(0,'rgba(0,255,255,.1)'); ggrad.addColorStop(1,'rgba(0,255,255,.5)');
  ctx.strokeStyle=ggrad; ctx.lineWidth=1;
  for(let i=0;i<20;i++){ const yy=gy + Math.pow(i/20,2)*(H-gy); ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke();}
  for(let i=0;i<20;i++){ const xx=i/19*W; ctx.beginPath(); ctx.moveTo(xx,gy); ctx.lineTo(xx,H); ctx.stroke();}
}

// ---- audio ----
let audioCtx=null, musicOn=false;
function musicStart(){ if(musicOn) return; audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const A=audioCtx; const bpm=98,beat=60/bpm, seq=[0,7,12,7,3,7,10,7]; const now=A.currentTime+0.05; for(let bar=0;bar<16;bar++){ for(let i=0;i<seq.length;i++){ const t=now+(bar*seq.length+i)*beat*0.5; const o=A.createOscillator(), g=A.createGain(); o.type='sawtooth'; o.frequency.value=110*Math.pow(2, seq[i]/12); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.04,t+0.04); g.gain.exponentialRampToValueAtTime(0.0001,t+beat*0.5); const f=A.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400; o.connect(f).connect(g).connect(A.destination); o.start(t); o.stop(t+beat*0.55);} } musicOn=true; }
function sfx(){ try{ const A=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); audioCtx=A; const o=A.createOscillator(), g=A.createGain(); o.type='square'; o.frequency.value=440; g.gain.value=0.05; o.connect(g).connect(A.destination); o.start(); o.frequency.exponentialRampToValueAtTime(660, A.currentTime+0.12); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime+0.14); o.stop(A.currentTime+0.15);}catch(e){} }

// ---- particles ----
const parts=[]; function burst(x,y){ for(let i=0;i<48;i++){ parts.push({x,y,vx:(Math.random()*2-1)*4,vy:(Math.random()*-4-2),g:0.18,a:1,c:['#00fff6','#ff57c5','#b81bff','#ffffff'][i%4]}); } }
function stepParts(){ for(const p of parts){ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.a-=0.02; } for(let i=parts.length-1;i>=0;i--) if(parts[i].a<=0) parts.splice(i,1); }
function drawParts(){ for(const p of parts){ ctx.globalAlpha=Math.max(0,p.a); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,6,10); } ctx.globalAlpha=1; }

// ---- state ----
const State={TITLE:0, EDIT:1, MATCH:2, RESULT:3}; let state=State.TITLE;
let names=["Mia Malkova","Johnny Sins","Abella Danger","Riley Reid","Angela White","Violet Myers","Eva Elfie","Kendra Lust"];
let pool=[], out=[], hist=[], cur=[], target=1;

const panel=document.querySelector('.ui-panel'); const toast=document.createElement('div'); toast.className='toast'; document.body.appendChild(toast);
function showToast(msg){toast.textContent=msg; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),1400);}
function clearPanel(){panel.innerHTML='';}
function chip(text){const d=document.createElement('div'); d.className='chip'; d.textContent=text; return d;}
function button(label,cls,fn){const b=document.createElement('button'); b.className='btn'+(cls?' '+cls:''); b.textContent=label; b.onclick=fn; return b;}
function inputChip(ph, val, on){const wrap=document.createElement('div'); wrap.className='chip'; const inp=document.createElement('input'); inp.placeholder=ph; inp.value=val||''; inp.onchange=()=>on(inp.value); wrap.appendChild(inp); return wrap; }

function buildTitle(){
  clearPanel();
  panel.append(chip('Retro 80s Mode'), button('🎵 Musik', 'alt', ()=>musicStart()), button('Start (Demo)', '', ()=>{ startFrom(names,1); }), button('Eigene Liste', 'alt', ()=>{ state=State.EDIT; buildEdit(); }));
}
function buildEdit(){
  clearPanel();
  const n=inputChip('Namen (Komma/Zeilen)', names.join(', '), v=>{ names = v.includes('\n')? v.split(/\r?\n/): v.split(','); names=names.map(s=>s.trim()).filter(Boolean); });
  const t=inputChip('Ziel', String(target), v=>{ const x=parseInt(v||'1',10); target=Math.max(1,x); });
  panel.append(n,t, button('Start', '', ()=>{ startFrom(names,target); }), button('Zurück','alt',()=>{ state=State.TITLE; buildTitle(); }));
}

function startFrom(list, tgt){
  pool=[...new Set(list)]; out=[]; hist=[]; target=Math.max(1, tgt||1);
  if(pool.length<2 || target>=pool.length){ showToast('Mind. 2 Namen & Ziel kleiner als Anzahl'); return; }
  state=State.MATCH; startMatch(); clearPanel();
  panel.append(chip('Bild‑URL setzen'), button('Links','alt',()=>{ const u=prompt('Bild‑URL für '+cur[0]); if(u && /^https?:\/\//i.test(u)) { L.img.src=u; showToast('Bild gesetzt'); } }),
                                button('Rechts','alt',()=>{ const u=prompt('Bild‑URL für '+cur[1]); if(u && /^https?:\/\//i.test(u)) { R.img.src=u; showToast('Bild gesetzt'); } }),
                                button('↩︎ Rückgängig','',()=>undo()),
                                button('Neu mischen','',()=>startMatch()));
  musicStart();
}

async function wikiThumb(q){ try{const r=await fetch(WIKI(q)); const j=await r.json(); if(j&&j.query&&j.query.pages){ const v=Object.values(j.query.pages)[0]; if(v&&v.thumbnail) return v.thumbnail.source; } }catch(e){} return null; }
async function openverseList(q,n=12){ try{const r=await fetch(OPENVERSE(q,n)); const j=await r.json(); return (j.results||[]).map(it=>it.thumbnail||it.url); }catch(e){ return []; } }
function loadPortrait(name){ const img=new Image(); img.src='assets/placeholder.png'; (async()=>{ const w=await wikiThumb(name); if(w) img.src=w; const ov=await openverseList(name,14); if(ov[0]) img.src=ov[0]; })(); return img; }

const L={x:0,y:0,img:new Image(),name:''}, R={x:0,y:0,img:new Image(),name:''};
function layout(){ L.x=W*0.3; L.y=H*0.58; R.x=W*0.7; R.y=H*0.58; }
function startMatch(){ if(pool.length<=1) return; const a=Math.floor(Math.random()*pool.length); let b=Math.floor(Math.random()*pool.length); while(b===a) b=Math.floor(Math.random()*pool.length); cur=[pool[a],pool[b]]; L.name=cur[0]; R.name=cur[1]; L.img=loadPortrait(L.name); R.img=loadPortrait(R.name); }

function choose(side){
  if(state!==State.MATCH) return;
  sfx();
  const w=cur[side], l=cur[1-side]; pool = pool.filter(n=>n!==w && n!==l); pool.push(w); out.push(l); hist.push({w,l});
  burst(side?R.x:L.x, side?R.y:L.y);
  if(pool.length<=target){ state=State.RESULT; clearPanel(); panel.append(button('Nochmal', '', ()=>{ state=State.TITLE; buildTitle(); })); }
  else startMatch();
}
function undo(){ const h=hist.pop(); if(!h) return; pool = pool.filter(n=>n!==h.w); const j=out.lastIndexOf(h.l); if(j>-1) out.splice(j,1); pool.push(h.w,h.l); startMatch(); }

// Swipe
let sx=0,sy=0; cnv.addEventListener('touchstart',e=>{const t=e.touches[0]; sx=t.clientX; sy=t.clientY; }, {passive:true});
cnv.addEventListener('touchend',e=>{const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; if(Math.abs(dx)>50 && Math.abs(dy)<60){ if(dx>0) choose(1); else choose(0);} });

// Render loop
function draw(t){
  drawBG(t);
  if(state===State.TITLE){
    const img=document.getElementById('logo');
    // Title text hint
    ctx.textAlign='center'; ctx.fillStyle='#decdff'; ctx.font='900 18px system-ui'; ctx.fillText('Wische links/rechts um zu wählen • Musik oben einschalten', W/2, H*0.38);
  } else if(state===State.EDIT){
    ctx.textAlign='center'; ctx.fillStyle='#decdff'; ctx.font='900 20px system-ui'; ctx.fillText('Eigene Liste & Ziel im Panel oben', W/2, H*0.2);
  } else if(state===State.MATCH){
    layout();
    drawCard(L); drawCard(R);
    ctx.textAlign='center'; ctx.fillStyle='#decdff'; ctx.font='900 18px system-ui'; ctx.fillText(L.name, W*0.3, H*0.82);
    ctx.fillText(R.name, W*0.7, H*0.82);
    ctx.fillStyle='#9eb4ff'; ctx.font='12px system-ui'; ctx.fillText(`${pool.length} aktiv • Ziel ${target}`, W/2, 26);
  } else if(state===State.RESULT){
    ctx.textAlign='center'; ctx.fillStyle='#decdff'; ctx.font='900 26px system-ui'; ctx.fillText('🏆 Übrig', W/2, H*0.28);
    ctx.font='16px system-ui'; ctx.fillStyle='#c9b9ff';
    for(let i=0;i<pool.length;i++){ ctx.fillText(pool[i], W/2, H*0.34+i*22); }
  }
  stepParts(); drawParts();
  requestAnimationFrame(draw);
}
function drawCard(o){
  const w=240,h=240;
  ctx.save(); ctx.translate(o.x,o.y);
  // neon frame glow
  ctx.fillStyle='rgba(0,255,246,0.14)'; ctx.beginPath(); ctx.arc(0,0,w*0.58,0,Math.PI*2); ctx.fill();
  try{ ctx.drawImage(o.img, -w/2, -h/2, w, h); }catch(e){}
  ctx.strokeStyle='rgba(0,255,246,0.7)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0, w*0.52, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

buildTitle();
requestAnimationFrame(draw);
