const API_URL = 'https://api.masterxcloud.shop';
const $ = id => document.getElementById(id);

let token = sessionStorage.getItem('xcloud_token') || '';
let operations = Number(sessionStorage.getItem('xcloud_operations') || 0);
let keepAliveTimer = null;
let activationStartedAt = 0;
let activationClock = null;
let activationStepTimer = null;
let currentStep = 0;
let deferredInstallPrompt = null;
let operationMode = 'activate';

const OP = {
  activate: {
    path: '/operations/activate',
    short: 'ATIVAR',
    button: 'ATIVAR DISPOSITIVO',
    title: 'ATIVANDO DISPOSITIVO',
    successTitle: 'ATIVAÇÃO CONCLUÍDA',
    successText: 'Dispositivo configurado com sucesso.',
    errorTitle: 'ATIVAÇÃO NÃO CONCLUÍDA',
    timeline: 'Ativando',
    messages: [
      'Conectando ao painel XCloud...',
      'Registrando o dispositivo...',
      'Configurando M3U / DNS...',
      'Finalizando a ativação...'
    ],
    steps: [
      ['Conectando','Preparando sessão XCloud'],
      ['Registrando','Cadastrando dispositivo'],
      ['Configurando','Adicionando M3U / DNS'],
      ['Finalizando','Confirmando ativação']
    ]
  },
  reset: {
    path: '/operations/reset',
    short: 'RESET',
    button: 'RESETAR DISPOSITIVO',
    title: 'RESETANDO DISPOSITIVO',
    successTitle: 'RESET CONCLUÍDO',
    successText: 'Dispositivo removido, cadastrado novamente e M3U/DNS reaplicada.',
    errorTitle: 'RESET NÃO CONCLUÍDO',
    timeline: 'Resetando',
    messages: [
      'Conectando ao painel XCloud...',
      'Removendo configuração atual...',
      'Cadastrando o dispositivo novamente...',
      'Reaplicando M3U / DNS...'
    ],
    steps: [
      ['Conectando','Preparando sessão XCloud'],
      ['Removendo','Excluindo configuração atual'],
      ['Cadastrando','Registrando dispositivo novamente'],
      ['Configurando','Reaplicando M3U / DNS']
    ]
  }
};

function setDisplay(el, show, mode='block'){
  if (!el) return;
  el.hidden = !show;
  el.style.display = show ? mode : 'none';
}

function clearSession({resetOperations=false}={}){
  token='';
  sessionStorage.removeItem('xcloud_token');
  if(resetOperations){
    operations=0;
    sessionStorage.removeItem('xcloud_operations');
  }
}

function setLogged(logged){
  setDisplay($('loginView'), !logged, 'grid');
  setDisplay($('appView'), logged, 'grid');
  setDisplay($('topActions'), logged, 'flex');
  if(logged){
    $('opsCount').textContent = operations;
    startKeepAlive();
    window.scrollTo({top:0,behavior:'smooth'});
  }else{
    stopKeepAlive();
  }
}

function setServerState(text, state='online'){
  $('loginStatus').textContent = text;
  const dot = $('serverDot');
  if (dot) dot.style.background = state === 'online' ? 'var(--green)' : state === 'error' ? 'var(--red)' : 'var(--cyan)';
}

function makeRequestError(message,status=0){
  const error=new Error(message);
  error.status=status;
  return error;
}

async function request(path, opts={}){
  const headers = {'Content-Type':'application/json', ...(opts.headers||{})};
  if(token) headers.Authorization = `Bearer ${token}`;
  let response;
  try{
    response = await fetch(API_URL + path, {...opts, headers});
  }catch{
    throw makeRequestError('Não foi possível conectar ao servidor. Aguarde alguns segundos e tente novamente.');
  }
  let data={};
  try{ data = await response.json(); }catch{}
  if(!response.ok){
    if(response.status === 401) throw makeRequestError(data.detail || 'Sessão expirada. Entre novamente.',401);
    throw makeRequestError(data.detail || `Erro HTTP ${response.status}`,response.status);
  }
  return data;
}

