/* =============================================================
   Manzanas, censo importado y reportes por manzana
   ============================================================= */

/* ---------- Ventana de detalle ---------- */
const Modal = {
  open(t, sub, body, foot = "") {
    $("#mclose").onclick = () => Modal.close();
    $("#mtitle").textContent = t;
    $("#msub").textContent = sub;
    $("#mbody").innerHTML = body;
    $("#mfoot").innerHTML = foot;
    $("#modal").classList.add("on");
    $("#mbody").scrollTop = 0;
  },
  close() {
    $("#modal").classList.remove("on");
  }
};
$("#mclose").onclick = Modal.close;
$("#modal").onclick = (e) => {
  if (e.target.id === "modal") Modal.close();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Modal.close();
});

const link = (u, t) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : "—");

/* Datos principales de un registro de censo, en orden */
function fichaCenso(r) {
  return [
    ["ID Árbol", r.id_arbol],
    ["N° de árbol", r.n_arbol],
    ["Manzana", r.manzana],
    ["Dirección", r.direccion],
    ["GPS", r.gps],
    ["Especie", r.especie],
    ["Fecha de registro", r.fecha ? new Date(r.fecha + "T12:00").toLocaleDateString("es-CL") : ""],
    ["Urgencia", r.urgencia],
    ["Recomendación técnica", r.recomendacion]
  ];
}

function verCenso(r) {
  const kv = ([k, v]) => `<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v || "—")}</dd></dl>`;
  const body = `<h3 class="sec">Identificación</h3>${fichaCenso(r).map(kv).join("")}
    <dl class="kv"><dt>Informe original</dt><dd>${link(r.informe_url, "Abrir informe PDF (Drive)")}</dd></dl>
    ${r.fotos_url ? `<dl class="kv"><dt>Fotografías</dt><dd>${link(r.fotos_url, "Abrir fotografías")}</dd></dl>` : ""}
    <h3 class="sec">Evaluación completa (${r.campos.length} respuestas)</h3>${r.campos.map(kv).join("")}
    <p class="det" style="margin-top:12px">Origen: ${esc(r._origen || "Importación")}</p>`;
  Modal.open(
    titulo(r),
    `Manzana ${r.manzana} · ${r.especie || "Especie no indicada"}`,
    body,
    `<button class="btn bs" onclick="Modal.close()">Cerrar</button><button class="btn bp" id="mpdf">${ic("pdf")} Descargar PDF</button>`
  );
  $("#mpdf").onclick = () => pdfCenso(r);
}

/* ---------- Agrupación por manzana ---------- */
const nivel = (u) =>
  /EMERGENCIA/.test(u)
    ? "r1"
    : /URGENTE/.test(u)
      ? "r2"
      : /PROGRAMABLE/.test(u)
        ? "r3"
        : u
          ? "r4"
          : "";
const contar = (arr) =>
  Object.entries(arr.reduce((o, v) => (v && (o[v] = (o[v] || 0) + 1), o), {})).sort(
    (a, b) => b[1] - a[1]
  );

function grupos() {
  const g = {};
  for (const r of DB.all()) {
    const m = mz(r) || "Sin manzana";
    (g[m] = g[m] || []).push(r);
  }
  return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }));
}

function renderManzanas() {
  const q = ($("#mzq").value || "").trim().toLowerCase();
  const gs = grupos().filter(([m]) => !q || m.toLowerCase().includes(q));
  $("#mzgrid").innerHTML = gs.length
    ? gs
        .map(([m, l]) => {
          const t = (k) => l.filter((r) => r._tipo === k).length;
          const esps = contar(l.map(esp)).slice(0, 4),
            urgs = contar(l.map(urg));
          return `<article class="mzc">
      <header><div><h4>Manzana ${esc(m)}</h4><span>${l.length} registro${l.length === 1 ? "" : "s"}</span></div><span class="mzico">${ic("tree")}</span></header>
      <div class="bd">
        <div class="row">${t("censo") ? `<span class="tag tp-x">Censo ${t("censo")}</span>` : ""}${t("encuesta") ? `<span class="tag tp-e">VTA ${t("encuesta")}</span>` : ""}${t("croquis") ? `<span class="tag tp-c">Croquis ${t("croquis")}</span>` : ""}</div>
        <div><div class="lbl">Especies principales</div><div class="row">${esps.map(([e, c]) => `<span class="pill">${esc(e)} · ${c}</span>`).join("") || "—"}</div></div>
        <div><div class="lbl">Urgencia de intervención</div><div class="row">${urgs.map(([u, c]) => `<span class="pill ${nivel(u)}">${esc(u)} · ${c}</span>`).join("") || "—"}</div></div>
      </div>
      <footer><button class="btn bs sm" data-mzver="${esc(m)}">${ic("folder")} Ver registros</button><button class="btn bp sm" data-mzpdf="${esc(m)}">${ic("pdf")} Informe manzana</button></footer>
    </article>`;
        })
        .join("")
    : `<div class="card empty">${DB.all().length ? "Ninguna manzana coincide" : "Aún no hay registros. Importe un Excel o complete un formulario."}</div>`;
}
$("#mzq").oninput = renderManzanas;
$("#mzgrid").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.mzver) {
    go("registros");
    $("#fclr").click();
    renderRows();
    $("#fm").value = b.dataset.mzver;
    $("#fo").value = "dir";
    renderRows();
  }
  if (b.dataset.mzpdf) pdfManzana(b.dataset.mzpdf);
};

