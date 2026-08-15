const tabsEl=document.getElementById('sessionTabs');
const emptyEl=document.getElementById('emptyState');
const viewEl=document.getElementById('sessionView');
const bodyEl=document.getElementById('attendanceBody');
const presentStat=document.getElementById('presentStat');
const absentStat=document.getElementById('absentStat');
const filterBar=document.getElementById('filterBar');
const filterText=document.getElementById('filterText');
const clearFilterBtn=document.getElementById('clearFilterBtn');
const deleteSessionBtn=document.getElementById('deleteSessionBtn');

let manifest={sessions:[]};
let currentFile=null;
let currentSession=null;
let currentData=null;
let currentFilter=null;
let loading=false;
let adminToken='';

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
      currentSession=null;
      currentData=null;
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

async function openSession(session){
  currentFile=session.data_file;
  currentSession=session;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.file===currentFile));
  const r=await fetch(`${session.data_file}?ts=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`Session HTTP ${r.status}`);
  const data=await r.json();
  currentData=data;
  currentFilter=null;
  emptyEl.classList.add('hidden');
  viewEl.classList.remove('hidden');
  document.getElementById('sessionTitle').textContent=data.session_name||session.name||'Attendance';
  document.getElementById('sessionMeta').textContent=[data.date,data.started_at?`Started: ${friendlyDateTime(data.started_at)}`:'',data.ended_at?`Ended: ${friendlyDateTime(data.ended_at)}`:''].filter(Boolean).join(' • ');
  const students=data.students||[];
  const present=students.filter(s=>String(s.status).toLowerCase()==='present').length;
  const absent=students.filter(s=>String(s.status).toLowerCase()==='absent').length;
  document.getElementById('presentCount').textContent=present;
  document.getElementById('absentCount').textContent=absent;
  document.getElementById('totalCount').textContent=students.length;
  document.getElementById('downloadCsv').href=session.csv_file||'#';
  updateFilterUI();
  renderStudents();
  renderTabs();
}

function renderStudents(){
  const students=currentData?.students||[];
  const visible=currentFilter?students.filter(s=>String(s.status).toLowerCase()===currentFilter):students;
  bodyEl.innerHTML='';
  visible.forEach(s=>{
    const tr=document.createElement('tr');
    const status=String(s.status||'');
    const cls=status.toLowerCase()==='present'?'status-present':'status-absent';
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
  currentFilter=currentFilter===type?null:type;
  updateFilterUI();
  renderStudents();
}

function updateFilterUI(){
  presentStat.classList.toggle('active',currentFilter==='present');
  absentStat.classList.toggle('active',currentFilter==='absent');
  if(currentFilter){
    const count=(currentData?.students||[]).filter(s=>String(s.status).toLowerCase()===currentFilter).length;
    filterText.textContent=`Showing ${count} ${currentFilter} student${count===1?'':'s'}`;
    filterBar.classList.remove('hidden');
  }else{
    filterBar.classList.add('hidden');
  }
}

presentStat.onclick=()=>setFilter('present');
absentStat.onclick=()=>setFilter('absent');
clearFilterBtn.onclick=()=>{currentFilter=null;updateFilterUI();renderStudents();};

function friendlyDateTime(v){
  if(!v)return'';
  return String(v).replace('T',' ');
}

function formatTime(v){
  if(!v||v==='—')return'—';
  const s=String(v);
  const m=s.match(/(\d{2}:\d{2}:\d{2})/);
  return m?m[1]:s;
}

async function githubRequest(path,options={}){
  if(!adminToken){
    adminToken=prompt('Admin delete requires your GitHub fine-grained access token.\n\nPaste it here. It is used only in this browser session and is not saved by the website.')||'';
    if(!adminToken)throw new Error('Delete cancelled.');
  }
  const headers={
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${adminToken}`,
    'X-GitHub-Api-Version':'2022-11-28',
    ...(options.headers||{})
  };
  const r=await fetch(`https://api.github.com/repos/ANSAH77/ANSAH77.github.io/contents/${path}`,{...options,headers});
  if(!r.ok){
    if(r.status===401||r.status===403)adminToken='';
    const text=await r.text();
    throw new Error(`GitHub delete failed (${r.status}). ${text.slice(0,180)}`);
  }
  if(r.status===204)return null;
  return r.json();
}

async function deleteRepoFile(path,message){
  if(!path)return;
  let info;
  try{info=await githubRequest(path);}catch(e){if(String(e.message).includes('(404)'))return;throw e;}
  await githubRequest(path,{
    method:'DELETE',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message,sha:info.sha,branch:'main'})
  });
}

async function deleteCurrentSession(){
  if(!currentSession)return;
  const name=currentData?.session_name||currentSession.name||'this attendance';
  if(!confirm(`Delete "${name}" from the public attendance website?\n\nThis removes the website copy and its downloadable CSV. Your Windows local copy is not affected.`))return;
  deleteSessionBtn.disabled=true;
  deleteSessionBtn.textContent='Deleting...';
  try{
    const target=currentSession;
    await deleteRepoFile(`attendance/${target.data_file}`,`Delete attendance ${name}`);
    await deleteRepoFile(`attendance/${target.csv_file}`,`Delete attendance CSV ${name}`);

    const manifestInfo=await githubRequest('attendance/manifest.json');
    const latestManifest=JSON.parse(atob(manifestInfo.content.replace(/\n/g,'')));
    latestManifest.sessions=(latestManifest.sessions||[]).filter(s=>s.data_file!==target.data_file);
    const updated=btoa(unescape(encodeURIComponent(JSON.stringify(latestManifest,null,2))));
    await githubRequest('attendance/manifest.json',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:`Remove attendance ${name} from site`,content:updated,sha:manifestInfo.sha,branch:'main'})
    });

    currentFile=null;
    currentSession=null;
    currentData=null;
    currentFilter=null;
    alert('Attendance deleted from the website. The Windows local copy was not deleted.');
    setTimeout(loadManifest,1200);
  }catch(e){
    alert(e.message);
  }finally{
    deleteSessionBtn.disabled=false;
    deleteSessionBtn.textContent='Delete Session';
  }
}

deleteSessionBtn.onclick=deleteCurrentSession;

function escapeHtml(v){
  return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

document.getElementById('refreshBtn').onclick=loadManifest;
loadManifest();
setInterval(()=>{if(document.visibilityState==='visible')loadManifest();},15000);
