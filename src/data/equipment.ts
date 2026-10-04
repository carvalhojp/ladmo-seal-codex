export interface EquipmentMaterial { name: string; amount: string }
export interface EquipmentRecipe { label?: string; consumes?: string; materials: EquipmentMaterial[]; money?: string; note?: string }
export interface EquipmentInfo { label?: string; materials?: EquipmentMaterial[]; money?: string; text?: string }
export interface EquipmentDungeon {
  id: string
  name: string
  abbreviation?: string
  bossImage?: string
  equipment?: string[]
  prerequisite?: EquipmentInfo
  weekly?: EquipmentInfo
  difficulties?: EquipmentInfo[]
  recipes?: EquipmentRecipe[]
  perPartCraft?: { collections: string[]; parts: string[]; recipe: EquipmentRecipe }
  exchange?: EquipmentInfo
  progression?: EquipmentRecipe[]
  reroll?: EquipmentRecipe
  notes?: string[]
}

export interface EquipmentPerfectModel {
  id: string
  name: string
  type?: string
  relatedDungeon?: string
  image?: string
  perfectModels: string[][]
}

const material = (name: string, amount: string): EquipmentMaterial => ({ name, amount })
const money = (value: string): EquipmentMaterial => material('Dinheiro', value)

export const equipmentDungeons: EquipmentDungeon[] = [
  { id:'dark-web', name:'Dark Web', abbreviation:'DW', bossImage:'/equipment/bosses/Dark Web.png', equipment:['Colar Radiante do Milagre'], prerequisite:{ materials:[material('Dados de Kuramon','15')], money:'5T' }, weekly:{ materials:[material('Dados de Kuramon','15')], money:'5T' }, recipes:[
    { label:'Sem food', materials:[material('Dados de Kuramon','125')], money:'200T' },
    { label:'Usando Colar Milagroso (Especial)', consumes:'Colar Milagroso (Especial)', materials:[material('Dados de Kuramon','100')], money:'125T' },
    { label:'Usando Colar de Perigo Digital', consumes:'Colar de Perigo Digital', materials:[material('Dados de Kuramon','75')], money:'90T' },
    { label:'Usando Colar Radiante de Quatro Bestas Sagradas', consumes:'Colar Radiante de Quatro Bestas Sagradas', materials:[material('Dados de Kuramon','50')], money:'75T' },
    { label:'Usando Colar de Unidade Zero', consumes:'Colar de Unidade Zero', materials:[material('Dados de Kuramon','50')], money:'75T' },
  ] },
  { id:'mdg', name:'Metalgreymon Dungeon', abbreviation:'MDG', bossImage:'/equipment/bosses/Metalgreymon.png', weekly:{ materials:[material('Energia Maligna','40')], money:'5T' }, perPartCraft:{ collections:['Davies','Yolei','TK'], parts:['Capacete','Acessório','Camisa','Calça','Luva','Bota'], recipe:{ materials:[material('Energia Maligna','25')], money:'10T', note:'Custo de cada parte; não do conjunto inteiro.' } } },
  { id:'sdg', name:'Susanoomon Dungeon', abbreviation:'SDG', bossImage:'/equipment/bosses/Susanoomon.png', prerequisite:{ text:'Complete a Dungeon Normal 10 vezes para obter o Loader Lv 0.' }, weekly:{ materials:[material('Peças de DigiCode','42')] }, progression:[
    { label:'Loader Lv 1', consumes:'Loader Lv 0', materials:[material('Peças de DigiCode','30')], money:'15T' }, { label:'Loader Lv 2', consumes:'Loader Lv 1', materials:[material('Peças de DigiCode','33')], money:'16T 500M' }, { label:'Loader Lv 3', consumes:'Loader Lv 2', materials:[material('Peças de DigiCode','38')], money:'18T 150M' }, { label:'Loader Lv 4', consumes:'Loader Lv 3', materials:[material('Peças de DigiCode','40')], money:'19T 965M' }, { label:'Loader Lv 5', consumes:'Loader Lv 4', materials:[material('Peças de DigiCode','55')], money:'23T 958M' }, { label:'Loader Lv 6', consumes:'Loader Lv 5', materials:[material('Peças de DigiCode','63')], money:'28T 749M 600B' }, { label:'Loader Lv 7', consumes:'Loader Lv 6', materials:[material('Peças de DigiCode','68')], money:'34T 499M 520B' }, { label:'Loader Lv 8', consumes:'Loader Lv 7', materials:[material('Peças de DigiCode','83')], money:'44T 849M 376B' }, { label:'Loader Lv 9', consumes:'Loader Lv 8', materials:[material('Peças de DigiCode','95')], money:'58T 304M 188B' }, { label:'Loader Lv 10', consumes:'Loader Lv 9', materials:[material('Peças de DigiCode','103')], money:'75T 795M 445B' }, { label:'Loader Completo', consumes:'Loader Lv 10', materials:[material('Peças de DigiCode','205')], money:'113T 693M 168B' },
  ] },
  { id:'arena-hard', name:'Arena Hard', weekly:{ materials:[material('Moedas de Arena [Difícil]','34')] }, prerequisite:{ label:'[Sub] Emblema do Escalador (Difícil)', materials:[material('Moedas de Arena [Difícil]','100')], text:'Recompensa: 2 Emblemas do Escalador [Evento]. Esta quest fornece os 2 Emblemas necessários para o primeiro craft.' }, equipment:['Anel de Arena Brilhante'], recipes:[{ materials:[material('Moedas de Arena [Difícil]','50'),material('Emblemas do Escalador [Evento]','2')] }] },
  { id:'shopping-center', name:'Dungeon Centro Comercial', bossImage:'/equipment/bosses/Centro Comercial.png', difficulties:[ { label:'Easy', materials:[material('DigiCode Contaminado','7')], money:'10T' }, { label:'Normal', materials:[material('DigiCode Contaminado','12'),material('Facas do Executor','8')], money:'35T' } ], equipment:['Vital Bracelet DigiVice'], recipes:[ { label:'Sem food', materials:[material('DigiCode Contaminado','100')], money:'75T' }, { label:'Usando Pulseira Milagrosa', consumes:'Pulseira Milagrosa', materials:[material('DigiCode Contaminado','50')], money:'30T' }, { label:'Usando Pulseira de Unidade Zero', consumes:'Pulseira de Unidade Zero', materials:[material('DigiCode Contaminado','25')], money:'10T' } ] },
  { id:'chimairamon', name:'Chimairamon Dungeon', bossImage:'/equipment/bosses/Chimairamon.png', difficulties:[ { label:'Easy', materials:[material('Aura Maligna de Chimairamon','4')] }, { label:'Normal', materials:[material('Aura Maligna de Chimairamon','20'),material('Anéis Negros','2')], money:'5T' } ], exchange:{ text:'Cada 1 Anel Negro pode ser trocado por 2 Aura Maligna de Chimairamon.' }, equipment:['Brinco Luxuoso da Bondade'], recipes:[ { label:'Sem food', materials:[material('Aura Maligna de Chimairamon','125')], money:'250T' }, { label:'Usando Brinco Milagroso (Especial)', consumes:'Brinco Milagroso (Especial)', materials:[material('Aura Maligna de Chimairamon','100')], money:'150T' }, { label:'Usando Brinco de Perigo Digital', consumes:'Brinco de Perigo Digital', materials:[material('Aura Maligna de Chimairamon','75')], money:'100T' }, { label:'Usando Brinco Radiante de Quatro Bestas Sagradas', consumes:'Brinco Radiante de Quatro Bestas Sagradas', materials:[material('Aura Maligna de Chimairamon','50')], money:'100T' }, { label:'Usando Brinco de Unidade Zero', consumes:'Brinco de Unidade Zero', materials:[material('Aura Maligna de Chimairamon','50')], money:'100T' } ] },
  { id:'eosmon', name:'Dungeon Terra do Nunca', abbreviation:'EOSMON', bossImage:'/equipment/bosses/Eosmon.png', prerequisite:{ materials:[material('Anéis da Luz','20')], money:'10T' }, weekly:{ materials:[material('Anéis da Luz','20')], money:'10T' }, equipment:['DigiAura da Coragem e Amizade','Primeiro Digivice Nv.1'], recipes:[ { label:'DigiAura da Coragem e Amizade', materials:[material('Anéis da Luz','20')], money:'20T' }, { label:'Primeiro Digivice Nv.1', materials:[material('Anéis da Luz','40')], money:'20T' } ], reroll:{ consumes:'a própria DigiAura', materials:[material('Anéis da Luz','5')], money:'10T', note:'Reroll da DigiAura existente; não é a fabricação inicial.' }, notes:['Toda a progressão desse Digivice exige sorte para avançar ao próximo nível. Ao realizar o craft e abrir a box, é possível permanecer no mesmo nível.'] },
  { id:'nightmare', name:'Dungeon Pesadelo', abbreviation:'BELIAL', bossImage:'/equipment/bosses/Pesadelo.png', prerequisite:{ materials:[material('Flores da Escuridão','20')], money:'80T' }, weekly:{ materials:[material('Flores da Escuridão','20')], money:'80T' }, equipment:['Anel da Esperança Radiante'], recipes:[ { label:'Sem food', materials:[material('Flores da Escuridão','250')], money:'500T' }, { label:'Usando Anel de Arena Brilhante', consumes:'Anel de Arena Brilhante', materials:[material('Flores da Escuridão','200')], money:'400T', note:'Food alternativo para reduzir o custo da fabricação.' } ] },
]

