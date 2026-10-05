const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const seed=[{id:1,title:"Проект Рози",author:"Грэм Симсион",pages:320,read:210,status:"reading",color:"green"},{id:2,title:"Атомные привычки",author:"Джеймс Клир",pages:320,read:320,status:"finished",color:"sand"},{id:3,title:"Марсианин",author:"Энди Вейер",pages:384,read:0,status:"planned",color:"blue"},{id:4,title:"1984",author:"Джордж Оруэлл",pages:328,read:328,status:"finished",color:"dark"}];
let books=JSON.parse(localStorage.getItem("sst3_books")||"null")||seed,notes=JSON.parse(localStorage.getItem("sst3_notes")||"null")||[],goal=+localStorage.getItem("sst3_goal")||30,sessions=JSON.parse(localStorage.getItem("sst3_sessions")||"{}"),seconds=+localStorage.getItem("sst3_seconds")||0,sessionHistory=JSON.parse(localStorage.getItem("sst3_session_history")||"[]");
let filter="all",selected=null,month=new Date(new Date().getFullYear(),new Date().getMonth(),1),timer=null,elapsed=0,running=false,stream=null;

// Облачный профиль и синхронизация через Supabase. Локальные данные остаются резервной копией.
const SUPA_READY=window.SUPABASE_URL&&window.SUPABASE_ANON_KEY&&window.SUPABASE_URL.startsWith("http")&&!window.SUPABASE_URL.includes("YOUR_")&&!window.SUPABASE_ANON_KEY.includes("YOUR_");
const cloud=SUPA_READY?window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY):null;
let currentUser=null,profile=null,syncTimer=null,authMode="login",cloudLoaded=false;

function profileInitial(name,email){return (String(name||email||"К").trim()[0]||"К").toUpperCase()}
function avatarMarkup(avatar,name,email,cls="profile-avatar"){const initial=profileInitial(name,email);return avatar?`<img src="${esc(avatar)}" alt="">`:initial}
function setAvatarElement(el,avatar,name,email){if(!el)return;el.innerHTML=avatar?`<img src="${esc(avatar)}" alt="">`:esc(profileInitial(name,email));el.classList.toggle("has-image",!!avatar)}
function currentDisplayName(){return profile?.display_name||currentUser?.user_metadata?.display_name||currentUser?.email?.split("@")[0]||"Читатель"}
function calculateStreak(){const dates=new Set(Object.keys(sessions).filter(k=>(sessions[k]?.pages||0)>0));let d=new Date();let streak=0;while(dates.has(key(d))){streak++;d.setDate(d.getDate()-1)}return streak}
function achievements(){const finished=books.filter(b=>b.status==="finished").length;const pages=books.reduce((s,b)=>s+(+b.read||0),0);const hasSession=sessionHistory.length>0;const hours=seconds/3600;const streak=calculateStreak();return [
 {icon:"✓",title:"Первая книга",text:"Заверши первую книгу",done:finished>=1},
 {icon:"100",title:"100 страниц",text:"Прочитай 100 страниц",done:pages>=100},
 {icon:"1ч",title:"Час чтения",text:"Набери 1 час по таймеру",done:hours>=1},
 {icon:"5",title:"Пять книг",text:"Заверши 5 книг",done:finished>=5},
 {icon:"1K",title:"Тысяча страниц",text:"Прочитай 1 000 страниц",done:pages>=1000},
 {icon:"7",title:"Неделя ритма",text:"Читай 7 дней подряд",done:streak>=7},
 {icon:"◷",title:"Первая сессия",text:"Сохрани первую сессию",done:hasSession}
 ]}