async function checkHealth(){
  if(!navigator.onLine){
    setServerState('Sem conexão com a internet.','error');
    if($('apiState')) $('apiState').textContent='OFFLINE';
    return;
  }
  setServerState('Verificando servidor...','loading');
  try{
    const data = await request('/health');
    if(data.ok){
      setServerState('Servidor online. Faça seu login.','online');
      if($('apiState')) $('apiState').textContent='ONLINE';
    }
  }catch{
    setServerState('Servidor pode estar iniciando. Tente entrar em alguns segundos.','loading');
    if($('apiState')) $('apiState').textContent='ACORDANDO';
  }
}

async function validateSession(){
  if(!token) return false;
  try{ await request('/auth/session'); return true; }
  catch{ clearSession(); return false; }
}

function startKeepAlive(){
  stopKeepAlive();
  keepAliveTimer=setInterval(async()=>{
    if(!token) return;
    if(!navigator.onLine){ if($('apiState')) $('apiState').textContent='OFFLINE'; return; }
    try{
      await request('/auth/session');
      if($('apiState')) $('apiState').textContent='ONLINE';
    }catch(err){
      if(err.status===401){
        clearSession();
        setLogged(false);
        setServerState('Sessão expirada. Entre novamente.','error');
        return;
      }
      if($('apiState')) $('apiState').textContent='RECONECTAR';
    }
  },10*60*1000);
}

