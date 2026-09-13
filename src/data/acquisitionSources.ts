export type AcquisitionSource =
  | { type: 'map'; difficult?: boolean }
  | { type: 'dungeon'; dungeon: string; reward?: boolean }
  | { type: 'shinjuku'; coinsPerSeal: number }
  | { type: 'monsterCard'; card: 'MC6' | 'MC7' }
export type AcquisitionFilter = 'all' | AcquisitionSource['type']

const mapNames = ['Gesomon','Devimon','Patamon','Giromon','Tentomon','Dracmon','Shamamon','Koromon','Kunemon','Tylomon','Rockmon','Meteormon','Warumonzaemon','Chrysalimon','Garurumon (Black)','Cherrymon','Renamon','DexDoruGreymon','Sinduramon','Dorumon','Tanemon','Garudamon','Syakomon','Gatomon','Tsunomon','Keramon','Kyubimon','Commandramon','MetalGarurumon','Goblimon','Leomon','Upamon','Coredramon (Verde)','DemiMeramon','Guilmon','Mushroomon','Nanomon','Waspmon','Sangloupmon','BlackGatomon','Rapidmon','Monodramon','Diablomon','Agumon','V-dramon','NeoDevimon','V-mon','Soulmon','WarGreymon','FanBeemon','Coredramon (Azul)','Dorugamon','Vikaralamon','Greymon','MegaSeadramon','Togemon','Volcamon','MetalTyranomon','Elecmon','Flymon','Meramon','Piyomon','Witchmon','Asuramon','MegaKabuterimon','Mikemon','Tankdramon','Monochromon','Palmon','Lillymon','Impmon','Ikkakumon','Drimogemon','Knightmon','Candlemon','Woodmon','Armadimon','Digmon','Gazimon','SkullSatamon']
const shinjuku: Record<string, number> = { Renamon:20,Goblimon:20,Guilmon:20,Impmon:20,Gazimon:20,Mushroomon:20,Elecmon:20,Floramon:20,Growmon:40,Leomon:40,Monochromon:40,Woodmon:40,Rockmon:40,Chrysalimon:40,Meramon:40,Sinduramon:50,MetalTyranomon:50,Vajramon:150,Vikaralamon:150,Zhuqiaomon:200,Beelzebumon:200,Megidramon:200 }
const dungeons: Record<string, { dungeon: string; reward?: boolean }> = { Dynasmon:{dungeon:'Royal Base'},Beelzebumon:{dungeon:'Chaotic Battle'},LordKnightmon:{dungeon:'Royal Base'},Vajramon:{dungeon:'Estádio'},Craniamon:{dungeon:'Royal Base'},Sleipmon:{dungeon:'Royal Base'},Lucemon:{dungeon:'Royal Base',reward:true},Baihumon:{dungeon:'BDG'},DexDorugoramon:{dungeon:'Royal Base'},Zhuqiaomon:{dungeon:'ZDG'},Megidramon:{dungeon:'Chaotic Battle'},Dexmon:{dungeon:'Royal Base'},'Ulforce V-dramon':{dungeon:'Royal Base'} }
const cards: Record<string, 'MC6'|'MC7'> = { Parasimon:'MC7',Chimairamon:'MC7',SaberLeomon:'MC7',Etemon:'MC6',MarinDevimon:'MC6' }

/** Acquisition metadata stays centralized; canonical seal identity remains unchanged. */
export const sourcesForName = (name: string): AcquisitionSource[] => [
  ...(mapNames.includes(name) ? [{ type:'map' as const, difficult: name === 'Kyubimon' || name === 'Leomon' }] : []),
  ...(dungeons[name] ? [{ type:'dungeon' as const, ...dungeons[name] }] : []),
  ...(shinjuku[name] ? [{ type:'shinjuku' as const, coinsPerSeal: shinjuku[name] }] : []),
  ...(cards[name] ? [{ type:'monsterCard' as const, card: cards[name] }] : []),
]
export const configuredAcquisitionNames = [...new Set([...mapNames, ...Object.keys(shinjuku), ...Object.keys(dungeons), ...Object.keys(cards)])]
export const matchesAcquisitionFilter = (name: string, filter: AcquisitionFilter) =>
  filter === 'all' || sourcesForName(name).some(source => source.type === filter)