/* ---------- Importar Excel ---------- */
$("#impx").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    toast("Leyendo planilla…");
    const regs = await Importar.leerArchivo(f);
    if (!regs.length) return toast("La planilla no tiene registros reconocibles");
    const nuevos = regs.filter((r) => !DB.all().some((x) => x._id === r._id)).length;
    const porMz = contar(regs.map((r) => r.manzana)).sort((a, b) =>
      a[0].localeCompare(b[0], "es", { numeric: true })
    );
    Modal.open(
      "Importar planilla",
      f.name,
      `
      <p style="margin:12px 0;font-size:15px">Se encontraron <b>${regs.length}</b> árboles: <b>${nuevos}</b> nuevos y <b>${regs.length - nuevos}</b> que se actualizarán (mismo ID_Arbol, no se duplican).</p>
      <h3 class="sec">Por manzana</h3>${porMz.map(([m, c]) => `<dl class="kv"><dt>Manzana ${esc(m)}</dt><dd>${c} árboles</dd></dl>`).join("")}`,
      `<button class="btn bs" onclick="Modal.close()">Cancelar</button><button class="btn bp" id="mimp">${ic("sheet")} Importar ${regs.length} registros</button>`
    );
    $("#mimp").onclick = async () => {
      $("#mimp").disabled = true;
      for (const r of regs) await DB.upsert(r);
      Modal.close();
      toast(`${regs.length} registros importados ✔`);
      stats();
      renderRows();
      renderManzanas();
      Sync.run();
    };
  } catch (err) {
    console.error(err);
    toast("No se pudo leer el archivo");
  }
};

