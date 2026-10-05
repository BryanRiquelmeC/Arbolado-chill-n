/* =============================================================
   Sistema Arbolado Urbano · by Bryan
   Lógica de interfaz: navegación, formularios, croquis, registros y PDF.

   Índice (buscar el título para saltar a cada parte):
     1. Utilidades ($, $$, toast)
     2. Navegación y menú lateral
     3. Render encuesta desde config   → construye la Matriz VTA
     4. Serializar / cargar formularios
     5. Croquis SVG en vivo            → dibujo del perfil transversal
     6. Guardar
     7. Registros                      → filtros, paginación, respaldo, CSV
     8. PDF
     9. init                           → arranque de la app
   ============================================================= */

/* ============ 1. Utilidades ============ */
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const toast = (m) => {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
};
const n = (v) => parseFloat(v) || 0;
hidratarIconos();

/* ============ 2. Navegación y menú lateral ============ */
function go(v) {
  $$(".view").forEach((x) => x.classList.toggle("on", x.id === "v-" + v));
  $$("aside button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  menuLateral(false);
  if (v === "registros") renderRows();
  if (v === "dash") stats();
  if (v === "manzanas") renderManzanas();
  window.scrollTo(0, 0);
}
$$("aside button").forEach((b) => (b.onclick = () => go(b.dataset.v)));
$$("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
/* Menú lateral en pantallas pequeñas: abrir/cerrar con la hamburguesa, la X o tocando fuera */
function menuLateral(abrir) {
  const abierto = abrir ?? !$("#side").classList.contains("open");
  $("#side").classList.toggle("open", abierto);
  $("#scrim").classList.toggle("on", abierto);
  document.body.classList.toggle("menu-abierto", abierto);
}
$$(".menu").forEach((b) => (b.onclick = () => menuLateral()));
$("#sideClose").onclick = () => menuLateral(false);
$("#scrim").onclick = () => menuLateral(false);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") menuLateral(false);
});

/* ============ 3. Render encuesta desde config ============ */
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function optHTML(o) {
  const m = o.match(/^(.+?\)|[^:]+):\s*(.*)$/);
  return m ? `<b>${esc(m[1])}</b><small>${esc(m[2])}</small>` : `<b>${esc(o)}</b>`;
}
function field(p) {
  const req = p.req ? ' <span class="req">*</span>' : "",
    r = p.req ? "required" : "";
  const lbl = `${p.n ? p.n + ". " : ""}${p.label}`;
  let inp,
    wide = true;
  if (p.type === "radio") {
    inp = `<div class="opts">${p.opts.map((o) => `<label><input type="radio" name="${p.id}" value="${esc(o)}" ${r}><span>${optHTML(o)}</span></label>`).join("")}
    ${p.otros ? `<label class="otro"><input type="radio" name="${p.id}" value="Otros"><span><b>Otros:</b></span><input type="text" name="${p.id}_otro" placeholder="Especifique…"></label>` : ""}</div>`;
  } else if (p.type === "select") {
    inp = `<select name="${p.id}" ${r}><option value="">— Seleccione —</option>${p.opts.map((o) => `<option>${esc(o)}</option>`).join("")}${p.otros ? "<option>Otros</option>" : ""}</select>
    ${p.otros ? `<input type="text" name="${p.id}_otro" placeholder="Si eligió Otros, especifique…" style="margin-top:6px">` : ""}`;
  } else if (p.type === "gps") {
    inp = gpsCampo(p.id, !!p.req);
  } else if (p.type === "photo") {
    inp = `<input type="file" accept="image/*" capture="environment" data-photo="${p.id}"><input type="hidden" name="${p.id}"><img class="prev" id="prev-${p.id}" alt="">`;
  } else if (p.type === "textarea") inp = `<textarea name="${p.id}" ${r}></textarea>`;
  else {
    wide = false;
    const i = `<input type="${p.type}" name="${p.id}" ${p.type === "number" ? 'step="any" min="0"' : ""} ${r}>`;
    inp = p.unit ? `<div class="unit">${i}<span>${p.unit}</span></div>` : i;
  }
  const clr = ["radio", "select"].includes(p.type)
    ? `<button type="button" class="clr" data-clr="${p.id}">${ic("x")} Quitar selección</button>`
    : "";
  return `<div class="f"${wide ? ' style="grid-column:1/-1"' : ""}><div class="qhead"><label>${lbl}${req}</label>${clr}</div>${p.hint ? `<div class="hint">${p.hint}</div>` : ""}${inp}</div>`;
}
$("#enc-title").textContent = ENCUESTA.titulo;
$("#enc-intro").textContent = ENCUESTA.intro;
$("#enc-nav").innerHTML = ENCUESTA.secciones
  .map((s, i) => `<a href="#sec-${i}">${ic(s.icono)} ${s.titulo}</a>`)
  .join("");