function renderProfilePage(){
 const name=currentDisplayName(),email=currentUser?.email||"Войди в аккаунт для синхронизации";
 $("#pageProfileName").textContent=name;$("#pageProfileEmail").textContent=email;$("#pageProfileNameInput").value=currentUser?name:"";
 setAvatarElement($("#pageProfileAvatar"),profile?.avatar,name,email);
 const finished=books.filter(b=>b.status==="finished").length,pages=books.reduce((s,b)=>s+(+b.read||0),0),streak=calculateStreak();
 $("#pBooks").textContent=finished;$("#pPages").textContent=pages.toLocaleString("ru-RU");$("#pTime").textContent=formatTime(seconds);$("#pStreak").textContent=streak;
 $("#pageSyncBadge").textContent=currentUser?(cloudLoaded?"☁ Синхронизировано":"Подключение…"):"Локально";
 $("#achievements").innerHTML=achievements().map(a=>`<article class="achievement ${a.done?"done":""}"><div class="achievement-icon">${a.icon}</div><div><b>${a.title}</b><small>${a.text}</small></div><span>${a.done?"Получено":"В процессе"}</span></article>`).join("");
 $("#profileLogoutPage").hidden=!currentUser;$("#savePageProfile").disabled=!currentUser;$("#avatarInput").disabled=!currentUser;
}
function setSyncUI(){
 const btn=$("#profileBtn"), name=$("#profileName"), email=$("#profileEmail"), avatar=$("#profileAvatar");
 if(!currentUser){btn.textContent="К";name.textContent="Гость";email.textContent=SUPA_READY?"Войди для синхронизации":"Синхронизация не настроена";avatar.textContent="К";$("#guestActions").hidden=false;$("#userActions").hidden=true;renderProfilePage();return}
 const display=currentDisplayName(),initial=profileInitial(display,currentUser.email);btn.textContent=initial;name.textContent=display;email.textContent=currentUser.email||"Аккаунт подключён";setAvatarElement(avatar,profile?.avatar,display,currentUser.email);$("#guestActions").hidden=true;$("#userActions").hidden=false;$("#profileNameInput").value=display;renderProfilePage();
}
function localPayload(){return {books,notes,goal,sessions,seconds,sessionHistory}}
function applyPayload(data){if(!data)return; if(Array.isArray(data.books))books=data.books; if(Array.isArray(data.notes))notes=data.notes; if(data.goal!=null)goal=+data.goal||30; if(data.sessions&&typeof data.sessions==='object')sessions=data.sessions; if(data.seconds!=null)seconds=+data.seconds||0; if(Array.isArray(data.sessionHistory))sessionHistory=data.sessionHistory; saveLocal(); renderBooks();renderNotes();renderStats();renderRecentSessions();updateDashboard()}
function saveLocal(){localStorage.setItem("sst3_books",JSON.stringify(books));localStorage.setItem("sst3_notes",JSON.stringify(notes));localStorage.setItem("sst3_goal",goal);localStorage.setItem("sst3_sessions",JSON.stringify(sessions));localStorage.setItem("sst3_seconds",seconds);localStorage.setItem("sst3_session_history",JSON.stringify(sessionHistory))}
async function syncNow(){
 if(!cloud||!currentUser||!cloudLoaded)return;
 const {error}=await cloud.from("user_data").upsert({user_id:currentUser.id,data:localPayload(),updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(error)console.warn("Sync error",error);
}
function queueSync(){if(!cloud||!currentUser||!cloudLoaded)return;clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,500)}
async function loadCloud(){
 if(!cloud||!currentUser)return;
 const {data,error}=await cloud.from("user_data").select("data").eq("user_id",currentUser.id).maybeSingle();
 if(error){console.warn("Cloud load error",error);toast("Не удалось загрузить данные из облака");return}
 if(data?.data&&Object.keys(data.data).length){applyPayload(data.data);cloudLoaded=true;toast("Данные синхронизированы");}
 else {cloudLoaded=true;await syncNow();toast("Локальные данные сохранены в профиль")}
}
async function loadProfile(){
 if(!cloud||!currentUser)return;
 let {data,error}=await cloud.from("profiles").select("id,display_name,avatar").eq("id",currentUser.id).maybeSingle();
 if(error)console.warn("Profile load error",error);
 profile=data||null;setSyncUI();
}
async function initCloud(){
 setSyncUI();
 if(!cloud){$("#profileEmail").textContent="Добавь ключи Supabase в supabase-config.js";return}
 const {data}=await cloud.auth.getSession();
 currentUser=data.session?.user||null;
 if(currentUser){await loadProfile();await loadCloud()}
 cloud.auth.onAuthStateChange(async (_event,session)=>{
   currentUser=session?.user||null; cloudLoaded=false;
   if(currentUser){await loadProfile();await loadCloud()} else {profile=null;setSyncUI()}
 });
}


function save(){saveLocal();queueSync()}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(t){let x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2100)}
function key(d){return d.toISOString().slice(0,10)}
function pct(b){return b.pages?Math.min(100,Math.round(b.read/b.pages*100)):0}
function coverHTML(b,detail=false){let img=b.cover||"";let cls=(b.color||"green");if(img)return `<div class="${detail?"detail-cover":"cover"} has-img"><img src="${esc(img)}" alt=""></div>`;return `<div class="${detail?"detail-cover":"cover"} ${cls}"><b>${esc(b.title)}</b></div>`}
function card(b){return `<article class="book" data-id="${b.id}">${coverHTML(b)}<div class="book-info"><strong>${esc(b.title)}</strong><small>${esc(b.author)}</small><div class="progress"><i style="width:${pct(b)}%"></i></div><em>${b.status==="finished"?"Прочитано":b.status==="reading"?`${b.read} / ${b.pages} стр.`:"В планах"}</em></div></article>`}

