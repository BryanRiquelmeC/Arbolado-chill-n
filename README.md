# Arbolado Urbano · Registro de Campo

Censo Arbolado Urbano 2026 — Croquis de perfil vial y Matriz VTA.
Desarrollado por **Bryan**.

## Estructura

```
arbolado-app/
├── index.html              Interfaz (panel, croquis, Matriz VTA, registros)
├── css/styles.css          Estilos (celeste / blanco)
├── js/
│   ├── config.js           ← URL y clave de Supabase (único archivo a editar)
│   ├── encuesta.js         Preguntas de la Matriz VTA
│   ├── db.js               Guardado en la tablet + sincronización con Supabase
│   ├── app.js              Lógica de formularios, croquis, filtros y PDF
│   ├── importar.js         Importación de planillas Excel del censo
│   ├── manzanas.js         Vista por manzana, detalle e informes PDF por manzana
│   └── vendor/             jsPDF y SheetJS (locales, funcionan sin internet)
├── icons/                  Íconos de la app
├── manifest.webmanifest    Permite instalarla en la tablet
├── sw.js                   Funcionamiento sin conexión
└── netlify.toml            Configuración de Netlify

base-de-datos/              (NO se sube a Netlify: contiene datos)
├── schema.sql                      Tabla, índices y vista resumen_manzanas
├── seed_censo_manzanas_23-29.sql   Carga de los 309 árboles del Excel
├── censo_manzanas_23-29.json       Mismo contenido, para "Restaurar" en la app
└── Manzana_24_original.xlsx        Planilla original
```

## Tipos de registro

| Tipo | Origen | Identificador |
|---|---|---|
| Croquis | Formulario de la app | automático |
| Matriz VTA | Formulario de la app | automático |
| Censo | Excel importado (Google Forms) | `censo-<ID_Arbol>` → reimportar actualiza, no duplica |

## Cómo funciona

1. Cada formulario se guarda **primero en la tablet** (funciona sin señal).
2. Si hay internet y Supabase está configurado, se sube a la nube automáticamente
   (al guardar, al recuperar conexión y cada 5 minutos). También con "☁ Sincronizar ahora".
3. Todas las tablets ven los registros de las demás.

## 1. Crear la base de datos (Supabase)

1. Crear un proyecto gratuito en https://supabase.com
2. Ir a **SQL Editor → New query**, pegar `base-de-datos/schema.sql` y presionar **Run**.
3. En **Project Settings → API** copiar la *Project URL* y la clave *anon public*.
4. Pegarlas en `js/config.js`.

> Sin login: cualquiera que tenga la URL de la app puede ver y modificar registros.
> No publique el enlace fuera del equipo de trabajo.

5. Para cargar el censo existente: ejecutar `base-de-datos/seed_censo_manzanas_23-29.sql`
   (o importar el Excel desde la app: Registros → 📥 Importar Excel).

## 2. Publicar en Netlify

**Opción rápida:** entrar a https://app.netlify.com/drop y arrastrar la carpeta `arbolado-app`.

**Opción recomendada (GitHub):**
1. Subir la carpeta a un repositorio de GitHub.
2. En Netlify: **Add new site → Import from Git** → elegir el repositorio.
3. Build command: *(vacío)* · Publish directory: `.`
4. Cada `git push` publica la nueva versión.

Al publicar cambios, subir el número `VERSION` en `sw.js` para que las tablets actualicen.

## 3. Instalar en la tablet Android

Abrir la URL de Netlify en **Chrome → menú ⋮ → "Instalar app" / "Agregar a la pantalla principal"**.
Queda como una app con ícono propio y funciona sin internet.

## Prueba local

```
python -m http.server 8000
```
y abrir http://localhost:8000

## GPS y dirección

El botón **GPS** (en Croquis y Matriz VTA) toma varias lecturas y guarda la más precisa
(se indica la precisión en metros). Con internet, obtiene **calle, número y ciudad** desde
OpenStreetMap (Nominatim, gratuito). Sin internet guarda solo las coordenadas.
Ajustes en `js/gps.js` (`PRECISION_OBJETIVO`, `ESPERA_MAXIMA`).
