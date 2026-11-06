import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { CronaCommand } from '../types/command';
import { addWarning, getWarnings, setGuildPrefix } from '../database/db';
import { COLORS, EMOJIS } from '../utils/constants';
import { createCronaEmbed, createErrorEmbed, createSuccessEmbed } from '../utils/embeds';

export const moderationCommands: CronaCommand[] = [
  {
    name: 'kick',
    aliases: ['expulsar'],
    description: 'Expulsa a un miembro del servidor con el filo de Ragnarok',
    category: 'Moderación',
    usage: 'kick <@usuario> [razón]',
    slashData: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Expulsa a un usuario del servidor')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('razon').setDescription('Motivo de la expulsión').setRequired(false)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      if (!ctx.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        await ctx.reply({
          embeds: [createErrorEmbed('No tienes permisos de **Expulsar Miembros** en este servidor.')],
        });
        return;
      }

      const targetUser = await ctx.getTargetUser('usuario', 0);
      const reason = ctx.getString('razon', 1, true) || 'Sin razón especificada';

      if (!targetUser) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Menciona al usuario que deseas expulsar.`)],
        });
        return;
      }

      const targetMember = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await ctx.reply({ embeds: [createErrorEmbed('No encontré a ese usuario en el servidor.')] });
        return;
      }

      if (
        ctx.author.id !== ctx.guild.ownerId &&
        targetMember.roles.highest.position >= ctx.member.roles.highest.position
      ) {
        await ctx.reply({
          embeds: [
            createErrorEmbed('No puedes expulsar a alguien con un rol igual o superior al tuyo.'),
          ],
        });
        return;
      }

      if (!targetMember.kickable) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              'No puedo expulsar a este usuario (su rol es superior al mío o es el dueño del servidor).'
            ),
          ],
        });
        return;
      }

      await targetMember.kick(`${ctx.author.tag}: ${reason}`);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Usuario Expulsado de Shibusen',
            `${EMOJIS.SWORD} **${targetUser.tag}** fue expulsado por **${ctx.author.displayName}**.\n` +
              `📝 **Motivo:** ${reason}`
          ),
        ],
      });
    },
  },
  {
    name: 'ban',
    aliases: ['banear', 'destierro'],
    description: 'Banea permanentemente a un usuario del servidor',
    category: 'Moderación',
    usage: 'ban <@usuario> [razón]',
    slashData: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Banea a un usuario del servidor')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a banear').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('razon').setDescription('Motivo del baneo').setRequired(false)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      if (!ctx.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        await ctx.reply({
          embeds: [createErrorEmbed('No tienes permisos de **Banear Miembros** en este servidor.')],
        });
        return;
      }

      const targetUser = await ctx.getTargetUser('usuario', 0);
      const reason = ctx.getString('razon', 1, true) || 'Sin razón especificada';

      if (!targetUser) {
        await ctx.reply({
          embeds: [createErrorEmbed('Menciona al usuario que deseas banear.')],
        });
        return;
      }

      const targetMember = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
      if (
        targetMember &&
        ctx.author.id !== ctx.guild.ownerId &&
        targetMember.roles.highest.position >= ctx.member.roles.highest.position
      ) {
        await ctx.reply({
          embeds: [
            createErrorEmbed('No puedes banear a alguien con un rol igual o superior al tuyo.'),
          ],
        });
        return;
      }

      if (targetMember && !targetMember.bannable) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              'No puedo banear a este usuario debido a la jerarquía de roles.'
            ),
          ],
        });
        return;
      }

      await ctx.guild.members.ban(targetUser.id, { reason: `${ctx.author.tag}: ${reason}` });
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Usuario Desterrado (Ban)',
            `${EMOJIS.BLACK_BLOOD} **${targetUser.tag}** fue baneado del servidor.\n` +
              `🛡️ **Moderador:** ${ctx.author.displayName}\n` +
              `📝 **Motivo:** ${reason}`
          ),
        ],
      });
    },
  },
  {
    name: 'timeout',
    aliases: ['mute', 'aislar', 'silenciar'],
    description: 'Aísla temporalmente a un usuario en la esquina oscura (Timeout)',
    category: 'Moderación',
    usage: 'timeout <@usuario> <minutos> [razón]',
    slashData: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Aplica aislamiento temporal (timeout) a un usuario')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a aislar').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('minutos')
          .setDescription('Duración en minutos (1 a 10080)')
          .setMinValue(1)
          .setMaxValue(10080)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('razon').setDescription('Motivo del aislamiento').setRequired(false)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await ctx.reply({
          embeds: [createErrorEmbed('No tienes permisos de **Moderar Miembros**.')],
        });
        return;
      }

      const targetUser = await ctx.getTargetUser('usuario', 0);
      const rawMinutes = ctx.getNumber('minutos', 1);
      const minutes = rawMinutes !== null ? Math.floor(rawMinutes) : null;
      const reason = ctx.getString('razon', 2, true) || 'Enviado a reflexionar a la esquina de Crona';

      if (!targetUser || !minutes || minutes < 1 || minutes > 10080) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(`Uso correcto: \`${ctx.prefix}timeout @usuario <minutos (1-10080)> [razón]\``),
          ],
        });
        return;
      }

      const targetMember = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
      if (
        targetMember &&
        ctx.author.id !== ctx.guild.ownerId &&
        targetMember.roles.highest.position >= ctx.member.roles.highest.position
      ) {
        await ctx.reply({
          embeds: [
            createErrorEmbed('No puedes aislar a alguien con un rol igual o superior al tuyo.'),
          ],
        });
        return;
      }

      if (!targetMember || !targetMember.moderatable) {
        await ctx.reply({
          embeds: [createErrorEmbed('No puedo aislar a ese miembro del servidor.')],
        });
        return;
      }

      await targetMember.timeout(minutes * 60 * 1000, `${ctx.author.tag}: ${reason}`);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Enviado a la Esquina Oscura (Timeout)',
            `⏳ **${targetUser.tag}** fue aislado durante **${minutes} minuto(s)**.\n` +
              `📝 **Motivo:** ${reason}`
          ),
        ],
      });
    },
  },
  {
    name: 'clear',
    aliases: ['purge', 'borrar', 'limpiar'],
    description: 'Elimina una cantidad de mensajes recientes del canal (1 a 100)',
    category: 'Moderación',
    usage: 'clear <cantidad>',
    slashData: new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Borra mensajes en lote de este canal')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((opt) =>
        opt
          .setName('cantidad')
          .setDescription('Número de mensajes a borrar (1-100)')
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member || !ctx.channel) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      if (!ctx.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await ctx.reply({
          embeds: [createErrorEmbed('No tienes permisos de **Gestionar Mensajes**.')],
        });
        return;
      }

      const rawCount = ctx.getNumber('cantidad', 0);
      const count = rawCount !== null ? Math.floor(rawCount) : null;
      if (!count || count < 1 || count > 100) {
        await ctx.reply({
          embeds: [createErrorEmbed('Indica una cantidad válida entre **1** y **100** mensajes.')],
        });
        return;
      }

      if (!(ctx.channel instanceof TextChannel)) {
        await ctx.reply({
          embeds: [createErrorEmbed('No puedo borrar mensajes en este tipo de canal.')],
        });
        return;
      }

      if (ctx.message) {
        await ctx.message.delete().catch(() => null);
      }

      const deleted = await ctx.channel.bulkDelete(count, true);
      const embed = createSuccessEmbed(
        'Limpieza Completada',
        `🧹 Ragnarok devoró **${deleted.size}** mensaje(s) en este canal.`
      );

      if (ctx.isSlash) {
        await ctx.reply({ embeds: [embed], ephemeral: true });
      } else {
        const msg = await ctx.channel.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => null), 4500);
      }
    },
  },
  {
    name: 'warn',
    aliases: ['advertir', 'advertencia'],
    description: 'Registra una advertencia formal a un usuario en el servidor',
    category: 'Moderación',
    usage: 'warn <@usuario> <motivo>',
    slashData: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Añade una advertencia a un miembro')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a advertir').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('motivo').setDescription('Razón de la advertencia').setRequired(true)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      if (!ctx.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await ctx.reply({
          embeds: [createErrorEmbed('Necesitas permisos de **Moderar Miembros** para advertir.')],
        });
        return;
      }

      const target = await ctx.getTargetUser('usuario', 0);
      const reason = ctx.getString('motivo', 1, true);

      if (!target || !reason) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Uso: \`${ctx.prefix}warn @usuario <motivo>\``)],
        });
        return;
      }

      const allWarnings = addWarning(ctx.guild.id, target.id, ctx.author.id, reason);

      await ctx.reply({
        embeds: [
          createCronaEmbed(COLORS.WARNING, ctx.author)
            .setTitle('⚠️ Advertencia Registrada')
            .setDescription(
              `👤 **Usuario:** <@${target.id}>\n` +
                `🛡️ **Moderador:** ${ctx.author.displayName}\n` +
                `📝 **Motivo:** ${reason}\n` +
                `📊 **Total de advertencias:** \`${allWarnings.length}\``
            ),
        ],
      });
    },
  },
  {
    name: 'warnings',
    aliases: ['warns', 'historial'],
    description: 'Consulta las advertencias acumuladas de un miembro',
    category: 'Moderación',
    usage: 'warnings [@usuario]',
    slashData: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Muestra el historial de advertencias de un usuario')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
      ),
    execute: async (ctx) => {
      if (!ctx.guild) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
      const list = getWarnings(ctx.guild.id, target.id);

      const embed = createCronaEmbed(COLORS.PRIMARY, target).setTitle(
        `📋 Advertencias de ${target.displayName || target.username}`
      );

      if (list.length === 0) {
        embed.setDescription('✨ Este usuario tiene un alma limpia sin advertencias en este servidor.');
      } else {
        const lines = list
          .slice(0, 10)
          .map(
            (w, idx) =>
              `**#${idx + 1}** • <t:${Math.floor(w.created_at / 1000)}:d> por <@${w.moderator_id}>\n↳ *${w.reason}*`
          );
        embed.setDescription(lines.join('\n\n'));
      }

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'prefix',
    aliases: ['setprefix', 'prefijo'],
    description: 'Cambia el prefijo clásico de Crona en este servidor (por defecto c!)',
    category: 'Moderación',
    usage: 'prefix <nuevo_prefijo>',
    slashData: new SlashCommandBuilder()
      .setName('prefix')
      .setDescription('Configura el prefijo clásico de Crona para este servidor')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((opt) =>
        opt
          .setName('nuevo')
          .setDescription('Nuevo prefijo (ej: c!, cr!, !)')
          .setMaxLength(5)
          .setRequired(true)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      if (!ctx.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await ctx.reply({
          embeds: [createErrorEmbed('Necesitas el permiso **Gestionar Servidor** para cambiar el prefijo.')],
        });
        return;
      }

      const newPrefix = ctx.getString('nuevo', 0)?.trim();
      if (!newPrefix || newPrefix.length > 5) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `El prefijo actual es \`${ctx.prefix}\`. Indica uno nuevo de hasta 5 caracteres.`
            ),
          ],
        });
        return;
      }

      setGuildPrefix(ctx.guild.id, newPrefix);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Prefijo Actualizado',
            `El prefijo clásico de Crona en **${ctx.guild.name}** ahora es \`${newPrefix}\`.\n` +
              `Ejemplo: \`${newPrefix}help\` o \`${newPrefix}hug\``
          ),
        ],
      });
    },
  },
];
