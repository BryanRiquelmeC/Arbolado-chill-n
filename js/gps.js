/* =============================================================
   GPS: coordenadas precisas + calle y número (dirección)

   1. Toma varias lecturas del GPS durante unos segundos y se queda
      con la más precisa (se detiene antes si logra ±15 m o menos).
   2. Con internet, convierte las coordenadas en calle y número usando
      OpenStreetMap (Nominatim). Sin internet, guarda solo las coordenadas.

   Uso en HTML:  <div data-gps="direccion" data-req="1"></div>
   Uso en JS:    gpsCampo("direccion", true)
   ============================================================= */

const GPS = {
  PRECISION_OBJETIVO: 15, // metros: si se logra, deja de esperar
  ESPERA_MAXIMA: 12000, // milisegundos de lectura como máximo
  ocupado: false
};

/* Marcado del campo: dirección + botón GPS + coordenadas + estado */
function gpsCampo(id, requerido = false) {
  return `
    <div class="gps-grupo">
      <input type="text" name="${id}" ${requerido ? "required" : ""} placeholder="Calle y número" autocomplete="off">
      <button type="button" class="btn bp gps-btn" data-gps-btn="${id}">${ic("pin")}<span>GPS</span></button>
    </div>
    <div class="gps-coords">
      ${ic("pin")}
      <input type="text" name="${id}_gps" placeholder="Coordenadas (latitud, longitud)" inputmode="decimal">
    </div>
    <div class="gps-estado" id="gps-estado-${id}" aria-live="polite"></div>`;
}

/* Reemplaza los marcadores <div data-gps> del HTML estático */
document.querySelectorAll("[data-gps]").forEach((el) => {
  el.outerHTML = gpsCampo(el.dataset.gps, el.dataset.req === "1");
});

/* Lectura precisa: varias muestras y se queda con la mejor */
function gpsLeer() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error("Este dispositivo no tiene GPS disponible"));
    let mejor = null;
    const terminar = () => {
      navigator.geolocation.clearWatch(vigia);
      clearTimeout(reloj);
      mejor ? resolve(mejor) : reject(new Error("No se pudo obtener la ubicación"));
    };
    const vigia = navigator.geolocation.watchPosition(
      (p) => {
        if (!mejor || p.coords.accuracy < mejor.coords.accuracy) mejor = p;
        if (p.coords.accuracy <= GPS.PRECISION_OBJETIVO) terminar();
      },
      (err) => {
        if (err.code === 1) {
          navigator.geolocation.clearWatch(vigia);
          clearTimeout(reloj);
          reject(
            new Error(
              "Permiso de ubicación denegado. Actívelo en Chrome → Configuración del sitio."
            )
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS.ESPERA_MAXIMA }
    );
    const reloj = setTimeout(terminar, GPS.ESPERA_MAXIMA);
  });
}

/* Coordenadas → calle y número (requiere internet) */
async function gpsDireccion(lat, lon) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1" +
    `&accept-language=es&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Servicio de direcciones no disponible");
  const a = (await res.json()).address || {};
  const calle = a.road || a.pedestrian || a.footway || a.residential || a.path || "";
  const numero = a.house_number || "";
  const ciudad = a.city || a.town || a.village || a.municipality || "";
  return {
    calle,
    numero,
    ciudad,
    texto: [calle && (numero ? `${calle} ${numero}` : calle), ciudad].filter(Boolean).join(", ")
  };
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-gps-btn]");
  if (!b || GPS.ocupado) return;
  const id = b.dataset.gpsBtn,
    f = b.form;
  const campoDir = f[id],
    campoGps = f[id + "_gps"],
    estado = document.getElementById("gps-estado-" + id);
  const aviso = (txt, tipo = "") => {
    estado.className = "gps-estado " + tipo;
    estado.innerHTML = txt;
  };

  GPS.ocupado = true;
  b.disabled = true;
  b.classList.add("cargando");
  aviso(`${ic("refresh", "gira")} Buscando señal GPS… mantenga el dispositivo quieto unos segundos`);
  try {
    const p = await gpsLeer();
    const lat = p.coords.latitude.toFixed(6),
      lon = p.coords.longitude.toFixed(6);
    const prec = Math.round(p.coords.accuracy);
    campoGps.value = `${lat}, ${lon}`;
    const calidad = prec <= 15 ? "ok" : prec <= 40 ? "medio" : "bajo";
    let txt = `Coordenadas registradas · precisión ±${prec} m${calidad === "bajo" ? " (baja: intente al aire libre)" : ""}`;

    if (!navigator.onLine) {
      aviso(`${txt}. Sin internet: escriba la calle y número manualmente.`, calidad);
    } else {
      aviso(`${txt}. Buscando calle…`, calidad);
      try {
        const d = await gpsDireccion(lat, lon);
        if (d.texto) {
          const reemplazar =
            !campoDir.value.trim() ||
            campoDir.dataset.auto === "1" ||
            confirm(`¿Reemplazar la dirección escrita por:\n"${d.texto}"?`);
          if (reemplazar) {
            campoDir.value = d.texto;
            campoDir.dataset.auto = "1";
          }
          txt += d.numero ? "" : ". Revise el número de la casa: el mapa no lo indicó";
          aviso(txt + ".", d.numero ? calidad : "medio");
          if (!d.numero && reemplazar) campoDir.focus();
        } else aviso(`${txt}. No se encontró la calle: escríbala manualmente.`, "medio");
      } catch (_) {
        aviso(`${txt}. No se pudo obtener la calle: escríbala manualmente.`, "medio");
      }
    }
    f.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (err) {
    aviso(err.message, "bajo");
  } finally {
    GPS.ocupado = false;
    b.disabled = false;
    b.classList.remove("cargando");
  }
});

/* Si el usuario edita la dirección a mano, ya no se reemplaza sin preguntar */
document.addEventListener("input", (e) => {
  if (e.isTrusted && e.target.dataset && e.target.dataset.auto) e.target.dataset.auto = "";
});