$("#enc-body").innerHTML = ENCUESTA.secciones
  .map(
    (s, i) =>
      `<div class="card" id="sec-${i}"><h3>${ic(s.icono)} ${s.titulo}</h3><div class="grid">${s.preguntas.map(field).join("")}</div></div>`
  )
  .join("");
$("#enc-nav").onclick = (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  $(a.getAttribute("href")).scrollIntoView({ behavior: "smooth" });
};
/* Desmarcar opción: clic de nuevo sobre la opción elegida o botón "Quitar selección" */
let _wasChecked = null;
document.addEventListener("pointerdown", (e) => {
  const l = e.target.closest("label");
  const r = l && l.querySelector("input[type=radio]");
  _wasChecked = r && r.checked ? r : null;
});
document.addEventListener("click", (e) => {
  const l = e.target.closest("label");
  const r = l && l.querySelector("input[type=radio]");
  if (r && _wasChecked === r && e.target.type !== "text") {
    e.preventDefault();
    setTimeout(() => {
      r.checked = false;
      r.dispatchEvent(new Event("input", { bubbles: true }));
      syncClr();
    }, 0);
  }
  _wasChecked = null;
  const b = e.target.closest("[data-clr]");
  if (b) {
    const f = b.form,
      id = b.dataset.clr;
    [...f.querySelectorAll(`[name="${id}"]`)].forEach((i) => {
      if (i.type === "radio") i.checked = false;
      else i.value = "";
    });
    const o = f.querySelector(`[name="${id}_otro"]`);
    if (o) o.value = "";
    syncClr();
    drawCroquis();
  }
});
function syncClr() {
  $$("[data-clr]").forEach((b) => {
    const f = b.form,
      id = b.dataset.clr;
    b.classList.toggle(
      "show",
      [...f.querySelectorAll(`[name="${id}"]`)].some((i) =>
        i.type === "radio" ? i.checked : !!i.value
      )
    );
  });
}
document.addEventListener("change", syncClr);

/* fotos: comprimir y guardar como dataURL */
document.addEventListener("change", (e) => {
  const f = e.target;
  if (!f.dataset.photo || !f.files[0]) return;
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 900 / Math.max(img.width, img.height)),
      c = document.createElement("canvas");
    c.width = img.width * k;
    c.height = img.height * k;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const d = c.toDataURL("image/jpeg", 0.65);
    f.form[f.dataset.photo].value = d;
    showPrev(f.dataset.photo, d);
  };
  img.src = URL.createObjectURL(f.files[0]);
});
function showPrev(id, d) {
  const p = $("#prev-" + id);
  if (p) {
    p.src = d || "";
    p.style.display = d ? "block" : "none";
  }
}
/* GPS: ver js/gps.js */

/* ============ 4. Serializar / cargar formularios ============ */
function read(form) {
  const d = {};
  [...form.elements].forEach((e) => {
    if (!e.name) return;
    if (e.type === "radio") {
      if (e.checked) d[e.name] = e.value;
      else if (!(e.name in d)) d[e.name] = "";
    } else if (e.type === "checkbox") {
      d[e.name] = d[e.name] || [];
      if (e.checked) d[e.name].push(e.value);
    } else d[e.name] = e.value.trim();
  });
  return d;
}
function load(form, d) {
  form.reset();
  [...form.elements].forEach((e) => {
    if (!e.name || !(e.name in d)) return;
    if (e.type === "radio") e.checked = d[e.name] === e.value;
    else if (e.type === "checkbox") e.checked = (d[e.name] || []).includes(e.value);
    else e.value = d[e.name];
  });
}
function validate(form) {
  let ok = true;
  [...form.elements].forEach((e) => {
    e.classList.remove("invalid");
    if (e.required && !e.checkValidity()) {
      ok = false;
      e.classList.add("invalid");
    }
  });
  if (!ok) {
    toast("Complete los campos obligatorios");
    form.querySelector(".invalid")?.focus();
  }
  return ok;
}
/* Ventana de confirmación con el diseño de la app. Devuelve true/false. */
function confirmar({ titulo, texto, ok = "Confirmar", icono = "info", peligro = false }) {
  return new Promise((resolve) => {
    Modal.open(
      titulo,
      "",
      `<div class="conf"><span class="conf-ico ${peligro ? "peligro" : ""}">${ic(icono)}</span><p>${texto}</p></div>`,
      `<button class="btn bs" id="confNo" type="button">Cancelar</button>
       <button class="btn ${peligro ? "bdanger" : "bp"}" id="confSi" type="button">${ic(icono)} ${ok}</button>`
    );
    $("#modal").classList.add("mini");
    const cerrar = (v) => {
      $("#modal").classList.remove("mini");
      Modal.close();
      resolve(v);
    };
    $("#confSi").onclick = () => cerrar(true);
    $("#confNo").onclick = () => cerrar(false);
    $("#mclose").onclick = () => cerrar(false);
    $("#confSi").focus();
  });
}