function renderBooks(){
 let q=($("#search")?.value||"").toLowerCase(),list=books.filter(b=>(filter==="all"||b.status===filter)&&(b.title+" "+b.author).toLowerCase().includes(q));
 $("#libraryBooks").innerHTML=list.map(card).join("")||'<div class="stat-card">Книг не найдено.</div>';
 $("#homeBooks").innerHTML=books.filter(b=>b.status==="reading").slice(0,4).map(card).join("")||'<div class="stat-card">Добавь книгу, которую читаешь.</div>';
 $$(".book").forEach(x=>x.onclick=()=>openBook(+x.dataset.id));updateDashboard()
}
function updateDashboard(){
 let finished=books.filter(b=>b.status==="finished").length,pages=books.reduce((s,b)=>s+b.read,0),today=sessions[key(new Date())]?.pages||0;
 $("#yearBooks").textContent=finished+" книг";$("#yearPages").textContent=pages.toLocaleString("ru-RU")+" страниц";$("#todayPages").textContent=today+" стр.";$("#todayPct").textContent=Math.min(100,Math.round(today/20*100))+"%";
 $("#sBooks").textContent=finished;$("#sPages").textContent=pages.toLocaleString("ru-RU");$("#sTime").textContent=formatTime(seconds);$("#sSpeed").textContent=seconds?Math.round(pages/(seconds/3600)):"—";
 $("#goalText").textContent=`${finished} / ${goal} книг`;$("#goalLeft").textContent=Math.max(0,goal-finished);$("#goalProgress").style.width=Math.min(100,finished/goal*100)+"%";$("#avgPages").textContent=Math.round(pages/Math.max(1,Object.keys(sessions).length))
}
function show(v){$$(".page").forEach(x=>x.classList.remove("active"));$("#"+v).classList.add("active");$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));let t={home:"Добрый вечер, читатель",library:"Моя библиотека",discover:"Найти книгу",calendar:"Календарь чтения",stats:"Статистика",notes:"Заметки и цитаты",goals:"Цели чтения",profile:"Мой профиль"};$("#title").textContent=t[v];$("#sidebar").classList.remove("open");if(v==="calendar")renderCalendar();if(v==="stats")renderStats();if(v==="notes")renderNotes();if(v==="profile")renderProfilePage()}
$("#profileBtn").onclick=()=>{if(currentUser){show("profile");return}let p=$("#profilePanel");p.hidden=!p.hidden};
document.addEventListener("click",e=>{if(!e.target.closest("#profilePanel")&&!e.target.closest("#profileBtn"))$("#profilePanel").hidden=true});
$("#loginBtn").onclick=()=>{if(!cloud){toast("Сначала настрой Supabase");return}$("#profilePanel").hidden=true;$("#authModal").showModal()};
$("#authToggle").onclick=()=>{authMode=authMode==="login"?"signup":"login";$("#authTitle").textContent=authMode==="login"?"Войти в Сашок стишок":"Создать профиль";$("#authSub").textContent=authMode==="login"?"Войди, чтобы синхронизировать библиотеку, заметки, цели и статистику между устройствами.":"Создай профиль: данные будут привязаны к аккаунту и доступны на твоих устройствах.";$("#authNameWrap").hidden=authMode!=="signup";$("#authSubmit").textContent=authMode==="login"?"Войти":"Создать профиль";$("#authToggle").textContent=authMode==="login"?"Нет аккаунта? Создать профиль":"Уже есть аккаунт? Войти";$("#authPassword").autocomplete=authMode==="login"?"current-password":"new-password";$("#authStatus").textContent=""};
$("#authForm").onsubmit=async e=>{e.preventDefault();if(!cloud)return;const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=$("#authName").value.trim();$("#authStatus").textContent="Подключаем…";let res;if(authMode==="login")res=await cloud.auth.signInWithPassword({email,password});else res=await cloud.auth.signUp({email,password,options:{data:{display_name:name||email.split("@")[0]}}});if(res.error){$("#authStatus").textContent=res.error.message;return}if(authMode==="signup"&&!res.data.session){$("#authStatus").textContent="Проверь почту и подтверди регистрацию, затем войди.";return}$("#authStatus").textContent="Готово";setTimeout(()=>$("#authModal").close(),400)};
$("#closeAuth").onclick=()=>$("#authModal").close();
async function saveProfileDisplay(display){if(!cloud||!currentUser)return false;const {error}=await cloud.from("profiles").upsert({id:currentUser.id,display_name:display,avatar:profile?.avatar||null,updated_at:new Date().toISOString()});if(error){toast("Не удалось сохранить профиль");return false}profile={...(profile||{}),display_name:display};setSyncUI();toast("Профиль сохранён");return true}
$("#saveProfile").onclick=async()=>{const display=$("#profileNameInput").value.trim()||"Читатель";await saveProfileDisplay(display)};
$("#savePageProfile").onclick=async()=>{if(!currentUser){toast("Сначала войди в профиль");return}const display=$("#pageProfileNameInput").value.trim()||"Читатель";await saveProfileDisplay(display)};
$("#logoutBtn").onclick=async()=>{if(cloud)await cloud.auth.signOut();$("#profilePanel").hidden=true;toast("Вы вышли из профиля")};
$("#profileLogoutPage").onclick=async()=>{if(cloud)await cloud.auth.signOut();toast("Вы вышли из профиля");show("home")};
$("#avatarInput").onchange=async e=>{const file=e.target.files?.[0];if(!file||!currentUser||!cloud)return;try{const avatar=await imageDataURL(file,220,220,.82);const {error}=await cloud.from("profiles").upsert({id:currentUser.id,display_name:currentDisplayName(),avatar,updated_at:new Date().toISOString()});if(error)throw error;profile={...(profile||{}),avatar};setSyncUI();toast("Аватар обновлён")}catch(err){console.warn(err);toast("Не удалось загрузить аватар")}};
$$(".nav[data-view]").forEach(x=>x.onclick=()=>show(x.dataset.view));$("#menu").onclick=()=>$("#sidebar").classList.toggle("open");$$("[data-open]").forEach(x=>x.onclick=()=>show(x.dataset.open));
$("#theme").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("sst3_dark",document.body.classList.contains("dark"))};if(localStorage.getItem("sst3_dark")==="true")document.body.classList.add("dark");

