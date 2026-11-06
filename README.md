# 🩸 Crona & Ragnarok — Bot Multifunción de Discord

Un bot de Discord inspirado en el legendario **Chocolat** de la época dorada de Discord, ambientado en el universo de **Soul Eater** con la personalidad de **Crona** y la espada demonio **Ragnarok**.

Soporta un **sistema híbrido de comandos**:
- **Prefijo clásico personalizable por servidor** (por defecto `c!`, ej: `c!hug @usuario`, `c!profile`, `c!daily`).
- **Slash Commands modernos (`/`)** (ej: `/hug`, `/profile`, `/help`).

---

## ✨ Módulos Incluidos (56 Comandos)

| Categoría | Comandos |
| :--- | :--- |
| 💖 **Roleplay Anime (11)** | `hug`, `pat`, `kiss`, `slap`, `cuddle`, `poke`, `bite`, `kill`, `cry`, `blush`, `dance` *(Con GIFs de anime en tiempo real y contador de interacciones entre usuarios)* |
| 🟣 **Economía de Almas (11)** | `balance` (`bal`), `daily`, `work`, `hunt` *(Cazar Kishins)*, `deposit` (`dep`), `withdraw` (`with`), `pay`, `shop`, `buy`, `inventory` (`inv`), `leaderboard` (`top`) |
| ⭐ **Perfil y Niveles (5)** | `profile` (`perfil`), `rank` (`nivel`), `rep` (`+rep`), `setbio`, `settitle` *(Sistema automático de XP por hablar en el chat)* |
| 💍 **Social y Matrimonio (3)** | `marry` *(Propuesta con botones interactivos)*, `divorce`, `ship` *(Calculadora de compatibilidad clásica)* |
| 🎲 **Diversión y Minijuegos (6)** | `8ball`, `roll` (`dados`), `coinflip`, `rps` *(Piedra, papel o tijera)*, `trivia` *(Quiz de anime con botones)*, `scream` |
| 🛡️ **Moderación (7)** | `kick`, `ban`, `timeout` (`mute`), `clear` (`purge`), `warn`, `warnings`, `prefix` |
| 🎵 **Música y Voz (7)** | `play`, `skip`, `stop`, `pause`, `resume`, `queue`, `nowplaying` |
| 🔮 **Utilidad (6)** | `help` *(Menú desplegable interactivo)*, `avatar`, `userinfo`, `serverinfo`, `botinfo`, `ping` |

---

## 🚀 Cómo Configurar y Encender a Crona

### 1. Crear la aplicación en Discord Developer Portal
1. Entra a [Discord Developer Portal](https://discord.com/developers/applications) y haz clic en **New Application** con el nombre **Crona**.
2. En la pestaña **General Information**, copia el **Application ID** (`CLIENT_ID`).
3. En la pestaña **Bot**:
   - Haz clic en **Reset Token** para copiar tu `DISCORD_TOKEN`.
   - Baja hasta **Privileged Gateway Intents** y activa los 3 interruptores:
     - ✅ **Presence Intent**
     - ✅ **Server Members Intent**
     - ✅ **Message Content Intent** *(Imprescindible para que funcione el prefijo clásico `c!`)*
4. En **OAuth2 -> URL Generator**, marca `bot` y `applications.commands`, selecciona permisos de `Administrator` (o los necesarios) e invita a Crona a tu servidor.

### 2. Configurar variables de entorno
Copia el archivo `.env.example` a `.env` y rellena tus datos:
```env
DISCORD_TOKEN=tu_token_aqui
CLIENT_ID=tu_client_id_aqui
GUILD_ID=id_de_tu_servidor_opcional_para_pruebas
DEFAULT_PREFIX=c!
```

### 3. Registrar Slash Commands y Ejecutar
```bash
# Registrar todos los Slash Commands (/) en Discord
npm run deploy

# Iniciar a Crona en modo desarrollo (con recarga automática)
npm run dev

# O compilar y ejecutar en producción
npm run build
npm start
```