/* Botón "Limpiar": pide confirmación antes de borrar lo escrito */
$$("[data-reset]").forEach(
  (b) =>
    (b.onclick = async () => {
      const nombre = b.dataset.reset === "croquis" ? "el croquis" : "la Matriz VTA";
      const si = await confirmar({
        titulo: "¿Limpiar formulario?",
        texto: `Se borrarán todos los datos escritos en ${nombre}, incluidas fotos y coordenadas.<br><b>Los registros ya guardados no se eliminan.</b>`,
        ok: "Sí, limpiar",
        icono: "trash",
        peligro: true
      });
      if (!si) return;
      const f = $("#f-" + b.dataset.reset);
      f.reset();
      f._id.value = "";
      $$(".prev").forEach((p) => (p.style.display = "none"));
      syncClr();
      $$(".gps-estado").forEach((x) => (x.textContent = ""));
      drawCroquis();
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Formulario limpio");
    })
);

/* ============ 5. Croquis SVG en vivo ============ */
function drawCroquis() {
  const f = $("#f-croquis"),
    d = read(f);
  const vals = [n(d.vereda_izq), n(d.plata_izq), n(d.calzada), n(d.plata_der), n(d.vereda_der)];
  const total = vals.reduce((a, b) => a + b, 0);
  $("#tot").textContent = total.toFixed(2);
  const W = 900,
    x0 = 50,
    def = [2, 1.9, 7.8, 1.9, 2.1];
  const use = total > 0 ? vals.map((v, i) => v || def[i] * 0.15) : def,
    sum = use.reduce((a, b) => a + b, 0);
  const ws = use.map((v) => (v / sum) * W);
  let x = x0;
  const xs = ws.map((w) => {
    const s = x;
    x += w;
    return s;
  });
  const yS = 190,
    yC = 212,
    lbl = ["VEREDA", "PLATABANDA", "CALZADA", "PLATABANDA", "VEREDA"];
  const tree = d.ubic_arbol,
    treeIdx = { "Vereda izq.": 0, "Platabanda izq.": 1, "Platabanda der.": 3, "Vereda der.": 4 }[
      tree
    ];
  /* Postes: izquierda y/o derecha (compatibilidad con registros antiguos "ubic_red") */
  const cab = d.cables === "Sí";
  let postes = Array.isArray(d.postes) ? d.postes : [];
  if (!postes.length && d.ubic_red)
    postes = [/Der/.test(d.ubic_red) ? "Platabanda der." : "Platabanda izq."];
  const pI = cab && postes.includes("Platabanda izq."),
    pD = cab && postes.includes("Platabanda der.");
  $("#postes-wrap").classList.toggle("oculto", !cab);
  $("#alt-izq").classList.toggle("oculto", !pI);
  $("#alt-der").classList.toggle("oculto", !pD);
  const alts = [pI && n(d.altura_cables_izq), pD && n(d.altura_cables_der)].filter(Boolean);
  f.altura_cables.value = alts.length ? Math.min(...alts).toFixed(2) : "";
  let s = `<style>text{font-family:Segoe UI,sans-serif}</style>
  <line x1="${x0}" y1="30" x2="${x0}" y2="250" stroke="#5d7a92" stroke-dasharray="4 4"/><line x1="${x0 + W}" y1="30" x2="${x0 + W}" y2="250" stroke="#5d7a92" stroke-dasharray="4 4"/>
  <text x="${x0}" y="22" font-size="11" fill="#5d7a92">LÍMITE OFICIAL (IZQ.)</text><text x="${x0 + W}" y="22" font-size="11" fill="#5d7a92" text-anchor="end">LÍMITE OFICIAL (DER.)</text>
  <line x1="${x0}" y1="48" x2="${x0 + W}" y2="48" stroke="#0b5c8f"/><rect x="${x0 + W / 2 - 110}" y="38" width="220" height="20" rx="4" fill="#d9eefb"/>
  <text x="${x0 + W / 2}" y="52" font-size="12" fill="#0b5c8f" text-anchor="middle" font-weight="700">ANCHO TOTAL: ${total.toFixed(2)} m</text>
  <path d="M${x0} ${yS} H${xs[2]} V${yC} H${xs[3]} V${yS} H${x0 + W}" fill="none" stroke="#16324a" stroke-width="3"/>
  <path d="M${xs[2]} ${yC} Q${xs[2] + ws[2] / 2} ${yC - 14} ${xs[3]} ${yC}" fill="none" stroke="#5bb4ea" stroke-width="1.5"/>`;
  const alto = (v) => Math.min(120, Math.max(50, n(v) * 22 || 95));
  const poste = (
    px,
    h,
    lado,
    v
  ) => `<line x1="${px}" y1="${yS}" x2="${px}" y2="${yS - h}" stroke="#16324a" stroke-width="4"/>
    <line x1="${px - 10}" y1="${yS - h}" x2="${px + 10}" y2="${yS - h}" stroke="#16324a" stroke-width="3"/><circle cx="${px - 10}" cy="${yS - h}" r="3" fill="#16324a"/><circle cx="${px + 10}" cy="${yS - h}" r="3" fill="#16324a"/>
    <text x="${px + (lado === "I" ? 14 : -14)}" y="${yS - h + 16}" font-size="11" fill="#0b5c8f" font-weight="700" text-anchor="${lado === "I" ? "start" : "end"}">${v ? n(v).toFixed(2) + " m" : ""}</text>`;
  const xI = xs[1] + ws[1] / 2,
    xD = xs[3] + ws[3] / 2,
    hI = alto(d.altura_cables_izq),
    hD = alto(d.altura_cables_der);
  if (pI && pD)
    s +=
      `<line x1="${xI}" y1="${yS - hI}" x2="${xD}" y2="${yS - hD}" stroke="#16324a" stroke-dasharray="6 4"/>` +
      poste(xI, hI, "I", d.altura_cables_izq) +
      poste(xD, hD, "D", d.altura_cables_der);
  else if (pI)
    s +=
      `<line x1="${xI}" y1="${yS - hI}" x2="${x0 + W}" y2="${yS - hI}" stroke="#16324a" stroke-dasharray="6 4"/>` +
      poste(xI, hI, "I", d.altura_cables_izq);
  else if (pD)
    s +=
      `<line x1="${x0}" y1="${yS - hD}" x2="${xD}" y2="${yS - hD}" stroke="#16324a" stroke-dasharray="6 4"/>` +
      poste(xD, hD, "D", d.altura_cables_der);
  if (treeIdx !== undefined) {
    const tx =
      xs[treeIdx] + ws[treeIdx] / 2 + ((treeIdx === 1 && pI) || (treeIdx === 3 && pD) ? 30 : 0);
    s += `<rect x="${tx - 4}" y="${yS - 60}" width="8" height="60" fill="#7a5230"/><circle cx="${tx}" cy="${yS - 82}" r="34" fill="#1f9d6b" opacity=".85"/>
    <text x="${tx}" y="${yS - 78}" font-size="10" fill="#fff" text-anchor="middle">${d.dap ? "DAP " + d.dap : ""}</text>`;
  }
  ws.forEach((w, i) => {
    const cx = xs[i] + w / 2,
      y = i === 2 ? yC + 5 : yS + 5;
    s += `<text x="${cx}" y="${i === 2 ? yS - 20 : yS - 8}" font-size="${w < 70 ? 9 : 12}" fill="#16324a" text-anchor="middle" font-weight="600">${lbl[i]}</text>
    <line x1="${xs[i]}" y1="265" x2="${xs[i] + w}" y2="265" stroke="#1e88c9"/><line x1="${xs[i]}" y1="258" x2="${xs[i]}" y2="272" stroke="#1e88c9"/>
    <text x="${cx}" y="288" font-size="12" fill="#0b5c8f" text-anchor="middle" font-weight="700">${vals[i] ? vals[i].toFixed(2) + " m" : "— m"}</text>`;
  });
  s += `<line x1="${x0 + W}" y1="258" x2="${x0 + W}" y2="272" stroke="#1e88c9"/>`;
  $("#svg").innerHTML = s;
}
$("#f-croquis").addEventListener("input", drawCroquis);