$$(".chip").forEach(x=>x.onclick=()=>{$$(".chip").forEach(y=>y.classList.remove("active"));x.classList.add("active");filter=x.dataset.filter;renderBooks()});$("#search").oninput=renderBooks;
let editingBookId=null,pendingCover="";
function imageDataURL(file,maxW,maxH,quality=.82){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=reject;fr.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const scale=Math.min(1,maxW/img.width,maxH/img.height),c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",quality))};img.src=fr.result};fr.readAsDataURL(file)})}
function updateCoverPreview(src,title="Обложка"){const el=$("#coverPreview");el.innerHTML=src?`<img src="${esc(src)}" alt="">`:`<span>${esc(title)}</span>`}
function openBookForm(book=null){editingBookId=book?.id||null;pendingCover=book?.cover||"";$("#bookModalKicker").textContent=book?"РЕДАКТИРОВАНИЕ":"НОВАЯ КНИГА";$("#bookModalTitle").textContent=book?"Редактировать книгу":"Добавить вручную";$("#bookSubmit").textContent=book?"Сохранить изменения":"Добавить";$("#deleteBook").hidden=!book;$("#bTitle").value=book?.title||"";$("#bAuthor").value=book?.author||"";$("#bPages").value=book?.pages||300;$("#bRead").value=book?.read||0;$("#bStatus").value=book?.status||"reading";$("#bCover").value="";updateCoverPreview(pendingCover,book?.title||"Обложка");$("#bookModal").showModal()}
$("#addBook").onclick=()=>openBookForm();
$("#editBook").onclick=()=>{if(selected)openBookForm(selected);$("#bookView").close()};
$("#closeBookForm").onclick=()=>$("#bookModal").close();
$("#bCover").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{pendingCover=await imageDataURL(file,500,750,.82);updateCoverPreview(pendingCover,$("#bTitle").value||"Обложка")}catch(err){toast("Не удалось обработать обложку")}};
$("#bTitle").oninput=()=>{if(!pendingCover)updateCoverPreview("",$("#bTitle").value||"Обложка")};
$("#bookForm").onsubmit=e=>{e.preventDefault();let p=Math.max(1,+$("#bPages").value||300),r=Math.min(p,Math.max(0,+$("#bRead").value||0)),title=$("#bTitle").value.trim(),author=$("#bAuthor").value.trim();if(editingBookId){const b=books.find(x=>x.id===editingBookId);if(b){Object.assign(b,{title,author,pages:p,read:r,status:$("#bStatus").value,cover:pendingCover||b.cover||""});if(b.read>=b.pages)b.status="finished"}}else books.unshift({id:Date.now(),title,author,pages:p,read:r,status:$("#bStatus").value,color:"green",cover:pendingCover});save();renderBooks();renderProfilePage();$("#bookModal").close();toast(editingBookId?"Книга обновлена":"Книга добавлена");editingBookId=null;pendingCover=""};
$("#deleteBook").onclick=()=>{if(!editingBookId)return;const b=books.find(x=>x.id===editingBookId);if(!b)return;if(confirm(`Удалить «${b.title}» из библиотеки?`)){books=books.filter(x=>x.id!==editingBookId);sessionHistory=sessionHistory.filter(s=>s.bookId!==editingBookId);save();renderBooks();renderRecentSessions();renderProfilePage();$("#bookModal").close();toast("Книга удалена");editingBookId=null;pendingCover=""}};

