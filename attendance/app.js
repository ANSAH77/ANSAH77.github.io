const tabsEl=document.getElementById('sessionTabs');
const emptyEl=document.getElementById('emptyState');
const viewEl=document.getElementById('sessionView');
const bodyEl=document.getElementById('attendanceBody');
let manifest={sessions:[]};
let currentFile=null;
let loading=false;

async function loadManifest(){
  if(loading)return;
  loading=true;
  try{
    const r=await fetch(`manifest.json?ts=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`Manifest HTTP ${r.status}`);
    manifest=await r.json();
    renderTabs();
    if(manifest.sessions?.length){
      const target=manifest.sessions.find(s=>s.data_file===currentFile)||manifest.sessions[0];
      await openSession(target);
    }else{
      currentFile=null;
      emptyEl.classList.remove('hidden');
      viewEl.classList.add('hidden');
    }
  }catch(e){
    tabsEl.innerHTML='<div class="empty">Could not load attendance records. Retrying automatically.</div>';
  }finally{
    loading=false;
  }
}

function renderTabs(){
  tabsEl.innerHTML='';
  (manifest.sessions||[]).forEach(s=>{
    const b=document.createElement('button');
    b.className='tab'+(s.data_file===currentFile?' active':'');
    b.dataset.file=s.data_file;
    b.innerHTML=`<strong>${escapeHtml(s.name||'Attendance')}</strong><small>${escapeHtml(s.date||'')}</small>`;
    b.onclick=()=>openSession(s,b);
    tabsEl.appendChild(b);
  });
}

async function openSession(session,button){
  currentFile=session.data_file;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.file===currentFile));
  const r=await fetch(`${session.data_file}?ts=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`Session HTTP ${r.status}`);
  const data=await r.json();
  emptyEl.classList.add('hidden');
  viewEl.classList.remove('hidden');
  document.getElementById('sessionTitle').textContent=data.session_name||session.name||'Attendance';
  document.getElementById('sessionMeta').textContent=[data.date,data.started_at?`Started: ${data.started_at}`:'',data.ended_at?`Ended: ${data.ended_at}`:''].filter(Boolean).join(' • ');
  const students=data.students||[];
  const present=students.filter(s=>String(s.status).toLowerCase()==='present').length;
  const absent=students.filter(s=>String(s.status).toLowerCase()==='absent').length;
  document.getElementById('presentCount').textContent=present;
  document.getElementById('absentCount').textContent=absent;
  document.getElementById('totalCount').textContent=students.length;
  document.getElementById('downloadCsv').href=session.csv_file||'#';
  bodyEl.innerHTML='';
  students.forEach(s=>{
    const tr=document.createElement('tr');
    const cls=String(s.status).toLowerCase()==='present'?'status-present':'status-absent';
    tr.innerHTML=`<td>${escapeHtml(s.name||'')}</td><td>${escapeHtml(s.index_number||'')}</td><td class="${cls}">${escapeHtml(s.status||'')}</td><td>${escapeHtml(s.timestamp||'—')}</td>`;
    bodyEl.appendChild(tr);
  });
  renderTabs();
}

function escapeHtml(v){
  return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

document.getElementById('refreshBtn').onclick=loadManifest;
loadManifest();
setInterval(()=>{if(document.visibilityState==='visible')loadManifest();},15000);