/* ============ 6. Guardar ============ */
function onSave(tipo) {
  return (e) => {
    e.preventDefault();
    const f = e.target;
    if (!validate(f)) return;
    const d = read(f);
    d._id = d._id || Date.now().toString(36);
    d._tipo = tipo;
    const prev = DB.all().find((x) => x._id === d._id);
    d._creado = (prev && prev._creado) || new Date().toISOString();
    d._dispositivo = /Android/.test(navigator.userAgent) ? "Android" : navigator.platform || "";
    if (tipo === "croquis") d.ancho_total = $("#tot").textContent;
    d._actualizado = new Date().toISOString();
    DB.upsert(d)
      .then(() => Sync.run())
      .catch(() => toast("⚠ No se pudo guardar en el dispositivo"));
    f._id.value = d._id;
    toast("Registro guardado ✔");
    if (e.submitter && e.submitter.dataset.pdf) pdf(d);
  };
}
$("#f-croquis").onsubmit = onSave("croquis");
$("#f-encuesta").onsubmit = onSave("encuesta");

/* ============ 7. Registros ============ */
function stats() {
  const l = DB.all();
  $("#st-total").textContent = l.length;
  $("#st-cro").textContent = l.filter((x) => x._tipo === "croquis").length;
  $("#st-enc").textContent = l.filter((x) => x._tipo === "encuesta").length;
  $("#st-cen").textContent = l.filter((x) => x._tipo === "censo").length;
  $("#st-mz").textContent = new Set(l.map(mz).filter(Boolean)).size;
}
/* Campos comunes a los 3 tipos de registro (croquis · Matriz VTA · censo importado) */
const mz = (r) => String((r._tipo === "encuesta" ? r.p1 : r.manzana) || "").trim(),
  esp = (r) =>
    r._tipo === "censo" ? r.especie || "" : r.p3 === "Otros" ? r.p3_otro || "Otros" : r.p3 || "",
  urg = (r) => (r._tipo === "censo" ? r.urgencia || "" : (r.p32 || "").split(" (")[0]),
  fecha = (r) => (r.fecha || r._creado || "").slice(0, 10),
  titulo = (r) => r.direccion || (r.id_arbol ? `Árbol ${r.id_arbol}` : "Sin dirección");