function openBook(id){selected=books.find(b=>b.id===id);if(!selected)return;$("#detailCover").outerHTML=coverHTML(selected,true).replace("detail-cover","detail-cover"); // replaced below
 let c=document.querySelector(".book-detail .detail-cover");c.id="detailCover";$("#detailTitle").textContent=selected.title;$("#detailAuthor").textContent=selected.author;$("#detailStatus").textContent=selected.status==="finished"?"ПРОЧИТАНО":selected.status==="reading"?"ЧИТАЮ":"В ПЛАНАХ";$("#detailPct").textContent=pct(selected)+"%";$("#detailBar").style.width=pct(selected)+"%";$("#detailPages").textContent=`${selected.read} из ${selected.pages} страниц`;$("#detailMeta").textContent=[selected.isbn?"ISBN "+selected.isbn:"",selected.year||"",selected.publisher||""].filter(Boolean).join(" · ");$("#bookView").showModal()}
$("#closeBook").onclick=()=>$("#bookView").close();
$("#addPages").onclick=()=>{if(!selected)return;let n=Math.min(10,selected.pages-selected.read);if(n<=0)return;selected.read+=n;selected.status=selected.read>=selected.pages?"finished":"reading";let k=key(new Date());sessions[k]??={pages:0};sessions[k].pages+=n;save();renderBooks();openBook(selected.id);toast("Добавлено "+n+" страниц")};
$("#markFinished").onclick=()=>{if(!selected)return;let n=selected.pages-selected.read;if(n>0){let k=key(new Date());sessions[k]??={pages:0};sessions[k].pages+=n}selected.read=selected.pages;selected.status="finished";save();renderBooks();openBook(selected.id);toast("Книга отмечена прочитанной")};

