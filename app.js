const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const seed=[{id:1,title:"Проект Рози",author:"Грэм Симсион",pages:320,read:210,status:"reading",color:"green"},{id:2,title:"Атомные привычки",author:"Джеймс Клир",pages:320,read:320,status:"finished",color:"sand"},{id:3,title:"Марсианин",author:"Энди Вейер",pages:384,read:0,status:"planned",color:"blue"},{id:4,title:"1984",author:"Джордж Оруэлл",pages:328,read:328,status:"finished",color:"dark"}];
let books=JSON.parse(localStorage.getItem("sst3_books")||"null")||seed,notes=JSON.parse(localStorage.getItem("sst3_notes")||"null")||[],goal=+localStorage.getItem("sst3_goal")||30,sessions=JSON.parse(localStorage.getItem("sst3_sessions")||"{}"),seconds=+localStorage.getItem("sst3_seconds")||0,sessionHistory=JSON.parse(localStorage.getItem("sst3_session_history")||"[]");
let filter="all",selected=null,month=new Date(new Date().getFullYear(),new Date().getMonth(),1),timer=null,elapsed=0,running=false,stream=null;

function save(){localStorage.setItem("sst3_books",JSON.stringify(books));localStorage.setItem("sst3_notes",JSON.stringify(notes));localStorage.setItem("sst3_goal",goal);localStorage.setItem("sst3_sessions",JSON.stringify(sessions));localStorage.setItem("sst3_seconds",seconds);localStorage.setItem("sst3_session_history",JSON.stringify(sessionHistory))}
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
function show(v){$$(".page").forEach(x=>x.classList.remove("active"));$("#"+v).classList.add("active");$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));let t={home:"Добрый вечер, читатель",library:"Моя библиотека",discover:"Найти книгу",calendar:"Календарь чтения",stats:"Статистика",notes:"Заметки и цитаты",goals:"Цели чтения"};$("#title").textContent=t[v];$("#sidebar").classList.remove("open");if(v==="calendar")renderCalendar();if(v==="stats")renderStats();if(v==="notes")renderNotes()}
$$(".nav[data-view]").forEach(x=>x.onclick=()=>show(x.dataset.view));$("#menu").onclick=()=>$("#sidebar").classList.toggle("open");$$("[data-open]").forEach(x=>x.onclick=()=>show(x.dataset.open));
$("#theme").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("sst3_dark",document.body.classList.contains("dark"))};if(localStorage.getItem("sst3_dark")==="true")document.body.classList.add("dark");

$$(".chip").forEach(x=>x.onclick=()=>{$$(".chip").forEach(y=>y.classList.remove("active"));x.classList.add("active");filter=x.dataset.filter;renderBooks()});$("#search").oninput=renderBooks;
$("#addBook").onclick=()=>$("#bookModal").showModal();
$("#bookForm").onsubmit=e=>{e.preventDefault();let p=+$("#bPages").value,r=Math.min(p,+$("#bRead").value);books.unshift({id:Date.now(),title:$("#bTitle").value,author:$("#bAuthor").value,pages:p,read:r,status:$("#bStatus").value,color:"green"});save();renderBooks();$("#bookModal").close();e.target.reset();toast("Книга добавлена")};

function openBook(id){selected=books.find(b=>b.id===id);if(!selected)return;$("#detailCover").outerHTML=coverHTML(selected,true).replace("detail-cover","detail-cover"); // replaced below
 let c=document.querySelector(".book-detail .detail-cover");c.id="detailCover";$("#detailTitle").textContent=selected.title;$("#detailAuthor").textContent=selected.author;$("#detailStatus").textContent=selected.status==="finished"?"ПРОЧИТАНО":selected.status==="reading"?"ЧИТАЮ":"В ПЛАНАХ";$("#detailPct").textContent=pct(selected)+"%";$("#detailBar").style.width=pct(selected)+"%";$("#detailPages").textContent=`${selected.read} из ${selected.pages} страниц`;$("#detailMeta").textContent=[selected.isbn?"ISBN "+selected.isbn:"",selected.year||"",selected.publisher||""].filter(Boolean).join(" · ");$("#bookView").showModal()}
$("#closeBook").onclick=()=>$("#bookView").close();
$("#addPages").onclick=()=>{if(!selected)return;let n=Math.min(10,selected.pages-selected.read);if(n<=0)return;selected.read+=n;selected.status=selected.read>=selected.pages?"finished":"reading";let k=key(new Date());sessions[k]??={pages:0};sessions[k].pages+=n;save();renderBooks();openBook(selected.id);toast("Добавлено "+n+" страниц")};
$("#markFinished").onclick=()=>{if(!selected)return;let n=selected.pages-selected.read;if(n>0){let k=key(new Date());sessions[k]??={pages:0};sessions[k].pages+=n}selected.read=selected.pages;selected.status="finished";save();renderBooks();openBook(selected.id);toast("Книга отмечена прочитанной")};

$("#continue").onclick=()=>{let b=books.find(x=>x.status==="reading");if(!b){show("library");return}openBook(b.id)};
$("#timerBtn").onclick=()=>{
 if(!selected){
   let b=books.find(x=>x.status==="reading");
   if(!b){toast("Сначала выбери книгу");show("library");return}
   selected=b;$("#timerBook").textContent=b.title;
 }
 if(!running){
   running=true;elapsed=0;$("#timer").textContent="00:00:00";$("#timerBtn").textContent="Стоп";$("#timerStatus").textContent="Идёт сессия чтения";
   timer=setInterval(()=>{elapsed++;$("#timer").textContent=formatClock(elapsed)},1000);
 }else{
   running=false;clearInterval(timer);$("#timerBtn").textContent="Старт";$("#timerStatus").textContent="Сессия завершена";
   $("#finishedTime").textContent=formatClock(elapsed);$("#finishedBook").textContent=selected.title;$("#sessionPages").value=0;$("#sessionNote").value="";
   $("#sessionModal").showModal();
 }
};
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
renderBooks();renderNotes();renderStats();renderRecentSessions();updateDashboard();
