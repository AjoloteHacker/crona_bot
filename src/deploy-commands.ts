import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { allCommands } from './commands';

async function deploy() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error(
      '❌ Faltan DISCORD_TOKEN o CLIENT_ID en tu archivo .env. Revisa .env.example.'
    );
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = allCommands.map((cmd) => cmd.slashData.toJSON());

  try {
    console.log(`🩸 Registrando ${body.length} Slash Commands de Crona...`);

    if (guildId && guildId.trim().length > 0) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId.trim()), {
        body,
      });
      console.log(`✅ ¡Se registraron ${body.length} comandos en el servidor de pruebas (${guildId})!`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body,
      });
      console.log(`✅ ¡Se registraron ${body.length} comandos globalmente en Discord!`);
    }
  } catch (error) {
    console.error('❌ Error al registrar Slash Commands:', error);
    process.exit(1);
  }
}

deploy();