$("#continue").onclick=()=>{let b=books.find(x=>x.status==="reading");if(!b){show("library");return}openBook(b.id)};
function renderSessionBookPicker(){const sel=$("#sessionBookSelect");const reading=books.filter(b=>b.status!=="finished");sel.innerHTML=reading.length?reading.map(b=>`<option value="${b.id}">${esc(b.title)} — ${esc(b.author)}</option>`).join(""):'<option value="">Нет доступных книг</option>';if(selected&&reading.some(b=>String(b.id)===String(selected.id)))sel.value=selected.id;updateSessionBookPreview()}
function updateSessionBookPreview(){const b=books.find(x=>String(x.id)===String($("#sessionBookSelect").value));$("#sessionBookPreview").innerHTML=b?`${coverHTML(b)}<div><b>${esc(b.title)}</b><small>${esc(b.author)} · ${b.read} / ${b.pages} стр.</small></div>`:'<span>Добавь книгу в библиотеку</span>'}
$("#sessionBookSelect").onchange=updateSessionBookPreview;
$("#timerBtn").onclick=()=>{if(running){running=false;clearInterval(timer);$("#timerBtn").textContent="Старт";$("#timerStatus").textContent="Сессия завершена";$("#finishedTime").textContent=formatClock(elapsed);$("#finishedBook").textContent=selected?.title||"—";$("#sessionPages").value=0;$("#sessionNote").value="";$("#sessionModal").showModal();return}renderSessionBookPicker();$("#startSessionModal").showModal()};
$("#closeStartSession").onclick=()=>$("#startSessionModal").close();
$("#startSessionForm").onsubmit=e=>{e.preventDefault();const b=books.find(x=>String(x.id)===String($("#sessionBookSelect").value));if(!b){toast("Сначала добавь книгу");return}selected=b;$("#timerBook").textContent=b.title;$("#timerStatus").textContent="Идёт сессия чтения";elapsed=0;running=true;$("#timer").textContent="00:00:00";$("#timerBtn").textContent="Стоп";$("#startSessionModal").close();timer=setInterval(()=>{elapsed++;$("#timer").textContent=formatClock(elapsed)},1000)};
$("#sessionForm").onsubmit=e=>{
 e.preventDefault();
 if(!selected){$("#sessionModal").close();return}
 const pages=Math.max(0,+$("#sessionPages").value||0);
 const note=$("#sessionNote").value.trim();
 const duration=elapsed;
 const now=new Date();
 const dateKey=key(now);
 if(pages>0){
   selected.read=Math.min(selected.pages,selected.read+pages);
   if(selected.read>=selected.pages)selected.status="finished";
   sessions[dateKey]??={pages:0};
   sessions[dateKey].pages+=pages;
 }
 seconds+=duration;
 sessionHistory.unshift({
   id:Date.now(),
   bookId:selected.id,
   book:selected.title,
   duration,
   pages,
   note,
   date:now.toISOString()
 });
 sessionHistory=sessionHistory.slice(0,50);
 if(note){
   notes.unshift({book:selected.title,text:note,source:"session",date:now.toISOString()});
 }
 elapsed=0;$("#timer").textContent="00:00:00";$("#timerStatus").textContent="Сессия сохранена";
 save();renderBooks();renderNotes();renderRecentSessions();updateDashboard();$("#sessionModal").close();
 toast(pages?`Сессия сохранена: +${pages} стр.`:"Сессия сохранена");
};
$("#cancelSession").onclick=()=>{
 elapsed=0;$("#timer").textContent="00:00:00";$("#timerStatus").textContent="Сессия отменена";$("#sessionModal").close();
};

