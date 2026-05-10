# 🔔 TOKEN ALARM

Sistema de alertas de precios para tokens en BSC. Monitorea precios en tiempo real y dispara alertas sonoras, visuales y del navegador cuando se cumplen las condiciones configuradas.

**Sin backend. Sin build. Funciona directo en GitHub Pages.**

---

## ✨ Características

- **Precios en vivo** — GeckoTerminal (primario) + DexScreener via proxy (fallback automático). Sin API key.
- **Órdenes limit** — alertas cuando un token suba o baje de un precio
- **Alertas**: sonido (Web Audio), notificación del navegador, toast visual
- **Modo de prueba** — simula crash/pump para verificar que todo funciona
- **Historial** persistido en localStorage

---

## 🪙 Tokens monitoreados

| Token | Dirección |
|-------|-----------|
| TKN1  | `0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4` |
| TKN2  | `0xf15c7f1F00000000b70505e9cC285A8b18D9A21f` |
| TKN3  | `0xd242797cBe7629C216f95f3deaFE79a9856Cb520` |

Los símbolos reales se obtienen de la API al cargar.

---

## 🚀 Deploy en GitHub Pages

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/token-alarm.git
git push -u origin main
```

Luego: **Settings → Pages → Source: main / (root) → Save**

URL: `https://TU-USUARIO.github.io/token-alarm`

El archivo `.nojekyll` ya está incluido — no necesitás nada más.

---

## 📡 Fuentes de precios

| Fuente | Rol | CORS | Key |
|--------|-----|------|-----|
| GeckoTerminal API | Primaria | ✅ | No |
| DexScreener + corsproxy.io | Fallback | ✅ | No |

El badge en el header muestra qué fuente está activa. El fallback es automático.

---

## 📋 Estructura

```
token-alarm/
├── index.html
├── .nojekyll          ← necesario para GitHub Pages
├── _config.yml
├── css/style.css
└── js/
    ├── tokens.js      ← editar para agregar/quitar tokens
    ├── prices.js      ← multi-source fetch + simulación
    ├── orders.js      ← CRUD órdenes (localStorage)
    ├── alerts.js      ← audio, notificaciones, historial
    ├── ui.js          ← renderizado
    └── app.js         ← controlador + modo de prueba
```

---

## 🧪 Modo de prueba

Abrí ⚙ → "Modo de Prueba" → elegí token + movimiento → **⚡ Ejecutar Simulación**.

Simula crash (-30%), pump (+40%), subas/bajas leves, o un precio manual. Evalúa las órdenes activas, dispara alertas y restaura los precios reales a los 15 segundos.

---

## 🛠 Agregar tokens

Editá `js/tokens.js`:

```js
{
  address: '0xTuDireccion',
  symbol:  'SYM',
  name:    'Nombre',
  chain:   'bsc',
  color:   '#ff7043',
  pairAddress: null,
}
```

## 📝 Licencia

MIT