/* ---------- PDF ---------- */
function pdfBase(titulo1, sub) {
  const { jsPDF } = window.jspdf,
    doc = new jsPDF({ unit: "mm", format: "letter" }),
    W = doc.internal.pageSize.getWidth();
  doc.setFillColor(11, 92, 143);
  doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(91, 180, 234);
  doc.rect(0, 26, W, 2, "F");
  doc.setTextColor(255);
  doc.setFontSize(15);
  doc.setFont(undefined, "bold");
  doc.text(titulo1, 14, 13);
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(sub, 14, 20);
  return { doc, W };
}
const tabla = (doc, y, head, body, opt = {}) => {
  doc.autoTable({
    startY: y,
    head: [head],
    body,
    theme: "grid",
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [30, 136, 201], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [242, 249, 254] },
    styles: { fontSize: 9, cellPadding: 2, lineColor: [207, 227, 242], overflow: "linebreak" },
    ...opt
  });
  return doc.lastAutoTable.finalY + 6;
};
function pdfFin(doc, W, archivo) {
  let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 240;
  if (y > 250) {
    doc.addPage();
    y = 40;
  }
  doc.setDrawColor(11, 92, 143);
  doc.line(W - 90, y, W - 14, y);
  doc.setTextColor(22, 50, 74);
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text("Rodolfo Gazmuri Sánchez", W - 52, y + 5, { align: "center" });
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.text("Certificado en Arbolado Urbano", W - 52, y + 10, { align: "center" });
  const p = doc.getNumberOfPages();
  for (let i = 1; i <= p; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${p}`, W - 14, 272, { align: "right" });
    doc.text("Sistema Arbolado Urbano · by Bryan", 14, 272);
  }
  doc.save(archivo);
}

function pdfCenso(r) {
  const { doc, W } = pdfBase(
    "INFORME VTA – CENSO ARBOLADO URBANO 2026",
    `ID ${r.id_arbol || r._id}  ·  Manzana ${r.manzana}  ·  ${r.fecha || ""}`
  );
  const col = {
    columnStyles: { 0: { cellWidth: 62, fontStyle: "bold", textColor: [22, 50, 74] } }
  };
  let y = tabla(
    doc,
    36,
    ["Identificación", ""],
    fichaCenso(r).map(([k, v]) => [k, v || "—"]),
    col
  );
  if (r.informe_url || r.fotos_url)
    y = tabla(
      doc,
      y,
      ["Enlaces", ""],
      [
        ["Informe original", r.informe_url || "—"],
        ["Fotografías", r.fotos_url || "—"]
      ],
      col
    );
  tabla(doc, y, ["Evaluación completa", ""], r.campos, col);
  pdfFin(doc, W, `censo_mz${r.manzana}_${Importar.slug(r.id_arbol || r._id)}.pdf`);
}

function pdfManzana(m) {
  const l = (grupos().find(([k]) => k === m) || [, []])[1]
    .slice()
    .sort(
      (a, b) => (+a.n_arbol || 0) - (+b.n_arbol || 0) || titulo(a).localeCompare(titulo(b), "es")
    );
  const { doc, W } = pdfBase(
    `INFORME MANZANA ${m.toUpperCase()}`,
    `Censo Arbolado Urbano 2026  ·  ${l.length} registros  ·  Emitido ${new Date().toLocaleDateString("es-CL")}`
  );
  let y = tabla(
    doc,
    36,
    ["Resumen", "Cantidad"],
    [
      ...Object.entries(TIPOS)
        .map(([k, [n]]) => [n, l.filter((r) => r._tipo === k).length])
        .filter((x) => x[1]),
      ...contar(l.map(urg)).map(([u, c]) => ["Urgencia: " + u, c])
    ],
    { columnStyles: { 1: { cellWidth: 30, halign: "center" } } }
  );
  y = tabla(doc, y, ["Especie", "N° árboles"], contar(l.map(esp)), {
    columnStyles: { 1: { cellWidth: 30, halign: "center" } }
  });
  tabla(
    doc,
    y,
    ["N°", "ID / Dirección", "Tipo", "Especie", "Urgencia"],
    l.map((r, i) => [
      r.n_arbol || i + 1,
      [r.id_arbol, r.direccion].filter(Boolean).join("\n") || "—",
      (TIPOS[r._tipo] || [""])[0],
      esp(r) || "—",
      urg(r) || "—"
    ]),
    {
      styles: { fontSize: 8, cellPadding: 1.8, lineColor: [207, 227, 242] },
      columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 22 } }
    }
  );
  pdfFin(doc, W, `informe_manzana_${Importar.slug(m)}.pdf`);
}

/* ---------- Ver cualquier registro (croquis · Matriz VTA · censo) ---------- */
function editarRegistro(r) {
  Modal.close();
  go(r._tipo);
  load($("#f-" + r._tipo), r);
  $$("[data-photo]").forEach((i) => showPrev(i.dataset.photo, r[i.dataset.photo]));
  syncClr();
  drawCroquis();
}
function verRegistro(r) {
  if (r._tipo === "censo") return verCenso(r);
  const kv = (k, v) => `<dl class="kv"><dt>${esc(k)}</dt><dd>${v}</dd></dl>`;
  const fmt = (v) => esc(Array.isArray(v) ? v.join(", ") : v || "—") || "—";
  let body = "",
    sub = "";
  if (r._tipo === "croquis") {
    // dibuja el croquis de este registro sin perder lo que haya en el formulario
    const f = $("#f-croquis"),
      cur = read(f);
    load(f, r);
    drawCroquis();
    const svg = $("#svg").outerHTML.replace('id="svg"', "");
    load(f, cur);
    drawCroquis();
    body =
      `<div class="croquis" style="margin:12px 0">${svg}</div>` +
      GRUPOS.croquis
        .map(
          ([t, ids]) =>
            `<h3 class="sec">${esc(t)}</h3>` +
            ids.map((id) => kv(LBL[id] || id, fmt(r[id]))).join("")
        )
        .join("");
    sub = `Croquis de perfil vial · Manzana ${r.manzana || "—"}`;
  } else {
    body = ENCUESTA.secciones
      .map(
        (sec) =>
          `<h3 class="sec">${ic(sec.icono)} ${esc(sec.titulo)}</h3>` +
          sec.preguntas
            .map((p) => {
              let v = r[p.id],
                html;
              if (p.type === "photo")
                html = v
                  ? `<img src="${v}" alt="" style="max-width:100%;max-height:260px;border-radius:9px">`
                  : "—";
              else {
                if (v === "Otros" && r[p.id + "_otro"]) v = "Otros: " + r[p.id + "_otro"];
                if (p.type === "gps" && r[p.id + "_gps"])
                  v = (v || "") + " · GPS: " + r[p.id + "_gps"];
                html = fmt(v) + (v && p.unit ? " " + p.unit : "");
              }
              return kv((p.n ? p.n + ". " : "") + p.label, html);
            })
            .join("")
      )
      .join("");
    sub = `Matriz VTA · Manzana ${r.p1 || "—"} · ${esp(r) || "Especie no indicada"}`;
  }
  body += `<p class="det" style="margin-top:12px">Guardado: ${new Date(r._actualizado || r._creado).toLocaleString("es-CL")}${r._pend ? " · pendiente de sincronizar" : ""}</p>`;
  Modal.open(
    titulo(r),
    sub,
    body,
    `<button class="btn bs" onclick="Modal.close()">Cerrar</button><button class="btn bs" id="med">${ic("edit")} Editar</button><button class="btn bp" id="mpdf">${ic("pdf")} Descargar PDF</button>`
  );
  $("#med").onclick = () => editarRegistro(r);
  $("#mpdf").onclick = () => pdf(r);
}