const TIPOS = {
  croquis: ["Croquis", "tp-c"],
  encuesta: ["Matriz VTA", "tp-e"],
  censo: ["Censo", "tp-x"]
};
const txt = (r) =>
  (
    Object.entries(r)
      .filter(([k, v]) => typeof v === "string" && !v.startsWith("data:") && !k.startsWith("_"))
      .map(([, v]) => v)
      .join(" ") +
    " " +
    (r.campos || []).map((c) => c[1]).join(" ")
  ).toLowerCase();
const hl = (t, q) => {
  t = esc(t || "—");
  if (!q) return t;
  const i = t.toLowerCase().indexOf(q);
  return i < 0
    ? t
    : t.slice(0, i) + "<mark>" + t.slice(i, i + q.length) + "</mark>" + t.slice(i + q.length);
};
function fillSel(id, vals, label) {
  const s = $(id),
    cur = s.value;
  s.innerHTML =
    `<option value="">${label}</option>` +
    [...new Set(vals.filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
      .map((v) => `<option>${esc(v)}</option>`)
      .join("");
  s.value = cur;
}
const POR_PAGINA = 20;
let pagina = 1;
function renderRows() {
  const all = DB.all();
  fillSel("#fm", all.map(mz), "Todas");
  fillSel("#fe", all.map(esp), "Todas");
  fillSel("#fu", all.map(urg), "Todas");
  const q = $("#q").value.trim().toLowerCase(),
    t = $("#ft").value,
    m = $("#fm").value,
    e = $("#fe").value,
    u = $("#fu").value,
    d1 = $("#fd1").value,
    d2 = $("#fd2").value;
  let l = all.filter(
    (r) =>
      (!t || r._tipo === t) &&
      (!m || mz(r) === m) &&
      (!e || esp(r) === e) &&
      (!u || urg(r) === u) &&
      (!d1 || fecha(r) >= d1) &&
      (!d2 || fecha(r) <= d2) &&
      (!q || txt(r).includes(q))
  );
  const o = $("#fo").value;
  if (o === "old") l = [...l].reverse();
  if (o === "dir")
    l = [...l].sort((a, b) => (a.direccion || "").localeCompare(b.direccion || "", "es"));
  if (o === "mz") l = [...l].sort((a, b) => mz(a).localeCompare(mz(b), "es", { numeric: true }));
  const total = l.length,
    paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (pagina > paginas) pagina = paginas;
  const ini = (pagina - 1) * POR_PAGINA;
  l = l.slice(ini, ini + POR_PAGINA);
  $("#rescount").textContent = total
    ? `Mostrando ${ini + 1}–${ini + l.length} de ${total} (total guardados: ${all.length})`
    : `0 de ${all.length} registros`;
  renderPager(paginas);
  $("#rows").innerHTML = l.length
    ? l
        .map((r) => {
          const c = r._tipo === "croquis",
            [tn, tc] = TIPOS[r._tipo] || ["—", ""];
          const det = c
            ? `Calzada <b>${r.calzada || "—"} m</b> · Total <b>${r.ancho_total || "—"} m</b>${r.dap ? ` · DAP <b>${r.dap} cm</b>` : ""}`
            : `${hl(esp(r), q)}${urg(r) ? ` · <b>${esc(urg(r))}</b>` : ""}`;
          return `<tr><td data-l="Fecha">${new Date(r._actualizado || r._creado).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</td>
    <td data-l="Tipo"><span class="tag ${tc}">${tn}</span></td><td data-l="Dirección"><b>${hl(titulo(r), q)}</b>${r.id_arbol && r.direccion ? `<div class="det">${esc(r.id_arbol)}</div>` : ""}</td><td data-l="Manzana">${hl(mz(r), q)}</td><td class="det" data-l="Detalle">${det}</td>
    <td class="tdacts"><div class="acts"><button class="btn bs sm" data-pdf="${r._id}">${ic("pdf")} PDF</button><button class="btn bs sm" data-ver="${r._id}">${ic("eye")} Ver</button>${r._tipo === "censo" ? "" : `<button class="btn bs sm" data-ed="${r._id}">${ic("edit")} Editar</button>`}<button class="btn bd sm" data-del="${r._id}" aria-label="Eliminar">${ic("trash")}</button></div></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">${all.length ? "Ningún registro coincide con los filtros" : "Aún no hay registros guardados"}</td></tr>`;
}
function renderPager(paginas) {
  const b = (p, t, dis, on) =>
    `<button type="button" class="pg${on ? " on" : ""}" data-pg="${p}" ${dis ? "disabled" : ""}>${t}</button>`;
  let h = b(1, ic("first"), pagina === 1) + b(pagina - 1, ic("prev") + " Anterior", pagina === 1);
  const desde = Math.max(1, Math.min(pagina - 2, paginas - 4)),
    hasta = Math.min(paginas, desde + 4);
  for (let p = desde; p <= hasta; p++) h += b(p, p, false, p === pagina);
  h +=
    b(pagina + 1, "Siguiente " + ic("next"), pagina === paginas) +
    b(paginas, ic("last"), pagina === paginas);
  $("#pager").innerHTML =
    paginas > 1 ? h + `<span class="pginfo">Página ${pagina} de ${paginas}</span>` : "";
}
$("#pager").onclick = (e) => {
  const b = e.target.closest("[data-pg]");
  if (!b || b.disabled) return;
  pagina = +b.dataset.pg;
  renderRows();
  $("#v-registros").scrollIntoView({ behavior: "smooth" });
};
const filtrar = () => {
  pagina = 1;
  renderRows();
};
["#q", "#fd1", "#fd2"].forEach((i) => ($(i).oninput = filtrar));
["#ft", "#fm", "#fe", "#fu", "#fo"].forEach((i) => ($(i).onchange = filtrar));
$("#fclr").onclick = () => {
  ["#q", "#ft", "#fm", "#fe", "#fu", "#fd1", "#fd2"].forEach((i) => ($(i).value = ""));
  $("#fo").value = "new";
  pagina = 1;
  renderRows();
};
$("#rows").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const id = b.dataset.pdf || b.dataset.ed || b.dataset.del || b.dataset.ver;
  const r = DB.all().find((x) => x._id === id);
  if (!r) return;
  if (b.dataset.pdf) pdf(r);
  if (b.dataset.ver) verRegistro(r);
  if (b.dataset.ed) {
    go(r._tipo);
    load($("#f-" + r._tipo), r);
    $$("[data-photo]").forEach((i) => showPrev(i.dataset.photo, r[i.dataset.photo]));
    syncClr();
    drawCroquis();
  }
  if (
    b.dataset.del &&
    (await confirmar({
      titulo: "¿Eliminar registro?",
      texto: `Se eliminará <b>${esc(titulo(r))}</b>. Esta acción no se puede deshacer.`,
      ok: "Sí, eliminar",
      icono: "trash",
      peligro: true
    }))
  ) {
    await DB.del(id);
    renderRows();
    stats();
    Sync.run();
    toast("Registro eliminado");
  }
};
const dl = (data, name, type) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
};
const hoy = () => new Date().toISOString().slice(0, 10);
$("#exp").onclick = () =>
  dl(JSON.stringify(DB.all(), null, 1), `respaldo_arbolado_${hoy()}.json`, "application/json");
$("#imp").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const l = JSON.parse(await f.text());
    if (!Array.isArray(l)) throw 0;
    for (const r of l) if (r._id) await DB.upsert(r);
    Sync.run();
    toast(`${l.length} registros restaurados ✔`);
    renderRows();
    stats();
  } catch (_) {
    toast("Archivo de respaldo no válido");
  }
  e.target.value = "";
};
$("#csv").onclick = () => {
  const l = DB.all();
  if (!l.length) return toast("No hay registros");
  const keys = [...new Set(l.flatMap((r) => Object.keys(r)))].filter(
    (k) => !l.some((r) => typeof r[k] === "string" && r[k].startsWith("data:"))
  );
  const q = (v) => `"${String(Array.isArray(v) ? v.join(", ") : (v ?? "")).replace(/"/g, '""')}"`;
  dl(
    "﻿" + [keys.join(";"), ...l.map((r) => keys.map((k) => q(r[k])).join(";"))].join("\n"),
    `registros_arbolado_${hoy()}.csv`,
    "text/csv"
  );
};