function stopKeepAlive(){
  if(keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer=null;
}

$('revealPassword').addEventListener('click',()=>{
  const field=$('password');
  field.type = field.type === 'password' ? 'text' : 'password';
  $('revealPassword').textContent = field.type === 'password' ? 'Mostrar' : 'Ocultar';
});

$('loginBtn').addEventListener('click',async()=>{
  const emailField=$('email');
  const email=emailField.value.trim();
  const password=$('password').value;
  if(!email || !password){ setServerState('Preencha e-mail e senha.','error'); return; }
  if(!emailField.validity.valid){ setServerState('Informe um e-mail válido.','error'); emailField.focus(); return; }
  if(!navigator.onLine){ setServerState('Sem conexão com a internet.','error'); return; }
  const btn=$('loginBtn');
  btn.disabled=true;
  setDisplay($('loginLoader'),true,'grid');
  try{
    const data=await request('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    if(!data.token) throw makeRequestError('O servidor não retornou uma sessão válida. Tente novamente.');
    token=data.token;
    sessionStorage.setItem('xcloud_token',token);
    $('password').value='';
    setLogged(true);
  }catch(err){ setServerState(err.message,'error'); }
  finally{ setDisplay($('loginLoader'),false); btn.disabled=false; }
});

$('logoutBtn').addEventListener('click',async()=>{
  try{ await request('/auth/logout',{method:'POST'}); }catch{}
  clearSession({resetOperations:true});
  setLogged(false);
  setServerState('Sessão encerrada.','online');
});

function timeline(type,title,text){
  const item=document.createElement('div');
  item.className=`timeline-item ${type}`;
  const dot=document.createElement('span'); dot.className='timeline-dot';
  const content=document.createElement('div');
  const strong=document.createElement('strong'); strong.textContent=title;
  const paragraph=document.createElement('p'); paragraph.textContent=text;
  content.append(strong,paragraph); item.append(dot,content);
  $('timeline').replaceChildren(item);
}

function installOperationSwitch(){
  const card = document.querySelector('.activation-card');
  if(!card || document.getElementById('operationSwitch')) return;
  const firstField = card.querySelector('.field');
  if(!firstField) return;
  const wrap=document.createElement('div');
  wrap.id='operationSwitch';
  wrap.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 18px';
  const activate=document.createElement('button');
  const reset=document.createElement('button');
  activate.type=reset.type='button';
  activate.id='modeActivate'; reset.id='modeReset';
  activate.textContent='ATIVAR'; reset.textContent='RESET';
  [activate,reset].forEach(btn=>{btn.style.cssText='min-height:48px;border-radius:14px;font-weight:900;letter-spacing:.06em;border:1px solid rgba(36,229,235,.22);color:#f5fbfc;background:rgba(255,255,255,.035)';});
  activate.addEventListener('click',()=>setOperationMode('activate'));
  reset.addEventListener('click',()=>setOperationMode('reset'));
  wrap.append(activate,reset);
  card.insertBefore(wrap,firstField);
  setOperationMode('activate');
}

function setOperationMode(mode){
  operationMode = mode === 'reset' ? 'reset' : 'activate';
  const op=OP[operationMode];
  const a=$('modeActivate'), r=$('modeReset');
  if(a && r){
    const active='linear-gradient(100deg,#26e5eb,#19cfd7 47%,#0ca4ad)';
    const idle='rgba(255,255,255,.035)';
    a.style.background=operationMode==='activate'?active:idle;
    r.style.background=operationMode==='reset'?active:idle;
    a.style.color=operationMode==='activate'?'#021012':'#f5fbfc';
    r.style.color=operationMode==='reset'?'#021012':'#f5fbfc';
  }
  const btn=$('executeBtn');
  if(btn && btn.firstElementChild) btn.firstElementChild.textContent=op.button;
  const head=document.querySelector('.activation-card .card-head h3');
  const copy=document.querySelector('.activation-card .card-head p:last-child');
  if(head) head.textContent=operationMode==='activate'?'Ativar dispositivo':'Resetar dispositivo';
  if(copy) copy.textContent=operationMode==='activate'?'Informe o Device Key e a lista M3U/DNS.':'O Reset remove, cadastra novamente e reaplica a mesma M3U/DNS.';
}

function resetProcessSteps(){
  currentStep=0;
  document.querySelectorAll('.process-step').forEach((step,index)=>{
    step.classList.toggle('active',index===0);
    step.classList.remove('done');
  });
}

function configureOverlay(op){
  const workingTitle=document.querySelector('#activationWorking h2');
  const successTitle=document.querySelector('#activationSuccess h2');
  const successText=document.querySelector('#activationSuccess > p:not(.eyebrow)');
  const errorTitle=document.querySelector('#activationError h2');
  if(workingTitle) workingTitle.textContent=op.title;
  if(successTitle) successTitle.textContent=op.successTitle;
  if(successText) successText.textContent=op.successText;
  if(errorTitle) errorTitle.textContent=op.errorTitle;
  document.querySelectorAll('.process-step').forEach((step,i)=>{
    const strong=step.querySelector('strong'); const small=step.querySelector('small');
    if(strong) strong.textContent=op.steps[i][0];
    if(small) small.textContent=op.steps[i][1];
  });
}

function moveStep(index,op){
  currentStep=Math.min(index,3);
  document.querySelectorAll('.process-step').forEach((step,i)=>{
    step.classList.toggle('active',i===currentStep);
    step.classList.toggle('done',i<currentStep);
  });
  $('activationMessage').textContent=op.messages[currentStep];
}

function openActivation(device,op){
  configureOverlay(op);
  setDisplay($('activationWorking'),true);
  setDisplay($('activationSuccess'),false);
  setDisplay($('activationError'),false);
  setDisplay($('activationOverlay'),true,'grid');
  $('activationDevice').textContent=device;
  $('activationTimer').textContent='0,0 s';
  resetProcessSteps();
  moveStep(0,op);
  activationStartedAt=performance.now();
  activationClock=setInterval(()=>{
    const elapsed=(performance.now()-activationStartedAt)/1000;
    $('activationTimer').textContent=`${elapsed.toFixed(1).replace('.',',')} s`;
  },100);
  let idx=0;
  activationStepTimer=setInterval(()=>{
    if(idx<3){ moveStep(idx+1,op); idx++; }
    else{ clearInterval(activationStepTimer); activationStepTimer=null; }
  },3400);
}

function stopActivationTimers(){
  if(activationClock) clearInterval(activationClock);
  if(activationStepTimer) clearInterval(activationStepTimer);
  activationClock=null; activationStepTimer=null;
}

function showSuccess(device){
  stopActivationTimers();
  document.querySelectorAll('.process-step').forEach(step=>{step.classList.remove('active');step.classList.add('done');});
  const elapsed=(performance.now()-activationStartedAt)/1000;
  setDisplay($('activationWorking'),false);
  setDisplay($('activationSuccess'),true,'grid');
  $('successDevice').textContent=device;
  $('successTime').textContent=`Concluído em ${elapsed.toFixed(1).replace('.',',')} s`;
}

function showError(message){
  stopActivationTimers();
  setDisplay($('activationWorking'),false);
  setDisplay($('activationError'),true,'grid');
  $('activationErrorText').textContent=message;
}

function closeActivation(){ stopActivationTimers(); setDisplay($('activationOverlay'),false); }

$('newActivationBtn').addEventListener('click',()=>{
  closeActivation(); $('device').value=''; $('playlist').value=''; $('device').focus();
  timeline('ready','PRONTO','Aguardando nova operação.');
});
$('retryActivationBtn').addEventListener('click',()=>{ closeActivation(); $('device').focus(); });

$('executeBtn').addEventListener('click',async()=>{
  const device=$('device').value.trim().toUpperCase();
  const playlist=$('playlist').value.trim();
  const op=OP[operationMode];
  if(!device){ alert('Informe o Device Key / MAC.'); return; }
  if(!playlist){ alert('Informe a M3U / DNS.'); return; }
  if(!navigator.onLine){ alert('Sem conexão com a internet. Verifique sua conexão e tente novamente.'); return; }
  const btn=$('executeBtn'); btn.disabled=true;
  timeline('working','PROCESSANDO',`${op.timeline} ${device}...`);
  openActivation(device,op);
  try{
    const data=await request(op.path,{method:'POST',body:JSON.stringify({device,playlist})});
    operations++;
    sessionStorage.setItem('xcloud_operations',operations);
    $('opsCount').textContent=operations;
    timeline('success','CONCLUÍDO',data.message || 'Operação concluída.');
    showSuccess(device);
  }catch(err){
    timeline('error','ERRO',err.message); showError(err.message);
    if(err.status===401){
      clearSession();
      setTimeout(()=>{closeActivation();setLogged(false);setServerState('Sessão expirada. Entre novamente.','error');},1800);
    }
  }finally{ btn.disabled=false; }
});

window.addEventListener('offline',()=>{
  if($('apiState')) $('apiState').textContent='OFFLINE';
  if(!$('loginView').hidden) setServerState('Sem conexão com a internet.','error');
});
window.addEventListener('online',()=>{ if($('apiState')) $('apiState').textContent='RECONECTANDO'; checkHealth(); });

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault(); deferredInstallPrompt=event;
  if($('installAppBtn')) setDisplay($('installAppBtn'),true,'inline-flex');
});
window.addEventListener('appinstalled',()=>{ deferredInstallPrompt=null; if($('installAppBtn')) setDisplay($('installAppBtn'),false); });
if($('installAppBtn')) $('installAppBtn').addEventListener('click',async()=>{
  if(!deferredInstallPrompt){ alert('Use o menu do navegador e escolha "Instalar app" ou "Adicionar à tela inicial".'); return; }
  deferredInstallPrompt.prompt();
  try{ await deferredInstallPrompt.userChoice; }catch{}
  deferredInstallPrompt=null; setDisplay($('installAppBtn'),false);
});

(async()=>{
  installOperationSwitch();
  await checkHealth();
  if(token){ const valid=await validateSession(); setLogged(valid); }
  else setLogged(false);
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {scope:'/',updateViaCache:'none'});
      await registration.update();
      if (registration.waiting) registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage({type:'SKIP_WAITING'});
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (error) { console.warn('PWA: falha ao registrar service worker', error); }
  });
}
