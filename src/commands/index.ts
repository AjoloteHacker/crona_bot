import { CronaCommand } from '../types/command';
import { roleplayCommands } from './roleplay';
import { economyCommands } from './economy';
import { profileCommands } from './profile';
import { socialCommands } from './social';
import { funCommands } from './fun';
import { moderationCommands } from './moderation';
import { musicCommands } from './music';
import { createUtilityCommands } from './utility';

export const allCommands: CronaCommand[] = [];

const baseCommands: CronaCommand[] = [
  ...roleplayCommands,
  ...economyCommands,
  ...profileCommands,
  ...socialCommands,
  ...funCommands,
  ...moderationCommands,
  ...musicCommands,
];

const utilityCommands = createUtilityCommands(() => allCommands);
allCommands.push(...baseCommands, ...utilityCommands);

export const commandMap = new Map<string, CronaCommand>();
export const aliasMap = new Map<string, CronaCommand>();

for (const cmd of allCommands) {
  const lowerName = cmd.name.toLowerCase();
  if (commandMap.has(lowerName)) {
    console.warn(`⚠️ [Comandos] Nombre de comando duplicado detectado: "${lowerName}"`);
  }
  commandMap.set(lowerName, cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      const lowerAlias = alias.toLowerCase();
      if (commandMap.has(lowerAlias) || aliasMap.has(lowerAlias)) {
        console.warn(
          `⚠️ [Comandos] Alias duplicado "${lowerAlias}" en "${cmd.name}" ignorado porque ya está asignado.`
        );
        continue;
      }
      aliasMap.set(lowerAlias, cmd);
    }
  }
}

export function resolveCommand(nameOrAlias: string): CronaCommand | undefined {
  const key = nameOrAlias.toLowerCase();
  return commandMap.get(key) || aliasMap.get(key);
}