/* ============ 8. PDF ============ */
const LBL = {
  direccion: "Dirección",
  direccion_gps: "Coordenadas GPS",
  manzana: "Manzana / Lote",
  fecha: "Fecha",
  km_inicial: "Km inicial",
  registro: "N° registro",
  cables: "Cables eléctricos aéreos",
  postes: "Postes / red ubicados en",
  altura_cables_izq: "Altura mín. cables lado izq. (m)",
  altura_cables_der: "Altura mín. cables lado der. (m)",
  altura_cables: "Altura mín. cables general (m)",
  sentido: "Sentido del tránsito",
  flujo: "Dirección del flujo",
  vereda_izq: "Vereda izq. (m)",
  plata_izq: "Platabanda izq. (m)",
  mat_plata_izq: "Material platabanda izq.",
  calzada: "Calzada solera a solera (m)",
  plata_der: "Platabanda der. (m)",
  mat_plata_der: "Material platabanda der.",
  vereda_der: "Vereda der. (m)",
  ancho_total: "Ancho total entre líneas oficiales (m)",
  ubic_arbol: "Ubicación del árbol",
  testigo_diam: "Testigo – diámetro (cm)",
  testigo_alt: "Testigo – altura (m)",
  dap: "DAP (cm)",
  altura_copa: "Altura de copa (m)",
  distancia_d: "Distancia D (m)",
  copa_n: "Proyección copa N (m)",
  copa_s: "Proyección copa S (m)",
  inclinacion: "Inclinación (°)",
  orient_incl: "Orientación inclinación",
  alt_incl: "Altura punto inclinación (m)",
  base_ancho: "Ancho base (cm)",
  raiz: "Profundidad / raíz (cm)",
  med_tronco: "Medida tronco (cm)",
  med_adic: "Medida adicional (cm)",
  notas: "Notas de campo"
};
const GRUPOS = {
  croquis: [
    [
      "Identificación",
      ["direccion", "direccion_gps", "manzana", "fecha", "km_inicial", "registro"]
    ],
    [
      "Red eléctrica y tránsito",
      [
        "cables",
        "postes",
        "altura_cables_izq",
        "altura_cables_der",
        "altura_cables",
        "sentido",
        "flujo"
      ]
    ],
    [
      "Perfil transversal (izquierda → derecha)",
      [
        "vereda_izq",
        "plata_izq",
        "mat_plata_izq",
        "calzada",
        "plata_der",
        "mat_plata_der",
        "vereda_der",
        "ancho_total",
        "ubic_arbol"
      ]
    ],
    [
      "Datos del árbol",
      [
        "testigo_diam",
        "testigo_alt",
        "dap",
        "altura_copa",
        "distancia_d",
        "copa_n",
        "copa_s",
        "inclinacion",
        "orient_incl",
        "alt_incl",
        "base_ancho",
        "raiz",
        "med_tronco",
        "med_adic"
      ]
    ],
    ["Observaciones", ["notas"]]
  ]
};