function renderRecentSessions(){
 const el=$("#recentSessions"); if(!el)return;
 const items=sessionHistory.slice(0,4);
 el.innerHTML=items.length?items.map(s=>`<div class="recent-session"><b>${esc(s.book)}</b><span>${formatTime(s.duration)}</span>${s.pages?`<span>+${s.pages} стр.</span>`:""}${s.note?"<span>✦</span>":""}<small>${new Date(s.date).toLocaleDateString("ru-RU",{day:"2-digit",month:"short"})}</small></div>`).join(""):"";
}
function formatClock(s){return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,"0")).join(":")}function formatTime(s){if(s<60)return Math.round(s)+"с";if(s<3600)return Math.floor(s/60)+"м";return Math.floor(s/3600)+"ч "+Math.floor(s%3600/60)+"м"}

async function searchBooks(q){
 q=q.trim();if(!q)return;
 $("#searchResults").innerHTML='<div class="loading">Ищу книги…</div>';
 try{
  let url="https://openlibrary.org/search.json?"+(q.replace(/^(97(8|9))?[\dXx -]{9,}$/,"")?`q=${encodeURIComponent(q)}`:`isbn=${encodeURIComponent(q)}`)+"&limit=12&fields=key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,publisher,language";
  let r=await fetch(url,{headers:{"Accept":"application/json"}});if(!r.ok)throw new Error("API");let data=await r.json();renderResults(data.docs||[]);
 }catch(e){$("#searchResults").innerHTML='<div class="stat-card">Не удалось получить результаты. Проверь интернет-соединение и попробуй ещё раз.</div>'}
}
function renderResults(docs){
 if(!docs.length){$("#searchResults").innerHTML='<div class="stat-card">Ничего не найдено.</div>';return}
 $("#searchResults").innerHTML=docs.map((d,i)=>{let isbn=(d.isbn||[]).find(x=>String(x).length===13)||d.isbn?.[0]||"";let cover=d.cover_i?`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`:"";return `<article class="result"><div class="result-cover">${cover?`<img src="${cover}" alt="">`:`<div class="no-cover">${esc(d.title||"Без названия")}</div>`}</div><div class="result-info"><strong>${esc(d.title||"Без названия")}</strong><small>${esc((d.author_name||["Неизвестный автор"])[0])}${d.first_publish_year?" · "+d.first_publish_year:""}</small><div class="result-actions"><button class="btn add-result" data-i="${i}">＋ Добавить</button><button class="secondary more-result" data-i="${i}">Подробнее</button></div></div></article>`}).join("");
 window.lastResults=docs;
 $$(".add-result").forEach(b=>b.onclick=()=>addApiBook(window.lastResults[+b.dataset.i]));
 $$(".more-result").forEach(b=>b.onclick=()=>addApiBook(window.lastResults[+b.dataset.i],true));
}
function addApiBook(d,detail=false){
 let isbn=(d.isbn||[]).find(x=>String(x).length===13)||d.isbn?.[0]||"";
 let existing=books.find(b=>isbn&&b.isbn===isbn);
 if(existing){toast("Эта книга уже в библиотеке");openBook(existing.id);return}
 let b={id:Date.now(),title:d.title||"Без названия",author:(d.author_name||["Неизвестный автор"])[0],pages:d.number_of_pages_median||300,read:0,status:"planned",isbn,year:d.first_publish_year||"",publisher:(d.publisher||[])[0]||"",cover:d.cover_i?`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`:"",color:"green"};
 books.unshift(b);save();renderBooks();toast("Книга добавлена");if(detail)openBook(b.id);else show("library")
}
$("#findBtn").onclick=()=>searchBooks($("#bookSearch").value);$("#bookSearch").addEventListener("keydown",e=>{if(e.key==="Enter")searchBooks(e.target.value)});
$("#isbnBtn").onclick=()=>searchBooks($("#isbn").value);
$("#globalSearch").onclick=()=>{show("discover");$("#bookSearch").focus()};

