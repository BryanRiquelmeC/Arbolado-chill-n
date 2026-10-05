/* =============================================================
   Almacenamiento y sincronización
   1) DB   → guarda todo en la tablet (IndexedDB). Funciona sin internet.
   2) Sync → cuando hay internet, sube los cambios a Supabase y
             descarga los registros de otras tablets.
   ============================================================= */

const DB = {
  cache: [],
  db: null,

  async init() {
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (e) {}
    try {
      this.db = await new Promise((ok, ko) => {
        const r = indexedDB.open("arbolado_urbano", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("registros", { keyPath: "_id" });
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
      this.cache = await new Promise((ok) => {
        const q = this.db.transaction("registros").objectStore("registros").getAll();
        q.onsuccess = () => ok(q.result || []);
        q.onerror = () => ok([]);
      });
      // Migración desde versiones anteriores (localStorage)
      let old = [];
      try {
        old = JSON.parse(localStorage.getItem("arbolado_registros")) || [];
      } catch (e) {}
      for (const r of old)
        if (!this.cache.some((x) => x._id === r._id)) {
          r._pend = true;
          this.cache.push(r);
          await this.put(r);
        }
      try {
        localStorage.removeItem("arbolado_registros");
      } catch (e) {}
    } catch (e) {
      this.db = null;
      try {
        this.cache = JSON.parse(localStorage.getItem("arbolado_registros")) || [];
      } catch (_) {}
    }
    this.sort();
  },

  sort() {
    this.cache.sort((a, b) =>
      (b._actualizado || b._creado || "").localeCompare(a._actualizado || a._creado || "")
    );
  },

  put(r) {
    if (!this.db) {
      localStorage.setItem("arbolado_registros", JSON.stringify(this.cache));
      return Promise.resolve();
    }
    return new Promise((ok, ko) => {
      const t = this.db.transaction("registros", "readwrite");
      t.objectStore("registros").put(r);
      t.oncomplete = ok;
      t.onerror = () => ko(t.error);
    });
  },

  remove(id) {
    if (!this.db) {
      localStorage.setItem("arbolado_registros", JSON.stringify(this.cache));
      return Promise.resolve();
    }
    return new Promise((ok) => {
      const t = this.db.transaction("registros", "readwrite");
      t.objectStore("registros").delete(id);
      t.oncomplete = ok;
    });
  },

  all() {
    return this.cache;
  },

  /* fromCloud=true: viene de Supabase, no hay que volver a subirlo */
  async upsert(r, fromCloud = false) {
    r._pend = !fromCloud;
    const i = this.cache.findIndex((x) => x._id === r._id);
    i >= 0 ? (this.cache[i] = r) : this.cache.push(r);
    this.sort();
    await this.put(r);
  },

  async del(id) {
    this.cache = this.cache.filter((x) => x._id !== id);
    await this.remove(id);
    Sync.queueDelete(id);
  }
};

/* ---------------- Sincronización con Supabase (sin login) ---------------- */
const Sync = {
  busy: false,
  last: localStorage.getItem("sync_last") || "",

  enabled() {
    return !!(window.CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
  },
  url(q = "") {
    return CONFIG.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + (CONFIG.TABLA || "registros") + q;
  },
  headers(extra = {}) {
    return {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      // Las claves nuevas (sb_publishable_...) no son JWT: solo van en "apikey".
      // Las claves antiguas "anon" (eyJ...) también se envían como Bearer.
      ...(CONFIG.SUPABASE_ANON_KEY.startsWith("eyJ")
        ? { Authorization: "Bearer " + CONFIG.SUPABASE_ANON_KEY }
        : {}),
      "Content-Type": "application/json",
      ...extra
    };
  },

  dels() {
    try {
      return JSON.parse(localStorage.getItem("sync_del")) || [];
    } catch (e) {
      return [];
    }
  },
  queueDelete(id) {
    if (!this.enabled()) return;
    const d = this.dels();
    d.push(id);
    localStorage.setItem("sync_del", JSON.stringify(d));
  },

  /* Registro local → fila de la tabla */
  toRow(r) {
    const { _pend, ...datos } = r;
    return {
      id: r._id,
      tipo: r._tipo,
      direccion: r.direccion || null,
      manzana: String((r._tipo === "encuesta" ? r.p1 : r.manzana) || "").trim() || null,
      especie:
        r._tipo === "censo"
          ? r.especie || null
          : r.p3 === "Otros"
            ? r.p3_otro || "Otros"
            : r.p3 || null,
      urgencia: r._tipo === "censo" ? r.urgencia || null : r.p32 ? r.p32.split(" (")[0] : null,
      id_arbol: r.id_arbol || null,
      dispositivo: r._dispositivo || null,
      creado: r._creado,
      actualizado: r._actualizado || r._creado,
      datos
    };
  },

  async push() {
    // 1) eliminaciones pendientes
    const dels = this.dels();
    if (dels.length) {
      const res = await fetch(this.url(`?id=in.(${dels.map(encodeURIComponent).join(",")})`), {
        method: "DELETE",
        headers: this.headers()
      });
      if (!res.ok) throw new Error("delete " + res.status);
      localStorage.setItem("sync_del", "[]");
    }
    // 2) registros nuevos o modificados (en lotes de 20 por las fotos)
    const pend = DB.all().filter((r) => r._pend);
    for (let i = 0; i < pend.length; i += 20) {
      const lote = pend.slice(i, i + 20);
      const res = await fetch(this.url("?on_conflict=id"), {
        method: "POST",
        headers: this.headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(lote.map((r) => this.toRow(r)))
      });
      if (!res.ok) throw new Error("upsert " + res.status + " " + (await res.text()));
      for (const r of lote) {
        r._pend = false;
        await DB.put(r);
      }
    }
  },

  async pull() {
    const res = await fetch(this.url("?select=datos,actualizado&order=actualizado.desc"), {
      headers: this.headers()
    });
    if (!res.ok) throw new Error("select " + res.status);
    const filas = await res.json(),
      ids = new Set(filas.map((f) => f.datos._id));
    for (const f of filas) {
      const loc = DB.all().find((x) => x._id === f.datos._id);
      if (!loc || (!loc._pend && (f.datos._actualizado || "") > (loc._actualizado || "")))
        await DB.upsert(f.datos, true);
    }
    // registros borrados desde otra tablet
    for (const r of [...DB.all()])
      if (!r._pend && !ids.has(r._id)) {
        DB.cache = DB.cache.filter((x) => x !== r);
        await DB.remove(r._id);
      }
  },

  async run(manual = false) {
    if (!this.enabled()) {
      this.badge();
      if (manual) toast("Nube no configurada: complete js/config.js");
      return;
    }
    if (this.busy) return;
    if (!navigator.onLine) {
      this.badge();
      if (manual) toast("Sin conexión: los datos quedan guardados en la tablet");
      return;
    }
    this.busy = true;
    this.badge("Sincronizando…");
    try {
      await this.push();
      await this.pull();
      this.last = new Date().toISOString();
      localStorage.setItem("sync_last", this.last);
      if (manual) toast("Sincronización completa ✔");
      if (typeof renderRows === "function") {
        renderRows();
        stats();
      }
    } catch (e) {
      console.error(e);
      if (manual) toast("⚠ Error al sincronizar, se reintentará");
    } finally {
      this.busy = false;
      this.badge();
    }
  },

  badge(txt) {
    const dot = document.getElementById("syncDot");
    if (!dot) return;
    const pend = DB.all().filter((r) => r._pend).length + this.dels().length;
    let cls = "",
      t = "",
      sub = "";
    if (!this.enabled()) {
      t = "Solo en este dispositivo";
      sub = "Nube no configurada";
    } else if (txt) {
      cls = "wait";
      t = txt;
    } else if (!navigator.onLine) {
      cls = "off";
      t = "Sin conexión";
      sub = pend ? `${pend} cambio(s) pendientes` : "Datos guardados en la tablet";
    } else if (pend) {
      cls = "wait";
      t = `${pend} pendiente(s) de subir`;
    } else {
      cls = "ok";
      t = "Sincronizado";
    }
    if (!sub && this.last)
      sub =
        "Última: " +
        new Date(this.last).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
    dot.className = "dot " + cls;
    document.getElementById("syncTxt").textContent = t;
    document.getElementById("syncSub").textContent = sub;
  }
};