export const equipmentPerfectModels: EquipmentPerfectModel[] = [
  { id:'chimairamon-earring', name:'Brinco Luxuoso da Bondade', type:'Brinco', relatedDungeon:'Chimairamon Dungeon', perfectModels:[
    ['HP%','SKILL%','ATT','ATT','HT'],
    ['HP%','SKILL%','ATT','ATT','CT'],
    ['HP%','SKILL%','ATT','ATT','DC'],
    ['SKILL%','ATT','ATT','DC','DC'],
  ] },
  { id:'luxury-kindness-earring', name:'Colar Radiante do Milagre', type:'Colar', relatedDungeon:'Dark Web', perfectModels:[
    ['AS','DC','ATT','ATT','AT%'],
    ['AS','DC','ATT','ATT','CT'],
    ['AS','DC','ATT','ATT','HP%'],
    ['AS','ATT','ATT','CT','HP%'],
  ] },
  { id:'vital-bracelet-digivice', name:'Vital Bracelet DigiVice', relatedDungeon:'Dungeon Centro Comercial', perfectModels:[
    ['SKILL%','DF','DC','DC','AT'],
    ['SKILL%','DF','DC','DC','HP%'],
    ['SKILL%','DF','HT','HT','DC'],
    ['SKILL%','DF','HT','HT','HP%'],
    ['SKILL%','DF','HT','HT','CT'],
  ] },
  { id:'shiny-arena-ring', name:'Anel de Arena Brilhante', type:'Anel', relatedDungeon:'Arena Hard', perfectModels:[
    ['DC','AT','AT','ATT','ATT'],
    ['DC','HT','ATT','ATT','CT'],
    ['HT','CT','CT','ATT','ATT'],
    ['DC','CT','CT','ATT','ATT'],
  ] },
  { id:'radiant-hope-ring', name:'Anel da Esperança Radiante', type:'Anel', relatedDungeon:'Dungeon Pesadelo (Belial)', perfectModels:[
    ['ATT','ATT','DC','DC','HT'],
    ['ATT','ATT','DC','DC','AT'],
    ['ATT','ATT','DC','DC','CT'],
    ['DC','DC','HT','ATT','ATT'],
  ] },
  { id:'miraculous-digital-earring', name:'Brinco Milagroso / Perigo Digital', perfectModels:[
    ['ATT','ATT','DC','DC','HT'],
    ['ATT','ATT','DC','DC','CT'],
  ] },
  { id:'miraculous-digital-necklace', name:'Colar Milagroso / Perigo Digital', perfectModels:[
    ['ATT','ATT','DC','AS','CT'],
    ['ATT','ATT','DC','AS','AT'],
  ] },
  { id:'miraculous-digital-ring', name:'Anel Milagroso / Perigo Digital', perfectModels:[
    ['ATT','ATT','CT','CT','AT'],
    ['ATT','ATT','AT','AT','CT'],
  ] },
  { id:'miraculous-x-knight-bracelet', name:'Bracelete Milagroso / Cavaleiro X', perfectModels:[
    ['DC','DC','HT','HT','CT'],
    ['DC','DC','HT','HT','AT'],
  ] },
]
