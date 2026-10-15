/* South FL Deal Checker — static site (GitHub Pages).
   Data: this browser only (localStorage) until Supabase is connected in Settings; then shared with your partner.
   AI: calls the Anthropic API straight from the browser with your own key (kept in this browser only).
   Maps: OpenStreetMap + Leaflet (free), Google satellite embed (free), optional Google Street View photos (needs your key). */

const RATES={sell:.08,rehab:.08,hold:.015,margin:.25,doc:.007,clerk:140};
const STATUSES=["Watching","Researching","Ready to bid","Passed","Bid - won","Bid - lost"];
const CHECKS=[["plaintiff","Foreclosing party confirmed from the final judgment"],["orsearch","County records searched by owner name AND parcel"],["senior","Nothing recorded ahead of the foreclosing loan (or amount known)"],["named","Every lienholder was named in the lawsuit"],["taxes","Property taxes checked (Tax Collector)"],["code","Code enforcement / city liens checked"],["unsafe","Unsafe structure notices / open permits checked"],["zoning","Zoning and legal unit count checked (Appraiser)"],["landuse","Future land use checked (county GIS / master plan)"],["llc","Owner / LLC looked up (Sunbiz)"],["driveby","Drive-by or photos; occupancy noted"],["comps","Your own comp value entered"],["titlerpt","Written title report received from title company"],["cancel","Checked sale is still on the calendar the morning of"]];
const MODELS=[["claude-sonnet-5-5","Sonnet 5.5 (balanced, ~2-5¢ per run)"],["claude-opus-5-5","Opus 5.5 (smarter, ~5-10¢ per run)"],["claude-haiku-5-5","Haiku 5.5 (cheapest, fastest)"]];

