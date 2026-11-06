import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandBuilder,
} from 'discord.js';
import { CronaCommand } from '../types/command';
import { updateSouls } from '../database/db';
import {
  COLORS,
  CRONA_QUOTES,
  EIGHT_BALL_ANSWERS,
  EMOJIS,
  TRIVIA_QUESTIONS,
} from '../utils/constants';
import { createCronaEmbed, createErrorEmbed } from '../utils/embeds';

export const funCommands: CronaCommand[] = [
  {
    name: '8ball',
    aliases: ['bola8', 'pregunta', 'oraculo'],
    description: 'Pregúntale a Crona y Ragnarok sobre tu destino',
    category: 'Diversión y Minijuegos',
    usage: '8ball <tu pregunta>',
    slashData: new SlashCommandBuilder()
      .setName('8ball')
      .setDescription('Hazle una pregunta de sí o no a Crona y Ragnarok')
      .addStringOption((opt) =>
        opt.setName('pregunta').setDescription('Tu pregunta para el oráculo').setRequired(true)
      ),
    execute: async (ctx) => {
      const question = ctx.getString('pregunta', 0, true);
      if (!question || question.trim().length < 2) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Hazme una pregunta primero... Ejemplo: \`${ctx.prefix}8ball ¿aprobaré mi examen?\``
            ),
          ],
        });
        return;
      }

      const answer =
        EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];

      const color =
        answer.type === 'positive'
          ? COLORS.SUCCESS
          : answer.type === 'negative'
          ? COLORS.RAGNAROK
          : COLORS.PRIMARY;

      const embed = createCronaEmbed(color, ctx.author)
        .setTitle(`🎱 Oráculo de Sangre Negra`)
        .addFields(
          { name: '❓ Pregunta', value: question },
          { name: `${EMOJIS.BLACK_BLOOD} Respuesta de Crona`, value: answer.text }
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'roll',
    aliases: ['dados', 'dado', 'dice'],
    description: 'Lanza un dado de las caras que elijas (por defecto 100)',
    category: 'Diversión y Minijuegos',
    usage: 'roll [caras]',
    slashData: new SlashCommandBuilder()
      .setName('roll')
      .setDescription('Lanza un dado de N caras')
      .addIntegerOption((opt) =>
        opt
          .setName('caras')
          .setDescription('Número de caras del dado (por defecto 100)')
          .setMinValue(2)
          .setMaxValue(10000)
          .setRequired(false)
      ),
    execute: async (ctx) => {
      const sides = ctx.getNumber('caras', 0) || 100;
      const clampedSides = Math.min(Math.max(sides, 2), 10000);
      const result = Math.floor(Math.random() * clampedSides) + 1;

      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle('🎲 Lanzamiento de Dados')
        .setDescription(
          `**${ctx.author.displayName}** lanzó un dado de **${clampedSides}** caras y obtuvo:\n# 🎯 \`${result}\``
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'coinflip',
    aliases: ['moneda', 'flip', 'cf'],
    description: 'Lanza una moneda de Shibusen al aire (Cara o Cruz)',
    category: 'Diversión y Minijuegos',
    usage: 'coinflip',
    slashData: new SlashCommandBuilder()
      .setName('coinflip')
      .setDescription('Lanza una moneda al aire'),
    execute: async (ctx) => {
      const isHeads = Math.random() < 0.5;
      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle('🪙 Moneda de Death City')
        .setDescription(
          `La moneda giró en el aire y cayó en:\n# ${
            isHeads ? '💀 **Cara (Shinigami)**' : '🗡️ **Cruz (Ragnarok)**'
          }`
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'rps',
    aliases: ['ppt', 'piedrapapeltijera'],
    description: 'Juega Piedra, Papel o Tijera contra Ragnarok y apuesta unas Almas',
    category: 'Diversión y Minijuegos',
    usage: 'rps <piedra | papel | tijera>',
    slashData: new SlashCommandBuilder()
      .setName('rps')
      .setDescription('Juega Piedra, Papel o Tijera contra Ragnarok')
      .addStringOption((opt) =>
        opt
          .setName('eleccion')
          .setDescription('Tu jugada')
          .setRequired(true)
          .addChoices(
            { name: '🪨 Piedra', value: 'piedra' },
            { name: '📄 Papel', value: 'papel' },
            { name: '✂️ Tijera', value: 'tijera' }
          )
      ),
    execute: async (ctx) => {
      const rawChoice = ctx.getString('eleccion', 0)?.toLowerCase();
      const valid = ['piedra', 'papel', 'tijera'];

      if (!rawChoice || !valid.includes(rawChoice)) {
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Elige una opción válida: \`${ctx.prefix}rps piedra\`, \`papel\` o \`tijera\`.`
            ),
          ],
        });
        return;
      }

      const botChoice = valid[Math.floor(Math.random() * valid.length)];
      const icons: Record<string, string> = {
        piedra: '🪨 Piedra',
        papel: '📄 Papel',
        tijera: '✂️ Tijera',
      };

      let outcome = '';
      let color: number = COLORS.PRIMARY;

      if (rawChoice === botChoice) {
        outcome = '🤝 **¡Empate!** Ragnarok gruñó porque ninguno ganó.';
      } else if (
        (rawChoice === 'piedra' && botChoice === 'tijera') ||
        (rawChoice === 'papel' && botChoice === 'piedra') ||
        (rawChoice === 'tijera' && botChoice === 'papel')
      ) {
        updateSouls(ctx.author.id, 40);
        outcome = `🎉 **¡Ganaste!** Ragnarok se enojó y me pegó en la cabeza.\nRecibes **+40 Almas** ${EMOJIS.SOUL}`;
        color = COLORS.SUCCESS;
      } else {
        outcome = '💢 **¡Ragnarok ganó!** Se está burlando mientras come dulces.';
        color = COLORS.RAGNAROK;
      }

      const embed = createCronaEmbed(color, ctx.author)
        .setTitle('✂️ Piedra, Papel o Tijera')
        .setDescription(
          `👤 **Tú elegiste:** ${icons[rawChoice]}\n` +
            `🗡️ **Ragnarok eligió:** ${icons[botChoice]}\n\n` +
            `${outcome}`
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'trivia',
    aliases: ['quiz', 'animequiz'],
    description: 'Responde una pregunta de trivia de Soul Eater / Anime para ganar Almas',
    category: 'Diversión y Minijuegos',
    usage: 'trivia',
    slashData: new SlashCommandBuilder()
      .setName('trivia')
      .setDescription('Juega una trivia interactiva de anime y gana Almas'),
    execute: async (ctx) => {
      const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
      const letters = ['A', 'B', 'C', 'D'];

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        q.options.map((optText, idx) =>
          new ButtonBuilder()
            .setCustomId(`trivia_${idx}`)
            .setLabel(`${letters[idx]}. ${optText}`)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle(`🧠 Trivia de Shibusen — Categoría: ${q.category}`)
        .setDescription(
          `**${q.question}**\n\n` +
            q.options.map((o, i) => `**${letters[i]}.** ${o}`).join('\n') +
            `\n\n⏱️ *Tienes 20 segundos para responder y ganar **80 Almas**.*`
        );

      const sent = await ctx.reply({ embeds: [embed], components: [row] });
      if (!sent || typeof sent.createMessageComponentCollector !== 'function') return;

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 20_000,
      });

      collector.on('collect', async (btnInteraction: any) => {
        if (btnInteraction.user.id !== ctx.author.id) {
          await btnInteraction.reply({
            content: `${EMOJIS.CRONA_SHY} Esta pregunta es para **${ctx.author.displayName}**. ¡Usa \`/trivia\` para la tuya!`,
            ephemeral: true,
          });
          return;
        }

        collector.stop('answered');
        const chosenIdx = parseInt(btnInteraction.customId.replace('trivia_', ''), 10);

        if (chosenIdx === q.answerIndex) {
          updateSouls(ctx.author.id, 80);
          const winEmbed = createCronaEmbed(COLORS.SUCCESS, ctx.author)
            .setTitle('✅ ¡Respuesta Correcta!')
            .setDescription(
              `¡Muy bien! La respuesta correcta era **${q.options[q.answerIndex]}**.\n` +
                `Has ganado **+80 Almas** ${EMOJIS.SOUL}`
            );
          await btnInteraction.update({ embeds: [winEmbed], components: [] });
        } else {
          const loseEmbed = createCronaEmbed(COLORS.ERROR, ctx.author)
            .setTitle('❌ Respuesta Incorrecta...')
            .setDescription(
              `Elegiste **${q.options[chosenIdx]}**, pero la respuesta correcta era **${q.options[q.answerIndex]}**.`
            );
          await btnInteraction.update({ embeds: [loseEmbed], components: [] });
        }
      });

      collector.on('end', async (_c: any, reason: string) => {
        if (reason !== 'answered') {
          const timeoutEmbed = createCronaEmbed(COLORS.SECONDARY)
            .setTitle('⌛ Tiempo Agotado')
            .setDescription(
              `Se acabó el tiempo... La respuesta correcta era **${q.options[q.answerIndex]}**.`
            );
          await sent.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
        }
      });
    },
  },
  {
    name: 'scream',
    aliases: ['screech', 'crona', 'frase'],
    description: 'Escucha los pensamientos de Crona o desata una resonancia con Ragnarok',
    category: 'Diversión y Minijuegos',
    usage: 'scream',
    slashData: new SlashCommandBuilder()
      .setName('scream')
      .setDescription('Recibe una frase característica de Crona y Ragnarok'),
    execute: async (ctx) => {
      const quote = CRONA_QUOTES[Math.floor(Math.random() * CRONA_QUOTES.length)];
      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle(`${EMOJIS.BLACK_BLOOD} Resonancia de Sangre Negra`)
        .setDescription(`> *${quote}*`);
      await ctx.reply({ embeds: [embed] });
    },
  },
];
