const tabsEl=document.getElementById('sessionTabs');
const emptyEl=document.getElementById('emptyState');
const viewEl=document.getElementById('sessionView');
const bodyEl=document.getElementById('attendanceBody');
const presentStat=document.getElementById('presentStat');
const absentStat=document.getElementById('absentStat');
const filterBar=document.getElementById('filterBar');
const filterText=document.getElementById('filterText');
const clearFilterBtn=document.getElementById('clearFilterBtn');

let manifest={sessions:[]};
let currentFile=null;
let currentSession=null;
let currentData=null;
let currentFilter=null;
let loading=false;

async function loadManifest({preserveFilter=true}={}){
  if(loading)return;
  loading=true;
  try{
    const r=await fetch(`manifest.json?ts=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`Manifest HTTP ${r.status}`);
    manifest=await r.json();
    renderTabs();
    if(manifest.sessions?.length){
      const target=manifest.sessions.find(s=>s.data_file===currentFile)||manifest.sessions[0];
      await openSession(target,{preserveFilter});
    }else{
      currentFile=null;currentSession=null;currentData=null;currentFilter=null;
      emptyEl.classList.remove('hidden');
      viewEl.classList.add('hidden');
    }
  }catch(e){
    console.error(e);
    tabsEl.innerHTML='<div class="empty">Could not load attendance records. Tap Refresh to retry.</div>';
  }finally{loading=false;}
}

function renderTabs(){
  tabsEl.innerHTML='';
  (manifest.sessions||[]).forEach(s=>{
    const b=document.createElement('button');
    b.className='tab'+(s.data_file===currentFile?' active':'');
    b.dataset.file=s.data_file;
    b.innerHTML=`<strong>${escapeHtml(s.name||'Attendance')}</strong><small>${escapeHtml(s.date||'')}</small>`;
    b.addEventListener('click',()=>openSession(s,{preserveFilter:false}));
    tabsEl.appendChild(b);
  });
}

async function openSession(session,{preserveFilter=false}={}){
  currentFile=session.data_file;
  currentSession=session;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.file===currentFile));
  const r=await fetch(`${session.data_file}?ts=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`Session HTTP ${r.status}`);
  currentData=await r.json();
  if(!preserveFilter)currentFilter=null;
  emptyEl.classList.add('hidden');
  viewEl.classList.remove('hidden');
  document.getElementById('sessionTitle').textContent=currentData.session_name||session.name||'Attendance';
  document.getElementById('sessionMeta').textContent=[currentData.date,currentData.started_at?`Started: ${friendlyDateTime(currentData.started_at)}`:'',currentData.ended_at?`Ended: ${friendlyDateTime(currentData.ended_at)}`:''].filter(Boolean).join(' • ');
  const students=currentData.students||[];
  document.getElementById('presentCount').textContent=students.filter(s=>normStatus(s)==='present').length;
  document.getElementById('absentCount').textContent=students.filter(s=>normStatus(s)==='absent').length;
  document.getElementById('totalCount').textContent=students.length;
  document.getElementById('downloadCsv').href=session.csv_file||'#';
  updateFilterUI();
  renderStudents();
  renderTabs();
}

function normStatus(student){return String(student?.status||'').trim().toLowerCase();}

function renderStudents(){
  const students=currentData?.students||[];
  const visible=currentFilter?students.filter(s=>normStatus(s)===currentFilter):students;
  bodyEl.innerHTML='';
  visible.forEach(s=>{
    const tr=document.createElement('tr');
    const status=String(s.status||'');
    const cls=normStatus(s)==='present'?'status-present':'status-absent';
    tr.innerHTML=`<td>${escapeHtml(s.name||'')}</td><td>${escapeHtml(s.index_number||'')}</td><td class="${cls}">${escapeHtml(status)}</td><td>${escapeHtml(formatTime(s.timestamp||'—'))}</td>`;
    bodyEl.appendChild(tr);
  });
  if(!visible.length){
    const tr=document.createElement('tr');
    tr.innerHTML='<td colspan="4">No students in this group.</td>';
    bodyEl.appendChild(tr);
  }
}

function setFilter(type){
  if(!currentData)return;
  currentFilter=(currentFilter===type)?null:type;
  updateFilterUI();
  renderStudents();
  try{document.querySelector('.table-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}
}

function updateFilterUI(){
  presentStat.classList.toggle('active',currentFilter==='present');
  absentStat.classList.toggle('active',currentFilter==='absent');
  if(currentFilter){
    const count=(currentData?.students||[]).filter(s=>normStatus(s)===currentFilter).length;
    filterText.textContent=`Showing ${count} ${currentFilter} student${count===1?'':'s'}`;
    filterBar.classList.remove('hidden');
  }else filterBar.classList.add('hidden');
}

presentStat.addEventListener('click',()=>setFilter('present'));
absentStat.addEventListener('click',()=>setFilter('absent'));
clearFilterBtn.addEventListener('click',()=>{currentFilter=null;updateFilterUI();renderStudents();});

function friendlyDateTime(v){return v?String(v).replace('T',' '):'';}
function formatTime(v){if(!v||v==='—')return'—';const s=String(v);const m=s.match(/(\d{2}:\d{2}:\d{2})/);return m?m[1]:s;}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

document.getElementById('refreshBtn').addEventListener('click',()=>loadManifest({preserveFilter:true}));
loadManifest({preserveFilter:false});
setInterval(()=>{if(document.visibilityState==='visible')loadManifest({preserveFilter:true});},15000);
