# 🔔 TOKEN ALARM

Sistema de alertas de precios para tokens en BSC. Monitorea precios en tiempo real y dispara alertas sonoras, visuales y del navegador cuando se cumplen las condiciones configuradas.

**Sin backend. Sin build. Funciona directo en GitHub Pages.**

---

## ✨ Características

- **Precios en vivo** — DexScreener API v1 (primaria) + GeckoTerminal (fallback automático). Sin API key.
- **Precio en BNB** — cada card muestra precio USD y precio nativo en BNB simultáneamente
- **Ticker en el header** — scroll continuo con símbolo, precio y variación 24h de todos los tokens
- **Alertas de precio** — alertas cuando un token suba o baje de un precio objetivo, con opción de repetición
- **Alertas**: sonido sintetizado (Web Audio API), notificación del navegador, toast visual
- **8 sonidos de alerta** — Executive, Pulse, Chime, Digital, Sonar, Alarm, Notification, Siren
- **Gráficas embebidas** — DexScreener o PooCoin por card, con precarga en segundo plano
- **Agregar contratos en runtime** — modal para agregar cualquier token BSC sin tocar el código
- **Tokens custom eliminables** — botón ✕ en cada card de token agregado manualmente
- **Modo de prueba** — simula crash/pump/precio manual para verificar que todo funciona
- **Historial** persistido en localStorage (hasta 200 entradas)
- **Reconexión automática** — backoff exponencial ante fallos de API

---

## 🪙 Tokens por defecto

| Símbolo | Dirección |
|---------|-----------|
| USDT.z  | `0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4` |
| USDT.z  | `0xf15c7f1F86398520b70505e9cC285A8b18D9A21f` |
| USDT.z  | `0xd242797cBe7629C216f95f3deaFE79a9856Cb520` |

Los símbolos y nombres reales se obtienen de la API al cargar. Podés agregar cualquier token BSC adicional desde la interfaz sin editar código.

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
| DexScreener API `/tokens/v1/bsc/` | Primaria | ✅ | No |
| DexScreener API `/latest/dex/pairs/bsc/` | Primaria (tokens con par conocido) | ✅ | No |
| GeckoTerminal API v2 | Fallback | ✅ | No |

El badge en el header muestra qué fuente está activa. El fallback a GeckoTerminal es automático. Si un token no tiene `pairAddress` guardado, DexScreener lo descubre automáticamente y lo persiste en memoria para el siguiente ciclo.

El precio de BNB se obtiene en paralelo desde DexScreener o GeckoTerminal y se usa para calcular el precio nativo de cada token.

---

## 📋 Estructura

```
token-alarm/
├── index.html
├── .nojekyll              ← necesario para GitHub Pages
├── _config.yml
├── css/
│   ├── style.css          ← sistema de estilos principal v4.2
│   └── style_additions.css ← estilos adicionales v5.0 (modal, chart tabs)
└── js/
    ├── tokens.js          ← definición de tokens, estado de precios, logos
    ├── prices.js          ← fetch multi-source, simulación, polling
    ├── orders.js          ← CRUD alertas (localStorage)
    ├── alerts.js          ← audio sintetizado, notificaciones, historial
    ├── ui.js              ← renderizado, cards, modal agregar token
    └── app.js             ← controlador principal, modo de prueba, settings
```

---

## 🪙 Agregar tokens desde la interfaz

Hacé click en **＋ CONTRATO** en el header de la sección de tokens. Se abre un modal donde ingresás:

- **Dirección del contrato** (BSC, obligatoria)
- **Símbolo** — ej: `BNB`, `CAKE` (opcional, se puede dejar en blanco)
- **Nombre** — descripción larga (opcional)
- **Color de acento** — selector con 8 presets y color personalizado

El token se agrega al grid inmediatamente y se busca su precio en la próxima actualización. Los tokens custom se persisten en `localStorage` y sobreviven recargas. Podés eliminarlos con el botón **✕** en la card.

---

## 🛠 Agregar tokens por código

Editá el array `DEFAULT_TOKENS` en `js/tokens.js`:

```js
{
  address:     '0xTuDireccion',
  symbol:      'SYM',
  name:        'Nombre del Token',
  chain:       'bsc',
  color:       '#ff7043',
  pairAddress: null,      // se descubre automáticamente
  verified:    false,
  logoOverride: null,     // URL de logo manual, o null para auto-resolver
}
```

---

## 📈 Cards de token

Cada card muestra:

- Logo + símbolo + nombre + antigüedad del pool
- Dirección (últimos 4 caracteres, click para copiar)
- Precio USD grande + precio BNB pequeño
- Variación 1H / 24H / 7D
- Estadísticas: volumen 24h, liquidez, market cap, FDV, txns 24h, alertas activas
- Barra de presión compra/venta
- Chips con las alertas activas del token
- Gráfica embebida desplegable (DexScreener o PooCoin)

---

## 📊 Gráficas

Cada card tiene un botón **CHART** que despliega la gráfica en vivo. Podés alternar entre:

- **DSC** — DexScreener embed (por defecto)
- **POO** — PooCoin embed

La gráfica se precarga en segundo plano al cargar la página. El botón **↗** la abre en una pestaña nueva.

---

## 🔔 Alertas de precio

1. Hacé click en **+ NUEVA ALERTA**
2. Seleccioná token, condición (sube a / baja de) y precio objetivo
3. Opcionalmente: nota, repetición automática, notificación del navegador

Cuando el precio alcanza el objetivo: suena la alerta, aparece un toast y se registra en el historial. Con "Repetir alerta" activado, la alerta se puede disparar nuevamente tras 60 segundos de cooldown.

---

## 🧪 Modo de prueba

Abrí **⚙ → Modo de Prueba** → elegí token + movimiento → **⚡ Ejecutar Simulación**.

| Opción | Efecto |
|--------|--------|
| Caída brusca | −30% del precio actual |
| Pump fuerte | +40% del precio actual |
| Baja leve | −5% del precio actual |
| Suba leve | +5% del precio actual |
| Precio manual | Precio exacto que ingresés |

Evalúa las órdenes activas, dispara alertas y restaura los precios reales a los 15 segundos. El historial marca las entradas de prueba con el badge **PRUEBA**.

---

## ⚙ Configuración

Accedé desde el botón **⚙** en el header:

- **Intervalo de actualización** — 10s / 30s / 1min / 5min
- **Fuente de precios** — DexScreener o GeckoTerminal (forzado)
- **Volumen de alerta** — slider 0–100%
- **Sonido de alerta** — 8 opciones con botón de prueba
- **Notificaciones del navegador** — requiere permiso del browser

Los ajustes se persisten en `localStorage`.

---

## 🔊 Sonidos de alerta

| Nombre | Descripción |
|--------|-------------|
| Executive | Dos tonos graves y cortos |
| Pulse | Doble pulso sinusoidal |
| Chime | Escala ascendente de 4 notas |
| Digital | Secuencia cuadrada rápida |
| Sonar | Ping decreciente con eco |
| Alarm | Ráfaga de dientes de sierra |
| Notification | Tono descendente suave |
| Siren | Barrido ascendente de dientes de sierra |

---

## 🐛 Debug

Abrí la consola del navegador y ejecutá:

```js
_debugPrices()
```

Muestra una tabla con dirección abreviada, pairAddress, precio USD, precio BNB, fuente activa y estado de error para cada token.

---

## 📝 Licencia

MIT