let scanStream=null,detector=null;
$("#scanBtn").onclick=async()=>{
 $("#scanModal").showModal();$("#scanHint").textContent="Запрашиваем камеру…";
 if(!("BarcodeDetector" in window)){ $("#scanHint").textContent="Этот браузер не поддерживает BarcodeDetector. Используй ручной ввод ISBN.";return}
 try{let supported=await BarcodeDetector.getSupportedFormats();if(!supported.includes("ean_13")&&!supported.includes("ean_8"))throw 0;detector=new BarcodeDetector({formats:supported.filter(x=>["ean_13","ean_8"].includes(x))});scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});$("#video").srcObject=scanStream;await $("#video").play();scanLoop()}catch(e){$("#scanHint").textContent="Не удалось открыть камеру. Можно ввести ISBN вручную."}
};
async function scanLoop(){if(!detector||!scanStream)return;try{let codes=await detector.detect($("#video"));if(codes.length){let v=codes[0].rawValue;stopScan();$("#scanModal").close();$("#isbn").value=v;show("discover");searchBooks(v);return}}catch(e){}requestAnimationFrame(scanLoop)}
function stopScan(){if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}$("#video").srcObject=null}
$("#closeScan").onclick=()=>{stopScan();$("#scanModal").close()};$("#manualScan").onclick=()=>{stopScan();$("#scanModal").close();$("#isbn").focus();show("discover")};

function renderNotes(){$("#notesGrid").innerHTML=notes.length?notes.map(n=>`<article class="note"><span class="overline">${esc(n.book)}</span><blockquote>“${esc(n.text)}”</blockquote><small>Личный дневник</small></article>`).join(""):'<div class="stat-card">Пока нет заметок.</div>'}
$("#addNote").onclick=()=>$("#noteModal").showModal();$("#noteForm").onsubmit=e=>{e.preventDefault();notes.unshift({book:$("#nBook").value||"Без книги",text:$("#nText").value});save();renderNotes();$("#noteModal").close();e.target.reset();toast("Заметка сохранена")};
$("#saveGoal").onclick=()=>{goal=Math.max(1,+$("#goalInput").value||30);save();updateDashboard();toast("Цель сохранена")};$("#export").onclick=()=>{let blob=new Blob([JSON.stringify({books,notes,goal,sessions,sessionHistory,seconds},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="sashok-stishok-library.json";a.click();URL.revokeObjectURL(a.href);toast("Данные экспортированы")};

function renderCalendar(){let y=month.getFullYear(),m=month.getMonth();$("#monthName").textContent=new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"}).format(month);let first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),out="";for(let i=0;i<first;i++)out+='<div class="empty"></div>';for(let d=1;d<=days;d++){let k=key(new Date(y,m,d)),p=sessions[k]?.pages||0,cl=p>=20?"read3":p>=10?"read2":p?"read1":"";let td=new Date(),today=y===td.getFullYear()&&m===td.getMonth()&&d===td.getDate();out+=`<div class="${cl} ${today?"today":""}"><b>${d}</b>${p?`<small>${p} стр.</small>`:""}</div>`}$("#calendarGrid").innerHTML=out}
$("#prevMonth").onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar()};$("#nextMonth").onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar()};
function renderStats(){let vals=Array(12).fill(0);Object.entries(sessions).forEach(([d,v])=>vals[new Date(d).getMonth()]+=v.pages||0);let max=Math.max(...vals,1);$("#bars").innerHTML=vals.map(v=>`<i title="${v} стр." style="height:${Math.max(5,v/max*100)}%"></i>`).join("");updateDashboard()}
$$("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d){if(d.id==="scanModal")stopScan();d.close()}}));
renderBooks();renderNotes();renderStats();renderRecentSessions();updateDashboard();initCloud();