async function svgToPng() {
  drawCroquis();
  const svg = $("#svg"),
    xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 2000;
  c.height = 600;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 2000, 600);
  g.drawImage(img, 0, 0, 2000, 600);
  return c.toDataURL("image/png");
}
async function pdf(r) {
  if (!window.jspdf) {
    toast("No se pudo cargar el generador de PDF");
    return;
  }
  if (r._tipo === "censo") return pdfCenso(r);
  const { jsPDF } = window.jspdf,
    doc = new jsPDF({ unit: "mm", format: "letter" }),
    W = doc.internal.pageSize.getWidth();
  const isC = r._tipo === "croquis";
  doc.setFillColor(11, 92, 143);
  doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(91, 180, 234);
  doc.rect(0, 26, W, 2, "F");
  doc.setTextColor(255);
  doc.setFontSize(15);
  doc.setFont(undefined, "bold");
  doc.text(
    isC ? "CROQUIS DE PERFIL VIAL (CORTE TRANSVERSAL)" : ENCUESTA.titulo.toUpperCase(),
    14,
    13
  );
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(
    `Registro ${r._id.toUpperCase()}  ·  ${new Date(r._creado).toLocaleString("es-CL")}`,
    14,
    20
  );
  let y = 36;
  const grupos = isC
    ? GRUPOS.croquis
    : ENCUESTA.secciones.map((s) => [s.titulo, s.preguntas.map((p) => p.id)]);
  const allQ = ENCUESTA.secciones.flatMap((s) => s.preguntas),
    photos = [];
  const lab = isC
    ? LBL
    : Object.fromEntries(
        allQ.map((p) => [p.id, (p.n ? p.n + ". " : "") + p.label + (p.unit ? ` (${p.unit})` : "")])
      );
  const val = (id) => {
    const q = allQ.find((p) => p.id === id);
    let v = r[id];
    if (q && q.type === "photo") {
      if (v) photos.push([lab[id], v]);
      return v ? "Ver fotografía adjunta" : "—";
    }
    if (v === "Otros" && r[id + "_otro"]) v = "Otros: " + r[id + "_otro"];
    if (q && q.type === "gps" && r[id + "_gps"]) v = (v || "") + "  ·  GPS: " + r[id + "_gps"];
    return Array.isArray(v) ? v.join(", ") : v || "—";
  };
  if (isC) {
    const cur = read($("#f-croquis"));
    load($("#f-croquis"), r);
    const png = await svgToPng();
    load($("#f-croquis"), cur);
    drawCroquis();
    doc.addImage(png, "PNG", 14, y, W - 28, (W - 28) * 0.3);
    y += (W - 28) * 0.3 + 6;
  }
  grupos.forEach(([t, ids]) => {
    const body = ids.map((id) => [
      lab[id] || id,
      isC ? (Array.isArray(r[id]) ? r[id].join(", ") : r[id] || "—") : val(id)
    ]);
    doc.autoTable({
      startY: y,
      head: [[t, ""]],
      body,
      theme: "grid",
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [30, 136, 201], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [242, 249, 254] },
      styles: { fontSize: 9.5, cellPadding: 2.2, lineColor: [207, 227, 242] },
      columnStyles: { 0: { cellWidth: 72, fontStyle: "bold", textColor: [22, 50, 74] } }
    });
    y = doc.lastAutoTable.finalY + 5;
  });
  photos.forEach(([t, d]) => {
    const p = doc.getImageProperties(d),
      w = Math.min(120, W - 28),
      h = (w * p.height) / p.width;
    if (y + h + 10 > 262) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(11, 92, 143);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text(t, 14, y + 4);
    doc.addImage(d, "JPEG", 14, y + 7, w, h);
    y += h + 14;
  });
  if (y > 235) {
    doc.addPage();
    y = 30;
  }
  y = Math.max(y + 18, 240);
  doc.setDrawColor(11, 92, 143);
  doc.line(W - 90, y, W - 14, y);
  doc.setTextColor(22, 50, 74);
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text("Rodolfo Gazmuri Sánchez", W - 52, y + 5, { align: "center" });
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.text("Certificado en Arbolado Urbano", W - 52, y + 10, { align: "center" });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${pages}`, W - 14, 272, { align: "right" });
    doc.text("Sistema Arbolado Urbano · by Bryan", 14, 272);
  }
  doc.save(
    `${isC ? "croquis" : "evaluacion"}_${(r.direccion || "sin_direccion").replace(/\W+/g, "_")}_${r._id}.pdf`
  );
}

/* ============ 9. init ============ */
$("#f-croquis").fecha.value = new Date().toISOString().slice(0, 10);
drawCroquis();
DB.init().then(() => {
  stats();
  renderRows();
  renderManzanas();
  Sync.run();
});
window.addEventListener("online", () => Sync.run());
window.addEventListener("offline", () => Sync.badge());
$("#syncBtn").onclick = () => Sync.run(true);
setInterval(() => Sync.run(), 5 * 60 * 1000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
