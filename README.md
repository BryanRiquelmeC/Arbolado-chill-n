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


