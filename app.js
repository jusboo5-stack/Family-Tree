(() => {
  "use strict";
  const STORAGE_KEY = "personalFamilyTree.v1";
  const $ = id => document.getElementById(id);
  const fields = {
    id: $("personId"), name: $("name"), relationship: $("relationship"), status: $("status"),
    phone: $("phone"), parentIds: $("parentIds"), spouseIds: $("spouseIds"), childrenIds: $("childrenIds")
  };
  const form = $("personForm"), formTitle = $("formTitle"), saveBtn = $("saveBtn"), cancelEditBtn = $("cancelEditBtn");
  const formError = $("formError"), peopleList = $("peopleList"), emptyState = $("emptyState"), treeView = $("treeView");
  const recordCount = $("recordCount"), searchInput = $("searchInput"), importMessage = $("importMessage");
  const makeId = () => "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const cleanStatus = value => {
    const s = String(value ?? "").trim().toLowerCase();
    if (["deceased", "dead", "passed away", "late"].includes(s)) return "Deceased";
    return "Alive";
  };
  function loadPeople() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      const records = parsed.filter(p => p && typeof p === "object" && p.id && p.name).map(p => ({
        id: String(p.id), name: String(p.name || ""), relationship: String(p.relationship || ""),
        status: cleanStatus(p.status), phone: String(p.phone || ""),
        parentIds: Array.isArray(p.parentIds) ? p.parentIds.map(String) : (p.connectedTo ? [String(p.connectedTo)] : []),
        spouseIds: Array.isArray(p.spouseIds) ? p.spouseIds.map(String) : [],
        layoutOrder: Number.isFinite(Number(p.layoutOrder)) ? Number(p.layoutOrder) : 0,
        notes: String(p.notes || "")
      }));
      // Restore legacy one-way spouse references symmetrically when present.
      records.forEach(p => p.spouseIds.forEach(id => { const other = records.find(x => x.id === id); if (other && !other.spouseIds.includes(p.id)) other.spouseIds.push(p.id); }));
      return records;
    } catch (e) { console.error(e); return []; }
  }
  let people = loadPeople();
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(people)); return true; }
    catch (e) { formError.textContent = "Could not save data. Export a backup and check browser storage space."; return false; }
  }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const personById = id => people.find(p => p.id === id);
  const nameOf = id => personById(id)?.name || "";
  function statusClass(s) { return s === "Deceased" ? "status-deceased" : "status-alive"; }
  function populatePeopleSelect(select, selected = []) {
    const self = fields.id.value;
    const keep = new Set(selected);
    select.innerHTML = people.filter(p => p.id !== self).slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
    [...select.options].forEach(o => o.selected = keep.has(o.value));
  }
  function resetForm() {
    form.reset(); fields.id.value = ""; fields.status.value = "Alive"; formTitle.textContent = "Add a person";
    saveBtn.textContent = "Add person"; cancelEditBtn.classList.add("hidden"); formError.textContent = "";
    populatePeopleSelect(fields.parentIds); populatePeopleSelect(fields.spouseIds); populateChildrenSelect([]);
  }
  function beginEdit(id) {
    const p = personById(id); if (!p) return;
    fields.id.value = p.id; fields.name.value = p.name; fields.relationship.value = p.relationship;
    fields.status.value = p.status; fields.phone.value = p.phone;
    populatePeopleSelect(fields.parentIds, p.parentIds); populatePeopleSelect(fields.spouseIds, p.spouseIds);
    populateChildrenSelect(people.filter(child => child.parentIds.includes(p.id)).map(child => child.id));
    formTitle.textContent = "Edit person"; saveBtn.textContent = "Save changes"; cancelEditBtn.classList.remove("hidden");
    formError.textContent = ""; form.scrollIntoView({behavior:"smooth",block:"start"}); fields.name.focus({preventScroll:true});
  }
  function populateChildrenSelect(selected = []) {
    const self = fields.id.value;
    const keep = new Set(selected);
    fields.childrenIds.innerHTML = people.filter(p => p.id !== self).slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
    [...fields.childrenIds.options].forEach(o => o.selected = keep.has(o.value));
  }
  function renderList() {
    const q = searchInput.value.trim().toLocaleLowerCase();
    const visible = people.filter(p => [p.name,p.relationship,p.status,p.phone,p.parentIds.map(nameOf).join(" "),p.spouseIds.map(nameOf).join(" ")].join(" ").toLocaleLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
    recordCount.textContent = `${people.length} ${people.length === 1 ? "person" : "people"}`;
    peopleList.innerHTML = visible.map(p => {
      const parents = p.parentIds.map(nameOf).filter(Boolean), spouses = p.spouseIds.map(nameOf).filter(Boolean);
      const details = [p.phone ? `Phone: ${esc(p.phone)}` : "", parents.length ? `Parents: ${esc(parents.join(", "))}` : "", spouses.length ? `Spouse/partner: ${esc(spouses.join(", "))}` : ""].filter(Boolean).join(" · ");
      return `<article class="person-card"><div class="person-main"><div class="person-name">${esc(p.name)}</div><div class="person-meta">${p.relationship ? `<span class="pill">${esc(p.relationship)}</span>` : ""}<span class="pill ${statusClass(p.status)}">${esc(p.status)}</span></div>${details ? `<div class="person-detail">${details}</div>` : ""}</div><div class="person-actions"><button class="small-button" type="button" data-action="edit" data-id="${esc(p.id)}">Edit</button><button class="small-button delete" type="button" data-action="delete" data-id="${esc(p.id)}">Delete</button></div></article>`;
    }).join("");
    emptyState.style.display = people.length && visible.length ? "none" : "block";
    emptyState.querySelector("h3").textContent = people.length ? "No matching records" : "No family records yet";
    emptyState.querySelector("p").textContent = people.length ? "Try a different search term." : "Add your first person using the form above, or import a CSV file.";
    renderTree();
  }
  function nodeMarkup(p) {
    return `<div class="tree-node ${statusClass(p.status)}" data-person-id="${esc(p.id)}"><strong>${esc(p.name)}</strong>${p.relationship ? `<div class="tree-rel">${esc(p.relationship)}</div>` : ""}${p.phone ? `<div class="tree-phone">${esc(p.phone)}</div>` : ""}</div>`;
  }
  function getGenerationMap() {
    // Treat every connected spouse/partner group as one family unit, so a spouse
    // cannot drift into another generation merely because their parent fields differ.
    const parent = new Map(people.map(p => [p.id, p.id]));
    const find = id => { let root=id; while(parent.get(root)!==root) root=parent.get(root); while(parent.get(id)!==id){const next=parent.get(id);parent.set(id,root);id=next;} return root; };
    const union = (a,b) => { if(!parent.has(a)||!parent.has(b))return; const ra=find(a),rb=find(b); if(ra!==rb)parent.set(rb,ra); };
    people.forEach(p => p.spouseIds.forEach(id => union(p.id,id)));
    const units = new Map();
    people.forEach(p => { const root=find(p.id); if(!units.has(root))units.set(root,[]); units.get(root).push(p); });
    const unitFor = new Map(); units.forEach((members,key)=>members.forEach(p=>unitFor.set(p.id,key)));
    const depths = new Map(), visiting = new Set();
    function unitDepth(key) {
      if(depths.has(key))return depths.get(key);
      if(visiting.has(key))return 0;
      visiting.add(key);
      const parents = new Set();
      (units.get(key)||[]).forEach(p=>p.parentIds.forEach(id=>{const pk=unitFor.get(id);if(pk&&pk!==key)parents.add(pk);}));
      let d=0; parents.forEach(pk=>{d=Math.max(d,unitDepth(pk)+1);});
      visiting.delete(key); depths.set(key,d); return d;
    }
    const generation = new Map();
    units.forEach((members,key)=>{const d=unitDepth(key);members.forEach(p=>generation.set(p.id,d));});
    return {generation, units};
  }
  function renderTree() {
    if (!people.length) { treeView.innerHTML = '<p class="tree-empty">Add people to build your family tree.</p>'; return; }
    const {generation, units} = getGenerationMap();
    const groups = new Map();
    units.forEach((members,key) => {
      const d = generation.get(members[0].id) || 0;
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push({key, members:members.slice().sort((a,b)=>a.name.localeCompare(b.name))});
    });
    const rows = [...groups.keys()].sort((a,b)=>a-b).map(d => {
      const familyUnits = groups.get(d).sort((a,b)=>{
        const ao=Math.min(...a.members.map(p=>p.layoutOrder||0)), bo=Math.min(...b.members.map(p=>p.layoutOrder||0));
        return (ao-bo) || a.members[0].name.localeCompare(b.members[0].name);
      });
      const html = familyUnits.map(unit => {
        unit.members.sort((a,b)=>(a.layoutOrder||0)-(b.layoutOrder||0)||a.name.localeCompare(b.name));
        const cards = unit.members.map((person,i) => `${i ? '<span class="spouse-link" aria-label="spouse or partner">- - -</span>' : ''}${nodeMarkup(person)}`).join('');
        return `<div class="tree-family-unit ${unit.members.length>1?'spouse-unit':''}" draggable="true" data-unit-id="${esc(unit.members[0].id)}"><div class="spouse-pair">${cards}</div></div>`;
      }).join('');
      return `<div class="tree-generation" data-generation="${d}"><div class="generation-people">${html}</div></div>`;
    }).join('');
    treeView.innerHTML = `<div class="tree-generations">${rows}</div>`;
    drawTreeConnections();
  }
  function drawTreeConnections() {
    const root = treeView.querySelector('.tree-generations');
    if (!root) return;
    root.querySelector('.tree-lines')?.remove();
    const rootRect = root.getBoundingClientRect();
    const width = Math.max(root.scrollWidth, rootRect.width);
    const height = Math.max(root.scrollHeight, rootRect.height);
    const byId = new Map([...root.querySelectorAll('[data-person-id]')].map(el => [el.dataset.personId, el]));
    const groups = new Map();
    people.forEach(child => {
      const parents = child.parentIds.filter(id => byId.has(id)).sort();
      if (!parents.length) return;
      const key = parents.join('|');
      if (!groups.has(key)) groups.set(key, {parents, children:[]});
      groups.get(key).children.push(child.id);
    });
    const paths = [];
    const cx = r => r.left + r.width / 2 - rootRect.left;
    const top = r => r.top - rootRect.top;
    const bottom = r => r.bottom - rootRect.top;
    [...groups.entries()].forEach(([groupKey, group], groupIndex) => {
      const parentEls = group.parents.map(id=>byId.get(id)).filter(Boolean);
      const childEls = group.children.map(id=>byId.get(id)).filter(Boolean);
      if (!parentEls.length || !childEls.length) return;
      const pr = parentEls.map(el=>el.getBoundingClientRect());
      const cr = childEls.map(el=>el.getBoundingClientRect());
      const px = pr.map(cx), py = Math.max(...pr.map(bottom));
      const childXs = cr.map(cx).sort((a,b)=>a-b), childTop = Math.min(...cr.map(top));
      // Give each distinct parent set its own connector lane so cousin branches
      // do not visually merge when their children happen to sit next to each other.
      const lane = (groupIndex % 9) * 7;
      const parentBarY = py + 15 + lane;
      const childBarY = childTop - 15 - lane;
      const parentCenter = (Math.min(...px) + Math.max(...px)) / 2;
      const childCenter = (Math.min(...childXs) + Math.max(...childXs)) / 2;
      const midY = (parentBarY + childBarY) / 2;
      // Use traditional right-angle family-tree connectors, never diagonal V-shaped lines.
      // Each parent drops vertically to a shared horizontal parent bar. This bar sits
      // below the cards, so it does not replace the three-dash spouse indicator.
      pr.forEach(r => paths.push(`M${cx(r)} ${bottom(r)} V${parentBarY}`));
      if (px.length > 1) {
        paths.push(`M${Math.min(...px)} ${parentBarY} H${Math.max(...px)}`);
      }
      paths.push(`M${parentCenter} ${parentBarY} V${midY} H${childCenter} V${childBarY}`);
      if (childXs.length > 1) paths.push(`M${Math.min(...childXs)} ${childBarY} H${Math.max(...childXs)}`);
      cr.forEach(r=>paths.push(`M${cx(r)} ${childBarY} V${top(r)}`));
    });
    const svg = `<svg class="tree-lines" aria-hidden="true" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
    root.insertAdjacentHTML('afterbegin', svg);
  }
  let draggedUnitId = null;
  treeView.addEventListener("dragstart", e => {
    const unit = e.target.closest(".tree-family-unit[draggable='true']");
    if (!unit) return;
    draggedUnitId = unit.dataset.unitId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedUnitId);
    unit.classList.add("dragging");
  });
  treeView.addEventListener("dragend", e => {
    e.target.closest(".tree-family-unit")?.classList.remove("dragging");
    treeView.querySelectorAll(".tree-family-unit.drag-over").forEach(el=>el.classList.remove("drag-over"));
    draggedUnitId = null;
  });
  treeView.addEventListener("dragover", e => {
    const target = e.target.closest(".tree-family-unit[draggable='true']");
    if (!target || !draggedUnitId || target.dataset.unitId === draggedUnitId || target.closest(".tree-generation") !== treeView.querySelector(`[data-unit-id='${CSS.escape(draggedUnitId)}']`)?.closest(".tree-generation")) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    treeView.querySelectorAll(".tree-family-unit.drag-over").forEach(el=>el.classList.remove("drag-over"));
    target.classList.add("drag-over");
  });
  treeView.addEventListener("drop", e => {
    const target = e.target.closest(".tree-family-unit[draggable='true']");
    if (!target || !draggedUnitId || target.dataset.unitId === draggedUnitId) return;
    const source = treeView.querySelector(`[data-unit-id='${CSS.escape(draggedUnitId)}']`);
    if (!source || source.closest(".tree-generation") !== target.closest(".tree-generation")) return;
    e.preventDefault();
    const rect = target.getBoundingClientRect();
    if (e.clientX < rect.left + rect.width / 2) target.before(source); else target.after(source);
    const row = source.closest(".generation-people");
    let order = 100;
    [...row.querySelectorAll(":scope > .tree-family-unit")].forEach(unit=>{
      const members = [...unit.querySelectorAll("[data-person-id]")].map(el=>personById(el.dataset.personId)).filter(Boolean);
      members.forEach(member=>{member.layoutOrder=order;order+=1;});
      order+=10;
    });
    persist(); renderTree(); showMessage("Family tree layout saved.");
  });
  window.addEventListener('resize', () => requestAnimationFrame(drawTreeConnections));
  form.addEventListener("submit", e => {
    e.preventDefault(); formError.textContent = "";
    const id = fields.id.value || makeId(), name = fields.name.value.trim();
    if (!name) { formError.textContent = "Enter a full name."; fields.name.focus(); return; }
    if (!fields.relationship.value.trim()) { formError.textContent = "Enter the person’s relationship."; fields.relationship.focus(); return; }
    const parentIds = [...fields.parentIds.selectedOptions].map(o=>o.value).filter(x=>x!==id);
    const spouseIds = [...fields.spouseIds.selectedOptions].map(o=>o.value).filter(x=>x!==id);
    const childrenIds = [...fields.childrenIds.selectedOptions].map(o=>o.value).filter(x=>x!==id);
    const existing = personById(id);
    const wasEditing = Boolean(fields.id.value);
    const record = { id, name, relationship: fields.relationship.value.trim(), status: cleanStatus(fields.status.value), phone: fields.phone.value.trim(), parentIds, spouseIds, layoutOrder: existing ? existing.layoutOrder : Math.max(0, ...people.map(p=>p.layoutOrder||0)) + 100, notes: "" };
    const old = people.map(p=>({...p,parentIds:[...p.parentIds],spouseIds:[...p.spouseIds]}));
    if (wasEditing) people = people.map(p=>p.id===id?record:p); else people.push(record);
    // Keep spouse links reciprocal.
    people.forEach(p => { if (p.id !== id) p.spouseIds = p.spouseIds.filter(sid=>sid!==id); });
    spouseIds.forEach(sid=>{ const spouse=personById(sid); if(spouse && !spouse.spouseIds.includes(id)) spouse.spouseIds.push(id); });
    // Children are stored as parent links on each child.
    people.forEach(p=>{ if(p.id!==id) p.parentIds=p.parentIds.filter(pid=>pid!==id); });
    childrenIds.forEach(cid=>{ const child=personById(cid); if(child && !child.parentIds.includes(id)) child.parentIds.push(id); });
    if (!persist()) { people=old; return; }
    resetForm(); renderAll(); showMessage(wasEditing ? "Changes saved." : "Person added.");
  });
  cancelEditBtn.addEventListener("click", resetForm);
  $("resetBtn").addEventListener("click", ()=>setTimeout(resetForm,0));
  searchInput.addEventListener("input",renderList);
  peopleList.addEventListener("click",e=>{
    const b=e.target.closest("button[data-action]"); if(!b)return; const p=personById(b.dataset.id); if(!p)return;
    if(b.dataset.action==="edit") beginEdit(p.id);
    else if(b.dataset.action==="delete") {
      people=people.filter(x=>x.id!==p.id).map(x=>({...x,parentIds:x.parentIds.filter(id=>id!==p.id),spouseIds:x.spouseIds.filter(id=>id!==p.id)}));
      persist(); if(fields.id.value===p.id)resetForm(); renderAll(); showMessage("Person deleted.");
    }
  });
  function showMessage(msg,error=false){importMessage.textContent=msg;importMessage.style.color=error?"var(--red)":"var(--green)";}
  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function csvEscape(v){const s=String(v??"");return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function exportCsv(){const headers=["id","name","relationship","status","phone","parentNames","spouseNames","layoutOrder"];
    const rows=people.map(p=>[p.id,p.name,p.relationship,p.status,p.phone,p.parentIds.map(nameOf).filter(Boolean).join("; "),p.spouseIds.map(nameOf).filter(Boolean).join("; "),p.layoutOrder||0]);
    downloadBlob(new Blob(["\uFEFF"+[headers,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),"family-tree.csv");showMessage("Excel-compatible CSV downloaded.");}
  function xmlEscape(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
  function exportSvg(){
    const cardW=230,cardH=104,spouseGap=16,unitGap=42,rowGap=118,pad=34;
    const {generation,units}=getGenerationMap(); const rows=new Map();
    units.forEach(members=>{const d=generation.get(members[0].id)||0;if(!rows.has(d))rows.set(d,[]);rows.get(d).push(members.slice().sort((a,b)=>(a.layoutOrder||0)-(b.layoutOrder||0)||a.name.localeCompare(b.name)));});
    const pos=new Map();let maxW=0;
    [...rows.keys()].sort((a,b)=>a-b).forEach(d=>{
      const familyUnits=rows.get(d).sort((a,b)=>{const ao=Math.min(...a.map(p=>p.layoutOrder||0)),bo=Math.min(...b.map(p=>p.layoutOrder||0));return (ao-bo)||a[0].name.localeCompare(b[0].name);});let x=pad;
      familyUnits.forEach(members=>{members.forEach((p,i)=>{pos.set(p.id,{x,y:pad+22+d*(cardH+rowGap)});x+=cardW+(i<members.length-1?spouseGap:0);});x+=unitGap;});
      maxW=Math.max(maxW,x);
    });
    const maxD=Math.max(0,...rows.keys()),height=pad*2+22+(maxD+1)*(cardH+rowGap);let lines="",cards="";
    const center=p=>p.x+cardW/2;
    people.forEach(p=>{
      const a=pos.get(p.id);if(!a)return;
      p.spouseIds.forEach(id=>{const b=pos.get(id);if(!b||b.y!==a.y||a.x>=b.x)return;const x1=a.x+cardW,x2=b.x,y=a.y+cardH/2;const mid=(x1+x2)/2;[-5,0,5].forEach(dy=>{lines+=`<path d="M${x1} ${y+dy} H${x2}" stroke="#9b8065" stroke-width="2.5" fill="none"/>`;});});
    });
    const childGroups=new Map();
    people.forEach(child=>{const parents=child.parentIds.filter(id=>pos.has(id)).sort();if(!parents.length)return;const key=parents.join('|');if(!childGroups.has(key))childGroups.set(key,{parents,children:[]});childGroups.get(key).children.push(child.id);});
    childGroups.forEach(group=>{
      const ps=group.parents.map(id=>pos.get(id)),cs=group.children.map(id=>pos.get(id));if(!ps.length||!cs.length)return;
      const parentXs=ps.map(center),childXs=cs.map(center),parentBottom=Math.max(...ps.map(p=>p.y+cardH)),childTop=Math.min(...cs.map(p=>p.y));
      const pBar=parentBottom+17,cBar=childTop-17,pc=(Math.min(...parentXs)+Math.max(...parentXs))/2,cc=(Math.min(...childXs)+Math.max(...childXs))/2,mid=(pBar+cBar)/2;
      ps.forEach(p=>{lines+=`<path d="M${center(p)} ${p.y+cardH} V${pBar}" stroke="#a9bdb0" stroke-width="2" fill="none"/>`;});
      if(parentXs.length>1)lines+=`<path d="M${Math.min(...parentXs)} ${pBar} H${Math.max(...parentXs)}" stroke="#a9bdb0" stroke-width="2" fill="none"/>`;
      lines+=`<path d="M${pc} ${pBar} V${mid} H${cc} V${cBar}" stroke="#a9bdb0" stroke-width="2" fill="none"/>`;
      if(childXs.length>1)lines+=`<path d="M${Math.min(...childXs)} ${cBar} H${Math.max(...childXs)}" stroke="#a9bdb0" stroke-width="2" fill="none"/>`;
      cs.forEach(p=>{lines+=`<path d="M${center(p)} ${cBar} V${p.y}" stroke="#a9bdb0" stroke-width="2" fill="none"/>`;});
    });
    people.forEach(p=>{const a=pos.get(p.id);if(!a)return;const fill=p.status==="Deceased"?"#eee2dc":"#f7faf7";cards+=`<g><rect x="${a.x}" y="${a.y}" width="${cardW}" height="${cardH}" rx="10" fill="${fill}" stroke="#aab8ad"/><text x="${a.x+12}" y="${a.y+24}" font-family="Arial" font-size="14" font-weight="700" fill="#242a28">${xmlEscape(p.name.slice(0,28))}</text><text x="${a.x+12}" y="${a.y+44}" font-family="Arial" font-size="11" fill="#65736a">${xmlEscape(p.relationship.slice(0,32))}</text><text x="${a.x+12}" y="${a.y+70}" font-family="Arial" font-size="10" fill="#65736a">${xmlEscape(p.phone.slice(0,32))}</text></g>`;});
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${maxW+pad}" height="${height}" viewBox="0 0 ${maxW+pad} ${height}"><rect width="100%" height="100%" fill="#fffdf9"/><text x="${pad}" y="20" font-family="Arial" font-size="16" font-weight="700" fill="#315d4c">Family Tree</text>${lines}${cards}</svg>`;
    downloadBlob(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),"family-tree.svg");showMessage("Family tree image (SVG) downloaded.");
  }
  $("exportJsonBtn").addEventListener("click",()=>{downloadBlob(new Blob([JSON.stringify(people,null,2)],{type:"application/json;charset=utf-8"}),"family-tree-backup.json");showMessage("JSON backup downloaded.");});
  $("exportCsvBtn").addEventListener("click",exportCsv);$("exportImageBtn").addEventListener("click",exportSvg);
  function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"'&&cell==="")quoted=true;else if(c===","){row.push(cell);cell="";}else if(c==="\n"){row.push(cell.replace(/\r$/,""));rows.push(row);row=[];cell="";}else cell+=c;}if(cell.length||row.length){row.push(cell.replace(/\r$/,""));rows.push(row);}return rows.filter(r=>r.some(v=>String(v).trim()));}
  const normKey = k => String(k??"").replace(/^\uFEFF/,"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  function getVal(raw, aliases){for(const [k,v] of Object.entries(raw)){if(aliases.includes(normKey(k))&&String(v??"").trim()!=="")return v;}return "";}
  function splitNames(value){return String(value??"").split(/[;|]/).map(s=>s.trim()).filter(Boolean);}
  function importRecords(records){if(!records.length){showMessage("No records were found in that file.",true);return;}
    const cleaned=records.map(raw=>{const name=getVal(raw,["name","fullname","person","personname"]);if(!String(name).trim())return null;
      return {id:makeId(),name:String(name).trim().slice(0,120),relationship:String(getVal(raw,["relationship","relationships","relation","relations","familyrelationship","relationshiptomainperson","kinship","relationtype"])).trim().slice(0,100),status:cleanStatus(getVal(raw,["status","lifestatus","maritalstatus","relationshipstatus","livingstatus"])),phone:String(getVal(raw,["phone","phonenumber","telephone","tel","mobile","mobilenumber","contactnumber","contactphone"])).trim().slice(0,40),parentNames:splitNames([getVal(raw,["parentnames","parents","parent"]),getVal(raw,["fathername","father"]),getVal(raw,["mothername","mother"])].filter(Boolean).join("; ")),spouseNames:splitNames(getVal(raw,["spousenames","spousename","spouse","spouses","partnername","partner","partners","husbandname","husband","wifename","wife"])),sourceId:String(getVal(raw,["id","personid"])).trim(),layoutOrder:Number(getVal(raw,["layoutorder","treeorder"]))||0,parentIds:Array.isArray(raw.parentIds)?raw.parentIds.map(String):[],spouseIds:Array.isArray(raw.spouseIds)?raw.spouseIds.map(String):[]};}).filter(Boolean);
    if(!cleaned.length){showMessage("No usable people found. The CSV must include a Name or Full Name column.",true);return;}
    const byName=new Map(people.map(p=>[p.name.toLocaleLowerCase(),p]));const sourceIds=new Map();let added=0,skipped=0;
    cleaned.forEach(p=>{const existing=byName.get(p.name.toLocaleLowerCase());if(existing){skipped++;p._targetId=existing.id;if(p.sourceId)sourceIds.set(p.sourceId,existing.id);return;}p._targetId=p.id;byName.set(p.name.toLocaleLowerCase(),p);if(p.sourceId)sourceIds.set(p.sourceId,p.id);people.push({id:p.id,name:p.name,relationship:p.relationship,status:p.status,phone:p.phone,parentIds:[],spouseIds:[],layoutOrder:p.layoutOrder||0,notes:""});added++;});
    const targetByName=new Map(people.map(p=>[p.name.toLocaleLowerCase(),p]));
    cleaned.forEach(p=>{const target=personById(p._targetId);if(!target)return;
      p.parentIds.forEach(pid=>{const mapped=sourceIds.get(pid)||pid;const parent=people.find(x=>x.id===mapped);if(parent&&parent.id!==target.id&&!target.parentIds.includes(parent.id))target.parentIds.push(parent.id);});
      p.parentNames.forEach(n=>{const parent=targetByName.get(n.toLocaleLowerCase());if(parent&&parent.id!==target.id&&!target.parentIds.includes(parent.id))target.parentIds.push(parent.id);});
      p.spouseIds.forEach(sid=>{const mapped=sourceIds.get(sid)||sid;const spouse=people.find(x=>x.id===mapped);if(spouse&&spouse.id!==target.id){if(!target.spouseIds.includes(spouse.id))target.spouseIds.push(spouse.id);if(!spouse.spouseIds.includes(target.id))spouse.spouseIds.push(target.id);}});
      p.spouseNames.forEach(n=>{const spouse=targetByName.get(n.toLocaleLowerCase());if(spouse&&spouse.id!==target.id){if(!target.spouseIds.includes(spouse.id))target.spouseIds.push(spouse.id);if(!spouse.spouseIds.includes(target.id))spouse.spouseIds.push(target.id);}});
    });
    // Support exports from the older app using connectedToName as a parent link.
    cleaned.forEach(p=>{const oldLink=String(getVal(records.find(r=>String(getVal(r,["name","fullname","person","personname"])).trim().toLowerCase()===p.name.toLowerCase())||{},["connectedtoname","connectedto"])).trim();const target=personById(p._targetId);const parent=targetByName.get(oldLink.toLowerCase());if(oldLink&&parent&&target&&parent.id!==target.id&&!target.parentIds.includes(parent.id))target.parentIds.push(parent.id);});
    // Deduplicate reciprocal spouse references.
    people.forEach(p=>{p.parentIds=[...new Set(p.parentIds.filter(id=>personById(id)&&id!==p.id))];p.spouseIds=[...new Set(p.spouseIds.filter(id=>personById(id)&&id!==p.id))];});
    if(!persist())return;renderAll();showMessage(`Imported ${added} new record(s).${skipped?` Skipped ${skipped} duplicate name(s).`:""} Blank or unrecognised statuses default to Alive.`);
  }
  $("importCsvInput").addEventListener("change",async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{const rows=parseCsv(await file.text());if(rows.length<2)throw new Error("CSV needs a header row and at least one data row.");const headers=rows[0].map(h=>String(h).replace(/^\uFEFF/,"").trim());const records=rows.slice(1).map(row=>{const obj={};headers.forEach((h,i)=>obj[h]=row[i]??"");return obj;});importRecords(records);}catch(err){showMessage(`Could not import CSV: ${err.message}`,true);}});
  $("importJsonInput").addEventListener("change",async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed))throw new Error("JSON backup must contain a list of people.");if(!confirm("Import these records and skip names that already exist?"))return;importRecords(parsed);}catch(err){showMessage(`Could not import JSON: ${err.message}`,true);}});
  function renderAll(){populatePeopleSelect(fields.parentIds,fields.parentIds.selectedOptions? [...fields.parentIds.selectedOptions].map(o=>o.value):[]);populatePeopleSelect(fields.spouseIds,fields.spouseIds.selectedOptions?[...fields.spouseIds.selectedOptions].map(o=>o.value):[]);populateChildrenSelect(fields.childrenIds.selectedOptions?[...fields.childrenIds.selectedOptions].map(o=>o.value):[]);renderList();}
  // JSON imports use the same flexible mapping; accept an array of records.
  resetForm();renderAll();
})();
