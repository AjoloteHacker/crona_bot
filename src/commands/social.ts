import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandBuilder,
} from 'discord.js';
import { CronaCommand } from '../types/command';
import {
  addInventoryItem,
  divorceUsers,
  getItemQuantity,
  getUser,
  marryUsers,
} from '../database/db';
import { COLORS, EMOJIS } from '../utils/constants';
import {
  buildProgressBar,
  createCronaEmbed,
  createErrorEmbed,
  createSuccessEmbed,
} from '../utils/embeds';

export const socialCommands: CronaCommand[] = [
  {
    name: 'marry',
    aliases: ['casarse', 'propose', 'matrimonio'],
    description: 'Propón matrimonio a tu persona especial al estilo clásico de Chocolat',
    category: 'Social y Matrimonio',
    usage: 'marry <@usuario>',
    slashData: new SlashCommandBuilder()
      .setName('marry')
      .setDescription('Propón matrimonio a otro usuario')
      .addUserOption((opt) =>
        opt
          .setName('usuario')
          .setDescription('La persona a quien quieres proponerle matrimonio')
          .setRequired(true)
      ),
    execute: async (ctx) => {
      const target = await ctx.getTargetUser('usuario', 0);
      if (!target || target.bot || target.id === ctx.author.id) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              'Debes elegir a otro usuario real (¡y no puedes casarte conmigo ni con Ragnarok!).'
            ),
          ],
        });
        return;
      }

      const authorData = getUser(ctx.author.id);
      const targetData = getUser(target.id);

      if (authorData.married_to) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Ya estás casado/a con <@${authorData.married_to}>. Usa \`${ctx.prefix}divorce\` primero si deseas separarte.`
            ),
          ],
        });
        return;
      }

      if (targetData.married_to) {
        await ctx.reply({
          embeds: [createErrorEmbed(`**${target.displayName}** ya está casado/a con alguien más...`)],
        });
        return;
      }

      const hasRing = getItemQuantity(ctx.author.id, 'anillo_alma') > 0;
      const ringNote = hasRing
        ? `💍 *(Usará su **Anillo de Resonancia de Alma**)*`
        : `🌸 *(Pista: Puedes comprar un Anillo de Resonancia en \`${ctx.prefix}shop\`)*`;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('marry_accept')
          .setLabel('¡Sí, acepto! 💍')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('marry_reject')
          .setLabel('No sé cómo lidiar con esto... 💔')
          .setStyle(ButtonStyle.Danger)
      );

      const proposalEmbed = createCronaEmbed(COLORS.LOVE, ctx.author)
        .setTitle(`${EMOJIS.RING} ¡Propuesta de Resonancia de Almas!`)
        .setDescription(
          `💖 **${ctx.author.displayName}** se ha arrodillado frente a <@${target.id}>...\n\n` +
            `> *«¿Aceptarías unir tu alma con la mía en Shibusen?»*\n${ringNote}\n\n` +
            `<@${target.id}>, tienes **60 segundos** para responder usando los botones de abajo.`
        );

      const sentMsg = await ctx.reply({
        content: `<@${target.id}>`,
        embeds: [proposalEmbed],
        components: [row],
      });

      if (!sentMsg || typeof sentMsg.createMessageComponentCollector !== 'function') return;

      const collector = sentMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      collector.on('collect', async (btnInteraction: any) => {
        if (btnInteraction.user.id !== target.id) {
          await btnInteraction.reply({
            content: `${EMOJIS.CRONA_SHY} ¡O-Oye! Esta propuesta es solo para **${target.displayName}**.`,
            ephemeral: true,
          });
          return;
        }

        collector.stop('answered');

        if (btnInteraction.customId === 'marry_accept') {
          if (hasRing) {
            addInventoryItem(ctx.author.id, 'anillo_alma', -1);
          }
          marryUsers(ctx.author.id, target.id);

          const acceptedEmbed = createCronaEmbed(COLORS.LOVE)
            .setTitle(`💒 ¡Nuevo Matrimonio en Death City!`)
            .setDescription(
              `🎉 ¡Felicidades a **${ctx.author.displayName}** y **${target.displayName}**!\n` +
                `Sus almas ahora resuenan juntas como una sola. ${EMOJIS.HEART}\n\n` +
                `-# *Incluso Ragnarok dejó de comer dulces un segundo para aplaudir.*`
            );

          await btnInteraction.update({
            content: '',
            embeds: [acceptedEmbed],
            components: [],
          });
        } else {
          const rejectedEmbed = createCronaEmbed(COLORS.SECONDARY)
            .setTitle(`💔 Propuesta Rechazada...`)
            .setDescription(
              `**${target.displayName}** dijo que no sabe cómo lidiar con esto y rechazó la propuesta de **${ctx.author.displayName}**.\n` +
                `*Te guardé un lugar en mi esquina oscura para llorar...*`
            );

          await btnInteraction.update({
            content: '',
            embeds: [rejectedEmbed],
            components: [],
          });
        }
      });

      collector.on('end', async (_collected: any, reason: string) => {
        if (reason !== 'answered') {
          const expiredEmbed = createCronaEmbed(COLORS.SECONDARY).setDescription(
            `⌛ **${target.displayName}** se puso tan nervioso/a que no respondió a tiempo...`
          );
          await sentMsg.edit({ embeds: [expiredEmbed], components: [] }).catch(() => null);
        }
      });
    },
  },
  {
    name: 'divorce',
    aliases: ['divorcio', 'divorciarse'],
    description: 'Rompe el vínculo de matrimonio actual',
    category: 'Social y Matrimonio',
    usage: 'divorce',
    slashData: new SlashCommandBuilder()
      .setName('divorce')
      .setDescription('Rompe tu matrimonio actual en Shibusen'),
    execute: async (ctx) => {
      const user = getUser(ctx.author.id);
      if (!user.married_to) {
        await ctx.reply({
          embeds: [createErrorEmbed('No estás casado/a con nadie actualmente.')],
        });
        return;
      }

      const partnerId = divorceUsers(ctx.author.id);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Vínculo de Alma Disuelto',
            `💔 **${ctx.author.displayName}** y <@${partnerId}> han tomado caminos separados.\n` +
              `*No sé cómo lidiar con las rupturas...*`
          ),
        ],
      });
    },
  },
  {
    name: 'ship',
    aliases: ['amor', 'love', 'afinidad'],
    description: 'Calcula el porcentaje de compatibilidad de almas entre dos personas (estilo Chocolat)',
    category: 'Social y Matrimonio',
    usage: 'ship <@usuario1> [@usuario2]',
    slashData: new SlashCommandBuilder()
      .setName('ship')
      .setDescription('Mide la resonancia romántica entre dos usuarios')
      .addUserOption((opt) =>
        opt.setName('usuario1').setDescription('Primera persona').setRequired(true)
      )
      .addUserOption((opt) =>
        opt.setName('usuario2').setDescription('Segunda persona (opcional)').setRequired(false)
      ),
    execute: async (ctx) => {
      const first = await ctx.getTargetUser('usuario1', 0);
      const second = (await ctx.getTargetUser('usuario2', 1)) || ctx.author;

      if (!first) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Menciona al menos a un usuario: \`${ctx.prefix}ship @usuario\``)],
        });
        return;
      }

      const userA = second.id === ctx.author.id && first.id !== ctx.author.id ? ctx.author : first;
      const userB = userA.id === first.id ? second : first;

      // Porcentaje determinista por pareja para que sea consistente
      const sortedIds = [userA.id, userB.id].sort().join('-');
      let hash = 0;
      for (let i = 0; i < sortedIds.length; i++) {
        hash = (hash * 31 + sortedIds.charCodeAt(i)) % 101;
      }
      const score = userA.id === userB.id ? 100 : hash;

      const nameA = userA.displayName || userA.username;
      const nameB = userB.displayName || userB.username;
      const shipName =
        nameA.slice(0, Math.ceil(nameA.length / 2)) +
        nameB.slice(Math.floor(nameB.length / 2));

      let verdict = '';
      if (score >= 90) {
        verdict = '💖 **¡Resonancia de Alma Perfecta!** ¡Hasta Shinigami-sama los bendice!';
      } else if (score >= 70) {
        verdict = '💕 **¡Muy buena conexión!** Harían un gran equipo Técnico-Arma.';
      } else if (score >= 45) {
        verdict = '🌸 **Compatibilidad moderada.** Con unos dulces para Ragnarok puede funcionar.';
      } else if (score >= 20) {
        verdict = '🥺 **N-No sé cómo lidiar con esto...** Sus longitudes de onda chocan un poco.';
      } else {
        verdict = '🩸 **¡Incompatibilidad Total!** Pelean más que Ragnarok y yo.';
      }

      const embed = createCronaEmbed(COLORS.LOVE, ctx.author)
        .setTitle(`💘 Medidor de Resonancia — ${nameA} × ${nameB}`)
        .setDescription(
          `✨ **Nombre del Ship:** \`${shipName}\`\n\n` +
            `${buildProgressBar(score, 100, 14)}\n\n` +
            `${verdict}`
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
];