const $=s=>document.querySelector(s);
const money=v=>v==null||isNaN(v)?"—":(v<0?"-$":"$")+Math.round(Math.abs(v)).toLocaleString("en-US");
const moneyK=v=>v==null||isNaN(v)?"—":"$"+(Math.abs(v)>=1e6?(v/1e6).toFixed(2)+"M":Math.round(v/1000)+"K");
const num=v=>{if(v==null||v==="")return null;const n=Number(String(v).replace(/[$,\s]/g,""));return isNaN(n)?null:n};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const dkey=d=>{const m=String(d||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+m[1].padStart(2,"0")+m[2].padStart(2,"0"):"99999999"};
const T0=new Date();T0.setHours(0,0,0,0);
const today=""+T0.getFullYear()+String(T0.getMonth()+1).padStart(2,"0")+String(T0.getDate()).padStart(2,"0");
const daysTo=d=>{const m=String(d||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(!m)return null;return Math.round((new Date(+m[3],+m[1]-1,+m[2])-T0)/864e5)};
const daysSince=d=>Math.round((T0-new Date(d+"T00:00:00"))/864e5);
const isUpcoming=p=>!p.date||dkey(p.date)>=today;
function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,3000)}
const zip=p=>(String(p.city||"").match(/\b(\d{5})\b/)||[])[1]||"";
const cityName=p=>String(p.city||"").replace(/\s*\d{5}.*$/,"").trim();
const cleanStreet=a=>String(a||"").replace(/\(.*?\)/g," ").replace(/\s*(#|UNIT|APT|STE|BLDG|LOT)\s*[\w-]+\b.*$/i,"").replace(/\s+/g," ").trim();
const hasStreet=p=>/^\d+\s+\S+/.test(cleanStreet(p.addr))&&!/no situs|no address/i.test(p.addr||"");
const fullAddr=p=>`${cleanStreet(p.addr)}, ${cityName(p)}, FL ${zip(p)}`.replace(/\s+,/g,",");
function kind(p){const t=String(p.type||"").toUpperCase().replace(/ZERO\s*LOT(\s*LINE)?/g,"");
  if(p.vacant||/VACANT|^\s*LAND\b|\bLOTS?\s*$/.test(t)||/^VACANT/i.test(p.notes||""))return"Vacant land";
  if(/MOBILE|MANUFACT/.test(t))return"Mobile home";
  if(/CONDO/.test(t))return"Condo";if(/TOWN/.test(t))return"Townhome";if(/DUPLEX|TRIPLEX|QUAD|MULTI|APART/.test(t))return"Multi-family";
  if(/COMM|OFFICE|STORE|RETAIL|WAREHOUSE|MIXED|CHURCH/.test(t))return"Commercial";return"Single family"}
const dense=p=>/RM|RH|MF|RMH|R-3|R-4|T5|T4|T6|MU|C-|CG|CC|CB|YC|RD|DT|MXD/.test(String(p.zoning||"").toUpperCase());
const pidDashed=p=>{const d=String(p.pid||"").replace(/\D/g,"");return p.county==="Palm Beach"&&d.length===17?[d.slice(0,2),d.slice(2,4),d.slice(4,6),d.slice(6,8),d.slice(8,10),d.slice(10,13),d.slice(13)].join("-"):""};
const copyBtn=(val,label)=>val?`<button class="copy" data-copy="${esc(val)}" title="Copy ${esc(label)}"><span class="cl">${esc(label)}</span> <span class="cv">${esc(val)}</span> <span class="ci">Copy</span></button>`:"";
const newId=()=>"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const safeId=s=>String(s||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,120);

/* ---------- settings (this browser only) ---------- */
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
// Shared defaults for both partners (public keys only: Supabase publishable key, Google key restricted to this site).
const DEFAULTS={googleKey:"AIzaSyDCt0yB_TjcJa1Dj94CFl_qVEI5wc3H7zg",sbUrl:"https://djlcwpyquslmuhqymqip.supabase.co",sbKey:"sb_publishable_g3caGhTyfmWt0YlEvsPjhw_S1YdSUYY"};
let S=Object.assign({anthropicKey:"",model:"claude-sonnet-5-5",titleModel:"claude-opus-5-5",...DEFAULTS},LS.get("dc_settings",{}));
for(const k in DEFAULTS)if(!S[k]||/^PASTE-/.test(S[k]))S[k]=/^PASTE-/.test(DEFAULTS[k])?"":DEFAULTS[k];
const saveSettings=()=>LS.set("dc_settings",S);

/* ---------- storage: local or Supabase ---------- */
const Store={
  mode:"local", sb:null, user:null, cache:{}, listeners:[],
  async init(){
    if(S.sbUrl&&S.sbKey&&window.supabase){
      try{
        this.sb=window.supabase.createClient(S.sbUrl,S.sbKey);
        const {data}=await this.sb.auth.getSession();
        this.user=data.session?.user||null;
        this.sb.auth.onAuthStateChange((_e,sess)=>{const had=!!this.user;this.user=sess?.user||null;if(!!this.user!==had)location.reload()});
        if(this.user){this.mode="shared";await this.load();this.subscribe();return}
        this.mode="shared";await this.load();this.subscribe();return;
      }catch(e){console.error(e);this.mode="local";toast("Could not reach Supabase. Using this browser only.")}
    }
    this.mode="local"; this.cache=LS.get("dc_props",{});
  },
  async load(){
    const {data,error}=await this.sb.from("properties").select("id,data");
    if(error){toast("Could not load shared list: "+error.message);return}
    this.cache={};for(const r of data)this.cache[r.id]=r.data;
  },
  subscribe(){
    let t;this.sb.channel("props").on("postgres_changes",{event:"*",schema:"public",table:"properties"},()=>{clearTimeout(t);t=setTimeout(async()=>{await this.load();this.emit()},400)}).subscribe();
  },
  all(){return Object.entries(this.cache).filter(([id,d])=>!d.hidden).map(([id,d])=>({...d,_id:id}))},
  get(id){return this.cache[id]?{...this.cache[id],_id:id}:null},
  async put(id,data){
    const clean={...data};delete clean._id;
    this.cache[id]=clean;
    if(this.mode==="shared"){const {error}=await this.sb.from("properties").upsert({id,data:clean,updated_at:new Date().toISOString()});if(error){toast("Save failed: "+error.message);throw error}}
    else LS.set("dc_props",this.cache);
    this.emit();
  },
  async patch(id,patch){const cur=this.cache[id]||{};return this.put(id,{...cur,...patch,updatedAt:new Date().toISOString()})},
  async del(id){delete this.cache[id];if(this.mode==="shared"){await this.sb.from("properties").delete().eq("id",id)}else LS.set("dc_props",this.cache);this.emit()},
  async upload(id,file){
    if(this.mode!=="shared")throw new Error("Photo upload needs Supabase connected. Paste an image link instead.");
    const path=`${safeId(id)}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g,"_")}`;
    const {error}=await this.sb.storage.from("photos").upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    return this.sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
  },
  onChange(f){this.listeners.push(f)}, emit(){this.listeners.forEach(f=>f())}
};

/* ---------- research file: history, documents, same-parcel memory ---------- */
const pidDigits=x=>String(x&&x.pid||"").replace(/\D/g,"");
const hasResearch=x=>!!(x&&(x.ai||x.insights||(x.history||[]).length||(x.docs||[]).length||(x.chat||[]).length));
let _pidIdx=null,_pidFor=null;
function samePid(p){if(_pidFor!==props){_pidFor=props;_pidIdx={};for(const x of props){const d=pidDigits(x);if(d.length>=8)(_pidIdx[d]=_pidIdx[d]||[]).push(x)}}const d=pidDigits(p);return d.length>=8?(_pidIdx[d]||[]).filter(x=>x._id!==p._id):[]}
const seenBefore=p=>hasResearch(p)||samePid(p).some(hasResearch);
function withHist(id,entry){const cur=Store.get(id)||{};return [...(cur.history||[]),{at:new Date().toISOString(),...entry}].slice(-60)}
async function uploadDocs(id,files,label){const out=[];if(Store.mode!=="shared")return out;for(const f of files){try{out.push({url:await Store.upload(id,f),name:label?label+" - "+f.name:f.name,type:f.type||"",at:new Date().toISOString()})}catch(e){console.error(e)}}return out}
function docThumb(d){const img=/^image\//.test(d.type||"")||/\.(png|jpe?g|gif|webp)(\?|$)/i.test(d.url||"");
  return `<a href="${esc(d.url)}" target="_blank" rel="noopener" class="doc" style="display:inline-flex;flex-direction:column;gap:4px;width:150px;margin:0 8px 8px 0;text-decoration:none">${img?`<img src="${esc(d.url)}" alt="${esc(d.name||"document")}" loading="lazy" style="width:150px;height:110px;object-fit:cover;border-radius:6px;border:1px solid var(--line,#ccc)">`:`<span class="tag" style="height:110px;display:flex;align-items:center;justify-content:center">PDF / file</span>`}<span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name||"document")}</span><span class="small muted">${d.at?esc(new Date(d.at).toLocaleDateString()):""}</span></a>`}
function histLabel(h){return h.type==="title"?"AI title exam":h.type==="analysis"?"AI property analysis":h.type==="qa"?"Question to the title attorney":h.type==="research"?(h.title||"Research"):"Saved item"}
function histBody(h){
  if(h.type==="title"&&h.result)return renderMemo(h.result,h.at);
  if(h.type==="analysis"&&h.result)return renderIns(h.result,h.at);
  if(h.type==="qa")return `<p class="small"><b>Q:</b> ${esc(h.q)}</p><p class="small" style="white-space:pre-wrap"><b>A:</b> ${esc(h.a)}</p>`;
  return `<div class="small" style="white-space:pre-wrap">${esc(h.text||"")}</div>${(h.docs||[]).length?`<div style="margin-top:8px">${h.docs.map(docThumb).join("")}</div>`:""}`}
function renderResearch(p){
  const hist=[...(p.history||[])].reverse(), docs=p.docs||[], rel=samePid(p).filter(hasResearch);
  return `<div class="panel">
   <div class="sechead"><h3>Research file <span class="muted" style="text-transform:none;letter-spacing:0">· everything saved on this property</span></h3>
     <div class="row"><label class="small" for="r_docs" style="cursor:pointer;text-decoration:underline">${Store.mode==="shared"?"Add document (mortgage, deed, judgment…)":"Document upload needs the shared list"}</label><input type="file" id="r_docs" accept="image/*,application/pdf" multiple hidden ${Store.mode==="shared"?"":"disabled"}></div></div>
   ${rel.length?`<div class="tag good" style="display:block;padding:8px 10px;margin-bottom:10px;font-size:13px"><b>Seen before:</b> this parcel was researched under ${rel.map(x=>`<button class="link" data-goto="${esc(x._id)}">${esc(x.case||x._id)} (${esc(x.date||"no date")}, ${(x.history||[]).length} saved item${(x.history||[]).length===1?"":"s"})</button>`).join(", ")}.</div>`:""}
   <h3 style="margin-top:4px">Documents (${docs.length})</h3>
   ${docs.length?`<div>${docs.map(docThumb).join("")}</div>`:`<p class="small muted">No documents yet. Screenshots you give the title attorney and documents you add here are kept for good.</p>`}
   <div class="row" style="margin-top:10px"><input id="r_title" style="flex:1 1 200px" placeholder="Note title (e.g. Mortgage search 10/15)"><button id="r_add">Save note</button></div>
   <textarea id="r_text" rows="3" placeholder="Paste findings to keep: what the clerk records showed, title company answers, phone calls…"></textarea>
   <h3 style="margin-top:12px">History (${hist.length})</h3>
   ${hist.length?hist.map(h=>`<details style="margin:6px 0"><summary class="small"><b>${esc(histLabel(h))}</b> · ${esc(new Date(h.at).toLocaleString())}${h.by?" · "+esc(h.by):""}${h.type==="title"&&h.result?" · mortgages: "+esc(mortStatus(h.result)):""}${h.type==="qa"?" · "+esc(String(h.q||"").slice(0,80)):""}</summary><div style="margin-top:8px">${histBody(h)}</div></details>`).join(""):`<p class="small muted">Every title exam, analysis, question and note will be saved here, newest first.</p>`}
  </div>`}

/* ---------- scoring ---------- */
function mortStatus(a){const s=String(a&&a.mortgageCheck&&a.mortgageCheck.status||"").toUpperCase();return /OPEN/.test(s)?"OPEN":/CLEAR/.test(s)?"CLEAR":"NOT VERIFIED"}
function calc(p){
  const V=num(p.comp)||num(p.value), bid=num(p.bid);
  const ai=p.ai&&p.ai.result;
  const surv=(ai&&Array.isArray(ai.survives)?ai.survives:[]).reduce((s,x)=>s+(num(x.amount)||0),0);
  const rehab=p.vacant?0:RATES.rehab;
  const out={V,bid,surv,ai:!!ai};
  if(V&&bid!=null){
    out.profit=V*(1-RATES.sell-rehab-RATES.hold)-bid*(1+RATES.doc)-RATES.clerk-surv;
    out.maxBid=(V*(1-RATES.sell-rehab-RATES.hold-RATES.margin)-RATES.clerk-surv)/(1+RATES.doc);
    out.margin=out.profit/V; out.ratio=bid/V; out.disc=V-bid; out.discPct=(V-bid)/V;
  }
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const pts={};
  pts.money=out.margin==null?0:40*clamp(out.margin/RATES.margin,0,1);
  pts.title=ai?35*(1-clamp(num(ai.titleRisk)??100,0,100)/100):0;
  const checks=p.checks||{}; const done=CHECKS.filter(c=>checks[c[0]]).length;
  pts.dd=15*done/CHECKS.length; out.done=done;
  const land=num(p.land), bldg=num(p.bldg);
  let fit=0.2; if(p.vacant||(land!=null&&bldg!=null&&land>=bldg))fit=1; else if(dense(p)||kind(p)==="Multi-family")fit=.7;
  pts.fit=10*fit; out.landShare=land!=null&&V?land/V:null;
  out.pts=pts; out.score=Math.round(pts.money+pts.title+pts.dd+pts.fit);
  out.pre=Math.round(pts.money+pts.fit+pts.dd);
  if(!V||bid==null){out.verdict="NEED NUMBERS";out.cls="p-grey"}
  else if(ai&&ai.dealBreaker){out.verdict="PASS";out.cls="p-bad";out.why="The AI title attorney found a deal-breaker."}
  else if(!ai){out.verdict="TITLE NOT CHECKED";out.cls="p-grey";out.why="Run the AI title attorney before trusting the score."}
  else if(out.profit<=0){out.verdict="PASS";out.cls="p-bad";out.why="No profit at this bid."}
  else if(out.score>=75&&mortStatus(ai)==="CLEAR"){out.verdict="GO";out.cls="p-go"}
  else if(out.score>=55&&mortStatus(ai)!=="CLEAR"){out.verdict="MAYBE";out.cls="p-warn";out.why=mortStatus(ai)==="OPEN"?"An open mortgage was found. Check whether it survives and what it costs before bidding.":"Mortgages not verified yet. Finish the mortgage search in the AI title attorney first."}
  else if(out.score>=55){out.verdict="MAYBE";out.cls="p-warn"}
  else {out.verdict="PASS";out.cls="p-bad"}
  return out;
}
const TIERS=[["EXCELLENT","We intend to bid"],["GREEN","Good deal"],["YELLOW","Maybe, keep watching"],["ORANGE","Needs a title check first"],["GREY","HOA sale, check the mortgage"],["RED","Skip"],["SET ASIDE","Set aside (hidden, not deleted)"]];
const tierOf=p=>p.myTier||p.tier||"";
const tierCls=t=>({EXCELLENT:"p-excel",GREEN:"p-go",YELLOW:"p-yellow",ORANGE:"p-warn",GREY:"p-grey",RED:"p-bad","SET ASIDE":"p-aside"}[t]||"p-grey");
const tierColor=t=>({EXCELLENT:"#00c853",GREEN:"#1d7a46",YELLOW:"#c9a400",ORANGE:"#d0790b",GREY:"#6b7480",RED:"#b3261e","SET ASIDE":"#9aa3ad"}[t]||"#0d5c8c");
const tierBtn=(p,extra="")=>`<button class="pill tierbtn ${tierCls(tierOf(p))} ${extra}" data-tier-id="${esc(p._id)}" title="Click to change the color tag">${esc(tierOf(p)||"NEW")} ▾</button>`;
const scoreLabel=k=>k.verdict==="TITLE NOT CHECKED"?"Title not checked":k.verdict==="NEED NUMBERS"?"Need numbers":k.score+" · "+k.verdict;

/* ---------- similarity ---------- */
function similarity(a,b){
  let s=0; const ka=kind(a),kb=kind(b);
  if(ka===kb)s+=3; else if((ka==="Single family"&&kb==="Townhome")||(kb==="Single family"&&ka==="Townhome"))s+=1;
  if(a.county&&a.county===b.county)s+=1.5; if(a.channel&&a.channel===b.channel)s+=2;
  if(cityName(a)&&cityName(a)===cityName(b))s+=3; else if(zip(a)&&zip(a).slice(0,3)===zip(b).slice(0,3))s+=1.5;
  const va=num(a.comp)||num(a.value),vb=num(b.comp)||num(b.value);
  if(va&&vb){const r=Math.abs(Math.log(va/vb));if(r<.25)s+=2.5;else if(r<.5)s+=1.5;else if(r<.8)s+=.5}
  const ba=num(a.bid),bb=num(b.bid);
  if(ba!=null&&va&&bb!=null&&vb&&Math.abs(ba/va-bb/vb)<.15)s+=1.5;
  if(dense(a)&&dense(b))s+=1; if(a.ptype&&a.ptype===b.ptype)s+=1;
  const la=num(a.land),ga=num(a.bldg),lb=num(b.land),gb=num(b.bldg);
  if(la!=null&&ga!=null&&lb!=null&&gb!=null&&((la>=ga)===(lb>=gb)))s+=1;
  if(a.lat&&b.lat){const d=Math.hypot(a.lat-b.lat,(a.lng-b.lng)*.9);if(d<.03)s+=2;else if(d<.08)s+=1}
  return s;
}
const similarTo=(p,pool,n=6)=>pool.filter(x=>x._id!==p._id).map(x=>({x,s:similarity(p,x)})).filter(o=>o.s>=5).sort((a,b)=>b.s-a.s).slice(0,n).map(o=>o.x);
let CITIES=[];
function queryProfile(q){
  const t=q.toUpperCase(); const o={addr:q,city:(q.match(/\b\d{5}\b/)||[])[0]||"",type:q,notes:""};
  for(const c of CITIES){if(c&&t.includes(c))o.city=c+" "+o.city}
  if(/PALM BEACH|BOYNTON|DELRAY|JUPITER|WELLINGTON|LAKE WORTH|RIVIERA|BOCA|GREENACRES|LOXAHATCHEE|ROYAL PALM|BELLE GLADE/.test(t))o.county="Palm Beach";
  else if(/LAUDERDALE|HOLLYWOOD|POMPANO|DEERFIELD|CORAL SPRINGS|TAMARAC|PLANTATION|SUNRISE|MIRAMAR|PEMBROKE|DAVIE|WESTON|MARGATE|COCONUT CREEK|HALLANDALE|DANIA|OAKLAND PARK|LAUDERHILL|PARKLAND|COOPER CITY/.test(t))o.county="Broward";
  else if(/MIAMI|HIALEAH|DORAL|HOMESTEAD/.test(t))o.county="Miami-Dade";
  const m=t.match(/\$\s?([\d,]{5,})/);if(m)o.value=num(m[1]);
  if(/DUPLEX|TRIPLEX|MULTI/.test(t))o.type="Multi-family";
  return o;
}

/* ---------- photos & maps ---------- */
// Street View: outdoor Google imagery only (no indoor/user-uploaded panoramas), aimed by address; needs a real street address.
const streetViewUrl=(p,size="640x360")=>S.googleKey&&(hasStreet(p)||(p.lat&&!p.geoApprox))?`https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${encodeURIComponent(hasStreet(p)?fullAddr(p):p.lat+","+p.lng)}&source=outdoor&radius=60&fov=85&return_error_code=true&key=${encodeURIComponent(S.googleKey)}`:"";
// Satellite photo (free Esri World Imagery, no key) once the property has a map pin.
const satUrl=(p,w=560,h=300)=>{if(!p.lat||p.geoApprox)return"";const dx=.0011,dy=dx*h/w;return`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${p.lng-dx},${p.lat-dy},${p.lng+dx},${p.lat+dy}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`};
function autoPhotos(p,size){const sv=streetViewUrl(p,size),sat=satUrl(p);return (kind(p)==="Vacant land"?[sat,sv]:[sv,sat]).filter(Boolean)}
function photoList(p){return [...(p.photos||[]).filter(Boolean),...autoPhotos(p)]}
// try each picture in turn; if one fails (no Street View there), show the next one
window.nextPhoto=img=>{const alts=(img.dataset.alts||"").split("|").filter(Boolean);if(!alts.length){img.remove();return}img.src=alts.shift();img.dataset.alts=alts.join("|")};
function miniMap(p){
  let h=0;for(const c of String(p.addr||"")+String(p.case||""))h=(h*31+c.charCodeAt(0))>>>0;
  const r=()=>{h=(h*1664525+1013904223)>>>0;return h/4294967296};
  let s=`<svg class="map" viewBox="0 0 280 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  for(let i=0;i<3;i++){const y=25+i*45+r()*10;s+=`<rect x="0" y="${y}" width="280" height="7" fill="currentColor" opacity=".16"/>`}
  for(let i=0;i<4;i++){const x=30+i*70+r()*20;s+=`<rect x="${x}" y="0" width="7" height="150" fill="currentColor" opacity=".16"/>`}
  for(let i=0;i<30;i++){s+=`<rect x="${r()*270}" y="${r()*140}" width="${10+r()*16}" height="${8+r()*12}" rx="1" fill="currentColor" opacity=".13"/>`}
  return s+`<circle cx="140" cy="75" r="7" fill="#0d5c8c"/><circle cx="140" cy="75" r="14" fill="#0d5c8c" opacity=".25"/></svg>`;
}
function heroImg(p){
  const list=[...(p.photos||[]).slice(0,1),...autoPhotos(p,"560x300")];
  if(!list.length)return hasStreet(p)?"":`<span class="nostreet">No street address · use the Property Appraiser map</span>`;
  return `<img class="ph" src="${esc(list[0])}" data-alts="${esc(list.slice(1).join("|"))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="nextPhoto(this)">`;
}
let geoBusy=false;
async function geocode(p){
  const q=fullAddr(p);
  try{
    const r=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q="+encodeURIComponent(q),{headers:{"Accept":"application/json"}});
    const j=await r.json(); if(j&&j[0])return{lat:+j[0].lat,lng:+j[0].lon};
    const r2=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q="+encodeURIComponent(cityName(p)+", FL "+zip(p)));
    const j2=await r2.json(); if(j2&&j2[0])return{lat:+j2[0].lat,lng:+j2[0].lon,approx:true};
  }catch(e){console.warn(e)}
  return null;
}
async function geocodeMissing(list,onEach){
  if(geoBusy)return; geoBusy=true;
  try{for(const p of list){
    if(p.lat||p.geoFail)continue;
    if(!hasStreet(p)){await Store.patch(p._id,{geoFail:true});continue}
    const g=await geocode(p);
    await Store.patch(p._id,g?{lat:g.lat,lng:g.lng,geoApprox:!!g.approx}:{geoFail:true});
    onEach&&onEach();
    await new Promise(r=>setTimeout(r,1100)); // OpenStreetMap allows 1 lookup per second
  }}finally{geoBusy=false}
}

/* ---------- links ---------- */
function links(p){
  const pb=p.county==="Palm Beach", bw=p.county==="Broward", md=p.county==="Miami-Dade", L=[]; const q=encodeURIComponent(fullAddr(p));
  if(p.link) L.push(["Property Appraiser",p.link]);
  else if(p.pid&&pb) L.push(["Property Appraiser","https://pbcpao.gov/Property/Details?parcelId="+encodeURIComponent(p.pid)]);
  else if(p.pid&&bw) L.push(["Property Appraiser","https://web.bcpa.net/BcpaClient/#/Record/"+encodeURIComponent(p.pid)]);
  else if(md) L.push(["Property Appraiser","https://www.miamidade.gov/Apps/PA/propertysearch/"]);
  if(pb||bw){
    L.push(["County records (liens, mortgages)",pb?"https://erec.mypalmbeachclerk.com/":"https://officialrecords.broward.org/AcclaimWeb/"]);
    L.push(["Court case docket",pb?"https://appsgp.mypalmbeachclerk.com/eCaseView/":"https://www.browardclerk.org/Web2"]);
    L.push(["Tax Collector",pb?"https://pbctax.publicaccessnow.com/":"https://broward.county-taxes.com/public"]);
    const tax=/tax/i.test(p.channel||"");
    if(/Foreclosure|Tax/.test(p.channel||""))L.push(["Auction calendar","https://"+(pb?"palmbeach":"broward")+(tax?".realtaxdeed.com":".realforeclose.com")]);
  }
  L.push(["Sunbiz (owner LLC)","https://search.sunbiz.org/Inquiry/CorporationSearch/ByName"]);
  L.push(["Zillow","https://www.zillow.com/homes/"+q+"_rb/"]);
  L.push(["Realtor.com","https://www.realtor.com/realestateandhomes-search/"+encodeURIComponent((cityName(p)||"").replace(/\s+/g,"-")+"_FL")]);
  L.push(["Google Maps",`https://www.google.com/maps/search/?api=1&query=${q}`]);
  if(p.lat)L.push(["Street View",`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}`]);
  return L;
}

/* ---------- AI (Anthropic API, called from this browser with your key) ---------- */
async function fileToImage(f){
  if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type))throw new Error(f.name+" is not a JPG, PNG, WebP or GIF.");
  if(f.size>4.5e6)throw new Error(f.name+" is over 4.5 MB. Take a smaller screenshot.");
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(f)});
  return{type:f.type,data};
}
// Repairs the usual AI JSON slips: code fences, text around the JSON, raw line breaks inside
// strings, trailing commas, and an answer that was cut off before the closing brackets.
function repairJSON(t){
  t=String(t||"").replace(/```(?:json)?/gi,"");
  const a=t.indexOf("{"); if(a<0)return null; t=t.slice(a);
  let out="", stack=[], inStr=false, esc=false, end=-1;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(inStr){
      if(esc){out+=c;esc=false;continue}
      if(c==="\\"){out+=c;esc=true;continue}
      if(c==='"'){out+=c;inStr=false;continue}
      if(c==="\n"){out+="\\n";continue} if(c==="\r"){continue} if(c==="\t"){out+="\\t";continue}
      out+=c;continue}
    if(c==='"'){inStr=true;out+=c;continue}
    if(c==="{"||c==="["){stack.push(c==="{"?"}":"]");out+=c;continue}
    if(c==="}"||c==="]"){stack.pop();out+=c;if(!stack.length){end=out.length;break}continue}
    out+=c}
  if(end<0){ // cut off: close what is open
    if(inStr)out+='"';
    out=out.replace(/,\s*$/,"").replace(/,\s*"[^"]*"\s*:?\s*$/,"").replace(/:\s*$/,': null');
    while(stack.length)out+=stack.pop();
  }
  out=out.replace(/,(\s*[}\]])/g,"$1");
  try{return JSON.parse(out)}catch{return null}
}
function parseJSON(t){
  try{return JSON.parse(t)}catch{}
  const f=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(f){try{return JSON.parse(f[1])}catch{}}
  const a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}
  const r=repairJSON(t); if(r&&typeof r==="object")return r;
  throw new Error("The AI answer was not readable. Press the button again.");
}
// Last resort: a quick, cheap pass that rewrites a messy answer as clean JSON.
async function parseOrFix(text,pr){
  try{return parseJSON(text)}catch{}
  pr&&pr.stage&&pr.stage("Tidying the answer…");
  const fixed=await askClaude({model:"claude-haiku-5-5",maxTokens:16000,system:"You convert text into one valid JSON object. Keep every field and every word of content. Output only the JSON, nothing else.",
    messages:[{role:"user",content:"Turn this into one valid JSON object:\n\n"+text.slice(0,60000)}]});
  return parseJSON(fixed);
}
// onText(chars) is called as the answer streams in, so the page can show real progress.
async function askClaude({system,messages,model,maxTokens=4096,onText}){
  if(!S.anthropicKey)throw new Error("Add your Anthropic API key in Settings first.");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":S.anthropicKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:model||S.model,max_tokens:maxTokens,system,messages,stream:true})});
  if(!r.ok){let m=r.status+"";try{m=(await r.json()).error.message}catch{}
    throw new Error(r.status===401?"Your Anthropic API key was rejected. Check it in Settings.":r.status===429?"Rate limit or spend limit hit. Try again in a minute.":r.status===529?"Claude is busy. Try again in a minute.":"AI error: "+m)}
  const reader=r.body.getReader(), dec=new TextDecoder(); let buf="", out="";
  for(;;){const {value,done}=await reader.read(); if(done)break; buf+=dec.decode(value,{stream:true});
    let i; while((i=buf.indexOf("\n\n"))>=0){const ev=buf.slice(0,i); buf=buf.slice(i+2);
      const line=ev.split("\n").find(l=>l.startsWith("data:")); if(!line)continue;
      let d; try{d=JSON.parse(line.slice(5))}catch{continue}
      if(d.type==="content_block_delta"&&d.delta&&d.delta.type==="text_delta"){out+=d.delta.text; onText&&onText(out.length)}
      else if(d.type==="message_delta"&&d.delta&&d.delta.stop_reason)askClaude.stop=d.delta.stop_reason;
      else if(d.type==="error")throw new Error("AI error: "+(d.error&&d.error.message||"stream failed"));}}
  if(!out.trim())throw new Error("The AI sent back an empty answer. Press the button again.");
  return out;
}
// Spinner with a percent. Progress = how much of a typical answer has been written (honest estimate), never 100% until done.
function progressRing(el,{label,expect}){
  if(!el)return{text(){},done(){},fail(){}};
  const t0=Date.now(); let chars=0, pct=0, stage=label, dead=false;
  el.innerHTML=`<span class="prog"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="0 100"/></svg><b class="pp">0%</b></span><span class="plabel"></span>`;
  const fg=el.querySelector(".fg"), pp=el.querySelector(".pp"), pl=el.querySelector(".plabel");
  const draw=()=>{if(dead||!el.isConnected)return;
    const secs=(Date.now()-t0)/1000;
    const warm=Math.min(18,secs*3); // before words arrive: reading the file
    const write=chars?18+76*(1-Math.exp(-chars/expect)):0;
    pct=Math.max(pct,Math.min(97,Math.round(Math.max(warm,write))));
    fg.setAttribute("stroke-dasharray",pct+" 100"); pp.textContent=pct+"%";
    if(stage===null)return;
    pl.textContent=chars?"Writing the "+stage+"…":"Reading the property file…";
  };
  const timer=setInterval(draw,250); draw();
  return{text(n){chars=n},stage(m){stage=null;pl.textContent=m;pp.textContent=pct+"%"},
    done(msg){dead=true;clearInterval(timer);if(!el.isConnected)return;fg.setAttribute("stroke-dasharray","100 100");pp.textContent="100%";pl.textContent=msg||"Done.";},
    fail(msg){dead=true;clearInterval(timer);if(el.isConnected)el.innerHTML=`<span class="small" style="color:var(--bad)">${esc(msg)}</span>`;}};
}
const userMsg=(text,images=[])=>({role:"user",content:[...images.map(im=>({type:"image",source:{type:"base64",media_type:im.type,data:im.data}})),{type:"text",text}]});

function facts(p){const k=calc(p);return `County: ${p.county||"unknown"}
Sale type: ${p.channel||"unknown"}
Sale/listing date: ${p.date||"unknown"} (${daysTo(p.date)??"?"} days away)
Case/MLS #: ${p.case||"unknown"}
Address: ${p.addr}, ${p.city}
Parcel: ${p.pid||"unknown"}
Owner of record: ${p.owner||"unknown"}
Foreclosing party / seller: ${p.plaintiff||"unknown"} (${p.ptype||"unknown"})
Final judgment / opening bid / asking price: ${p.bid??"unknown"}
Appraiser value: ${p.value??"unknown"}   Investor's own comp: ${p.comp??"none"}
Land value: ${p.land??"unknown"}   Building value: ${p.bldg??"unknown"}
Zoning: ${p.zoning||"unknown"}   Type: ${p.type||"unknown"}   Units: ${p.units||"?"}   Sq ft: ${p.sqft||"?"}   Year built: ${p.year||"?"}
Vacant land: ${!!p.vacant}
Tier: ${tierOf(p)||"none"}${p.myTier&&p.tier&&p.myTier!==p.tier?" (we changed it from "+p.tier+")":""}   Watchlist note: ${p.notes||"none"}
Computed: discount to value ${k.discPct!=null?Math.round(k.discPct*100)+"%":"n/a"}, profit at opening bid ${k.profit!=null?Math.round(k.profit):"n/a"}, walk-away max bid ${k.maxBid!=null?Math.round(k.maxBid):"n/a"}, land share ${k.landShare!=null?Math.round(k.landShare*100)+"%":"n/a"}
Partners' notes: ${(p.dnotes||"none").slice(0,6000)}`}

const ATTORNEY=`You are acting as a seasoned Florida real estate title attorney and title examiner (board-certified level) who represents two investors buying at Palm Beach, Broward and Miami-Dade foreclosure and tax deed auctions. The clients know you are an AI, that this is not a legal opinion they can rely on, and that they will still order a title commitment; do not repeat that disclaimer. Speak and reason exactly like their attorney would: direct, specific, decisive, in plain English a beginner understands, citing Florida Statutes and federal law where it matters.

How you examine title:
- Build the chain of title and encumbrance history from the recorded documents provided. Match every mortgage to its satisfaction/release by book/page or instrument number. Note assignments.
- A mortgage foreclosure extinguishes interests JUNIOR to the foreclosed mortgage whose holders were properly named and served. Senior, unsatisfied liens survive. Junior holders NOT named survive (omitted-party problem; may need reforeclosure).
- Interests recorded after the lis pendens are cut off unless the holder intervened within 30 days (F.S. 48.23).
- HOA/condo association foreclosures do NOT extinguish a first mortgage recorded before the association's claim of lien; buyer takes subject to it. Third-party buyers are jointly liable for unpaid assessments (F.S. 720.3085, 718.116).
- United States as junior lienholder (HUD, IRS, SBA, USA): named = lien extinguished but right of redemption (1 year; 120 days for IRS tax liens) under 28 U.S.C. 2410(c). Not named = lien survives.
- Reverse mortgages (HECM) show as a first mortgage plus a HUD/Federal Housing Commissioner second.
- Property taxes always survive. Municipal code enforcement liens, utility liens, special assessments and PACE/clean-energy assessments can survive; require a municipal lien search.
- Tax deeds (F.S. 197.552) extinguish most private liens, but certain government liens survive; title insurers usually require a quiet title action or wait 4 years before insuring. Note the 90-day surplus / notice issues.
- Watch for: estate owners (heirs not named), deceased defendants, bankruptcy stays, defective service, vacated judgments, wrong legal description, unrecorded leases/tenants (Protecting Tenants at Foreclosure), open permits, unsafe structure orders, and sales likely to be cancelled or redeemed.
- Use ONLY the facts and documents provided. Never invent amounts; use null. Say exactly what is missing.
- You ALWAYS have the property file (case number, parcel, sale type, foreclosing party, owner, judgment/opening bid, values, notes). If no recorded documents were pasted, still give a full preliminary opinion from the file: what this kind of sale wipes out and what typically survives, the specific risks this file shows (HOA plaintiff, private lender, estate owner, federal party, tax deed, etc.), and a precise list of which documents to pull next (with the case number and parcel). Set opinion to "Cannot determine from records provided" only for the insurability call, and set titleRisk from what the file shows (do not default to 100).

MANDATORY MORTGAGE CHECK (every examination, no exceptions; the clients said this is a must):
- Fill "mortgageCheck" first. List EVERY mortgage you can see in the records provided (purchase money, refinance, HELOC/line of credit, reverse mortgage/HECM and its HUD second, private/hard-money, seller financing, mortgage modifications and assignments). For each: lender, recording date, book/page or instrument #, amount if shown, position (1st/2nd/etc.), whether a satisfaction/release is recorded (cite it), and what THIS sale does to it (wiped out / SURVIVES / unknown) and why.
- status "CLEAR" only if the records provided cover the current owner AND every owner back to the last arm's-length purchase (and any prior foreclosure that cleared title), and every mortgage found has a recorded satisfaction or is wiped out by this sale. Say exactly what was searched.
- status "OPEN MORTGAGE FOUND" if any mortgage has no recorded satisfaction. If it survives this sale (e.g. HOA/condo sale, tax deed with a government-held mortgage, junior foreclosure, omitted party), it MUST also appear in "survives" with its amount (use null if unknown) and you must say plainly the buyer would take the house subject to that debt.
- status "NOT VERIFIED" whenever no recorded documents were pasted or the records do not cover all the owners above. Never assume there is no mortgage because none was pasted. Then give step-by-step "howToVerify" for THIS county: Palm Beach = erec.mypalmbeachclerk.com Name Search; Broward = officialrecords.broward.org; Miami-Dade = onlineservices.miamidadeclerk.gov/officialrecords. Search each owner name (current owner, prior owners, trusts/estates/LLCs in the chain) with Document Category "Mortgage", then again for "Release/Satisfaction" and "Assignment", plus the parcel number; and read the Final Judgment to see which mortgage is being foreclosed.
- HOA/condo association or other junior-lien sale with status NOT VERIFIED: opinion "Cannot determine from records provided", titleRisk at least 60. HOA/condo sale with an OPEN first mortgage of unknown amount: dealBreaker true. Bank first-mortgage foreclosure: confirm the foreclosed mortgage is the oldest open mortgage; any older open mortgage survives.`;

function titlePrompt(p,records,fj){return `PROPERTY FILE
${facts(p)}

RECORDED DOCUMENTS (pasted from the Clerk's Official Records search; may be messy table text):
${records||"(none pasted yet: give a preliminary opinion from the property file above, and list exactly what to pull)"}

FINAL JUDGMENT / DOCKET / OTHER NOTES:
${fj||"(none pasted)"}

Write your preliminary title examination as ONE JSON object, no other text, exactly this shape:
{"mortgageCheck":{"status":"CLEAR | OPEN MORTGAGE FOUND | NOT VERIFIED",
   "headline":"one plain-English sentence about mortgages on this property",
   "searched":"exactly which records you reviewed (names, parcel, date range) or 'none provided'",
   "mortgages":[{"lender":"...","recorded":"date","ref":"book/page or instrument #","amount":number or null,"position":"1st | 2nd | HELOC | reverse | private | unknown","satisfied":"yes (cite satisfaction) | no | unknown","effect":"wiped out | SURVIVES | unknown","why":"..."}],
   "howToVerify":["exact steps to finish the mortgage search for this county"]},
 "opinion":"Insurable | Insurable with exceptions | Not insurable without curative work | Cannot determine from records provided",
 "summary":"3-5 sentences, your bottom line as their attorney",
 "vesting":"who holds title now and how they got it",
 "plaintiffPosition":"first mortgage | second mortgage | HOA/condo | tax deed | private lender | unknown",
 "chain":["short chronological entries: date - document - parties - status (satisfied / open / assigned)"],
 "survives":[{"item":"lien and holder","amount":number or null,"why":"reason it survives"}],
 "wipedOut":[{"item":"...","why":"..."}],
 "redemption":["any right of redemption and its deadline"],
 "requirements":["curative requirements a title company would list (Schedule B-I style)"],
 "exceptions":["exceptions a policy would take (Schedule B-II style)"],
 "redFlags":["..."],
 "unknowns":["what the records provided do not show and where to get it"],
 "askTitleCompany":["specific questions"],
 "bidAdvice":"what you would tell them to do at the auction, with a dollar ceiling if the facts support one",
 "titleRisk":0-100 where 0 = clean and 100 = do not buy,
 "dealBreaker":true or false}`}

const INSIGHTS=`You are an experienced South Florida real estate investor coaching two beginners who buy at county foreclosure and tax deed auctions and also look at listings. Their strategy is "high-density land banking": houses or small multifamily where the land will be worth more than the building, near job hubs (Downtown West Palm Beach, PBI airport, hospitals, Fort Lauderdale, Miami), on main roads or corner lots, on land zoned for more density. Be specific to the facts given, never generic, never invent numbers. Auction buys are cash, as-is, no inspection, possibly occupied. Cost rules: 8% selling, 8% rehab (0 for vacant land), 1.5% holding, 0.7% doc stamps, $140 clerk fees, 25% target margin. HOA foreclosure: say the first mortgage may survive until the title check proves otherwise.`;
function insPrompt(p){return `PROPERTY FACTS
${facts(p)}
AI title attorney result so far: ${p.ai&&p.ai.result?JSON.stringify({opinion:p.ai.result.opinion,titleRisk:p.ai.result.titleRisk,dealBreaker:p.ai.result.dealBreaker,survives:p.ai.result.survives}):"not run"}
${(p.photos||[]).length?"Photos of the property are attached when available.":""}

Reply with ONLY one JSON object:
{"headline":"one sentence verdict","verdict":"Strong buy | Buy | Maybe | Pass","strategy":"best strategy in a few words",
 "reasons":[{"title":"short label","detail":"1-2 sentences"}],"risks":["..."],"exits":["..."],"verify":["numbers or facts to confirm before bidding"],
 "maxBidSuggestion":number or null,"maxBidWhy":"one sentence"}`}

/* ---------- state ---------- */
let props=[], selId=null, view="cards", bigMap=null, bigLayer=null, detMap=null;
const deb={};
function patchLater(id,field,val){clearTimeout(deb[field]);deb[field]=setTimeout(()=>Store.patch(id,{[field]:val}),700)}

/* ---------- cards / list ---------- */
function card(p,extraTag){
  const k=calc(p), d=daysTo(p.date), n=(p.photos||[]).length;
  const disc=k.discPct!=null?`<span class="disc${k.discPct<0?" neg":""}">${Math.round(Math.abs(k.discPct)*100)}% ${k.discPct>=0?"below":"above"} value</span>`:`<span class="muted">value not found</span>`;
  const tags=[kind(p),p.zoning?"Zoning "+p.zoning:null,k.landShare!=null&&k.landShare>=.5?["Land "+Math.round(k.landShare*100)+"% of value","good"]:null,seenBefore(p)?["Researched before","good"]:null,extraTag].filter(Boolean)
    .map(t=>Array.isArray(t)?`<span class="tag ${t[1]}">${esc(t[0])}</span>`:`<span class="tag">${esc(t)}</span>`).join("");
  const listing=/Listing|Off-market/.test(p.channel||"");
  return `<article class="card${p._id===selId?" sel":""}${tierOf(p)==="EXCELLENT"?" excel":""}" data-id="${esc(p._id)}" tabindex="0" role="button" aria-label="${esc(p.addr)}">
   <div class="hero" style="color:var(--muted)">${miniMap(p)}${heroImg(p)}${tierBtn(p,"tier")}
     ${d!=null?`<span class="days">${d<0?"Past":d===0?"Today":d===1?"Tomorrow":(listing?"":"Sale in ")+d+" days"}</span>`:""}
     <span class="ptype">${esc(p.channel||"")}</span>${n?`<span class="nphotos">${n} photo${n>1?"s":""}</span>`:""}</div>
   <div class="cbody">
     <div class="price"><b>${money(num(p.bid))}</b><span class="vs">${listing?"asking":"opening bid"}<br>value ${moneyK(k.V)}</span></div>
     <div class="caddr">${esc(p.addr)}</div><div class="ccity">${esc(p.city)}${p.county?" · "+esc(p.county):""}</div>${p.pid?`<div class="cpid">Parcel <button class="copy mini" data-copy="${esc(p.pid)}" title="Copy parcel ID">${esc(p.pid)} <span class="ci">Copy</span></button></div>`:""}
     <div class="tags">${p.feedGone?`<span class="tag bad">Not on auction list anymore</span>`:""}${sinceVisit(p).added?`<span class="tag good">NEW since your last visit</span>`:sinceVisit(p).changed?`<span class="tag">Updated</span>`:""}${tags}</div>
     <div class="cfoot">${disc}<span class="pill ${k.cls}">${scoreLabel(k)}</span></div>
   </div></article>`;
}
function filtered(){
  const q=$("#q").value.trim().toLowerCase(), c=$("#fCounty").value, ch=$("#fChannel").value, t=$("#fTier").value, s=$("#fStatus").value, past=$("#fPast").checked, sort=$("#fSort").value;
  const rows=props.filter(p=>(!newOnly||(()=>{const s=sinceVisit(p);return s.added||s.changed||s.gone})())&&(newOnly||past||isUpcoming(p))&&(!c||p.county===c)&&(!ch||p.channel===ch)&&(t?tierOf(p)===t:tierOf(p)!=="SET ASIDE")&&(!s||(p.status||"Watching")===s)
    &&(!q||[p.addr,p.city,p.case,p.plaintiff,p.owner,p.type,p.zoning,p.pid].join(" ").toLowerCase().includes(q)));
  const K=new Map(rows.map(p=>[p._id,calc(p)])); const sc=id=>{const k=K.get(id);return k.ai?k.score:k.pre};
  const by={date:(a,b)=>dkey(a.date).localeCompare(dkey(b.date))||String(a.addr).localeCompare(String(b.addr)),
    score:(a,b)=>sc(b._id)-sc(a._id), tier:(a,b)=>TIERS.findIndex(x=>x[0]===tierOf(a))-TIERS.findIndex(x=>x[0]===tierOf(b))||dkey(a.date).localeCompare(dkey(b.date)), disc:(a,b)=>(K.get(b._id).discPct??-9)-(K.get(a._id).discPct??-9),
    value:(a,b)=>(K.get(b._id).V||0)-(K.get(a._id).V||0), bid:(a,b)=>(num(a.bid)??9e12)-(num(b.bid)??9e12)};
  return rows.sort(by[sort]||by.date);
}
function renderModeBar(){
  const m=Store.mode, el=$("#modeBar");
  const ai=S.anthropicKey?`<span class="pill p-go">AI on</span>`:`<span class="pill p-grey">AI off</span> <button class="link" data-open="settings">add your Anthropic key</button>`;
  const ph=S.googleKey?`<span class="pill p-go">Street View photos on</span>`:`<span class="pill p-grey">Street View photos off</span>`;
  const st=m==="shared"?`<span class="pill p-go">Shared list</span> <span class="muted">signed in as ${esc(Store.user?.email||"")}</span>`
    :m==="login"?`<span class="pill p-warn">Not signed in</span> <button class="link" data-open="settings">sign in to see the shared list</button>`
    :`<span class="pill p-warn">This browser only</span> <button class="link" data-open="settings">connect Supabase to share with your partner</button>`;
  el.innerHTML=`${st} ${ai} ${ph}`;
}
const FILTERS=[["#fCounty","county"],["#fChannel","sale type"],["#fTier","tier"],["#fStatus","status"]];
function activeFilters(){return FILTERS.filter(([id])=>$(id).value).map(([id,n])=>`${n}: ${$(id).value}`)}
function clearFilters(){newOnly=false;renderBotBar();FILTERS.forEach(([id])=>{$(id).value=""});$("#q").value="";if(bigMap)bigMap._fitted=false;renderList()}
function renderList(){
  renderModeBar();
  const rows=filtered(), q=$("#q").value.trim(), act=activeFilters();
  $("#clearF").hidden=!act.length&&!q&&!newOnly;
  const em=$("#emptyMsg");
  if(props.length&&!rows.length&&!q){em.hidden=false;em.innerHTML=`No properties match <b>${esc(act.join(" · "))}</b>${$("#fPast").checked?"":" (upcoming sales only)"}. Your list has ${props.length} properties in total, so try removing one filter. <button class="primary" data-clear="1" style="margin-left:8px">Clear filters</button>`}
  else em.hidden=true;
  $("#listTitle").textContent=newOnly?"What changed since your last visit":q?`Results for “${q}”`:$("#fPast").checked?"All properties":"Upcoming sales";
  const nAside=props.filter(p=>tierOf(p)==="SET ASIDE").length;
  $("#listMsg").innerHTML=props.length?`${rows.length} of ${props.length} properties${nAside&&$("#fTier").value!=="SET ASIDE"?` · ${nAside} set aside <button class="link" data-show-aside="1">show</button>`:""}`:"";
  const up=(act.length||q?rows:props).filter(p=>dkey(p.date)>=today), sfx=act.length||q?" (filtered)":"";
  $("#strip").innerHTML=props.length?[[up.length,"upcoming sales"+sfx],[up.filter(p=>{const d=daysTo(p.date);return d!=null&&d<=7}).length,"selling in the next 7 days"],[up.filter(p=>tierOf(p)==="EXCELLENT").length,"EXCELLENT (we intend to bid)"],[up.filter(p=>p.ai&&p.ai.result).length,"title-checked by AI"],[up.filter(p=>p.status==="Ready to bid").length,"marked Ready to bid"]].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join(""):"";
  if(!props.length){
    $("#cards").innerHTML=`<div class="empty" style="grid-column:1/-1">${Store.mode==="login"?"Sign in (Settings) to see your shared list.":"No properties yet. Press <b>+ Add</b>, or open <b>Settings → Import</b> and load your watchlist file."}</div>`;
    $("#tbody").innerHTML="";renderForYou([]);return}
  if(!rows.length&&q){
    const prof=queryProfile(q); const sim=props.filter(isUpcoming).map(x=>({x,s:similarity(prof,x)})).sort((a,b)=>b.s-a.s).slice(0,6).filter(o=>o.s>=2).map(o=>o.x);
    $("#cards").innerHTML=`<div class="empty" style="grid-column:1/-1">No property on your list matches “${esc(q)}”. <button id="addFromQ" class="primary" style="margin-left:8px">Add it</button>${sim.length?`<p class="small" style="margin-top:14px">Properties on your list most like what you typed:</p>`:""}</div>`+sim.map(p=>card(p,"Similar to your search")).join("");
    $("#addFromQ").onclick=()=>{openAdd();$("#f_addr").value=q.toUpperCase()};
    $("#tbody").innerHTML="";return}
  if(view==="cards"){$("#cards").innerHTML=rows.map(p=>card(p)).join("");const need=rows.filter(p=>!p.lat&&!p.geoFail&&hasStreet(p));if(need.length&&!geoBusy)geocodeMissing(need.slice(0,60),()=>{})}
  else if(view==="table")$("#tbody").innerHTML=rows.map(p=>{const k=calc(p);return `<tr class="item" data-id="${esc(p._id)}" tabindex="0"><td class="num">${esc(p.date)}</td><td><b>${esc(p.addr)}</b><br><span class="muted small">${esc(p.city)}</span>${p.pid?`<br><button class="copy mini" data-copy="${esc(p.pid)}">${esc(p.pid)} <span class="ci">Copy</span></button>`:""}</td><td>${esc(p.county)}</td><td class="small">${esc(p.channel)}<br><span class="muted">${esc(kind(p))}</span></td><td class="r num">${money(num(p.bid))}</td><td class="r num">${money(k.V)}</td><td class="r num">${k.discPct!=null?Math.round(k.discPct*100)+"%":"—"}</td><td>${tierBtn(p)}</td><td><span class="pill ${k.cls}">${scoreLabel(k)}</span></td><td class="small">${esc(p.status||"Watching")}</td></tr>`}).join("");
  else renderBigMap(rows);
  if(view==="cards"&&!rows.length)$("#cards").innerHTML="";
  if(view==="table"&&!rows.length)$("#tbody").innerHTML="";
  renderForYou(rows,!!q);
}
function renderBigMap(rows){
  if(!window.L){$("#mapMsg").textContent="The map library did not load. Check your connection.";return}
  if(!bigMap){bigMap=L.map("bigMap").setView([26.4,-80.15],9);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(bigMap);bigLayer=L.layerGroup().addTo(bigMap)}
  setTimeout(()=>bigMap.invalidateSize(),50);
  bigLayer.clearLayers(); const pts=[];
  for(const p of rows){if(!p.lat)continue;const k=calc(p);
    const m=L.circleMarker([p.lat,p.lng],{radius:8,color:"#fff",weight:2,fillColor:tierColor(tierOf(p)),fillOpacity:.95}).addTo(bigLayer);
    const img=(p.photos||[])[0]||streetViewUrl(p,"300x160");
    m.bindPopup(`<div class="pop">${img?`<img src="${esc(img)}" style="width:220px;height:120px;object-fit:cover;border-radius:6px" referrerpolicy="no-referrer" onerror="this.remove()">`:""}<b>${esc(p.addr)}</b>${esc(p.city)}<br>${money(num(p.bid))} bid · value ${moneyK(k.V)}<br>${esc(p.channel)} · ${esc(p.date||"")}<br><button class="link" data-open-id="${esc(p._id)}">Open property</button></div>`);
    pts.push([p.lat,p.lng])}
  if(pts.length&&!bigMap._fitted){bigMap.fitBounds(pts,{padding:[30,30],maxZoom:13});bigMap._fitted=true}
  const missing=rows.filter(p=>!p.lat&&!p.geoFail);
  $("#mapMsg").textContent=missing.length?`Finding map pins for ${missing.length} more properties (about 1 per second)…`:`${pts.length} properties on the map.${rows.some(p=>p.geoFail)?" Some addresses could not be found; open the property and set the pin with a Google Maps link.":""}`;
  if(missing.length&&!geoBusy)geocodeMissing(missing,()=>{});
}
function renderForYou(pool,searching){
  const liked=props.filter(p=>/Ready to bid|Bid - won|Researching/.test(p.status||"")||tierOf(p)==="EXCELLENT"), passed=props.filter(p=>p.status==="Passed"||/RED|SET ASIDE/.test(tierOf(p)));
  const up=(pool||props).filter(p=>isUpcoming(p)&&!/Passed|Bid/.test(p.status||"")&&!/RED|SET ASIDE/.test(tierOf(p)));
  if(searching||!up.length){$("#forYouSec").hidden=true;return}
  let why, ranked;
  if(liked.length){
    ranked=up.filter(p=>!liked.includes(p)).map(x=>{const k=calc(x);return{x,s:Math.max(...liked.map(l=>similarity(l,x)))-0.6*Math.max(0,...passed.map(l=>similarity(l,x)))+(k.ai?k.score:k.pre)/15}}).sort((a,b)=>b.s-a.s).slice(0,8).map(o=>o.x);
    why=`Based on the ${liked.length} propert${liked.length===1?"y":"ies"} you tagged EXCELLENT or marked Researching / Ready to bid.`;
  }else{
    ranked=up.map(x=>{const k=calc(x);return{x,s:(k.ai?k.score:k.pre)+(k.discPct||0)*20}}).sort((a,b)=>b.s-a.s).slice(0,8).map(o=>o.x);
    why="Best numbers on the list right now. Mark properties Researching or Ready to bid and this row learns what you like.";
  }
  $("#forYouSec").hidden=!ranked.length; $("#forYouWhy").textContent=why; $("#forYou").innerHTML=ranked.map(p=>card(p)).join("");
}

/* ---------- search suggestions ---------- */
let sugIdx=-1;
function suggest(){
  const q=$("#q").value.trim().toLowerCase(), box=$("#sugg");
  if(q.length<2){box.hidden=true;return}
  const hits=props.filter(p=>[p.addr,p.city,p.case,p.plaintiff,p.owner,p.pid].join(" ").toLowerCase().includes(q)).slice(0,8);
  let html=hits.map(p=>`<button data-open-id="${esc(p._id)}"><span class="pill ${tierCls(tierOf(p))}" style="font-size:10.5px">${esc(tierOf(p)||"NEW")}</span><span class="addr"><b>${esc(p.addr)}</b> <span class="muted">${esc(p.city)}</span></span><span class="num small">${money(num(p.bid))}</span></button>`).join("");
  if(!hits.length){const prof=queryProfile(q);const sim=props.filter(isUpcoming).map(x=>({x,s:similarity(prof,x)})).sort((a,b)=>b.s-a.s).slice(0,4).filter(o=>o.s>=2);
    html=`<div class="hint">Not on your list yet. Press <b>+ Add</b> to add it. Similar properties:</div>`+sim.map(o=>`<button data-open-id="${esc(o.x._id)}"><span class="tag">similar</span><span class="addr"><b>${esc(o.x.addr)}</b> <span class="muted">${esc(o.x.city)}</span></span><span class="num small">${money(num(o.x.bid))}</span></button>`).join("")}
  box.innerHTML=html; box.hidden=false; sugIdx=-1;
}

/* ---------- property page ---------- */
function openDetail(id){selId=id;$("#sugg").hidden=true;renderDetail(true);renderList();$("#detail").scrollIntoView({behavior:"smooth",block:"start"})}
let galIdx=0;
function snapshot(p,k){
  const d=daysTo(p.date), items=[];
  if(k.discPct!=null)items.push([`${money(Math.abs(k.disc))} (${Math.round(Math.abs(k.discPct)*100)}%) ${k.discPct>=0?"below":"above"} value`,k.discPct>=.4?"good":k.discPct<0?"bad":""]);
  if(k.landShare!=null)items.push([`Land is ${Math.round(k.landShare*100)}% of the value`,k.landShare>=.5?"good":""]);
  if(p.sqft&&k.bid!=null)items.push([`${money(k.bid/num(p.sqft))}/sq ft`,""]);
  if(p.units)items.push([`${p.units} units`,""]); if(p.year)items.push([`Built ${p.year}`,""]);
  if(dense(p))items.push([`Higher-density zoning (${p.zoning})`,"good"]);
  if(d!=null)items.push([d<0?"Date has passed":`${d} day${d===1?"":"s"} away`,d>=0&&d<=3?"bad":""]);
  if(p.feedGone)items.push(["No longer on the auction list: canceled, redeemed or sold early?","bad"]);
  if(/HOA/.test(p.channel||""))items.push(["HOA sale: a first mortgage may survive","bad"]);
  if(/\bEST\b|estate/i.test((p.owner||"")+" "+(p.notes||"")))items.push(["Owner is an estate: confirm heirs were named",""]);
  return items;
}
function renderGallery(p){
  const list=photoList(p); if(galIdx>=list.length)galIdx=0;
  const own=(p.photos||[]).length;
  const main=list.length?`<img src="${esc(list[galIdx])}" alt="Property photo" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'nophoto',textContent:'This image link did not load. The site may block outside use; save the picture and upload it, or try another link.'}))">${galIdx<own?`<button class="del small" data-delphoto="${galIdx}">Remove</button>`:""}`
    :`<div class="nophoto">No photos yet. On Zillow, Realtor.com or the auction page, right-click a photo → “Copy image address”, then paste it below.${S.googleKey?"":" Add a Google key in Settings for automatic Street View photos."}</div>`;
  return `<div class="gallery"><div class="main">${main}</div><div class="thumbs">${list.map((u,i)=>`<button class="${i===galIdx?"on":""}" data-gal="${i}" aria-label="Photo ${i+1}"><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></button>`).join("")}</div></div>
   <div class="row"><input id="ph_url" class="grow" style="flex:1 1 260px" placeholder="Paste an image link (right-click photo → Copy image address)"><button id="ph_add">Add photo</button>
   <label class="small muted" for="ph_file" style="cursor:pointer;text-decoration:underline">${Store.mode==="shared"?"or upload photos":"Upload needs Supabase"}</label><input type="file" id="ph_file" accept="image/*" multiple hidden ${Store.mode==="shared"?"":"disabled"}></div>`;
}
function renderDetail(fresh){
  const p=props.find(x=>x._id===selId), el=$("#detail");
  if(detMap){detMap.remove();detMap=null}
  if(!p){el.hidden=true;return}
  if(fresh)galIdx=0;
  el.hidden=false;
  const k=calc(p), ai=p.ai&&p.ai.result, ins=p.insights&&p.insights.result, checks=p.checks||{}, sim=similarTo(p,props.filter(isUpcoming));
  const bar=(label,v,max)=>`<div class="bar"><span>${label}</span><div class="track"><div class="fill" style="width:${Math.round(100*v/max)}%"></div></div><span class="num">${Math.round(v)}/${max}</span></div>`;
  const listing=/Listing|Off-market/.test(p.channel||"");
  const q=encodeURIComponent(p.lat?`${p.lat},${p.lng}`:fullAddr(p));
  el.innerHTML=`
  <div class="panel">
   <div class="dhead">
     <div style="min-width:0"><div class="row" style="gap:8px">${tierBtn(p)}${p.myTier&&p.tier&&p.myTier!==p.tier?`<span class="small muted">(imported as ${esc(p.tier)})</span>`:""}<span class="small muted">${esc(p.county)} · ${esc(p.channel)} · ${esc(kind(p))}</span></div>
       <h2 style="margin-top:4px;font-size:22px">${esc(p.addr)}</h2><p class="muted">${esc(p.city)} · ${listing?"Listed":"Sale"} ${esc(p.date||"—")} · ${listing?"MLS":"Case"} <span class="num">${esc(p.case||"—")}</span></p>
       <div class="copybar">${copyBtn(p.pid,"Parcel ID")}${copyBtn(pidDashed(p),"With dashes")}${copyBtn(p.case,listing?"MLS #":"Case #")}${copyBtn(p.addr,"Address")}${copyBtn(p.owner,"Owner")}</div>
       ${p.pid?`<p class="small muted">Tip: county search pages find properties by <b>Parcel ID</b> or <b>case number</b>, not by street address. Click a button to copy, then paste with Cmd+V.</p>`:`<p class="small muted">No parcel ID saved yet. Find it on the Property Appraiser site and add it below.</p>`}</div>
     <div class="row"><label class="small">Status <select id="d_status">${STATUSES.map(s=>`<option${(p.status||"Watching")===s?" selected":""}>${s}</option>`).join("")}</select></label><button id="d_del" class="ghost small">Delete</button><button id="closeDetail" class="ghost">Close</button></div>
   </div>
   ${renderGallery(p)}
   <div class="money">
     <div><span class="small muted">${listing?"Asking price":"Judgment / opening bid"}</span><b>${money(k.bid)}</b></div>
     <div><span class="small muted">Value used</span><b>${money(k.V)}</b><span class="small muted">${num(p.comp)?"your comp":"county appraiser"}</span></div>
     <div><span class="small muted">Discount to value</span><b style="color:${k.discPct>0?"var(--go)":"var(--bad)"}">${k.discPct!=null?Math.round(k.discPct*100)+"%":"—"}</b></div>
     <div><span class="small muted">Profit at that price</span><b style="color:${k.profit>0?"var(--go)":"var(--bad)"}">${money(k.profit)}</b></div>
     <div><span class="small muted">Walk-away max bid</span><b>${money(k.maxBid)}</b><span class="small muted">25% margin</span></div>
   </div>
   <div class="tags">${snapshot(p,k).map(([t,c])=>`<span class="tag ${c}" style="font-size:12.5px;padding:3px 9px">${esc(t)}</span>`).join("")}</div>
  </div>

  <div class="panel">
   <div class="sechead"><h3>Map and aerial</h3><span class="small muted">${p.lat?(p.geoApprox?"Pin is approximate (ZIP center). ":"")+"Drag the pin if it is in the wrong spot.":"Finding the address…"}</span></div>
   <div class="maps"><div class="m" id="detMap"></div><div class="m"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Satellite view" src="https://maps.google.com/maps?q=${q}&t=k&z=19&output=embed"></iframe></div></div>
   <div class="row small"><span class="muted">Wrong spot? Paste a Google Maps link or “lat, lng”:</span><input id="d_pin" style="flex:1 1 220px" placeholder="https://www.google.com/maps/@26.71,-80.05,…"><button id="d_pinSave">Set pin</button></div>
  </div>

  <div class="panel">
   <div class="scorebox">
     <div><div class="bignum">${k.verdict==="NEED NUMBERS"?"—":k.score}</div><div class="small muted">deal score / 100</div></div>
     <div style="min-width:170px"><span class="pill ${k.cls}" style="font-size:16px;padding:4px 12px">${k.verdict}</span><p class="small muted" style="margin-top:6px;max-width:32ch">${esc(k.why||(k.verdict==="GO"?"Numbers and title both look good. Still get the written title report.":k.verdict==="MAYBE"?"Could work. Fix the weak spots first.":""))}</p></div>
     <div class="bars">${bar("Profit margin",k.pts.money,40)}${bar("Title risk (AI)",k.pts.title,35)}${bar("Homework done",k.pts.dd,15)}${bar("Land-bank fit",k.pts.fit,10)}</div>
   </div>
   <p class="small muted">Profit = value − 8% selling − ${p.vacant?"0% rehab (vacant land)":"8% rehab"} − 1.5% holding − 0.7% doc stamps − $140 clerk fees − liens the AI attorney says survive (${money(k.surv)}).</p>
  </div>

  <div class="panel ai">
   <div class="sechead"><h3>Property insights</h3><div class="row"><button class="primary" id="runIns">${ins?"Re-run analysis":"Analyze property"}</button><span id="insStatus" class="small muted"></span></div></div>
   <p class="small muted">A “should we buy this?” write-up from the numbers, your notes and the photos. Paste listing text into the notes first if you have it.</p>
   <div id="insOut">${ins?renderIns(ins,p.insights.at):`<p class="muted small">Not analyzed yet.</p>`}</div>
  </div>

  <div class="panel ai">
   <div class="sechead"><h3>AI title attorney</h3><span class="small muted">Model: ${esc(S.titleModel)}</span></div>
   <p class="small">The attorney already has this property’s file: case <b class="num">${esc(p.case||"—")}</b>, parcel <b class="num">${esc(p.pid||"—")}</b>, ${esc(p.plaintiff||"foreclosing party unknown")}, bid and values. Press <b>Examine title</b> for an opinion right now. For a sharper answer, paste the county records list below (optional).</p>
   <label class="small" for="d_records"><b>Recorded documents — needed for the mortgage check.</b> Search the county records by every owner's name (and the parcel), Document Category <b>Mortgage</b>, then <b>Release/Satisfaction</b>, and paste the results here. Liens, judgments and lis pendens help too.</label>
   <textarea id="d_records" class="mono" rows="5" placeholder="County records → search the owner names and parcel ${esc(p.pid||"")} → copy the results → paste here">${esc(p.records||"")}</textarea>
   <label class="small muted" for="d_fj">Final judgment, docket or notes from the title company (optional)</label>
   <textarea id="d_fj" class="mono" rows="4">${esc(p.fj||"")}</textarea>
   <div class="row"><label class="small muted" for="d_imgs">Screenshots (optional)</label><input type="file" id="d_imgs" accept="image/*" multiple>
     <button class="primary" id="runAi">Examine title</button><span id="aiStatus" class="small muted"></span></div>
   <div id="aiOut">${ai?renderMemo(ai,p.ai.at):`<p class="muted small">No title examination yet.</p>`}</div>
   <h3 style="margin-top:6px">Ask the title attorney</h3>
   <div class="chat" id="chat">${(p.chat||[]).map(m=>`<div class="msg ${m.role}">${esc(m.content)}</div>`).join("")||`<p class="small muted">Ask follow-ups like “If HUD redeems, do I get my money back?” or “What should I bid max?”</p>`}</div>
   <form id="chatForm" class="row"><input id="chatIn" style="flex:1 1 260px" placeholder="Ask about this property’s title…"><button class="primary" type="submit">Ask</button><button type="button" id="chatClear" class="ghost small">Clear</button></form>
  </div>

  ${renderResearch(p)}

  <div class="two">
   <div class="panel"><h3>Property facts</h3>
    <dl class="kv">
     <dt>Foreclosing party / seller</dt><dd>${esc(p.plaintiff||"—")} <span class="muted">(${esc(p.ptype||"?")})</span></dd>
     <dt>Owner</dt><dd>${esc(p.owner||"—")}</dd><dt>Parcel</dt><dd class="num">${esc(p.pid||"—")}</dd>
     <dt>Type</dt><dd>${esc(p.type||"—")}</dd><dt>Zoning</dt><dd>${esc(p.zoning||"—")}</dd>
     <dt>Land / building</dt><dd class="num">${money(num(p.land))} / ${money(num(p.bldg))}</dd>
     ${p.sqft||p.units||p.year?`<dt>Size</dt><dd>${p.sqft?esc(p.sqft)+" sq ft":""}${p.units?" · "+esc(p.units)+" units":""}${p.year?" · built "+esc(p.year):""}</dd>`:""}
     <dt>Note</dt><dd>${esc(p.notes||"—")}</dd>
    </dl>
    <div class="formgrid">
     <label>Your comp value ($)<input id="d_comp" inputmode="decimal" value="${esc(p.comp??"")}" placeholder="what it would really sell for"></label>
     <label>Parcel ID<input id="d_pid" value="${esc(p.pid??"")}" placeholder="e.g. 00414725020003580"></label>
     <label>Bid / asking ($)<input id="d_bid" inputmode="decimal" value="${esc(p.bid??"")}"></label>
     <label style="flex-direction:row;align-items:center;gap:8px;margin-top:18px"><input type="checkbox" id="d_vacant"${p.vacant?" checked":""}> Vacant land (no rehab)</label>
    </div>
   </div>
   <div class="panel"><h3>Research links</h3><div class="links">${links(p).map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>
    <h3>Notes for you and your partner</h3><textarea id="d_notes" rows="6" placeholder="Listing text, drive-by notes, what the title company said, the max bid you agreed on…">${esc(p.dnotes||"")}</textarea>
   </div>
  </div>

  <div class="panel">
   <h3>Due diligence checklist <span class="muted" style="text-transform:none;letter-spacing:0">· ${k.done} of ${CHECKS.length} done</span></h3>
   <div class="checks">${CHECKS.map(([id,t])=>`<label><input type="checkbox" data-check="${id}"${checks[id]?" checked":""}> <span>${t}</span></label>`).join("")}</div>
  </div>

  ${sim.length?`<div class="sec" style="margin-top:4px"><div class="sechead"><h2>Properties like this one</h2><span class="small muted">Same kind of deal: type, area, price range and sale type</span></div><div class="hrow">${sim.map(x=>card(x)).join("")}</div></div>`:""}`;
  wireDetail(p);
  const chat=$("#chat");chat.scrollTop=chat.scrollHeight;
  if(window.L){
    detMap=L.map("detMap",{scrollWheelZoom:false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(detMap);
    if(p.lat){detMap.setView([p.lat,p.lng],p.geoApprox?14:17);
      const mk=L.marker([p.lat,p.lng],{draggable:true,icon:L.divIcon({className:"",html:`<div style="width:18px;height:18px;border-radius:50%;background:${tierColor(tierOf(p))};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,iconSize:[18,18],iconAnchor:[9,9]})}).addTo(detMap);
      mk.on("dragend",()=>{const ll=mk.getLatLng();Store.patch(p._id,{lat:ll.lat,lng:ll.lng,geoApprox:false,geoFail:false});toast("Pin moved.")});
      for(const x of sim)if(x.lat)L.circleMarker([x.lat,x.lng],{radius:6,color:"#fff",weight:1.5,fillColor:tierColor(tierOf(x)),fillOpacity:.85}).bindTooltip(x.addr).addTo(detMap);
    }else{detMap.setView([26.4,-80.15],9);if(!p.geoFail)geocode(p).then(g=>Store.patch(p._id,g?{lat:g.lat,lng:g.lng,geoApprox:!!g.approx}:{geoFail:true}))}
  }
}
function renderIns(a,at){
  const L_=(arr,f)=>{if(arr!=null&&!Array.isArray(arr))arr=[arr];return arr&&arr.length?`<ul>${arr.map(f).join("")}</ul>`:`<p class="muted small">None.</p>`};
  const vc={"Strong buy":"p-go","Buy":"p-go","Maybe":"p-warn","Pass":"p-bad"}[a.verdict]||"p-grey";
  return `<div class="two" style="margin-top:6px">
   <div><p style="font-size:16px;font-weight:600">${esc(a.headline||"")}</p><p class="small" style="margin-top:6px"><span class="pill ${vc}">${esc(a.verdict||"—")}</span> <span class="muted">· best strategy: <b>${esc(a.strategy||"—")}</b>${at?" · "+esc(new Date(at).toLocaleDateString()):""}</span></p>
    <h3 style="margin-top:12px">Top reasons</h3>${L_(a.reasons,x=>`<li><b>${esc(x.title)}:</b> ${esc(x.detail)}</li>`)}
    <h3 style="margin-top:12px">Exit options</h3>${L_(a.exits,x=>`<li>${esc(x)}</li>`)}</div>
   <div><h3>Risks</h3>${L_(a.risks,x=>`<li>${esc(x)}</li>`)}
    <h3 style="margin-top:12px">Check before you bid</h3>${L_(a.verify,x=>`<li>${esc(x)}</li>`)}
    ${a.maxBidSuggestion!=null?`<h3 style="margin-top:12px">Suggested ceiling</h3><p><b class="num">${money(num(a.maxBidSuggestion))}</b> <span class="small muted">${esc(a.maxBidWhy||"")}</span></p>`:""}</div></div>`;
}
function renderMemo(a,at){
  const L_=(arr,f)=>{if(arr!=null&&!Array.isArray(arr))arr=[arr];return arr&&arr.length?`<ul>${arr.map(f).join("")}</ul>`:`<p class="muted small">None.</p>`};
  const oc=/^Insurable$/.test(a.opinion||"")?"p-go":/with exceptions/.test(a.opinion||"")?"p-warn":/Not insurable/.test(a.opinion||"")?"p-bad":"p-grey";
  const mc=a.mortgageCheck||null, ms=mortStatus(a);
  const mcls=ms==="CLEAR"?"p-go":ms==="OPEN"?"p-bad":"p-warn";
  const mtxt=ms==="CLEAR"?"MORTGAGES: CLEAR":ms==="OPEN"?"MORTGAGE: OPEN MORTGAGE FOUND":"MORTGAGES: NOT VERIFIED";
  const mbox=`<div class="panel" style="border-width:2px;margin:0 0 12px">
     <div class="row"><span class="pill ${mcls}" style="font-size:15px">${mtxt}</span>${mc&&mc.headline?`<b>${esc(mc.headline)}</b>`:""}</div>
     ${!mc?`<p class="small">This opinion was made before the mortgage check was added. Press <b>Examine title</b> again.</p>`:""}
     ${mc&&mc.mortgages&&mc.mortgages.length?`<ul>${mc.mortgages.map(m=>`<li><b>${esc(m.lender||"Lender ?")}</b>${m.recorded?" · recorded "+esc(m.recorded):""}${m.ref?" · "+esc(m.ref):""}${num(m.amount)?" · "+money(num(m.amount)):""}${m.position?" · "+esc(m.position):""} — satisfied: <b>${esc(m.satisfied||"unknown")}</b> — this sale: <b style="color:${/SURVIV/i.test(m.effect||"")?"var(--bad)":"inherit"}">${esc(m.effect||"unknown")}</b>${m.why?`<br><span class="small muted">${esc(m.why)}</span>`:""}</li>`).join("")}</ul>`:mc?`<p class="small">No mortgages found in the records provided.</p>`:""}
     ${mc&&mc.searched?`<p class="small muted">Searched: ${esc(mc.searched)}</p>`:""}
     ${mc&&ms!=="CLEAR"&&mc.howToVerify&&mc.howToVerify.length?`<p class="small"><b>Finish the mortgage search:</b></p><ol class="small">${[].concat(mc.howToVerify).map(x=>`<li>${esc(x)}</li>`).join("")}</ol><p class="small muted">Paste what you find into “Recorded documents” and press Examine title again.</p>`:""}
   </div>`;
  return `<div class="memo">${mbox}
   <div class="row"><span class="pill ${oc}" style="font-size:14px">${esc(a.opinion||"—")}</span><span class="small muted">Title risk ${esc(a.titleRisk)}/100 · foreclosing party: ${esc(a.plaintiffPosition||"unknown")}${a.dealBreaker?" · <b style='color:var(--bad)'>DEAL-BREAKER</b>":""}${at?" · "+esc(new Date(at).toLocaleString()):""}</span></div>
   <p class="opinion">${esc(a.summary||"")}</p>
   ${a.bidAdvice?`<p><b>At the auction:</b> ${esc(a.bidAdvice)}</p>`:""}
   <div class="two">
    <div><h3>Vesting</h3><p class="small">${esc(a.vesting||"—")}</p>
     <h3 style="margin-top:12px">Survives the sale (you would owe it)</h3>${L_(a.survives,x=>`<li><b>${esc(x.item)}</b>${num(x.amount)?" — "+money(num(x.amount)):""}. ${esc(x.why||"")}</li>`)}
     <h3 style="margin-top:12px">Wiped out by the sale</h3>${L_(a.wipedOut,x=>`<li>${esc(x.item)}. <span class="muted">${esc(x.why||"")}</span></li>`)}
     <h3 style="margin-top:12px">Redemption rights</h3>${L_(a.redemption,x=>`<li>${esc(x)}</li>`)}</div>
    <div><h3>Red flags</h3>${L_(a.redFlags,x=>`<li>${esc(x)}</li>`)}
     <h3 style="margin-top:12px">Requirements to cure (B-I)</h3>${L_(a.requirements,x=>`<li>${esc(x)}</li>`)}
     <h3 style="margin-top:12px">Policy exceptions (B-II)</h3>${L_(a.exceptions,x=>`<li>${esc(x)}</li>`)}
     <h3 style="margin-top:12px">Missing from the records</h3>${L_(a.unknowns,x=>`<li>${esc(x)}</li>`)}
     <h3 style="margin-top:12px">Ask the title company</h3>${L_(a.askTitleCompany,x=>`<li>${esc(x)}</li>`)}</div>
   </div>
   ${a.chain&&a.chain.length?`<details><summary class="small">Chain of title (${a.chain.length} entries)</summary>${L_(a.chain,x=>`<li class="small">${esc(x)}</li>`)}</details>`:""}
  </div>`;
}
function wireDetail(p){
  const id=p._id;
  $("#closeDetail").onclick=()=>{selId=null;renderDetail();renderList()};
  $("#d_del").onclick=async()=>{if($("#d_del").dataset.armed){await Store.del(id);selId=null;toast("Deleted.")}else{$("#d_del").dataset.armed=1;$("#d_del").textContent="Click again to delete";setTimeout(()=>{const b=$("#d_del");if(b){delete b.dataset.armed;b.textContent="Delete"}},3000)}};
  $("#d_status").onchange=e=>Store.patch(id,{status:e.target.value});
  $("#d_comp").onchange=e=>Store.patch(id,{comp:num(e.target.value)});
  $("#d_bid").onchange=e=>Store.patch(id,{bid:num(e.target.value)});
  $("#d_pid").onchange=e=>Store.patch(id,{pid:e.target.value.replace(/[^0-9A-Za-z]/g,"")});
  $("#d_vacant").onchange=e=>Store.patch(id,{vacant:e.target.checked});
  $("#d_notes").oninput=e=>patchLater(id,"dnotes",e.target.value);
  $("#d_records").oninput=e=>patchLater(id,"records",e.target.value.slice(0,80000));
  $("#d_fj").oninput=e=>patchLater(id,"fj",e.target.value.slice(0,40000));
  document.querySelectorAll("[data-check]").forEach(cb=>cb.onchange=()=>{const c={...(p.checks||{})};c[cb.dataset.check]=cb.checked;Store.patch(id,{checks:c})});
  document.querySelectorAll("[data-gal]").forEach(b=>b.onclick=e=>{e.stopPropagation();galIdx=+b.dataset.gal;renderDetail()});
  document.querySelectorAll("[data-delphoto]").forEach(b=>b.onclick=()=>{const ph=[...(p.photos||[])];ph.splice(+b.dataset.delphoto,1);galIdx=0;Store.patch(id,{photos:ph})});
  $("#ph_add").onclick=()=>{const u=$("#ph_url").value.trim();if(!/^https?:\/\/\S+$/i.test(u)){toast("Paste a full image link that starts with http.");return}Store.patch(id,{photos:[...(p.photos||[]),u]});toast("Photo added.")};
  $("#ph_url").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("#ph_add").click()}};
  $("#ph_file").onchange=async e=>{const files=[...e.target.files];if(!files.length)return;toast("Uploading…");const urls=[];
    try{for(const f of files)urls.push(await Store.upload(id,f));await Store.patch(id,{photos:[...(p.photos||[]),...urls]});toast("Uploaded.")}catch(err){toast(err.message||"Upload failed.")}};
  $("#d_pinSave").onclick=()=>{const v=$("#d_pin").value;const m=v.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||v.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)||v.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if(!m){toast("Could not find coordinates in that. Paste a Google Maps link with @lat,lng or type “26.71, -80.05”.");return}
    Store.patch(id,{lat:+m[1],lng:+m[2],geoApprox:false,geoFail:false});toast("Pin set.")};
  $("#runAi").onclick=()=>runTitle(p); $("#runIns").onclick=()=>runIns(p);
  document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>openDetail(b.dataset.goto));
  $("#r_docs").onchange=async e=>{const files=[...e.target.files];if(!files.length)return;toast("Uploading…");const d=await uploadDocs(id,files);if(!d.length){toast("Upload failed.");return}
    await Store.patch(id,{docs:[...((Store.get(id)||{}).docs||[]),...d],history:withHist(id,{type:"research",title:"Documents added",text:d.map(x=>x.name).join("\n"),docs:d})});toast("Saved to the research file.")};
  $("#r_add").onclick=async()=>{const text=$("#r_text").value.trim();if(!text)return;await Store.patch(id,{history:withHist(id,{type:"research",title:$("#r_title").value.trim()||"Note",text})});toast("Note saved.")};
  $("#chatForm").onsubmit=e=>{e.preventDefault();runChat(p)};
  $("#chatClear").onclick=()=>Store.patch(id,{chat:[]});
}

/* ---------- AI actions ---------- */
let aiRunning=false;
async function runTitle(p){
  const records=$("#d_records").value.trim(), fj=$("#d_fj").value.trim(), files=[...$("#d_imgs").files];
  const btn=$("#runAi");btn.disabled=true;aiRunning=true;
  const pr=progressRing($("#aiStatus"),{label:"title opinion",expect:3500});
  try{
    const imgs=[];for(const f of files.slice(0,8))imgs.push(await fileToImage(f));
    const text=await askClaude({system:ATTORNEY,model:S.titleModel,maxTokens:16000,onText:n=>pr.text(n),messages:[userMsg(titlePrompt(p,records.slice(0,80000),fj.slice(0,40000)),imgs)]});
    const res=await parseOrFix(text,pr);
    pr.done("Title opinion ready."); res.titleRisk=Math.max(0,Math.min(100,num(res.titleRisk)??100));
    aiRunning=false;
    const saved=await uploadDocs(p._id,files.slice(0,8),"Title exam");
    await Store.patch(p._id,{records:records.slice(0,80000),fj:fj.slice(0,40000),ai:{result:res,at:new Date().toISOString()},
      docs:[...((Store.get(p._id)||{}).docs||[]),...saved],
      history:withHist(p._id,{type:"title",result:res,records:records.slice(0,20000),fj:fj.slice(0,8000),docs:saved})});
    toast("Title examination done.");
  }catch(e){aiRunning=false;pr.fail(e.message||"Something went wrong.")}finally{aiRunning=false;const b=$("#runAi");if(b)b.disabled=false}
}
async function urlToImage(u){ // only works when the photo host allows it; otherwise skipped
  try{const r=await fetch(u,{mode:"cors"});if(!r.ok)return null;const b=await r.blob();if(!/^image\//.test(b.type)||b.size>4.5e6)return null;return await fileToImage(new File([b],"photo",{type:b.type}))}catch{return null}
}
async function runIns(p){
  const btn=$("#runIns");btn.disabled=true;aiRunning=true;
  const pr=progressRing($("#insStatus"),{label:"analysis",expect:1800});
  try{
    const imgs=[];for(const u of (p.photos||[]).slice(0,3)){const im=await urlToImage(u);if(im)imgs.push(im)}
    const res=await parseOrFix(await askClaude({system:INSIGHTS,messages:[userMsg(insPrompt(p),imgs)],maxTokens:8000,onText:n=>pr.text(n)}),pr);
    pr.done("Analysis ready.");
    aiRunning=false; await Store.patch(p._id,{insights:{result:res,at:new Date().toISOString()},history:withHist(p._id,{type:"analysis",result:res})}); toast("Analysis done.");
  }catch(e){aiRunning=false;pr.fail(e.message)}finally{aiRunning=false;const b=$("#runIns");if(b)b.disabled=false}
}
async function runChat(p){
  const q=$("#chatIn").value.trim(); if(!q)return;
  const hist=[...(p.chat||[])].slice(-16); hist.push({role:"user",content:q});
  $("#chat").insertAdjacentHTML("beforeend",`<div class="msg user">${esc(q)}</div><div class="msg assistant" id="pending">Thinking…</div>`);$("#chatIn").value="";$("#chat").scrollTop=1e9;
  aiRunning=true;
  try{
    const ctx=`PROPERTY FILE\n${facts(p)}\n\nYOUR TITLE EXAMINATION SO FAR:\n${p.ai&&p.ai.result?JSON.stringify(p.ai.result).slice(0,12000):"(not run yet)"}\n\nRECORDS THEY PASTED:\n${(p.records||"(none)").slice(0,30000)}\n\nFINAL JUDGMENT / NOTES:\n${(p.fj||"(none)").slice(0,10000)}\n\nAnswer the clients' questions about this property as their title attorney. Be direct and practical. Plain text, no markdown headings, short paragraphs.`;
    const msgs=[{role:"user",content:ctx},{role:"assistant",content:"Understood. I have the file. What would you like to know?"},...hist.map(m=>({role:m.role,content:m.content}))];
    const ans=await askClaude({system:ATTORNEY,model:S.titleModel,messages:msgs,maxTokens:1500});
    hist.push({role:"assistant",content:ans.trim()});
    aiRunning=false; await Store.patch(p._id,{chat:hist.slice(-20),history:withHist(p._id,{type:"qa",q,a:ans.trim()})});
  }catch(e){aiRunning=false;const el=$("#pending");if(el){el.textContent=e.message;el.removeAttribute("id")}}
}

/* ---------- add ---------- */
function openAdd(){
  const el=$("#addPanel"); el.hidden=false;
  el.innerHTML=`<div class="sechead"><h2>Add a property</h2><button id="addCancel" class="ghost">Cancel</button></div>
   <p class="small muted">Fastest: paste the listing description or auction page text and/or attach screenshots, then press <b>Fill in with AI</b>. Check the fields and save.</p>
   <textarea id="a_paste" rows="4" placeholder="Paste listing text, auction details, or the appraiser page here"></textarea>
   <div class="row"><label class="small muted" for="a_imgs">Screenshots</label><input type="file" id="a_imgs" accept="image/*" multiple><button id="a_fill">Fill in with AI</button><span id="a_status" class="small muted"></span></div>
   <form id="addForm" class="formgrid">
    <label>County<select id="f_county"><option>Palm Beach</option><option>Broward</option><option>Miami-Dade</option><option>Other</option></select></label>
    <label>Sale type<select id="f_channel"><option>Foreclosure</option><option>Foreclosure (HOA)</option><option>Tax Deed</option><option>Listing (MLS)</option><option>Off-market</option></select></label>
    <label>Sale / listing date (MM/DD/YYYY)<input id="f_date"></label>
    <label>Case # or MLS #<input id="f_case"></label>
    <label>Address<input id="f_addr" required></label>
    <label>City and ZIP<input id="f_city" placeholder="MIAMI 33142"></label>
    <label>Parcel / folio<input id="f_pid"></label>
    <label>Property type<input id="f_type" placeholder="Single Family, Duplex, Vacant"></label>
    <label>Foreclosing party / seller<input id="f_plaintiff"></label>
    <label>Party type<select id="f_ptype"><option>Bank</option><option>HOA</option><option>Private lender</option><option>Tax deed</option><option>Seller</option><option>Unknown</option></select></label>
    <label>Judgment / opening bid / asking ($)<input id="f_bid" inputmode="decimal"></label>
    <label>Appraiser or market value ($)<input id="f_value" inputmode="decimal"></label>
    <label>Land value ($)<input id="f_land" inputmode="decimal"></label>
    <label>Building value ($)<input id="f_bldg" inputmode="decimal"></label>
    <label>Zoning<input id="f_zoning"></label>
    <label>Units<input id="f_units" inputmode="numeric"></label>
    <label>Living area (sq ft)<input id="f_sqft" inputmode="numeric"></label>
    <label>Year built<input id="f_year" inputmode="numeric"></label>
    <label style="grid-column:1/-1">Photo links (one per line)<textarea id="f_photos" rows="2" placeholder="https://photos.zillowstatic.com/…"></textarea></label>
    <label style="grid-column:1/-1">Description / notes<textarea id="f_notes" rows="3"></textarea></label>
    <div class="row" style="align-self:end"><button class="primary" type="submit">Save property</button></div>
   </form>`;
  el.scrollIntoView({behavior:"smooth",block:"start"});
  $("#addCancel").onclick=()=>{el.hidden=true};
  $("#a_fill").onclick=fillWithAI;
  $("#addForm").onsubmit=saveNew;
}
async function fillWithAI(){
  const txt=$("#a_paste").value.trim(), files=[...$("#a_imgs").files];
  if(!txt&&!files.length){$("#a_status").textContent="Paste the listing or auction text first.";return}
  $("#a_fill").disabled=true;$("#a_status").textContent="Reading…";
  try{
    const imgs=[];for(const f of files.slice(0,6))imgs.push(await fileToImage(f));
    const r=parseJSON(await askClaude({model:"claude-haiku-5-5",maxTokens:1500,system:"You extract real estate facts into JSON. Never guess numbers; use null when a value is not stated.",
      messages:[userMsg(`Extract the property facts from this South Florida listing / auction / appraiser text and any screenshots. Reply with ONLY a JSON object with keys: county ("Palm Beach"|"Broward"|"Miami-Dade"|"Other"), channel ("Foreclosure"|"Foreclosure (HOA)"|"Tax Deed"|"Listing (MLS)"|"Off-market"), date ("MM/DD/YYYY"), case (case or MLS number), addr, city ("CITY ZIP" uppercase), pid, type, plaintiff (foreclosing party, or seller/listing agent), ptype ("Bank"|"HOA"|"Private lender"|"Tax deed"|"Seller"|"Unknown"), bid (number: judgment, opening bid or asking price), value (number or null), land, bldg, zoning, units, sqft, year, notes (2-3 sentences: key selling points, motivation, redevelopment potential, problems).\n\nTEXT:\n${txt.slice(0,30000)}`,imgs)]}));
    const set=(id,v)=>{if(v!=null&&v!=="")$("#"+id).value=v};
    const sel=(id,v)=>{const s=$("#"+id);if(v&&[...s.options].some(o=>o.value===v))s.value=v};
    sel("f_county",r.county);sel("f_channel",r.channel);sel("f_ptype",r.ptype);
    ["date","case","addr","city","pid","type","plaintiff","bid","value","land","bldg","zoning","units","sqft","year","notes"].forEach(k=>set("f_"+k,r[k]));
    $("#a_status").textContent="Filled in. Check the fields, then save.";
  }catch(e){$("#a_status").textContent=e.message}finally{$("#a_fill").disabled=false}
}
async function saveNew(e){
  e.preventDefault();
  const g=id=>$("#"+id).value.trim();
  const id=safeId(g("f_case"))||newId();
  if(Store.get(id)&&!confirmOverwrite(id))return;
  const doc={county:g("f_county"),channel:g("f_channel"),date:g("f_date"),case:g("f_case"),addr:g("f_addr").toUpperCase(),city:g("f_city").toUpperCase(),pid:g("f_pid"),type:g("f_type"),
    plaintiff:g("f_plaintiff"),ptype:g("f_ptype"),bid:num(g("f_bid")),value:num(g("f_value")),land:num(g("f_land")),bldg:num(g("f_bldg")),zoning:g("f_zoning"),units:num(g("f_units")),sqft:num(g("f_sqft")),year:num(g("f_year")),
    photos:g("f_photos").split(/\s+/).filter(u=>/^https?:\/\//.test(u)),notes:g("f_notes"),vacant:/vacant|land/i.test(g("f_type")),tier:"",status:"Watching",source:"Added by hand",updatedAt:new Date().toISOString()};
  Object.keys(doc).forEach(k=>{if(doc[k]==null||doc[k]===""||(Array.isArray(doc[k])&&!doc[k].length))delete doc[k]});
  try{await Store.put(id,doc);$("#addPanel").hidden=true;toast("Saved.");$("#q").value="";openDetail(id)}catch{}
}
let overwriteArmed=null;
function confirmOverwrite(id){if(overwriteArmed===id){overwriteArmed=null;return true}overwriteArmed=id;toast("That case number is already on your list. Press Save again to replace it.");return false}

/* ---------- settings ---------- */
function openSettings(){
  const el=$("#setPanel"); el.hidden=false;
  el.innerHTML=`<div class="sechead"><h2>Settings</h2><button id="setClose" class="ghost">Close</button></div>
  <p class="small muted">Keys are saved in this browser only. They are never put in the website code or the shared list. Each partner enters their own on their own device.</p>
  <div class="two">
   <div class="formgrid" style="grid-template-columns:1fr">
    <h3>AI (Anthropic)</h3>
    <label>Anthropic API key <input id="s_ak" type="password" value="${esc(S.anthropicKey)}" placeholder="sk-ant-…" autocomplete="off"></label>
    <label>Model for insights<select id="s_model">${MODELS.map(([v,t])=>`<option value="${v}"${S.model===v?" selected":""}>${t}</option>`).join("")}</select></label>
    <label>Model for the title attorney<select id="s_tmodel">${MODELS.map(([v,t])=>`<option value="${v}"${S.titleModel===v?" selected":""}>${t}</option>`).join("")}</select></label>
    <p class="small muted">Get a key at console.anthropic.com → API keys. Set a monthly spend limit there (for example $10).</p>
    <h3>Photos (optional)</h3>
    <label>Google Maps API key (Street View photos)<input id="s_gk" type="password" value="${esc(S.googleKey)}" placeholder="AIza…" autocomplete="off"></label>
    <p class="small muted">Turns on automatic Street View photos on every card. Restrict the key to your github.io address in Google Cloud.</p>
   </div>
   <div class="formgrid" style="grid-template-columns:1fr">
    <h3>Shared list (Supabase)</h3>
    <label>Supabase project URL<input id="s_su" value="${esc(S.sbUrl)}" placeholder="https://xxxx.supabase.co"></label>
    <label>Supabase anon public key<input id="s_sk" type="password" value="${esc(S.sbKey)}" autocomplete="off"></label>
    <div id="authBox"></div>
    <h3>Import / export</h3>
    <div class="row"><label class="small" for="s_imp" style="cursor:pointer;text-decoration:underline">Import a .json file</label><input id="s_imp" type="file" accept=".json,application/json"><button id="s_exp">Export everything</button></div>
    ${Store.mode==="shared"&&Object.keys(LS.get("dc_props",{})).length?`<button id="s_push">Copy this browser’s ${Object.keys(LS.get("dc_props",{})).length} local properties into the shared list</button>`:""}
   </div>
  </div>
  <div class="row"><button class="primary" id="s_save">Save settings</button><span class="small muted" id="s_msg"></span></div>`;
  const ab=$("#authBox");
  if(Store.mode==="shared")ab.innerHTML=`<p class="small">Signed in as <b>${esc(Store.user.email)}</b>. <button class="link" id="s_out">Sign out</button></p>`;
  else if(Store.mode==="login")ab.innerHTML=`<div class="row"><input id="s_email" type="email" placeholder="your email" style="flex:1 1 200px"><button id="s_login">Email me a sign-in link</button></div>`;
  $("#setClose").onclick=()=>{el.hidden=true};
  $("#s_save").onclick=()=>{const before=S.sbUrl+S.sbKey;S.anthropicKey=$("#s_ak").value.trim();S.model=$("#s_model").value;S.titleModel=$("#s_tmodel").value;S.googleKey=$("#s_gk").value.trim();S.sbUrl=$("#s_su").value.trim().replace(/\/$/,"");S.sbKey=$("#s_sk").value.trim();saveSettings();
    if(before!==S.sbUrl+S.sbKey){location.reload();return}toast("Settings saved.");el.hidden=true;renderList();if(selId)renderDetail()};
  const out=$("#s_out");if(out)out.onclick=async()=>{await Store.sb.auth.signOut();location.reload()};
  const li=$("#s_login");if(li)li.onclick=async()=>{const email=$("#s_email").value.trim();if(!email)return;
    const {error}=await Store.sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
    $("#s_msg").textContent=error?error.message:"Check your email and click the link. It opens this site signed in."};
  $("#s_exp").onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),properties:Store.all().map(p=>({...p,id:p._id,_id:undefined}))},null,1)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="deal-checker-export.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
  $("#s_imp").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    try{const j=JSON.parse(await f.text());const arr=Array.isArray(j)?j:j.properties||[];
      const res=await mergeFeed(arr);$("#s_msg").textContent=`Imported: ${res.added} new, ${res.changed} updated. Your tags, notes, comps and checklists were kept.`}
    catch(err){$("#s_msg").textContent="That file could not be read: "+err.message}};
  const push=$("#s_push");if(push)push.onclick=async()=>{const loc=LS.get("dc_props",{});let n=0;for(const [id,d] of Object.entries(loc)){if(Store.get(id))continue;await Store.sb.from("properties").upsert({id,data:d});Store.cache[id]=d;n++}Store.emit();$("#s_msg").textContent=`Copied ${n} properties.`};
  el.scrollIntoView({behavior:"smooth",block:"start"});
}

/* ---------- events & boot ---------- */
function closeTierMenu(){const m=document.getElementById("tierMenu");if(m)m.remove()}
function openTierMenu(btn){
  closeTierMenu(); const p=Store.get(btn.dataset.tierId); if(!p)return;
  const cur=tierOf(p), m=document.createElement("div"); m.id="tierMenu"; m.className="tiermenu"; m.setAttribute("role","menu");
  m.innerHTML=`<div class="small muted" style="padding:4px 8px">Change tag</div>`+TIERS.map(([t,d])=>`<button data-set-tier="${t}" data-for="${esc(p._id)}" class="${t===cur?"on":""}"><span class="pill ${tierCls(t)}">${t}</span><span class="small">${d}</span></button>`).join("")
    +(p.myTier&&p.tier?`<button data-set-tier="" data-for="${esc(p._id)}"><span class="small muted">Undo: go back to the imported tag (${esc(p.tier)})</span></button>`:"");
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect(), w=m.offsetWidth, h=m.offsetHeight;
  m.style.left=(window.scrollX+Math.max(8,Math.min(window.innerWidth-w-8,r.left)))+"px";
  m.style.top=(window.scrollY+(r.bottom+h+8<window.innerHeight?r.bottom+4:Math.max(8,r.top-h-4)))+"px";
}
async function copyText(t){
  try{await navigator.clipboard.writeText(t);toast("Copied: "+t)}
  catch{const ta=document.createElement("textarea");ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast("Copied: "+t)}catch{toast("Select and copy: "+t)}ta.remove()}
}
document.addEventListener("click",e=>{
  const tm=e.target.closest("[data-set-tier]");if(tm){e.stopPropagation();const id=tm.dataset.for,v=tm.dataset.setTier;closeTierMenu();Store.patch(id,{myTier:v||null});toast(v?`Tagged ${v}.`:"Back to the imported tag.");return}
  const tb=e.target.closest("[data-tier-id]");if(tb){e.preventDefault();e.stopPropagation();openTierMenu(tb);return}
  if(!e.target.closest("#tierMenu"))closeTierMenu();
  if(e.target.closest("[data-show-aside]")){$("#fTier").value="SET ASIDE";renderList();return}
  if(e.target.closest("[data-clear]")){clearFilters();return}
  const cp=e.target.closest("[data-copy]");if(cp){e.preventDefault();e.stopPropagation();copyText(cp.dataset.copy);return}
  const o=e.target.closest("[data-open-id]");if(o){openDetail(o.dataset.openId);return}
  const s=e.target.closest("[data-open]");if(s&&s.dataset.open==="settings"){openSettings();return}
  const c=e.target.closest(".card,tr.item");if(c&&c.dataset.id&&!e.target.closest("a,button[data-gal]")){openDetail(c.dataset.id);return}
  if(!e.target.closest(".search"))$("#sugg").hidden=true;
});
document.addEventListener("keydown",e=>{if(e.key==="Enter"){const c=e.target.closest(".card,tr.item");if(c&&c.dataset.id)openDetail(c.dataset.id)}});
["#fCounty","#fChannel","#fTier","#fStatus","#fPast","#fSort"].forEach(s=>$(s).addEventListener("input",()=>{if(bigMap)bigMap._fitted=false;renderList()}));
$("#fStatus").innerHTML+=STATUSES.map(s=>`<option>${s}</option>`).join("");
function setView(v){view=v;["Cards","Map","Table"].forEach(n=>$("#v"+n).classList.toggle("on",n.toLowerCase()===v));$("#cards").hidden=v!=="cards";$("#mapWrap").hidden=v!=="map";$("#tablewrap").hidden=v!=="table";LS.set("dc_view",v);renderList()}
$("#vCards").onclick=()=>setView("cards");$("#vMap").onclick=()=>setView("map");$("#vTable").onclick=()=>setView("table");
$("#addBtn").onclick=openAdd; $("#setBtn").onclick=openSettings;
$("#q").addEventListener("input",()=>{suggest();renderList()});
$("#q").addEventListener("focus",suggest);
$("#q").addEventListener("keydown",e=>{const items=[...$("#sugg").querySelectorAll("button")];
  if(e.key==="ArrowDown"){e.preventDefault();sugIdx=Math.min(items.length-1,sugIdx+1)}else if(e.key==="ArrowUp"){e.preventDefault();sugIdx=Math.max(-1,sugIdx-1)}
  else if(e.key==="Enter"){e.preventDefault();if(sugIdx>=0&&items[sugIdx])openDetail(items[sugIdx].dataset.openId);$("#sugg").hidden=true;return}
  else if(e.key==="Escape"){$("#sugg").hidden=true;return}else return;
  items.forEach((b,i)=>b.classList.toggle("on",i===sugIdx))});

Store.onChange(()=>{
  renderBotBar();
  props=Store.all(); CITIES=[...new Set(props.map(cityName).filter(Boolean))];
  renderList();
  const ae=document.activeElement, typing=ae&&$("#detail").contains(ae)&&/TEXTAREA|INPUT/.test(ae.tagName)&&ae.type!=="checkbox"&&ae.type!=="file";
  if(selId&&!typing&&!aiRunning)renderDetail();
});
/* ---------- bot status + "since your last visit" ---------- */
let feedMeta=null, newOnly=false;
const LAST_VISIT=LS.get("dc_last_visit",null); // ISO time of the previous visit (read once per page load)
const sinceVisit=p=>{const t=LAST_VISIT||"1970";return{added:p.feedAddedAt&&p.feedAddedAt>t,changed:p.feedChangedAt&&p.feedChangedAt>t&&!(p.feedAddedAt&&p.feedAddedAt>t),gone:p.feedGoneAt&&p.feedGoneAt>t}};
function markVisited(){LS.set("dc_last_visit",new Date().toISOString())}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")markVisited()});
window.addEventListener("pagehide",markVisited);
const fmtWhen=iso=>{const d=new Date(iso);if(isNaN(d))return iso;return d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};
function renderBotBar(){
  const el=$("#botBar"); if(!el)return;
  let state,cls,line;
  if(!feedMeta||feedMeta.error){state="Waiting for the first morning run";cls="p-grey";line="The bot publishes the daily list here each morning at about 6:52 AM. Nothing has been published yet."}
  else{
    const ageH=(Date.now()-new Date(feedMeta.stamp))/36e5;
    if(ageH<=26){state="Bot ran "+(new Date(feedMeta.stamp).toDateString()===new Date().toDateString()?"today":"yesterday");cls="p-go"}
    else if(ageH<=72){state="Bot missed a run";cls="p-warn"}
    else{state="Bot hasn't run in "+Math.floor(ageH/24)+" days";cls="p-bad"}
    line=`Last update ${fmtWhen(feedMeta.stamp)} · ${feedMeta.total} on the list${feedMeta.scanned?` · ${feedMeta.scanned} auctions scanned`:""}${feedMeta.counties.length?` · ${feedMeta.counties.join(", ")}`:""}`;
    if(cls!=="p-go")line+=". Check that your computer was on with the Claude app open at 6:52 AM, and that Deal Checker is signed in inside the Claude app’s built-in browser.";
  }
  const all=Store.all(); let a=0,c=0,g=0; for(const p of all){const s=sinceVisit(p);if(s.added)a++;if(s.changed)c++;if(s.gone)g++}
  const since=LAST_VISIT?`since your last visit (${fmtWhen(LAST_VISIT)})`:"since you started";
  el.innerHTML=`<div class="botrow"><span class="pill ${cls}"><span class="dot"></span>${esc(state)}</span><span class="small muted">${esc(line)}</span></div>
   <div class="botrow"><b>${a?`${a} new`:"No new listings"}</b><span class="small muted">${c?` · ${c} updated`:""}${g?` · ${g} no longer listed`:""} ${esc(since)}</span>
   ${a||c||g?`<button class="${newOnly?"primary":""}" id="newOnlyBtn">${newOnly?"Showing what changed. Show all":"Show what changed"}</button>`:""}
   <button class="ghost small" id="seenBtn" title="Reset the counter now">Mark all as seen</button></div>`;
  const nb=$("#newOnlyBtn");if(nb)nb.onclick=()=>{newOnly=!newOnly;renderList();renderBotBar();$("#listTitle").scrollIntoView({behavior:"smooth",block:"start"})};
  $("#seenBtn").onclick=()=>{markVisited();location.reload()};
}

/* ---------- daily watchlist feed (data/watchlist.json, published by the scheduled task) ---------- */
const FEED_FIELDS=["county","channel","date","case","addr","city","pid","type","plaintiff","ptype","bid","value","land","bldg","zoning","fit","vacant","notes","link","tier","source","feedStatus","owner"];
async function mergeFeed(items,{markGone=false,feedDate="",scanned=null}={}){
  let added=0,changed=0,gone=0; const seen=new Set((scanned||[]).map(safeId));
  for(const raw of items){
    const id=safeId(raw.id||raw._id||raw.case); if(!id)continue; seen.add(id);
    const cur=Store.get(id);
    if(!cur){const d={};for(const k of FEED_FIELDS)if(raw[k]!=null&&raw[k]!=="")d[k]=raw[k];d.status="Watching";d.feedFirstSeen=feedDate||new Date().toISOString().slice(0,10);d.feedAddedAt=new Date().toISOString();
      await Store.put(id,d);added++;continue}
    const patch={};for(const k of FEED_FIELDS){if(raw[k]==null||raw[k]==="")continue;if(JSON.stringify(cur[k])!==JSON.stringify(raw[k]))patch[k]=raw[k]}
    if(cur.feedGone)patch.feedGone=false;
    if(["bid","date","value","tier","plaintiff","ptype","addr","channel","feedGone"].some(k=>k in patch))patch.feedChangedAt=new Date().toISOString();
    if(Object.keys(patch).length){if(patch.addr&&patch.addr!==cur.addr){patch.lat=null;patch.lng=null;patch.geoFail=false}await Store.patch(id,patch);changed++}
  }
  if(markGone){for(const p of Store.all()){if(!seen.has(p._id)&&/^Watchlist|^Daily/.test(p.source||"")&&isUpcoming(p)&&!p.feedGone){await Store.patch(p._id,{feedGone:true,feedGoneAt:new Date().toISOString()});gone++}}}
  return{added,changed,gone};
}
// Apply one daily feed object ({generated, properties, scanned, counties, window}). Used by data/watchlist.json
// and by the morning bot, which calls window.DC_importFeed(feed) inside this page (Claude's browser pane).
async function applyFeed(j,{force=false}={}){
  const stamp=j&&j.generated||""; if(!stamp||!Array.isArray(j.properties))throw new Error("Not a watchlist feed");
  const meta={stamp,counties:j.counties||[],window:j.window||"",total:j.properties.length,scanned:(j.scanned||[]).length};
  if(!feedMeta||feedMeta.error||feedMeta.stamp<stamp)feedMeta=meta;
  if(Store.mode==="login")return{skipped:"not signed in"};
  const last=Store.mode==="shared"?(Store.cache.__feed?.stamp||""):LS.get("dc_feed_stamp","");
  if(!force&&last>=stamp)return{skipped:"already applied",stamp};
  const res=await mergeFeed(j.properties,{markGone:true,feedDate:stamp.slice(0,10),scanned:Array.isArray(j.scanned)?j.scanned:null});
  if(Store.mode==="shared")await Store.put("__feed",{...meta,hidden:true});else{LS.set("dc_feed_stamp",stamp);LS.set("dc_feed_meta",meta)}
  if(res.added||res.changed||res.gone)toast(`Watchlist updated ${stamp.slice(0,10)}: ${res.added} new, ${res.changed} changed${res.gone?`, ${res.gone} no longer listed`:""}.`);
  renderBotBar();
  return{...res,stamp,mode:Store.mode,total:Store.all().length};
}
// Save research from Claude's sessions: DC_addResearch({id or pid, title, text, by, docs:[{url,name}]})
window.DC_addResearch=async r=>{let id=r.id&&Store.get(r.id)?r.id:null;
  if(!id&&r.pid){const d=String(r.pid).replace(/\D/g,"");const m=Store.all().filter(x=>pidDigits(x)===d).sort((a,b)=>dkey(b.date).localeCompare(dkey(a.date)));if(m.length)id=m[0]._id}
  if(!id)throw new Error("Property not found");
  const docs=(r.docs||[]).map(d=>({at:new Date().toISOString(),...d}));
  await Store.patch(id,{history:withHist(id,{type:"research",title:r.title||"Research",text:r.text||"",by:r.by||"Claude",docs}),...(docs.length?{docs:[...((Store.get(id)||{}).docs||[]),...docs]}:{})});
  return{id,items:(Store.get(id).history||[]).length}};
window.DC_importFeed=feed=>applyFeed(typeof feed==="string"?JSON.parse(feed):feed);
window.DC_status=()=>({mode:Store.mode,user:Store.user?.email||null,properties:Store.all().length,lastFeed:Store.mode==="shared"?Store.cache.__feed?.stamp||null:LS.get("dc_feed_stamp",null)});
async function loadFeed(){
  // the last feed the bot applied (shared list) or this browser applied
  const saved=Store.mode==="shared"?Store.cache.__feed:LS.get("dc_feed_meta",null);
  if(saved&&saved.stamp)feedMeta={stamp:saved.stamp,counties:saved.counties||[],window:saved.window||"",total:saved.total||0,scanned:saved.scanned||0};
  try{
    const r=await fetch("data/watchlist.json?t="+Date.now(),{cache:"no-store"});
    if(r.ok)await applyFeed(await r.json());
  }catch(e){console.warn("feed",e)}
  finally{renderBotBar()}
}
(async()=>{
  await Store.init();
  props=Store.all(); CITIES=[...new Set(props.map(cityName).filter(Boolean))];
  const v=LS.get("dc_view","cards"); setView(["cards","map","table"].includes(v)?v:"cards");
  await loadFeed();
  if(!S.anthropicKey&&!props.length)openSettings();
})();
