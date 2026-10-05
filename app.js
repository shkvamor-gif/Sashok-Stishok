const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const defaultBooks = [
 {id:1,title:"Проект Рози",author:"Грэм Симсион",pages:320,read:210,status:"reading",cover:"linear-gradient(135deg,#253f35,#769c87)"},
 {id:2,title:"Атомные привычки",author:"Джеймс Клир",pages:320,read:320,status:"finished",cover:"linear-gradient(135deg,#a77a55,#e3bd8c)"},
 {id:3,title:"Марсианин",author:"Энди Вейер",pages:384,read:0,status:"planned",cover:"linear-gradient(135deg,#7b342a,#d38b63)"},
 {id:4,title:"1984",author:"Джордж Оруэлл",pages:328,read:328,status:"finished",cover:"linear-gradient(135deg,#252525,#686868)"},
 {id:5,title:"Гарри Поттер",author:"Дж. К. Роулинг",pages:432,read:110,status:"reading",cover:"linear-gradient(135deg,#392c64,#9a7fcb)"}
];
const defaultNotes = [
 {book:"Атомные привычки",text:"Маленькие изменения со временем дают огромный результат."},
 {book:"Проект Рози",text:"Интересно наблюдать, как герой учится видеть мир за пределами собственных алгоритмов."},
 {book:"1984",text:"Книга, к которой хочется возвращаться именно из-за вопросов, а не ответов."}
];

let books = JSON.parse(localStorage.getItem("readly_books") || "null") || defaultBooks;
let notes = JSON.parse(localStorage.getItem("readly_notes") || "null") || defaultNotes;
let goal = Number(localStorage.getItem("readly_goal") || 30);

function save(){localStorage.setItem("readly_books",JSON.stringify(books));localStorage.setItem("readly_notes",JSON.stringify(notes));localStorage.setItem("readly_goal",goal)}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

function bookCard(b){
 const pct=Math.min(100,Math.round(b.read/b.pages*100));
 return `<article class="book-card">
   <div class="cover" style="background:${b.cover||'linear-gradient(135deg,#253f35,#8aa391)'}"><span>${escapeHtml(b.title)}</span></div>
   <div class="book-meta"><strong title="${escapeHtml(b.title)}">${escapeHtml(b.title)}</strong><small>${escapeHtml(b.author)}</small>
   <div class="progress-line"><i style="width:${pct}%"></i></div>
   <small>${b.status==="finished"?"Прочитано":b.status==="reading"?`${b.read} из ${b.pages} стр.`:"В планах"}</small></div>
 </article>`;
}
function renderBooks(filter="all"){
 const list=filter==="all"?books:books.filter(b=>b.status===filter);
 $("#libraryGrid").innerHTML=list.map(bookCard).join("");
 $("#currentlyReading").innerHTML=books.filter(b=>b.status==="reading").slice(0,4).map(bookCard).join("") || `<div class="metric-card">Пока ничего не читаешь.</div>`;
 updateMetrics();
}
function updateMetrics(){
 const finished=books.filter(b=>b.status==="finished").length;
 const pages=books.reduce((s,b)=>s+(b.status==="finished"?b.pages:b.read),0);
 $("#booksRead").textContent=finished;
 $("#bookGoal").textContent=goal;
 $("#pagesRead").textContent=pages.toLocaleString("ru-RU");
 $("#bookMeter").style.width=Math.min(100,finished/goal*100)+"%";
 $("#goalLarge").textContent=`${finished} / ${goal} книг`;
 $("#goalLargeMeter").style.width=Math.min(100,finished/goal*100)+"%";
 $("#goalLeft").textContent=Math.max(0,goal-finished);
}
function renderNotes(){
 $("#notesGrid").innerHTML=notes.map(n=>`<article class="note"><div class="eyebrow">${escapeHtml(n.book||"Без книги")}</div><div class="quote">“${escapeHtml(n.text)}”</div><small>Добавлено в личный дневник</small></article>`).join("");
}
function renderChart(){
 const vals=[48,72,58,91,66,110,86,130,102,145];
 $("#chart").innerHTML=vals.map(v=>`<i style="height:${v/150*100}%"></i>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

$$(".nav-item[data-view]").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));
$$("[data-view-link]").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.viewLink)));
function showView(view){
 $$(".view").forEach(v=>v.classList.remove("active-view"));
 $("#"+view).classList.add("active-view");
 $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===view));
 const titles={dashboard:"Добрый вечер, читатель",library:"Моя библиотека",goals:"Цели чтения",stats:"Статистика",notes:"Заметки и цитаты"};
 $("#pageTitle").textContent=titles[view]||"Readly";
 $("#sidebar").classList.remove("open");
 window.scrollTo({top:0,behavior:"smooth"});
}
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("readly_dark",document.body.classList.contains("dark"))};
if(localStorage.getItem("readly_dark")==="true")document.body.classList.add("dark");

$$(".filter").forEach(btn=>btn.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderBooks(btn.dataset.filter)});
$("#addBookBtn").onclick=()=>$("#bookDialog").showModal();
$("#bookForm").onsubmit=e=>{
 e.preventDefault();
 const palettes=["linear-gradient(135deg,#253f35,#769c87)","linear-gradient(135deg,#63443b,#c68c72)","linear-gradient(135deg,#30486a,#7597c2)","linear-gradient(135deg,#49355e,#a47bbf)"];
 books.unshift({id:Date.now(),title:$("#bookTitle").value,author:$("#bookAuthor").value,pages:Number($("#bookPages").value),read:0,status:$("#bookStatus").value,cover:palettes[Math.floor(Math.random()*palettes.length)]});
 save();renderBooks();$("#bookDialog").close();e.target.reset();toast("Книга добавлена в библиотеку");
};
$("#addNoteBtn").onclick=()=>$("#noteDialog").showModal();
$("#noteForm").onsubmit=e=>{
 e.preventDefault();notes.unshift({book:$("#noteBook").value,text:$("#noteText").value});save();renderNotes();$("#noteDialog").close();e.target.reset();toast("Заметка сохранена");
};
$("#saveGoal").onclick=()=>{goal=Math.max(1,Number($("#goalInput").value)||30);save();updateMetrics();toast("Цель обновлена")};
$("#continueBtn").onclick=()=>{const b=books.find(x=>x.status==="reading");if(b){b.read=Math.min(b.pages,b.read+10);save();renderBooks();toast(`+10 страниц: ${b.title}`)}else toast("Добавь книгу, которую сейчас читаешь")};
$("#searchBtn").onclick=()=>{const q=prompt("Поиск по библиотеке:");if(!q)return;const found=books.filter(b=>(b.title+" "+b.author).toLowerCase().includes(q.toLowerCase()));showView("library");$("#libraryGrid").innerHTML=found.map(bookCard).join("")||`<div class="metric-card">Ничего не найдено.</div>`};
$("#exportBtn").onclick=()=>{
 const data={books,notes,goal,exportedAt:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="readly-library.json";a.click();URL.revokeObjectURL(a.href);toast("Данные экспортированы");
};
document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close()}));
for(let i=0;i<7;i++){const el=document.createElement("i");el.style.height=(20+Math.random()*70)+"%";$("#miniBars").append(el)}
renderBooks();renderNotes();renderChart();updateMetrics();
