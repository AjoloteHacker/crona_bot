import { SlashCommandBuilder } from 'discord.js';
import { CronaCommand } from '../types/command';
import {
  addInventoryItem,
  getInventory,
  getTopUsersByLevel,
  getTopUsersBySouls,
  getUser,
  setCooldownTimestamp,
  setTitle,
  updateSouls,
} from '../database/db';
import { COLORS, EMOJIS, SHOP_ITEMS } from '../utils/constants';
import { createCronaEmbed, createErrorEmbed, createSuccessEmbed } from '../utils/embeds';

function formatCooldown(msRemaining: number): string {
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

export const economyCommands: CronaCommand[] = [
  {
    name: 'balance',
    aliases: ['bal', 'almas', 'cartera', 'wallet'],
    description: 'Consulta cuántas Almas tienes en tu cartera y en el Banco de Shibusen',
    category: 'Economía',
    usage: 'balance [@usuario]',
    slashData: new SlashCommandBuilder()
      .setName('balance')
      .setDescription('Consulta tus Almas recolectadas o las de otro usuario')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
      ),
    execute: async (ctx) => {
      const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
      const data = getUser(target.id);
      const total = data.souls + data.bank;

      const embed = createCronaEmbed(COLORS.ECONOMY, target)
        .setTitle(`${EMOJIS.SOUL} Resonancia de Almas de ${target.displayName || target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: `${EMOJIS.SOUL} En Cartera`,
            value: `**${data.souls.toLocaleString()}** Almas`,
            inline: true,
          },
          {
            name: `${EMOJIS.BLACK_BLOOD} Banco de Sangre Negra`,
            value: `**${data.bank.toLocaleString()}** Almas`,
            inline: true,
          },
          {
            name: `${EMOJIS.SPARKLES} Total Acumulado`,
            value: `**${total.toLocaleString()}** Almas`,
            inline: true,
          }
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'daily',
    aliases: ['diario', 'recompensa'],
    description: 'Reclama tu ración diaria de Almas otorgada por Shinigami-sama',
    category: 'Economía',
    usage: 'daily',
    slashData: new SlashCommandBuilder()
      .setName('daily')
      .setDescription('Reclama tu recompensa diaria de Almas'),
    execute: async (ctx) => {
      const user = getUser(ctx.author.id);
      const cooldownMs = 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - user.last_daily;

      if (elapsed < cooldownMs) {
        const remaining = formatCooldown(cooldownMs - elapsed);
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Ya reclamaste tus Almas diarias... Vuelve en **${remaining}** o Ragnarok se enojará.`
            ),
          ],
        });
        return;
      }

      const baseReward = 350;
      const levelBonus = user.level * 25;
      const totalReward = baseReward + levelBonus;

      setCooldownTimestamp(ctx.author.id, 'last_daily', Date.now());
      const updated = updateSouls(ctx.author.id, totalReward);

      const embed = createSuccessEmbed(
        'Recompensa Diaria de Shibusen',
        `${EMOJIS.SOUL} Has recibido **+${totalReward.toLocaleString()} Almas** *(incluye +${levelBonus} por tu Nivel ${user.level})*.\n\n` +
          `> *«M-Maka dijo que debía entregarte esto hoy... cuídalas bien.»*\n` +
          `Ahora tienes **${updated.souls.toLocaleString()} Almas** en tu cartera.`
      );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'work',
    aliases: ['trabajar', 'mision'],
    description: 'Realiza una misión del tablón de Shibusen para ganar Almas',
    category: 'Economía',
    usage: 'work',
    slashData: new SlashCommandBuilder()
      .setName('work')
      .setDescription('Realiza una misión en Death City para ganar Almas'),
    execute: async (ctx) => {
      const user = getUser(ctx.author.id);
      const cooldownMs = 30 * 60 * 1000; // 30 minutos
      const elapsed = Date.now() - user.last_work;

      if (elapsed < cooldownMs) {
        const remaining = formatCooldown(cooldownMs - elapsed);
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Necesitas descansar después de tu última misión... Espera **${remaining}**.`
            ),
          ],
        });
        return;
      }

      const jobs = [
        'Ordenaste los libros de la biblioteca de Shibusen junto a Maka',
        'Ayudaste a Death the Kid a alinear cuadros simétricamente durante dos horas',
        'Patrullaste las calles nocturnas de Death City buscando huevos de Kishin',
        'Limpiaste el salón de clases del Profesor Stein sin cuestionar sus experimentos',
        'Compartiste dulces con Ragnarok para evitar que destruyera la cafetería',
        'Escribiste un poema en la esquina del salón y alguien te dejó una propina por lástima',
      ];

      const chosenJob = jobs[Math.floor(Math.random() * jobs.length)];
      const reward = Math.floor(Math.random() * 180) + 120; // 120 a 300 Almas

      setCooldownTimestamp(ctx.author.id, 'last_work', Date.now());
      const updated = updateSouls(ctx.author.id, reward);

      const embed = createCronaEmbed(COLORS.ECONOMY, ctx.author)
        .setTitle(`${EMOJIS.SWORD} Misión de Shibusen Completada`)
        .setDescription(
          `${chosenJob}.\n\n` +
            `${EMOJIS.SOUL} Ganancia: **+${reward} Almas**\n` +
            `Cartera actual: **${updated.souls.toLocaleString()} Almas**`
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'hunt',
    aliases: ['cazar', 'crime', 'kishin'],
    description: 'Sal a cazar un alma de Kishin con Ragnarok (Alto riesgo / Alta recompensa)',
    category: 'Economía',
    usage: 'hunt',
    slashData: new SlashCommandBuilder()
      .setName('hunt')
      .setDescription('Arriésgate a cazar un Kishin con Ragnarok para absorber sus Almas'),
    execute: async (ctx) => {
      const user = getUser(ctx.author.id);
      const cooldownMs = 45 * 60 * 1000; // 45 minutos
      const elapsed = Date.now() - user.last_hunt;

      if (elapsed < cooldownMs) {
        const remaining = formatCooldown(cooldownMs - elapsed);
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Tu Sangre Negra aún se está recuperando del último combate. Espera **${remaining}**.`
            ),
          ],
        });
        return;
      }

      setCooldownTimestamp(ctx.author.id, 'last_hunt', Date.now());
      const success = Math.random() < 0.65; // 65% éxito

      if (success) {
        const reward = Math.floor(Math.random() * 350) + 200;
        const updated = updateSouls(ctx.author.id, reward);
        const embed = createCronaEmbed(COLORS.RAGNAROK, ctx.author)
          .setTitle(`${EMOJIS.BLACK_BLOOD} ¡Caza de Kishin Exitosa!`)
          .setDescription(
            `¡Invocaste el **Screech Alpha** con Ragnarok y devoraron a un espíritu maligno!\n\n` +
              `${EMOJIS.SOUL} Almas absorbidas: **+${reward} Almas**\n` +
              `Cartera actual: **${updated.souls.toLocaleString()} Almas**`
          );
        await ctx.reply({ embeds: [embed] });
      } else {
        const penalty = Math.min(user.souls, Math.floor(Math.random() * 140) + 60);
        const updated = updateSouls(ctx.author.id, -penalty);
        const embed = createCronaEmbed(COLORS.ERROR, ctx.author)
          .setTitle(`${EMOJIS.CRONA_SHY} ¡La Caza Falló!`)
          .setDescription(
            `Ragnarok se distrajo buscando dulces y una bruja te emboscó... Tuvimos que huir a nuestra esquina.\n\n` +
              `💸 Perdiste: **-${penalty} Almas**\n` +
              `Cartera actual: **${updated.souls.toLocaleString()} Almas**`
          );
        await ctx.reply({ embeds: [embed] });
      }
    },
  },
  {
    name: 'deposit',
    aliases: ['dep', 'depositar'],
    description: 'Guarda tus Almas en el Banco de Sangre Negra para protegerlas',
    category: 'Economía',
    usage: 'deposit <cantidad | all>',
    slashData: new SlashCommandBuilder()
      .setName('deposit')
      .setDescription('Deposita tus Almas en el banco')
      .addStringOption((opt) =>
        opt
          .setName('cantidad')
          .setDescription('Cantidad de Almas a depositar o "all" para todo')
          .setRequired(true)
      ),
    execute: async (ctx) => {
      const raw = ctx.getString('cantidad', 0);
      if (!raw) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Indica cuántas Almas quieres depositar (\`${ctx.prefix}dep <cantidad|all>\`).`)],
        });
        return;
      }

      const user = getUser(ctx.author.id);
      const amount =
        raw.toLowerCase() === 'all' || raw.toLowerCase() === 'todo'
          ? user.souls
          : parseInt(raw, 10);

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply({
          embeds: [createErrorEmbed('Por favor ingresa una cantidad válida mayor a 0.')],
        });
        return;
      }

      if (amount > user.souls) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(`No tienes suficientes Almas en tu cartera (Tienes **${user.souls}**).`),
          ],
        });
        return;
      }

      const updated = updateSouls(ctx.author.id, -amount, amount);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Depósito en Sangre Negra',
            `Guardaste **${amount.toLocaleString()} Almas** en el banco.\n` +
              `${EMOJIS.SOUL} Cartera: **${updated.souls.toLocaleString()}** | ${EMOJIS.BLACK_BLOOD} Banco: **${updated.bank.toLocaleString()}**`
          ),
        ],
      });
    },
  },
  {
    name: 'withdraw',
    aliases: ['with', 'retirar'],
    description: 'Retira Almas del Banco de Sangre Negra a tu cartera',
    category: 'Economía',
    usage: 'withdraw <cantidad | all>',
    slashData: new SlashCommandBuilder()
      .setName('withdraw')
      .setDescription('Retira Almas del banco a tu cartera')
      .addStringOption((opt) =>
        opt
          .setName('cantidad')
          .setDescription('Cantidad de Almas a retirar o "all" para todo')
          .setRequired(true)
      ),
    execute: async (ctx) => {
      const raw = ctx.getString('cantidad', 0);
      if (!raw) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Indica cuántas Almas quieres retirar (\`${ctx.prefix}with <cantidad|all>\`).`)],
        });
        return;
      }

      const user = getUser(ctx.author.id);
      const amount =
        raw.toLowerCase() === 'all' || raw.toLowerCase() === 'todo'
          ? user.bank
          : parseInt(raw, 10);

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply({
          embeds: [createErrorEmbed('Por favor ingresa una cantidad válida mayor a 0.')],
        });
        return;
      }

      if (amount > user.bank) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(`No tienes tantas Almas guardadas en el banco (Tienes **${user.bank}**).`),
          ],
        });
        return;
      }

      const updated = updateSouls(ctx.author.id, amount, -amount);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Retiro de Almas',
            `Retiraste **${amount.toLocaleString()} Almas** a tu cartera.\n` +
              `${EMOJIS.SOUL} Cartera: **${updated.souls.toLocaleString()}** | ${EMOJIS.BLACK_BLOOD} Banco: **${updated.bank.toLocaleString()}**`
          ),
        ],
      });
    },
  },
  {
    name: 'pay',
    aliases: ['transfer', 'dar', 'pagar'],
    description: 'Transfiere Almas de tu cartera a otro usuario',
    category: 'Economía',
    usage: 'pay <@usuario> <cantidad>',
    slashData: new SlashCommandBuilder()
      .setName('pay')
      .setDescription('Envía Almas a otro usuario')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Destinatario').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('cantidad')
          .setDescription('Cantidad de Almas a transferir')
          .setMinValue(1)
          .setRequired(true)
      ),
    execute: async (ctx) => {
      const target = await ctx.getTargetUser('usuario', 0);
      const rawAmount = ctx.getNumber('cantidad', 1);
      const amount = rawAmount !== null ? Math.floor(rawAmount) : null;

      if (!target || target.bot || target.id === ctx.author.id) {
        await ctx.reply({
          embeds: [createErrorEmbed('Debes mencionar a otro usuario real para transferirle Almas.')],
        });
        return;
      }

      if (!amount || amount <= 0) {
        await ctx.reply({
          embeds: [createErrorEmbed('Ingresa una cantidad válida de Almas para enviar.')],
        });
        return;
      }

      const sender = getUser(ctx.author.id);
      if (sender.souls < amount) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `No tienes suficientes Almas en tu cartera (Tienes **${sender.souls.toLocaleString()}**).`
            ),
          ],
        });
        return;
      }

      updateSouls(ctx.author.id, -amount);
      updateSouls(target.id, amount);

      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Transferencia de Almas',
            `${EMOJIS.SOUL} **${ctx.author.displayName}** le entregó **${amount.toLocaleString()} Almas** a **${target.displayName}**!`
          ),
        ],
      });
    },
  },
  {
    name: 'shop',
    aliases: ['tienda', 'store'],
    description: 'Abre la tienda de objetos y títulos de Death City',
    category: 'Economía',
    usage: 'shop',
    slashData: new SlashCommandBuilder()
      .setName('shop')
      .setDescription('Explora los objetos disponibles en la tienda de Crona'),
    execute: async (ctx) => {
      const embed = createCronaEmbed(COLORS.ECONOMY, ctx.author)
        .setTitle('🏪 Tienda de Resonancia de Death City')
        .setDescription(
          `Compra objetos o títulos exclusivos usando \`${ctx.prefix}buy <id>\` o \`/buy\`.\n`
        );

      for (const item of SHOP_ITEMS) {
        embed.addFields({
          name: `${item.emoji} ${item.name} — \`${item.price.toLocaleString()} Almas\` (ID: \`${item.id}\`)`,
          value: `${item.description}${item.titleReward ? `\n↳ *Desbloquea título:* **${item.titleReward}**` : ''}`,
          inline: false,
        });
      }

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'buy',
    aliases: ['comprar'],
    description: 'Compra un artículo de la tienda usando tus Almas',
    category: 'Economía',
    usage: 'buy <id_del_objeto>',
    slashData: new SlashCommandBuilder()
      .setName('buy')
      .setDescription('Compra un objeto de la tienda de Crona')
      .addStringOption((opt) =>
        opt
          .setName('objeto')
          .setDescription('Elige el objeto que deseas comprar')
          .setRequired(true)
          .addChoices(
            ...SHOP_ITEMS.map((item) => ({
              name: `${item.name} (${item.price} Almas)`,
              value: item.id,
            }))
          )
      ),
    execute: async (ctx) => {
      const query = ctx.getString('objeto', 0)?.toLowerCase();
      if (!query) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Especifica el ID del objeto que deseas comprar. Revisa \`${ctx.prefix}shop\`.`
            ),
          ],
        });
        return;
      }

      const item = SHOP_ITEMS.find(
        (i) => i.id.toLowerCase() === query || i.name.toLowerCase().includes(query)
      );

      if (!item) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `No encontré ese artículo en la tienda... Usa \`${ctx.prefix}shop\` para ver los IDs válidos.`
            ),
          ],
        });
        return;
      }

      const user = getUser(ctx.author.id);
      if (user.souls < item.price) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Te faltan **${(item.price - user.souls).toLocaleString()} Almas** en tu cartera para comprar **${item.name}**.`
            ),
          ],
        });
        return;
      }

      updateSouls(ctx.author.id, -item.price);
      addInventoryItem(ctx.author.id, item.id, 1);

      let extraNote = '';
      if (item.titleReward) {
        setTitle(ctx.author.id, item.titleReward);
        extraNote = `\n✨ ¡Tu título de perfil se ha actualizado automáticamente a **${item.titleReward}**!`;
      }

      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            '¡Compra Realizada!',
            `Has adquirido ${item.emoji} **${item.name}** por **${item.price.toLocaleString()} Almas**.${extraNote}`
          ),
        ],
      });
    },
  },
  {
    name: 'inventory',
    aliases: ['inv', 'inventario', 'mochila'],
    description: 'Revisa los objetos que guardas en tu inventario',
    category: 'Economía',
    usage: 'inventory [@usuario]',
    slashData: new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('Muestra tu inventario o el de otro usuario')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
      ),
    execute: async (ctx) => {
      const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
      const items = getInventory(target.id);

      const embed = createCronaEmbed(COLORS.ECONOMY, target).setTitle(
        `🎒 Inventario de ${target.displayName || target.username}`
      );

      if (items.length === 0) {
        embed.setDescription(
          `*Su mochila está tan vacía como mi esquina oscura...*\nUsa \`${ctx.prefix}shop\` para ver objetos disponibles.`
        );
      } else {
        const lines = items.map((entry) => {
          const meta = SHOP_ITEMS.find((i) => i.id === entry.item_id);
          return meta
            ? `${meta.emoji} **${meta.name}** × \`${entry.quantity}\``
            : `📦 **${entry.item_id}** × \`${entry.quantity}\``;
        });
        embed.setDescription(lines.join('\n'));
      }

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'leaderboard',
    aliases: ['top', 'ranking', 'lb'],
    description: 'Muestra el ranking global de usuarios con más Almas o mayor Nivel',
    category: 'Economía',
    usage: 'leaderboard [almas | niveles]',
    slashData: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Muestra la tabla de clasificación de Shibusen')
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de clasificación')
          .setRequired(false)
          .addChoices(
            { name: '🟣 Almas (Economía)', value: 'almas' },
            { name: '⭐ Niveles y XP', value: 'niveles' }
          )
      ),
    execute: async (ctx) => {
      const type = (ctx.getString('tipo', 0) || 'almas').toLowerCase();
      const isLevels = type.startsWith('niv') || type === 'xp' || type === 'level';

      const rows = isLevels ? getTopUsersByLevel(10) : getTopUsersBySouls(10);
      const medals = ['🥇', '🥈', '🥉'];

      const lines = await Promise.all(
        rows.map(async (row, idx) => {
          const badge = medals[idx] || `\`#${idx + 1}\``;
          const fetchedUser = await ctx.client.users.fetch(row.id).catch(() => null);
          const name = fetchedUser ? fetchedUser.username : `Usuario (${row.id.slice(0, 6)})`;
          if (isLevels) {
            return `${badge} **${name}** — Nivel **${row.level}** (\`${row.xp} XP\`)`;
          } else {
            return `${badge} **${name}** — **${(row.souls + row.bank).toLocaleString()}** ${EMOJIS.SOUL}`;
          }
        })
      );

      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle(
          isLevels
            ? `${EMOJIS.LEVEL} Clasificación de Técnicos por Nivel`
            : `${EMOJIS.SOUL} Clasificación de Coleccionistas de Almas`
        )
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Aún no hay registros.');

      await ctx.reply({ embeds: [embed] });
    },
  },
];
