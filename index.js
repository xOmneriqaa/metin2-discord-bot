require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  MessageFlags
} = require('discord.js');
const https = require('https');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Lokal profil dosyasi
const LOCAL_PROFILES_PATH = path.join(__dirname, 'profiles.json');

// MongoDB baglanti durumu
let isMongoConnected = false;

// HTTP Agent - baglanti havuzu (memory leak onleme)
const httpAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  timeout: 10000,
});

// ========== MONGODB SCHEMA ==========
const profileSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  serverId: Number,
  serverName: String,
  itemNameFilter: String,
  statFilters: Array,
  minWon: Number,
  maxWon: Number,
  minYang: Number,
  maxYang: Number,
  minUpgrade: Number,
  maxUpgrade: Number,
  minLevel: Number,
  maxLevel: Number,
  elemType: Number,
  minElemTotal: Number,
  minElemSingle: Number,
  simyaQuality: Number,
  minBonusCount: Number,
  checkInterval: Number,
  isActive: { type: Boolean, default: false },
  // Kusak filtreleri
  minAbsorption: { type: Number, default: 0 },
  beltElemType: { type: Number, default: 0 },
  beltWeaponFilter: { type: String, default: '' }, // Emilen silah ismi filtresi
  // Pet filtreleri
  petType: { type: Number, default: 0 },
  minPetHP: { type: Number, default: 0 },
  minPetSP: { type: Number, default: 0 },
  minPetDefans: { type: Number, default: 0 },
  minPetDays: { type: Number, default: 0 },
  petSkill1: { type: Number, default: 0 },
  petSkill2: { type: Number, default: 0 },
  petSkill3: { type: Number, default: 0 },
  // Gelismis filtreler
  minRemainingDays: { type: Number, default: 0 },
  maxRemainingDays: { type: Number, default: 0 },
  // Kategori filtresi
  categoryFilter: { type: String, default: '' },
});

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
});

const Profile = mongoose.model('Profile', profileSchema);
const Config = mongoose.model('Config', configSchema);

// ========== SUNUCU LISTESI ==========
const SERVERS_TR = {
  'Firtina': 439,
  'Lodos': 438,
  '[SAPPHIRE] Star': 437,
  '[SAPPHIRE] Safir': 436,
  'Zephyr': 435,
  '[ONYX] Bazalt': 433,
  '[RUBY] Lucifer': 431,
  '[RUBY] Charon': 426,
  'Bagjanamu': 418,
  'Arkadaslar': 413,
  'Marmara': 409,
  'Ezel': 59,
  'Barbaros': 57,
  'Dandanakan': 51,
};

const SERVERS_INT = {
  'Germania': 70,
  'Teutonia': 71,
  'Europe': 502,
  'Italia': 503,
  'Iberia': 506,
  'Azrael': 523,
  'Tigerghost': 524,
  '[RUBY] Chimera': 531,
  '[EMERALD] Aurora': 534,
  '[SAPPHIRE] Oceana': 540,
  'Nyx': 541,
  'Romania': 599,
  'Tara Romaneasca': 54,
  'Magyarorszag': 700,
  'Cesko': 701,
  'Polska': 702,
  '[RUBY] Kirin': 723,
  '[SAPPHIRE] Azure': 732,
  'Chione': 733,
};

const SERVERS = { ...SERVERS_TR, ...SERVERS_INT };

// ========== ELEMENT HARITASI ==========
const ELEMENT_MAP = {
  99: 'Şimşek',
  100: 'Ateş',
  101: 'Buz',
  102: 'Rüzgar',
  103: 'Toprak',
  104: 'Karanlık',
};

function getElementName(elemType) {
  return ELEMENT_MAP[elemType] || `Element #${elemType}`;
}

// ========== SIMYA KALITE HARITASI ==========
const SIMYA_QUALITY_MAP = {
  0: 'Mat',
  1: 'Parlak',
  2: 'Tertemiz',
  3: 'Mükemmel',
  4: 'Kusursuz',
};

// ========== PET TIP HARITASI ==========
const PET_TYPE_MAP = {
  1: 'Tip 1',
  2: 'Tip 2',
  3: 'Tip 3',
  4: 'Tip 4',
  5: 'Tip 5',
  6: 'Tip 6',
  7: 'Tip 7',
  8: 'Tip 8',
};

function getPetTypeName(typeId) {
  return PET_TYPE_MAP[typeId] || `Tip ${typeId}`;
}

// ========== PET BECERI HARITASI ==========
const PET_SKILL_MAP = {
  1: 'Dayanıklılık (Savaşçı)',
  2: 'Dayanıklılık (Sura)',
  3: 'Dayanıklılık (Ninja)',
  4: 'Dayanıklılık (Şaman)',
  5: 'Dayanıklılık (Lycan)',
  6: 'Berserker',
  7: 'Büyü Bozma',
  8: 'Hızlandırma',
  9: 'Talim',
  10: 'Yenileme',
  11: 'Vampir',
  12: 'Hayaletler',
  13: 'Engel',
  14: 'Yansıtma',
  15: 'Yang Düşme',
  16: 'Menzil',
  17: 'Yenilmezlik',
  18: 'İyileştirme',
  19: 'Mayalama ustası',
  20: 'Canavar avcısı',
  21: 'Kavrayış',
  22: 'Can çekme',
  23: 'Tüy gibi',
};

function getPetSkillName(skillId) {
  return PET_SKILL_MAP[skillId] || `Beceri #${skillId}`;
}

function getSimyaQuality(vnum) {
  // vnum suffix'in ilk rakamı kaliteyi belirler
  // örn: 165460 -> suffix 460 -> ilk rakam 4 -> Kusursuz
  const suffix = vnum % 1000;
  const qualityTier = Math.floor(suffix / 100);
  return qualityTier;
}

function getSimyaQualityName(qualityTier) {
  return SIMYA_QUALITY_MAP[qualityTier] || `Kalite #${qualityTier}`;
}

// Item isminden miktar (×N veya xN) parse et
function parseQuantityFromName(name) {
  if (!name) return { cleanName: name, quantity: 1 };

  // ×N veya xN formatını ara (Unicode × veya normal x)
  const match = name.match(/\s*[×x](\d+)\s*$/i);
  if (match) {
    const quantity = parseInt(match[1], 10);
    const cleanName = name.replace(/\s*[×x]\d+\s*$/i, '').trim();
    return { cleanName, quantity };
  }

  return { cleanName: name, quantity: 1 };
}

// Süreyi detaylı formatta göster (gün + saat + dakika)
function formatDuration(seconds) {
  if (seconds <= 0) return '0d';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}g`);
  if (hours > 0) parts.push(`${hours}s`);
  if (minutes > 0) parts.push(`${minutes}d`);

  return parts.join(' ') || '0d';
}

// Item'in kalan suresini saniye cinsinden hesapla
// Pet icin petInfo[2][3], diger sureli itemler icin sockets[0] kullanilir
// Sunucu saati gercek zamandan farkli olabilir, mutlak deger alinir
function getItemRemainingSeconds(item, debug = false) {
  const nowTimestamp = Math.floor(Date.now() / 1000);

  // Pet ise petInfo'dan al
  if (item.petInfo && item.petInfo[2] && item.petInfo[2][3]) {
    const petEndTimestamp = Number(item.petInfo[2][3]) || 0;
    if (petEndTimestamp > 1700000000) {
      let remaining = petEndTimestamp - nowTimestamp;
      // Sunucu saati farkli olabilir - mutlak deger al (180 gun limitinde)
      if (remaining < 0 && remaining > -15552000) {
        remaining = Math.abs(remaining);
      }
      return remaining > 0 ? remaining : 0;
    }
  }

  // Sureli item ise sockets'dan al
  if (item.sockets && Array.isArray(item.sockets)) {
    // Tum socket degerlerini kontrol et - timestamp olan varsa kullan
    for (let i = 0; i < item.sockets.length; i++) {
      const socketVal = item.sockets[i];
      if (socketVal > 1700000000) { // Unix timestamp gibi gorunuyorsa
        let remaining = socketVal - nowTimestamp;
        // Sunucu saati farkli olabilir - mutlak deger al (180 gun limitinde)
        if (remaining < 0 && remaining > -15552000) {
          remaining = Math.abs(remaining);
        }
        if (remaining > 0) {
          if (debug) console.log(`[DEBUG SOCKET] ${item.name}: socket[${i}]=${socketVal}, remaining=${remaining}`);
          return remaining;
        }
      }
    }
  }

  return 0; // Sure bilgisi yok
}

// Element verilerini parse et
// elem[0]: Element tipi (99=Ates, 101=Buz, 102=Yildirim, 103=Ruzgar)
// elem[1]: Temel element degerleri [6,4,6]
// elem[2]: Bonus element degerleri [8,4,8] (silahlar icin)
function parseElementData(elem) {
  if (!elem || !Array.isArray(elem) || elem.length < 2) {
    return null;
  }
  const elemType = elem[0];
  const values = Array.isArray(elem[1]) ? elem[1] : [];
  const total = values.reduce((sum, v) => sum + v, 0);
  const maxSingle = values.length > 0 ? Math.max(...values) : 0;

  // elem[2] varsa bonus degerleri de al
  let bonusValues = [];
  let bonusTotal = 0;
  if (elem.length >= 3 && Array.isArray(elem[2])) {
    bonusValues = elem[2];
    bonusTotal = bonusValues.reduce((sum, v) => sum + v, 0);
  }

  return { elemType, values, total, maxSingle, bonusValues, bonusTotal };
}

// Taslari (zihin taslari) parse et
// Zihin taslari: +0 ile +4 arasi (19 cesit x 5 seviye = 95 tas)
// vnum araliklari: 28030-28049 (+0), 28130-28149 (+1), 28230-28249 (+2), 28330-28349 (+3), 28430-28449 (+4)
// Kusaklar (category 9-3) ve petler haric
function parseStones(item) {
  if (!item || !item.sockets || !Array.isArray(item.sockets)) return [];
  // Kusaklari atla (sockets[0] silah vnum, sockets[1] emis orani)
  if (item.category === '9-3') return [];
  // Petleri atla
  if (item.petInfo) return [];

  const stones = [];
  for (const socketVal of item.sockets) {
    // Zihin tasi vnum araliklari (+0 ile +4 arasi)
    const isZihinTasi =
      (socketVal >= 28030 && socketVal < 28050) ||  // +0
      (socketVal >= 28130 && socketVal < 28150) ||  // +1
      (socketVal >= 28230 && socketVal < 28250) ||  // +2
      (socketVal >= 28330 && socketVal < 28350) ||  // +3
      (socketVal >= 28430 && socketVal < 28450);    // +4

    if (isZihinTasi) {
      const stoneName = getItemNameByVnum(socketVal);
      if (stoneName && !stoneName.includes('Bilinmiyor') && !stoneName.includes('Bilinmeyen')) {
        stones.push(stoneName);
      }
    }
  }
  return stones;
}

// ========== PROFIL SISTEMI ==========

// Profil ID sayaci
let profileIdCounter = 1;

// Tum profiller (Map: id -> profile)
const PROFILES = new Map();

// Secili profil ID'si (varsayilan: null)
let selectedProfileId = null;

// Profilleri lokale kaydet
function saveProfilesToLocal() {
  try {
    const data = {
      profileIdCounter,
      selectedProfileId,
      profiles: []
    };
    for (const [id, p] of PROFILES) {
      const { seenItems, intervalId, ...profileData } = p;
      data.profiles.push(profileData);
    }
    fs.writeFileSync(LOCAL_PROFILES_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Profiller lokale kaydedildi: ${PROFILES.size} profil`);
  } catch (err) {
    console.error('Lokal profil kaydetme hatasi:', err.message);
  }
}

// Profilleri lokalden yukle
function loadProfilesFromLocal() {
  try {
    if (!fs.existsSync(LOCAL_PROFILES_PATH)) {
      console.log('Lokal profil dosyasi bulunamadi, bos baslanacak.');
      return false;
    }
    const raw = fs.readFileSync(LOCAL_PROFILES_PATH, 'utf8');
    const data = JSON.parse(raw);

    profileIdCounter = data.profileIdCounter || 1;
    selectedProfileId = data.selectedProfileId || null;
    PROFILES.clear();

    const profilesToStart = [];
    for (const profile of (data.profiles || [])) {
      const wasActive = profile.isActive || false;
      profile.seenItems = new Set();
      profile.intervalId = null;
      profile.isActive = false;
      PROFILES.set(profile.id, profile);

      if (wasActive) {
        profilesToStart.push(profile);
      }
    }

    console.log(`${PROFILES.size} profil lokalden yuklendi.`);

    // Onceden aktif olan profilleri baslat
    for (const profile of profilesToStart) {
      startProfile(profile);
      console.log(`[${profile.name}] Otomatik baslatildi (onceki oturumdan)`);
    }
    return true;
  } catch (err) {
    console.error('Lokal profil yukleme hatasi:', err.message);
    return false;
  }
}

// Profilleri kaydet (MongoDB varsa oraya, her zaman lokale)
async function saveProfiles() {
  // Her zaman lokale kaydet
  saveProfilesToLocal();

  // MongoDB bagliysa oraya da kaydet
  if (isMongoConnected) {
    try {
      for (const [id, p] of PROFILES) {
        const { seenItems, intervalId, ...data } = p;
        await Profile.findOneAndUpdate(
          { id: id },
          data,
          { upsert: true, new: true }
        );
      }
      await Config.findOneAndUpdate(
        { key: 'profileIdCounter' },
        { value: profileIdCounter },
        { upsert: true }
      );
      await Config.findOneAndUpdate(
        { key: 'selectedProfileId' },
        { value: selectedProfileId },
        { upsert: true }
      );
      console.log(`Profiller MongoDB'ye kaydedildi: ${PROFILES.size} profil`);
    } catch (err) {
      console.error('MongoDB profil kaydetme hatasi:', err.message);
    }
  }
}

// Profilleri yukle (MongoDB varsa oradan, yoksa lokalden)
async function loadProfiles() {
  // MongoDB bagliysa oradan yukle
  if (isMongoConnected) {
    try {
      const counterDoc = await Config.findOne({ key: 'profileIdCounter' });
      const selectedDoc = await Config.findOne({ key: 'selectedProfileId' });

      profileIdCounter = counterDoc?.value || 1;
      selectedProfileId = selectedDoc?.value || null;

      const profiles = await Profile.find({});
      PROFILES.clear();

      const profilesToStart = [];
      for (const p of profiles) {
        const profile = p.toObject();
        const wasActive = profile.isActive || false;
        profile.seenItems = new Set();
        profile.intervalId = null;
        profile.isActive = false;
        PROFILES.set(profile.id, profile);

        if (wasActive) {
          profilesToStart.push(profile);
        }
      }

      console.log(`${PROFILES.size} profil MongoDB'den yuklendi.`);

      // Onceden aktif olan profilleri baslat
      for (const profile of profilesToStart) {
        startProfile(profile);
        console.log(`[${profile.name}] Otomatik baslatildi (onceki oturumdan)`);
      }

      // Lokale de kaydet (senkronizasyon)
      saveProfilesToLocal();
      return;
    } catch (err) {
      console.error('MongoDB profil yukleme hatasi:', err.message);
      console.log('Lokalden yuklemeye geciliyor...');
    }
  }

  // MongoDB yoksa veya hata olursa lokalden yukle
  loadProfilesFromLocal();
}

// Varsayilan profil olustur
function createDefaultProfile(name = 'Yeni Profil') {
  const id = profileIdCounter++;
  return {
    id,
    name: name,
    serverId: 436,
    serverName: '[SAPPHIRE] Safir',
    itemNameFilter: '',
    statFilters: [],
    minWon: 0,
    maxWon: 0,
    minYang: 0,
    maxYang: 0,
    minUpgrade: 0,
    maxUpgrade: 200,
    minLevel: 0,
    maxLevel: 120,
    // Element filtreleri
    elemType: 0,         // 0 = herhangi, 100=Ateş, 101=Buz, vb.
    minElemTotal: 0,     // Min toplam element değeri
    minElemSingle: 0,    // Min tek element değeri
    // Simya filtreleri
    simyaQuality: 5,     // 5 = hepsi, 0=Mat, 1=Parlak, 2=Tertemiz, 3=Mükemmel, 4=Kusursuz
    minBonusCount: 0,    // Min bonus sayısı (0=devre dışı, 3-6)
    // Kusak filtreleri
    minAbsorption: 0,    // Min emis orani % (0=devre disi)
    beltElemType: 0,     // Kusak element tipi (0=hepsi)
    beltWeaponFilter: '', // Emilen silah ismi filtresi
    // Pet filtreleri
    petType: 0,          // 0=hepsi, 1-8 pet tipi
    minPetHP: 0,
    minPetSP: 0,
    minPetDefans: 0,
    minPetDays: 0,
    // Pet beceri filtreleri
    petSkill1: 0,        // 0=devre disi, 1-23 beceri ID
    petSkill1MinLevel: 0,
    petSkill2: 0,
    petSkill2MinLevel: 0,
    petSkill3: 0,
    petSkill3MinLevel: 0,
    // Gelismis filtreler
    minRemainingDays: 0,
    maxRemainingDays: 0,
    // Kategori filtresi
    categoryFilter: '',
    checkInterval: 30,
    isActive: false,
    intervalId: null,
    seenItems: new Set(),
  };
}

// Secili profili getir (yoksa null)
function getSelectedProfile() {
  if (selectedProfileId === null) return null;
  return PROFILES.get(selectedProfileId) || null;
}

// ========== GLOBAL DEGISKENLER ==========
let STAT_MAP = {};
let STAT_MAP_REVERSE = {};
let ITEM_LEVEL_MAP = {};  // vnum -> level
let ITEM_NAME_MAP = {};   // vnum -> item name

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// ========== YARDIMCI FONKSIYONLAR ==========

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: httpAgent }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString();
          chunks.length = 0; // Temizle
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('JSON parse hatasi'));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function fetchData(serverId) {
  return fetchJSON(`https://metin2alerts.com/store/public/data/${serverId}.json`);
}

async function loadStatMap() {
  try {
    const data = await fetchJSON('https://metin2alerts.com/m2_data/tr/stat_map.json');
    STAT_MAP = {};
    STAT_MAP_REVERSE = {};
    for (const [id, rawName] of Object.entries(data)) {
      const isPercent = rawName.includes('%%%') || (rawName.includes('%%') && !rawName.includes('+%d'));
      let cleanName = rawName
        .replace(/\+?%+d/g, '')
        .replace(/:\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (isPercent && !cleanName.includes('%')) {
        cleanName = cleanName + ' %';
      } else if (!isPercent && !cleanName.includes('+') && !cleanName.includes('%')) {
        cleanName = cleanName + ' +';
      }

      const numId = parseInt(id, 10);
      if (STAT_MAP[cleanName] !== undefined) {
        cleanName = `${cleanName} (${numId})`;
      }

      STAT_MAP[cleanName] = numId;
      STAT_MAP_REVERSE[numId] = cleanName;
    }
    console.log(`Stat haritasi yuklendi: ${Object.keys(STAT_MAP).length} stat`);
  } catch (err) {
    console.error('Stat haritasi yuklenemedi:', err.message);
  }
}

async function loadItemLevelMap() {
  try {
    const data = await fetchJSON('https://metin2alerts.com/m2_data/item_proto.json');
    ITEM_LEVEL_MAP = {};
    for (const [vnum, item] of Object.entries(data)) {
      // Level bilgisi kaydet
      if (item.LimitType0 === 'LEVEL') {
        ITEM_LEVEL_MAP[vnum] = parseInt(item.LimitValue0, 10) || 0;
      } else if (item.LimitType1 === 'LEVEL') {
        ITEM_LEVEL_MAP[vnum] = parseInt(item.LimitValue1, 10) || 0;
      }
    }
    console.log(`Item level haritasi yuklendi: ${Object.keys(ITEM_LEVEL_MAP).length} item`);
  } catch (err) {
    console.error('Item level haritasi yuklenemedi:', err.message);
  }

  // Turkce item isimleri ayri yukle
  try {
    const nameData = await fetchJSON('https://metin2alerts.com/m2_data/tr/item_names.json');
    ITEM_NAME_MAP = nameData;
    console.log(`Item isim haritasi yuklendi: ${Object.keys(ITEM_NAME_MAP).length} item`);
  } catch (err) {
    console.error('Item isim haritasi yuklenemedi:', err.message);
  }
}

function getItemNameByVnum(vnum) {
  return ITEM_NAME_MAP[vnum] || null;
}

function getItemLevel(vnum) {
  return ITEM_LEVEL_MAP[vnum] || 0;
}

function findStatId(statName) {
  const lower = statName.toLowerCase().trim();
  for (const [name, id] of Object.entries(STAT_MAP)) {
    if (name.toLowerCase().includes(lower)) {
      return { id, name };
    }
  }
  return null;
}

function getStatName(statId) {
  return STAT_MAP_REVERSE[statId] || `Stat #${statId}`;
}

function parseUpgradeFromName(name) {
  if (!name) return 0;
  // +X'i herhangi bir yerde bul (sadece sonda degil)
  // Ornek: "Kahraman Zodyak Bıçak+9 Rüzgarın gücü 4" -> 9
  const match = name.match(/\+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function filterItems(items, profile) {
  if (!Array.isArray(items) || !profile) return [];

  return items.filter(item => {
    if (!item) return false;

    // Item ismi filtresi
    if (profile.itemNameFilter) {
      const itemName = (item.name || '').toLowerCase();
      const searchTerm = profile.itemNameFilter.toLowerCase();
      if (!itemName.includes(searchTerm)) {
        return false;
      }
    }

    // Won filtresi
    const wonPrice = item.wonPrice || 0;
    if (profile.minWon > 0 && wonPrice < profile.minWon) {
      return false;
    }
    if (profile.maxWon > 0 && wonPrice > profile.maxWon) {
      return false;
    }

    // Yang filtresi
    const yangPrice = item.yangPrice || 0;
    if (profile.minYang > 0 && yangPrice < profile.minYang) {
      return false;
    }
    if (profile.maxYang > 0 && yangPrice > profile.maxYang) {
      return false;
    }

    // Upgrade filtresi
    const refine = parseUpgradeFromName(item.name);
    if (refine < profile.minUpgrade || refine > profile.maxUpgrade) {
      return false;
    }

    // Level filtresi (vnum'dan item_proto ile)
    if (profile.minLevel > 0 || profile.maxLevel < 120) {
      const itemLevel = getItemLevel(item.vnum);
      if (itemLevel < profile.minLevel || itemLevel > profile.maxLevel) {
        return false;
      }
    }

    // Stat filtreleri
    for (const filter of profile.statFilters) {
      const attr = item.attrs?.find(a => Array.isArray(a) && a[0] === filter.statId);
      if (!attr || attr[1] < filter.minValue) {
        return false;
      }
    }

    // Element filtreleri
    const hasElemFilter = profile.elemType > 0 || profile.minElemTotal > 0 || profile.minElemSingle > 0;
    if (hasElemFilter) {
      const elemData = parseElementData(item.elem);

      // Element verisi yoksa ve filtre varsa, eleme
      if (!elemData) {
        return false;
      }

      // Element tipi filtresi
      if (profile.elemType > 0 && elemData.elemType !== profile.elemType) {
        return false;
      }

      // Toplam element değeri filtresi
      if (profile.minElemTotal > 0 && elemData.total < profile.minElemTotal) {
        return false;
      }

      // Tek element değeri filtresi
      if (profile.minElemSingle > 0 && elemData.maxSingle < profile.minElemSingle) {
        return false;
      }
    }

    // Simya kalite filtresi (5 = hepsi, 0-4 = belirli kalite)
    if (profile.simyaQuality < 5 && item.vnum) {
      const itemQuality = getSimyaQuality(item.vnum);
      if (itemQuality !== profile.simyaQuality) {
        return false;
      }
    }

    // Simya bonus sayısı filtresi
    if (profile.minBonusCount > 0) {
      const bonusCount = item.attrs ? item.attrs.length : 0;
      if (bonusCount < profile.minBonusCount) {
        return false;
      }
    }

    // Kategori filtresi
    // API formatı: "Y-Z" (örn: "1-2"), Site formatı: "X-Y-Z" (örn: "0-1-2")
    // Her iki formatı da kabul et
    if (profile.categoryFilter && profile.categoryFilter.length > 0) {
      const filter = profile.categoryFilter;
      const cat = item.category;
      // Direkt eşleşme veya site formatından API formatına dönüşüm
      const filterParts = filter.split('-');
      if (filterParts.length === 3) {
        // Site formatı: "0-1-2" -> API formatı: "1-2"
        const apiFormat = filterParts[1] + '-' + filterParts[2];
        if (cat !== filter && cat !== apiFormat) return false;
      } else {
        // Zaten API formatında
        if (cat !== filter) return false;
      }
    }

    // Kusak filtresi (emis orani, element ve/veya silah)
    if (profile.minAbsorption > 0 || profile.beltElemType > 0 || profile.beltWeaponFilter) {
      // Sadece kisiye ozel kusaklar (9-3)
      if (item.category !== '9-3') return false;

      // Emis orani kontrolu
      if (profile.minAbsorption > 0) {
        if (!item.sockets || item.sockets.length < 2) return false;
        if (item.sockets[1] < profile.minAbsorption) return false;
      }

      // Kusak element kontrolu
      if (profile.beltElemType > 0) {
        if (!item.elem || item.elem.length < 1) return false;
        if (item.elem[0] !== profile.beltElemType) return false;
      }

      // Emilen silah ismi kontrolu - vnum'dan silah ismini al ve arama yap
      if (profile.beltWeaponFilter && profile.beltWeaponFilter.length > 0) {
        if (!item.sockets || item.sockets.length < 1 || !item.sockets[0]) return false;
        const weaponName = getItemNameByVnum(item.sockets[0]);
        if (!weaponName) return false;
        if (!weaponName.toLowerCase().includes(profile.beltWeaponFilter.toLowerCase())) return false;
      }
    }

    // Pet filtreleri
    if (profile.petType > 0 || profile.minPetHP > 0 || profile.minPetSP > 0 ||
        profile.minPetDefans > 0 || profile.minPetDays > 0 ||
        profile.petSkill1 > 0 || profile.petSkill2 > 0 || profile.petSkill3 > 0) {
      if (!item.petInfo || !item.petInfo[2]) return false;

      // Pet tipi kontrolu
      if (profile.petType > 0 && item.petInfo[1] !== profile.petType) return false;

      // Pet statlari: petInfo[2][5]=HP, [6]=Defans, [7]=SP
      const petStats = item.petInfo[2];
      if (profile.minPetHP > 0 && parseFloat(petStats[5] || 0) < profile.minPetHP) return false;
      if (profile.minPetDefans > 0 && parseFloat(petStats[6] || 0) < profile.minPetDefans) return false;
      if (profile.minPetSP > 0 && parseFloat(petStats[7] || 0) < profile.minPetSP) return false;

      // Pet gunu: petStats[3] = pet bitis timestamp
      if (profile.minPetDays > 0) {
        const petRemainingSeconds = getItemRemainingSeconds(item);
        const petRemainingDays = petRemainingSeconds / 86400;
        if (petRemainingDays < profile.minPetDays) return false;
      }

      // Pet beceri filtreleri
      // petInfo[3] format: [?, skill1_id, skill1_level, ?, skill2_id, skill2_level, ?, skill3_id, skill3_level, ?]
      if (profile.petSkill1 > 0 || profile.petSkill2 > 0 || profile.petSkill3 > 0) {
        if (!item.petInfo[3] || !Array.isArray(item.petInfo[3])) {
          return false;
        }
        const skills = item.petInfo[3];

        // Pet'in sahip oldugu becerileri cikar (index: 1,2 | 4,5 | 7,8)
        const petSkills = [];
        if (skills[1] > 0) petSkills.push({ id: skills[1], level: skills[2] || 0 });
        if (skills[4] > 0) petSkills.push({ id: skills[4], level: skills[5] || 0 });
        if (skills[7] > 0) petSkills.push({ id: skills[7], level: skills[8] || 0 });

        // Her filtre icin kontrol yap
        const checkSkill = (skillId, minLevel) => {
          if (skillId <= 0) return true; // Filtre aktif degil
          const found = petSkills.find(s => s.id === skillId);
          if (!found) return false; // Beceri yok
          if (minLevel > 0 && found.level < minLevel) return false; // Seviye yetersiz
          return true;
        };

        if (!checkSkill(profile.petSkill1, profile.petSkill1MinLevel)) return false;
        if (!checkSkill(profile.petSkill2, profile.petSkill2MinLevel)) return false;
        if (!checkSkill(profile.petSkill3, profile.petSkill3MinLevel)) return false;
      }
    }

    // Kalan gun filtresi (sadece sureli itemler icin - petler haric)
    if (profile.minRemainingDays > 0 || profile.maxRemainingDays > 0) {
      // Pet ise gun filtresinden elenir - petler gun filtresinde gelmez
      if (item.petInfo) return false;

      // Pet degil - gun filtresini uygula
      const remainingSeconds = getItemRemainingSeconds(item);

      // Eger sure filtresi varsa ama item'da sure bilgisi yoksa, filtrele
      if (remainingSeconds === 0) return false;

      const remainingDays = remainingSeconds / 86400;

      // min=12, max=12 demek 12-13 gun arasi (12 dahil, 13 haric)
      if (profile.minRemainingDays > 0 && remainingDays < profile.minRemainingDays) return false;
      if (profile.maxRemainingDays > 0 && remainingDays >= profile.maxRemainingDays + 1) return false;
    }

    return true;
  });
}

// ========== PROFIL ISLEMLERI ==========

function startProfile(profile) {
  if (!profile || profile.isActive) return;
  profile.isActive = true;
  checkItemsForProfile(profile);
  profile.intervalId = setInterval(() => checkItemsForProfile(profile), profile.checkInterval * 1000);
  console.log(`[${profile.name}] Baslatildi. Interval: ${profile.checkInterval}s`);
  saveProfiles(); // Aktiflik durumunu kaydet
}

function stopProfile(profile) {
  if (!profile || !profile.isActive) return;
  profile.isActive = false;
  if (profile.intervalId) {
    clearInterval(profile.intervalId);
    profile.intervalId = null;
  }
  profile.seenItems.clear();
  console.log(`[${profile.name}] Durduruldu.`);
  saveProfiles(); // Aktiflik durumunu kaydet
}

function restartProfileInterval(profile) {
  if (!profile || !profile.isActive) return;
  if (profile.intervalId) clearInterval(profile.intervalId);
  profile.intervalId = setInterval(() => checkItemsForProfile(profile), profile.checkInterval * 1000);
  console.log(`[${profile.name}] Interval ${profile.checkInterval}s olarak ayarlandi.`);
}

async function deleteProfile(id) {
  const profile = PROFILES.get(id);
  if (profile) {
    stopProfile(profile);
    PROFILES.delete(id);
    if (selectedProfileId === id) {
      // Baska bir profil sec veya null yap
      const remaining = Array.from(PROFILES.keys());
      selectedProfileId = remaining.length > 0 ? remaining[0] : null;
    }
    // MongoDB'den sil (bagliysa)
    if (isMongoConnected) {
      try {
        await Profile.deleteOne({ id: id });
      } catch (err) {
        console.error('MongoDB profil silme hatasi:', err.message);
      }
    }
    await saveProfiles();
    console.log(`Profil silindi: ${profile.name}`);
  }
}

// ========== EMBED OLUSTURMA ==========

function formatFilters(profile) {
  if (!profile) return 'Profil secilmedi';
  const lines = [];

  if (profile.itemNameFilter) {
    lines.push(`Item: "${profile.itemNameFilter}"`);
  }

  if (profile.statFilters.length > 0) {
    const statTexts = profile.statFilters.map(f => {
      const name = getStatName(f.statId);
      const shortName = name.length > 20 ? name.substring(0, 20) + '..' : name;
      return `${shortName} >= ${f.minValue}`;
    });
    lines.push(`Efsun: ${statTexts.join('; ')}`);
  }

  const priceFilters = [];
  if (profile.minWon > 0 || profile.maxWon > 0) {
    const minW = profile.minWon || 0;
    const maxW = profile.maxWon || '∞';
    priceFilters.push(`Won: ${minW} - ${maxW}`);
  }
  if (profile.minYang > 0 || profile.maxYang > 0) {
    const minY = profile.minYang || 0;
    const maxY = profile.maxYang || '∞';
    priceFilters.push(`Yang: ${minY} - ${maxY}`);
  }
  if (priceFilters.length > 0) {
    lines.push(`Fiyat: ${priceFilters.join(' | ')}`);
  }

  if (profile.minUpgrade > 0 || profile.maxUpgrade < 200) {
    lines.push(`Upgrade: +${profile.minUpgrade} - +${profile.maxUpgrade}`);
  }

  if (profile.minLevel > 0 || profile.maxLevel < 120) {
    lines.push(`Level: ${profile.minLevel} - ${profile.maxLevel}`);
  }

  // Element filtreleri
  const elemFilters = [];
  if (profile.elemType > 0) elemFilters.push(getElementName(profile.elemType));
  if (profile.minElemTotal > 0) elemFilters.push(`Top>=${profile.minElemTotal}`);
  if (profile.minElemSingle > 0) elemFilters.push(`Tek>=${profile.minElemSingle}`);
  if (elemFilters.length > 0) {
    lines.push(`Element: ${elemFilters.join(', ')}`);
  }

  // Simya filtreleri
  const simyaFilters = [];
  if (profile.simyaQuality < 5) simyaFilters.push(getSimyaQualityName(profile.simyaQuality));
  if (profile.minBonusCount > 0) simyaFilters.push(`${profile.minBonusCount}+ bonus`);
  if (simyaFilters.length > 0) {
    lines.push(`Simya: ${simyaFilters.join(', ')}`);
  }

  // Kusak filtreleri
  const kusakFilters = [];
  if (profile.minAbsorption > 0) kusakFilters.push(`Emis>=%${profile.minAbsorption}`);
  if (profile.beltElemType > 0) kusakFilters.push(`Elem: ${getElementName(profile.beltElemType)}`);
  if (profile.beltWeaponFilter) kusakFilters.push(`Silah: ${profile.beltWeaponFilter}`);
  if (kusakFilters.length > 0) {
    lines.push(`Kusak: ${kusakFilters.join(', ')}`);
  }

  // Pet filtreleri
  const petFilters = [];
  if (profile.petType > 0) petFilters.push(`Tip: ${profile.petType}`);
  if (profile.minPetHP > 0) petFilters.push(`HP>=${profile.minPetHP}`);
  if (profile.minPetSP > 0) petFilters.push(`SP>=${profile.minPetSP}`);
  if (profile.minPetDefans > 0) petFilters.push(`Def>=${profile.minPetDefans}`);
  if (profile.minPetDays > 0) petFilters.push(`Gun>=${profile.minPetDays}`);
  // Pet becerileri
  const petSkillIds = [profile.petSkill1, profile.petSkill2, profile.petSkill3].filter(s => s > 0);
  if (petSkillIds.length > 0) {
    petFilters.push(`Beceri: ${petSkillIds.map(id => getPetSkillName(id)).join(', ')}`);
  }
  if (petFilters.length > 0) {
    lines.push(`Pet: ${petFilters.join(', ')}`);
  }

  // Gelismis filtreler - kalan gun
  const advFilters = [];
  if (profile.minRemainingDays > 0) advFilters.push(`MinGun>=${profile.minRemainingDays}`);
  if (profile.maxRemainingDays > 0) advFilters.push(`MaxGun<=${profile.maxRemainingDays}`);
  if (advFilters.length > 0) {
    lines.push(`Sureli: ${advFilters.join(', ')}`);
  }

  // Kategori filtresi
  if (profile.categoryFilter) {
    lines.push(`Kategori: ${profile.categoryFilter}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'Filtre yok';
}

function getProfileStatusText() {
  const profiles = Array.from(PROFILES.values());
  if (profiles.length === 0) return 'Profil yok';

  return profiles.map(p => {
    const status = p.isActive ? '🟢' : '⚪';
    return `${status} ${p.name} (${p.serverName.substring(0, 20)})`;
  }).join('\n');
}

function createPanel() {
  const profile = getSelectedProfile();
  const hasProfile = profile !== null;

  // Aktif profil sayisi
  const activeCount = Array.from(PROFILES.values()).filter(p => p.isActive).length;
  const totalCount = PROFILES.size;

  const embed = new EmbedBuilder()
    .setColor(hasProfile && profile.isActive ? 0x57F287 : 0xED4245)
    .setTitle('Metin2 Ticaret Alarmi - Coklu Profil')
    .setDescription(hasProfile
      ? `Secili: **${profile.name}**\nDurum: ${profile.isActive ? 'AKTIF' : 'DURDURULDU'}`
      : 'Profil secilmedi. "Yeni Profil" butonuyla profil olustur.')
    .addFields(
      { name: 'Profiller', value: `\`\`\`\n${getProfileStatusText()}\n\`\`\``, inline: false },
    );

  if (hasProfile) {
    embed.addFields(
      { name: 'Sunucu', value: profile.serverName, inline: true },
      { name: 'Kontrol', value: `${profile.checkInterval}s`, inline: true },
      { name: 'Takip', value: `${profile.seenItems.size} item`, inline: true },
      { name: 'Aktif Filtreler', value: `\`\`\`\n${formatFilters(profile)}\n\`\`\`` },
    );
  }

  embed.setFooter({ text: `Aktif: ${activeCount}/${totalCount} profil` });

  const components = [];

  // Satir 1: Profil secim dropdown (eger profil varsa)
  if (PROFILES.size > 0) {
    const profileOptions = Array.from(PROFILES.values()).map(p => ({
      label: `${p.isActive ? '🟢' : '⚪'} ${p.name}`,
      description: `${p.serverName} - ${p.isActive ? 'Aktif' : 'Durduruldu'}`,
      value: String(p.id),
      default: p.id === selectedProfileId
    }));

    const profileSelect = new StringSelectMenuBuilder()
      .setCustomId('select_profile')
      .setPlaceholder('Profil Sec')
      .addOptions(profileOptions.slice(0, 25)); // Max 25 option

    components.push(new ActionRowBuilder().addComponents(profileSelect));
  }

  // Satir 2: Sunucu secimi (eger profil seciliyse)
  if (hasProfile) {
    // Turk + Uluslararasi sunuculari tek dropdown'da birlestir (max 25)
    const allServers = Object.keys(SERVERS).slice(0, 25);
    const serverSelect = new StringSelectMenuBuilder()
      .setCustomId('select_server')
      .setPlaceholder('Sunucu Sec')
      .addOptions(
        allServers.map(name => ({
          label: name,
          value: name,
          default: name === profile.serverName
        }))
      );

    components.push(new ActionRowBuilder().addComponents(serverSelect));
  }

  // Satir 3: Yeni Profil, Profili Sil, Export, Import, Kusak
  const buttons1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_new_profile')
      .setLabel('Yeni Profil')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_delete_profile')
      .setLabel('Profili Sil')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_interval')
      .setLabel('Sure')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_days')
      .setLabel('Gun')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_belt')
      .setLabel('Kusak')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
  );
  components.push(buttons1);

  // Satir 4: Item, Stat, Fiyat, Upgrade, Level
  const buttons2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_item_search')
      .setLabel('Item')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_stat_filter')
      .setLabel('Efsun')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_price')
      .setLabel('Fiyat')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_upgrade')
      .setLabel('Upgrade')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_level')
      .setLabel('Level')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
  );
  components.push(buttons2);

  // Satir 5: BASLAT/DURDUR, Element, Simya, Pet, Kategori
  const isActive = hasProfile && profile.isActive;
  const buttons3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(isActive ? 'btn_stop' : 'btn_start')
      .setLabel(isActive ? 'DURDUR' : 'BASLAT')
      .setStyle(isActive ? ButtonStyle.Danger : ButtonStyle.Success)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_element')
      .setLabel('Element')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_simya')
      .setLabel('Simya')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_pet')
      .setLabel('Pet')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
    new ButtonBuilder()
      .setCustomId('btn_category')
      .setLabel('Kategori')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasProfile),
  );
  components.push(buttons3);

  return { embed, components };
}

function createSearchResults(items, profile) {
  const top15 = items.slice(0, 15);

  let description;
  if (top15.length === 0) {
    description = '```\nKriterlere uyan item bulunamadi.\n```';
  } else {
    const lines = top15.map((item, i) => {
      const name = (item.name || 'Bilinmeyen').substring(0, 25).padEnd(25);
      const price = item.wonPrice ? `${item.wonPrice}W` : (item.yangPrice ? `${item.yangPrice}Y` : '?');
      return `${String(i + 1).padStart(2)}. ${name} ${price.padStart(8)} ${(item.seller || '?').substring(0, 10)}`;
    });
    description = '```\n' + lines.join('\n') + '\n```';
  }

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(`Arama Sonuclari - ${profile.name}`)
    .setDescription(description)
    .addFields(
      { name: 'Sunucu', value: profile.serverName, inline: true },
      { name: 'Bulunan', value: `${items.length} item`, inline: true },
      { name: 'Filtreler', value: `\`\`\`\n${formatFilters(profile)}\n\`\`\`` },
    )
    .setFooter({ text: 'Ilk 15 sonuc gosteriliyor' })
    .setTimestamp();
}

function createAlertEmbed(item, profile) {
  const stats = [];

  // Random statlar (yilan itemleri gibi itemlerde ilk 3 stat random gelir)
  if (Array.isArray(item.rand) && item.rand.length > 0) {
    for (const rand of item.rand) {
      if (Array.isArray(rand) && rand[1] !== 0) {
        const name = getStatName(rand[0]);
        stats.push(`${name}: ${rand[1] > 0 ? '+' : ''}${rand[1]}`);
      }
    }
  }

  // Tum efsunlari goster (site ile ayni)
  if (Array.isArray(item.attrs)) {
    for (const attr of item.attrs) {
      if (Array.isArray(attr) && attr[1] !== 0) {
        const name = getStatName(attr[0]);
        stats.push(`${name}: ${attr[1] > 0 ? '+' : ''}${attr[1]}`);
      }
    }
  }

  // Miktar (quantity) - item'in kendi miktari (ornegin 20 tane tas)
  const itemQuantity = item.quantity || 1;

  // Tekrar sayisi (repeatCount) - ayni itemdan kac tane listelenmis (x3 gibi)
  const repeatCount = item._repeatCount || 1;
  const repeatStr = repeatCount > 1 ? ` x${repeatCount}` : '';

  // Kalan sure hesapla (pet ve sureli itemler icin)
  const remainingSeconds = getItemRemainingSeconds(item);
  const durationStr = remainingSeconds > 0 ? ` (${formatDuration(remainingSeconds)})` : '';

  // Pet ise gercek pet ismini kullan + level, tip, gun ekle
  let titleText = item.name || 'Bilinmeyen Item';
  if (item.petInfo && item.petInfo[2]) {
    const petStats = item.petInfo[2];
    // Pet vnum'dan Turkce isim al
    const petVnum = item.petInfo[0];
    const petName = getItemNameByVnum(petVnum) || item.name || 'Pet';
    const petLevel = petStats[0] || 1;
    const petType = item.petInfo[1] || 0;

    titleText = `${petName} Lv ${petLevel} (Tip ${petType})${durationStr}${repeatStr}`;
  } else {
    // Pet degilse sure ve tekrar sayisi ekle
    titleText = titleText + durationStr + repeatStr;
  }
  // Title max 256 karakter
  if (titleText.length > 250) {
    titleText = titleText.substring(0, 250) + '...';
  }

  const priceLines = [];
  if (item.wonPrice) priceLines.push(`${item.wonPrice} Won`);
  if (item.yangPrice) priceLines.push(`${item.yangPrice} Yang`);
  const priceText = priceLines.length > 0 ? priceLines.join(' / ') : '?';

  // Element bilgisi - Site formati: "Buzun gücü 22 (8,6,8)"
  // elem[1] = taşlardan + efsundan gelen toplam element
  // elem[2] = belirsiz (kullanmiyoruz)
  const elemData = parseElementData(item.elem);
  let elemText = 'Yok';
  if (elemData && elemData.total > 0) {
    const elemName = getElementName(elemData.elemType);
    elemText = `${elemName} ${elemData.total} (${elemData.values.join(',')})`;
  }

  // Kusak icin emis orani ve emilen silah bilgisi
  let beltText = null;
  if (item.category === '9-3' && item.sockets && item.sockets.length >= 2) {
    const absorbedWeaponVnum = item.sockets[0];
    const absorptionRate = item.sockets[1];
    const beltParts = [];
    if (absorptionRate > 0) {
      beltParts.push(`Emis: %${absorptionRate}`);
    }
    if (absorbedWeaponVnum > 0) {
      const weaponName = getItemNameByVnum(absorbedWeaponVnum);
      beltParts.push(`Silah: ${weaponName || absorbedWeaponVnum}`);
    }
    if (beltParts.length > 0) {
      beltText = beltParts.join(' | ');
    }
  }

  // Pet icin detayli bilgi
  // petStats: [level, ?, ?, timestamp, owner, HP%, Defans%, SP%, ...]
  let petText = null;
  let petSkillsText = null;
  if (item.petInfo && item.petInfo[2]) {
    const petStats = item.petInfo[2];
    const petType = item.petInfo[1] || 0;
    const petLevel = petStats[0] || 1;
    const petHP = petStats[5] ? `HP: +${petStats[5]}%` : null;
    const petDefans = petStats[6] ? `Defans: +${petStats[6]}%` : null;
    const petSP = petStats[7] ? `SP: +${petStats[7]}%` : null;

    // Pet kalan sure hesapla
    let petDurationStr = null;
    if (petStats[3] && petStats[3] > Date.now()/1000) {
      const remainingSeconds = petStats[3] - Date.now()/1000;
      petDurationStr = formatDuration(remainingSeconds);
    }

    const petParts = [
      `Lv ${petLevel} (Tip ${petType})`,
      petDurationStr,
      petHP, petDefans, petSP
    ].filter(p => p);

    if (petParts.length > 0) {
      petText = petParts.join(' | ');
    }

    // Pet becerileri (petInfo[3])
    // Format: [?, skill1_id, skill1_level, ?, skill2_id, skill2_level, ?, skill3_id, skill3_level, ?]
    // Index:   0  1          2             3  4          5             6  7          8             9
    if (item.petInfo[3] && Array.isArray(item.petInfo[3]) && item.petInfo[3].length >= 3) {
      const skills = item.petInfo[3];
      const skillParts = [];

      if (skills[1] > 0) {
        skillParts.push(`${getPetSkillName(skills[1])} (${skills[2]})`);
      }
      if (skills[4] > 0) {
        skillParts.push(`${getPetSkillName(skills[4])} (${skills[5]})`);
      }
      if (skills[7] > 0) {
        skillParts.push(`${getPetSkillName(skills[7])} (${skills[8]})`);
      }

      if (skillParts.length > 0) {
        petSkillsText = skillParts.join(' | ');
      }
    }
  }

  const fields = [
    { name: 'Fiyat', value: `**${priceText}**`, inline: true },
    { name: 'Satici', value: `\`${item.seller || '?'}\``, inline: true },
    { name: 'Element', value: elemText || 'Yok', inline: true },
  ];

  // Kusak bilgisi varsa ekle
  if (beltText && beltText.length > 0) {
    fields.push({ name: 'Kusak', value: beltText, inline: false });
  }

  // Pet bilgisi varsa ekle
  if (petText && petText.length > 0) {
    fields.push({ name: 'Pet', value: petText, inline: false });
  }

  // Pet becerileri varsa ekle
  if (petSkillsText && petSkillsText.length > 0) {
    fields.push({ name: 'Beceriler', value: petSkillsText, inline: false });
  }

  // Taslari (stones/gems) ekle
  const stones = parseStones(item);
  if (stones.length > 0) {
    fields.push({ name: 'Taşlar', value: stones.join('\n'), inline: false });
  }

  // Miktar varsa ekle (1'den buyukse)
  if (itemQuantity > 1) {
    fields.push({ name: 'Miktar', value: `${itemQuantity}`, inline: true });
  }

  // Kalan sure varsa ekle
  if (remainingSeconds > 0) {
    fields.push({ name: 'Kalan süre', value: formatDuration(remainingSeconds), inline: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(titleText || 'Item')
    .setDescription(stats.length > 0 ? `\`\`\`\n${stats.join('\n')}\n\`\`\`` : 'Stat bilgisi yok')
    .setFooter({ text: `[${profile.name}] ${profile.serverName}` })
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

// ========== ANA ISLEVLER ==========

async function checkItemsForProfile(profile) {
  if (!profile || !profile.isActive) return;

  const timestamp = new Date().toLocaleString('tr-TR');
  console.log(`[${timestamp}] [${profile.name}] Kontrol ediliyor... (${profile.serverName})`);

  try {
    const items = await fetchData(profile.serverId);
    const filtered = filterItems(items, profile);

    // seenItems cok buyurse temizle (max 5000)
    if (profile.seenItems.size > 5000) {
      profile.seenItems.clear();
    }

    // Item'lari grupla: ayni satici + ayni vnum + ayni fiyat = ayni item
    // Ayni itemdan kac tane oldugunu say (xNumber icin)
    const groupedItems = new Map();
    for (const item of filtered) {
      // Grup anahtari: satici + vnum + fiyat
      const groupKey = `${item.seller || 'unknown'}-${item.vnum || item.name}-${item.wonPrice || 0}-${item.yangPrice || 0}`;

      if (!groupedItems.has(groupKey)) {
        // Ilk item - repeatCount ekle
        item._repeatCount = 1;
        groupedItems.set(groupKey, item);
      } else {
        // Ayni itemdan bir tane daha - sayaci artir
        groupedItems.get(groupKey)._repeatCount++;
      }
    }

    const uniqueFiltered = Array.from(groupedItems.values());

    const newItems = uniqueFiltered.filter(item => {
      // Grup bazli key kullan - ayni satici+vnum+fiyat bir kere gonderilsin
      const { cleanName } = parseQuantityFromName(item.name);
      const key = `${profile.serverId}-${item.seller || 'unknown'}-${item.vnum || cleanName}-${item.wonPrice || 0}-${item.yangPrice || 0}`;
      if (profile.seenItems.has(key)) return false;
      profile.seenItems.add(key);
      return true;
    });

    if (newItems.length > 0) {
      console.log(`[${profile.name}] ${newItems.length} yeni item bulundu!`);
      await sendAlertsForProfile(newItems, profile);
    } else {
      console.log(`[${profile.name}] Yeni item yok.`);
    }
  } catch (err) {
    console.error(`[${profile.name}] Kontrol hatasi:`, err.message);
  }
}

let cachedChannel = null;

async function sendAlertsForProfile(items, profile) {
  if (!profile || !profile.isActive) return;

  try {
    if (!cachedChannel) {
      cachedChannel = await client.channels.fetch(process.env.CHANNEL_ID);
    }
  } catch (e) {
    console.error('Kanal bulunamadi:', e.message);
    cachedChannel = null;
    return;
  }

  for (const item of items) {
    if (!profile.isActive) {
      console.log(`[${profile.name}] Durduruldu - kalan mesajlar iptal edildi.`);
      return;
    }
    try {
      const embed = createAlertEmbed(item, profile);
      await cachedChannel.send({ embeds: [embed] });
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[${profile.name}] Mesaj gonderme hatasi:`, err.message);
      cachedChannel = null; // Hata olursa cache'i temizle
    }
  }
}

async function updatePanel(interaction) {
  try {
    const panel = createPanel();
    if (interaction.message) {
      await interaction.message.edit({ embeds: [panel.embed], components: panel.components });
    }
  } catch (err) {
    console.error('Panel guncelleme hatasi:', err.message);
  }
}

// ========== INTERACTION HANDLER ==========

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Select Menu: Profil Sec
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_profile') {
      const profileId = parseInt(interaction.values[0], 10);
      if (PROFILES.has(profileId)) {
        selectedProfileId = profileId;
      }
      const panel = createPanel();
      await interaction.update({ embeds: [panel.embed], components: panel.components });
      return;
    }

    // Select Menu: Sunucu Sec
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_server') {
      const profile = getSelectedProfile();
      if (profile) {
        const serverName = interaction.values[0];
        profile.serverName = serverName;
        profile.serverId = SERVERS[serverName];
        profile.seenItems.clear();
        saveProfiles();
      }
      const panel = createPanel();
      await interaction.update({ embeds: [panel.embed], components: panel.components });
      return;
    }

    // Button: Yeni Profil
    if (interaction.isButton() && interaction.customId === 'btn_new_profile') {
      const modal = new ModalBuilder()
        .setCustomId('modal_new_profile')
        .setTitle('Yeni Profil Olustur');

      const input = new TextInputBuilder()
        .setCustomId('input_profile_name')
        .setLabel('Profil ismi')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: Profil 1')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(30);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // Button: Profili Sil
    if (interaction.isButton() && interaction.customId === 'btn_delete_profile') {
      const profile = getSelectedProfile();
      if (profile) {
        deleteProfile(profile.id);
      }
      const panel = createPanel();
      await interaction.update({ embeds: [panel.embed], components: panel.components });
      return;
    }

    // Button: Item Ara
    if (interaction.isButton() && interaction.customId === 'btn_item_search') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_item_search')
        .setTitle('Item Ismi Ara');

      const input = new TextInputBuilder()
        .setCustomId('input_item_name')
        .setLabel('Item ismini gir (bos birak = tum itemler)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: Dolunay Kılıcı')
        .setValue(profile.itemNameFilter)
        .setRequired(false)
        .setMaxLength(50);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // Button: Stat Filtre
    if (interaction.isButton() && interaction.customId === 'btn_stat_filter') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_stat_filter')
        .setTitle('Efsun Filtresi Ekle');

      const inputStat = new TextInputBuilder()
        .setCustomId('input_stat_name')
        .setLabel('Efsun ismi')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: Ortalama Zarar %, Delici Vuruş için şansı %')
        .setRequired(true)
        .setMaxLength(50);

      const inputValue = new TextInputBuilder()
        .setCustomId('input_stat_value')
        .setLabel('Min deger')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 30')
        .setRequired(true)
        .setMaxLength(5);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputStat),
        new ActionRowBuilder().addComponents(inputValue)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Fiyat
    if (interaction.isButton() && interaction.customId === 'btn_price') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_price')
        .setTitle('Fiyat Filtreleri');

      const inputMinWon = new TextInputBuilder()
        .setCustomId('input_min_won')
        .setLabel('Min Won (0 = devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 10')
        .setValue(String(profile.minWon))
        .setRequired(false)
        .setMaxLength(10);

      const inputMaxWon = new TextInputBuilder()
        .setCustomId('input_max_won')
        .setLabel('Max Won (0 = devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 100')
        .setValue(String(profile.maxWon))
        .setRequired(false)
        .setMaxLength(10);

      const inputMinYang = new TextInputBuilder()
        .setCustomId('input_min_yang')
        .setLabel('Min Yang (0 = devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 100000')
        .setValue(String(profile.minYang))
        .setRequired(false)
        .setMaxLength(15);

      const inputMaxYang = new TextInputBuilder()
        .setCustomId('input_max_yang')
        .setLabel('Max Yang (0 = devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 1000000')
        .setValue(String(profile.maxYang))
        .setRequired(false)
        .setMaxLength(15);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputMinWon),
        new ActionRowBuilder().addComponents(inputMaxWon),
        new ActionRowBuilder().addComponents(inputMinYang),
        new ActionRowBuilder().addComponents(inputMaxYang)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Upgrade
    if (interaction.isButton() && interaction.customId === 'btn_upgrade') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_upgrade')
        .setTitle('Upgrade Filtresi (+0 - +200)');

      const inputMin = new TextInputBuilder()
        .setCustomId('input_min_upgrade')
        .setLabel('Minimum upgrade')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 9')
        .setValue(String(profile.minUpgrade))
        .setRequired(false)
        .setMaxLength(3);

      const inputMax = new TextInputBuilder()
        .setCustomId('input_max_upgrade')
        .setLabel('Maximum upgrade')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 15')
        .setValue(String(profile.maxUpgrade))
        .setRequired(false)
        .setMaxLength(3);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputMin),
        new ActionRowBuilder().addComponents(inputMax)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Sure (Kontrol suresi)
    if (interaction.isButton() && interaction.customId === 'btn_interval') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_interval')
        .setTitle('Kontrol Suresi');

      const input = new TextInputBuilder()
        .setCustomId('input_interval')
        .setLabel('Kontrol Suresi (saniye, min 5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 30')
        .setValue(String(profile.checkInterval))
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // Button: Gun (Kalan gun filtresi)
    if (interaction.isButton() && interaction.customId === 'btn_days') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_days')
        .setTitle('Kalan Gun Filtresi');

      const inputMin = new TextInputBuilder()
        .setCustomId('input_min_days')
        .setLabel('Min Kalan Gun (0 = devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 30')
        .setValue(String(profile.minRemainingDays))
        .setRequired(false)
        .setMaxLength(5);

      const inputMax = new TextInputBuilder()
        .setCustomId('input_max_days')
        .setLabel('Max Kalan Gun (0 = devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 365')
        .setValue(String(profile.maxRemainingDays))
        .setRequired(false)
        .setMaxLength(5);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputMin),
        new ActionRowBuilder().addComponents(inputMax)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Kategori
    if (interaction.isButton() && interaction.customId === 'btn_category') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_category')
        .setTitle('Kategori Filtresi');

      const input = new TextInputBuilder()
        .setCustomId('input_category')
        .setLabel('Kategori kodu (bos = tum kategoriler)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0-8-1 (Yakut), 0-9-3 (Kusak), 0-1-2 (Pet)')
        .setValue(profile.categoryFilter || '')
        .setRequired(false)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // Button: Element
    if (interaction.isButton() && interaction.customId === 'btn_element') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_element')
        .setTitle('Element Filtresi');

      const inputType = new TextInputBuilder()
        .setCustomId('input_elem_type')
        .setLabel('Element (0=Hepsi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('99=Simsek, 100=Ates, 101=Buz, 102=Ruzgar')
        .setValue(String(profile.elemType))
        .setRequired(false)
        .setMaxLength(3);

      const inputTotal = new TextInputBuilder()
        .setCustomId('input_elem_total')
        .setLabel('Min toplam (0=devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 10')
        .setValue(String(profile.minElemTotal))
        .setRequired(false)
        .setMaxLength(3);

      const inputSingle = new TextInputBuilder()
        .setCustomId('input_elem_single')
        .setLabel('Min tek deger (0=devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 6')
        .setValue(String(profile.minElemSingle))
        .setRequired(false)
        .setMaxLength(3);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputType),
        new ActionRowBuilder().addComponents(inputTotal),
        new ActionRowBuilder().addComponents(inputSingle)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Simya
    if (interaction.isButton() && interaction.customId === 'btn_simya') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_simya')
        .setTitle('Simya Filtresi');

      const inputQuality = new TextInputBuilder()
        .setCustomId('input_simya_quality')
        .setLabel('Kalite (5=Hepsi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0=Mat, 1=Parlak, 2=Tertemiz, 3=Mukemmel, 4=Kusursuz')
        .setValue(String(profile.simyaQuality))
        .setRequired(false)
        .setMaxLength(1);

      const inputBonus = new TextInputBuilder()
        .setCustomId('input_simya_bonus')
        .setLabel('Min bonus sayisi (0=devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('3, 4, 5 veya 6')
        .setValue(String(profile.minBonusCount))
        .setRequired(false)
        .setMaxLength(1);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputQuality),
        new ActionRowBuilder().addComponents(inputBonus)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Kusak
    if (interaction.isButton() && interaction.customId === 'btn_belt') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_belt')
        .setTitle('Kusak Filtresi');

      const inputAbsorption = new TextInputBuilder()
        .setCustomId('input_absorption')
        .setLabel('Min Emis % (0=devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 20')
        .setValue(String(profile.minAbsorption || 0))
        .setRequired(false)
        .setMaxLength(2);

      const inputBeltElem = new TextInputBuilder()
        .setCustomId('input_belt_elem')
        .setLabel('Element (0=Hepsi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('99=Simsek, 100=Ates, 101=Buz, 102=Ruzgar')
        .setValue(String(profile.beltElemType || 0))
        .setRequired(false)
        .setMaxLength(3);

      const inputBeltWeapon = new TextInputBuilder()
        .setCustomId('input_belt_weapon')
        .setLabel('Emilen Silah (bos=Hepsi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: Zodyak Yay')
        .setValue(profile.beltWeaponFilter || '')
        .setRequired(false)
        .setMaxLength(30);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputAbsorption),
        new ActionRowBuilder().addComponents(inputBeltElem),
        new ActionRowBuilder().addComponents(inputBeltWeapon)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Pet
    if (interaction.isButton() && interaction.customId === 'btn_pet') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_pet')
        .setTitle('Pet Filtresi');

      const inputPetType = new TextInputBuilder()
        .setCustomId('input_pet_type')
        .setLabel('Tip (0=Hepsi, 1-8)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 3')
        .setValue(String(profile.petType || 0))
        .setRequired(false)
        .setMaxLength(1);

      const inputPetStats = new TextInputBuilder()
        .setCustomId('input_pet_stats')
        .setLabel('HP, SP, Defans, Gun (0=devre disi)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 10,10,15,30')
        .setValue([profile.minPetHP || 0, profile.minPetSP || 0, profile.minPetDefans || 0, profile.minPetDays || 0].join(','))
        .setRequired(false)
        .setMaxLength(20);

      const inputPetSkills = new TextInputBuilder()
        .setCustomId('input_pet_skills')
        .setLabel('Beceri ID (!beceriler ile listele)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 6,13,20')
        .setValue([profile.petSkill1, profile.petSkill2, profile.petSkill3].filter(s => s > 0).join(',') || '')
        .setRequired(false)
        .setMaxLength(20);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputPetType),
        new ActionRowBuilder().addComponents(inputPetStats),
        new ActionRowBuilder().addComponents(inputPetSkills)
      );
      await interaction.showModal(modal);
      return;
    }

    // Button: Level
    if (interaction.isButton() && interaction.customId === 'btn_level') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_level')
        .setTitle('Level Filtresi');

      const inputMin = new TextInputBuilder()
        .setCustomId('input_min_level')
        .setLabel('Minimum level (0-120)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 75')
        .setValue(String(profile.minLevel))
        .setRequired(false)
        .setMaxLength(3);

      const inputMax = new TextInputBuilder()
        .setCustomId('input_max_level')
        .setLabel('Maximum level (0-120)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: 105')
        .setValue(String(profile.maxLevel))
        .setRequired(false)
        .setMaxLength(3);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputMin),
        new ActionRowBuilder().addComponents(inputMax)
      );
      await interaction.showModal(modal);
      return;
    }

    // Modal Submit: Yeni Profil
    if (interaction.isModalSubmit() && interaction.customId === 'modal_new_profile') {
      const name = interaction.fields.getTextInputValue('input_profile_name').trim();
      if (!name) {
        await interaction.reply({ content: 'Profil ismi bos olamaz!', flags: MessageFlags.Ephemeral });
        return;
      }

      const newProfile = createDefaultProfile(name);
      PROFILES.set(newProfile.id, newProfile);
      selectedProfileId = newProfile.id;
      saveProfiles();

      await interaction.reply({ content: `Profil olusturuldu: **${name}**`, flags: MessageFlags.Ephemeral });
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Item Search
    if (interaction.isModalSubmit() && interaction.customId === 'modal_item_search') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const value = interaction.fields.getTextInputValue('input_item_name').trim();
      profile.itemNameFilter = value;
      profile.seenItems.clear();
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Stat Filter
    if (interaction.isModalSubmit() && interaction.customId === 'modal_stat_filter') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const statName = interaction.fields.getTextInputValue('input_stat_name').trim();
      const minValue = parseInt(interaction.fields.getTextInputValue('input_stat_value'), 10);

      if (isNaN(minValue) || minValue < 0) {
        await interaction.reply({ content: 'Gecersiz deger! Pozitif bir sayi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      const statInfo = findStatId(statName);
      if (!statInfo) {
        await interaction.reply({ content: `"${statName}" isimli stat bulunamadi. !statlar ile listeye bak.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const existing = profile.statFilters.findIndex(f => f.statId === statInfo.id);
      if (existing >= 0) {
        profile.statFilters[existing].minValue = minValue;
      } else {
        profile.statFilters.push({ statId: statInfo.id, minValue, statName: statInfo.name });
      }

      profile.seenItems.clear();
      saveProfiles();
      await interaction.reply({ content: `Efsun filtresi eklendi: **${statInfo.name}** >= ${minValue}`, flags: MessageFlags.Ephemeral });
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Price
    if (interaction.isModalSubmit() && interaction.customId === 'modal_price') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const minWonStr = interaction.fields.getTextInputValue('input_min_won').trim();
      const maxWonStr = interaction.fields.getTextInputValue('input_max_won').trim();
      const minYangStr = interaction.fields.getTextInputValue('input_min_yang').trim();
      const maxYangStr = interaction.fields.getTextInputValue('input_max_yang').trim();

      const minWon = minWonStr ? parseInt(minWonStr, 10) : 0;
      const maxWon = maxWonStr ? parseInt(maxWonStr, 10) : 0;
      const minYang = minYangStr ? parseInt(minYangStr, 10) : 0;
      const maxYang = maxYangStr ? parseInt(maxYangStr, 10) : 0;

      if (isNaN(minWon) || minWon < 0 || isNaN(maxWon) || maxWon < 0 ||
          isNaN(minYang) || minYang < 0 || isNaN(maxYang) || maxYang < 0) {
        await interaction.reply({ content: 'Gecersiz deger! Pozitif sayilar gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.minWon = minWon;
      profile.maxWon = maxWon;
      profile.minYang = minYang;
      profile.maxYang = maxYang;
      profile.seenItems.clear();
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Upgrade
    if (interaction.isModalSubmit() && interaction.customId === 'modal_upgrade') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const minStr = interaction.fields.getTextInputValue('input_min_upgrade').trim();
      const maxStr = interaction.fields.getTextInputValue('input_max_upgrade').trim();

      const min = minStr ? parseInt(minStr, 10) : 0;
      const max = maxStr ? parseInt(maxStr, 10) : 200;

      if (isNaN(min) || min < 0 || min > 200 || isNaN(max) || max < 0 || max > 200) {
        await interaction.reply({ content: 'Gecersiz deger! 0-200 arasi sayilar gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.minUpgrade = min;
      profile.maxUpgrade = max;
      profile.seenItems.clear();
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Interval (Kontrol Suresi)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_interval') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const value = parseInt(interaction.fields.getTextInputValue('input_interval'), 10);
      if (isNaN(value) || value < 5 || value > 3600) {
        await interaction.reply({ content: 'Gecersiz deger! 5-3600 saniye arasi gir.', flags: MessageFlags.Ephemeral });
        return;
      }
      profile.checkInterval = value;
      restartProfileInterval(profile);
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Days (Kalan Gun)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_days') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const minDaysStr = interaction.fields.getTextInputValue('input_min_days').trim();
      const maxDaysStr = interaction.fields.getTextInputValue('input_max_days').trim();

      const minDays = minDaysStr ? parseInt(minDaysStr, 10) : 0;
      const maxDays = maxDaysStr ? parseInt(maxDaysStr, 10) : 0;

      if (isNaN(minDays) || isNaN(maxDays) || minDays < 0 || maxDays < 0) {
        await interaction.reply({ content: 'Gecersiz deger! Pozitif sayi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.minRemainingDays = minDays;
      profile.maxRemainingDays = maxDays;
      profile.seenItems.clear();
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Category
    if (interaction.isModalSubmit() && interaction.customId === 'modal_category') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const category = interaction.fields.getTextInputValue('input_category').trim();
      profile.categoryFilter = category;
      profile.seenItems.clear();
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Element
    if (interaction.isModalSubmit() && interaction.customId === 'modal_element') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const typeStr = interaction.fields.getTextInputValue('input_elem_type').trim();
      const totalStr = interaction.fields.getTextInputValue('input_elem_total').trim();
      const singleStr = interaction.fields.getTextInputValue('input_elem_single').trim();

      const elemType = typeStr ? parseInt(typeStr, 10) : 0;
      const minTotal = totalStr ? parseInt(totalStr, 10) : 0;
      const minSingle = singleStr ? parseInt(singleStr, 10) : 0;

      if (isNaN(elemType) || isNaN(minTotal) || isNaN(minSingle)) {
        await interaction.reply({ content: 'Gecersiz deger! Sayilar gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.elemType = elemType;
      profile.minElemTotal = minTotal;
      profile.minElemSingle = minSingle;
      profile.seenItems.clear();
      saveProfiles();

      const elemName = elemType > 0 ? getElementName(elemType) : 'Hepsi';
      await interaction.reply({
        content: `Element filtresi ayarlandi:\nTip: ${elemName}\nMin Toplam: ${minTotal}\nMin Tek: ${minSingle}`,
        flags: MessageFlags.Ephemeral
      });
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Simya
    if (interaction.isModalSubmit() && interaction.customId === 'modal_simya') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const qualityStr = interaction.fields.getTextInputValue('input_simya_quality').trim();
      const bonusStr = interaction.fields.getTextInputValue('input_simya_bonus').trim();

      const quality = qualityStr ? parseInt(qualityStr, 10) : 5;
      const bonus = bonusStr ? parseInt(bonusStr, 10) : 0;

      if (isNaN(quality) || quality < 0 || quality > 5) {
        await interaction.reply({ content: 'Gecersiz kalite! 0-5 arasi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (isNaN(bonus) || bonus < 0 || bonus > 6) {
        await interaction.reply({ content: 'Gecersiz bonus sayisi! 0-6 arasi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.simyaQuality = quality;
      profile.minBonusCount = bonus;
      profile.seenItems.clear();
      saveProfiles();

      const qualityName = quality < 5 ? getSimyaQualityName(quality) : 'Hepsi';
      await interaction.reply({
        content: `Simya filtresi ayarlandi:\nKalite: ${qualityName}\nMin Bonus: ${bonus > 0 ? bonus : 'Devre disi'}`,
        flags: MessageFlags.Ephemeral
      });
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Kusak
    if (interaction.isModalSubmit() && interaction.customId === 'modal_belt') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const absorptionStr = interaction.fields.getTextInputValue('input_absorption').trim();
      const beltElemStr = interaction.fields.getTextInputValue('input_belt_elem').trim();
      const beltWeaponStr = interaction.fields.getTextInputValue('input_belt_weapon').trim();

      const absorption = absorptionStr ? parseInt(absorptionStr, 10) : 0;
      const beltElem = beltElemStr ? parseInt(beltElemStr, 10) : 0;

      if (isNaN(absorption) || absorption < 0 || absorption > 100) {
        await interaction.reply({ content: 'Gecersiz emis orani! 0-100 arasi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (isNaN(beltElem) || (beltElem !== 0 && (beltElem < 99 || beltElem > 104))) {
        await interaction.reply({ content: 'Gecersiz element! 0=Hepsi, 99-104 arasi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.minAbsorption = absorption;
      profile.beltElemType = beltElem;
      profile.beltWeaponFilter = beltWeaponStr;
      profile.seenItems.clear();
      saveProfiles();

      const elemName = beltElem > 0 ? getElementName(beltElem) : 'Hepsi';
      const weaponText = beltWeaponStr || 'Hepsi';
      await interaction.reply({
        content: `Kusak filtresi ayarlandi:\nMin Emis: %${absorption > 0 ? absorption : 'Devre disi'}\nElement: ${elemName}\nSilah: ${weaponText}`,
        flags: MessageFlags.Ephemeral
      });
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Pet
    if (interaction.isModalSubmit() && interaction.customId === 'modal_pet') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const petTypeStr = interaction.fields.getTextInputValue('input_pet_type').trim();
      const petStatsStr = interaction.fields.getTextInputValue('input_pet_stats').trim();
      const petSkillsStr = interaction.fields.getTextInputValue('input_pet_skills').trim();

      const petType = petTypeStr ? parseInt(petTypeStr, 10) : 0;

      // Stats parse: HP, SP, Defans, Gun
      const statParts = petStatsStr ? petStatsStr.split(',').map(s => parseFloat(s.trim()) || 0) : [0, 0, 0, 0];
      const petHP = statParts[0] || 0;
      const petSP = statParts[1] || 0;
      const petDefans = statParts[2] || 0;
      const petDays = statParts[3] || 0;

      // Beceri ID'lerini parse et
      const skillIds = petSkillsStr
        ? petSkillsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0 && n <= 23)
        : [];

      if (isNaN(petType) || petType < 0 || petType > 8) {
        await interaction.reply({ content: 'Gecersiz pet tipi! 0-8 arasi gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.petType = petType;
      profile.minPetHP = petHP;
      profile.minPetSP = petSP;
      profile.minPetDefans = petDefans;
      profile.minPetDays = petDays;
      profile.petSkill1 = skillIds[0] || 0;
      profile.petSkill2 = skillIds[1] || 0;
      profile.petSkill3 = skillIds[2] || 0;
      profile.petSkill1MinLevel = 0;
      profile.petSkill2MinLevel = 0;
      profile.petSkill3MinLevel = 0;
      profile.seenItems.clear();
      saveProfiles();

      // Beceri isimlerini goster
      const skillNames = skillIds.map(id => getPetSkillName(id)).join(', ');

      await interaction.reply({
        content: `Pet filtresi ayarlandi:\nTip: ${petType > 0 ? petType : 'Hepsi'}\nMin HP/SP/Def: ${petHP}/${petSP}/${petDefans}\nMin Gun: ${petDays || 'Devre disi'}\nBeceriler: ${skillNames || 'Devre disi'}`,
        flags: MessageFlags.Ephemeral
      });
      await updatePanel(interaction);
      return;
    }

    // Modal Submit: Level
    if (interaction.isModalSubmit() && interaction.customId === 'modal_level') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Profil bulunamadi!', flags: MessageFlags.Ephemeral });
        return;
      }

      const minStr = interaction.fields.getTextInputValue('input_min_level').trim();
      const maxStr = interaction.fields.getTextInputValue('input_max_level').trim();

      const min = minStr ? parseInt(minStr, 10) : 0;
      const max = maxStr ? parseInt(maxStr, 10) : 120;

      if (isNaN(min) || min < 0 || min > 120 || isNaN(max) || max < 0 || max > 120) {
        await interaction.reply({ content: 'Gecersiz deger! 0-120 arasi sayilar gir.', flags: MessageFlags.Ephemeral });
        return;
      }

      profile.minLevel = min;
      profile.maxLevel = max;
      profile.seenItems.clear();
      saveProfiles();
      await interaction.deferUpdate();
      await updatePanel(interaction);
      return;
    }

    // Button: Simdi Ara
    if (interaction.isButton() && interaction.customId === 'btn_search') {
      const profile = getSelectedProfile();
      if (!profile) {
        await interaction.reply({ content: 'Once bir profil sec!', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply();
      try {
        const items = await fetchData(profile.serverId);
        const filtered = filterItems(items, profile);
        filtered.sort((a, b) => (a.wonPrice || 0) - (b.wonPrice || 0));
        const embed = createSearchResults(filtered, profile);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ content: `Hata: ${err.message}` });
      }
      return;
    }

    // Button: Paneli Yenile
    if (interaction.isButton() && interaction.customId === 'btn_refresh') {
      const panel = createPanel();
      await interaction.update({ embeds: [panel.embed], components: panel.components });
      return;
    }

    // Button: Baslat
    if (interaction.isButton() && interaction.customId === 'btn_start') {
      const profile = getSelectedProfile();
      if (profile) {
        startProfile(profile);
      }
      const panel = createPanel();
      await interaction.update({ embeds: [panel.embed], components: panel.components });
      return;
    }

    // Button: Durdur
    if (interaction.isButton() && interaction.customId === 'btn_stop') {
      const profile = getSelectedProfile();
      if (profile) {
        stopProfile(profile);
      }
      const panel = createPanel();
      await interaction.update({ embeds: [panel.embed], components: panel.components });
      return;
    }

  } catch (err) {
    console.error('Interaction hatasi:', err.message);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Bir hata olustu.', flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
      // Ignore
    }
  }
});

// ========== MESAJ KOMUTLARI ==========

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  try {
    if (message.content.toLowerCase() === '!help') {
      const helpText = [
        '**Metin2 Pazar Botu**',
        '',
        '`!panel` - Kontrol paneli',
        '',
        '**Listeler:**',
        '`!statlar` - Efsun isimleri *(isim kopyala)*',
        '`!elementler` - Element kodlari *(ID kopyala)*',
        '`!kategoriler` - Kategori kodlari *(ID kopyala)*',
        '`!simyalar` - Simya kaliteleri *(ID kopyala)*',
        '`!beceriler` - Pet becerileri *(ID kopyala)*',
        '',
        '**Profil:**',
        '`!export` - Profili indir',
        '`!import {JSON}` - Profil yukle',
      ].join('\n');

      await message.reply(helpText);
      return;
    }

    if (message.content.toLowerCase() === '!panel') {
      const panel = createPanel();
      await message.reply({ embeds: [panel.embed], components: panel.components });
      return;
    }

    if (message.content.toLowerCase() === '!statlar') {
      const statNames = Object.keys(STAT_MAP).sort();
      const content = statNames.map((name, i) => `${i + 1}. ${name} (ID: ${STAT_MAP[name]})`).join('\n');

      const buffer = Buffer.from(content, 'utf-8');
      await message.reply({
        content: `Toplam **${statNames.length}** stat:`,
        files: [{
          attachment: buffer,
          name: 'statlar.txt'
        }]
      });
      return;
    }

    if (message.content.toLowerCase() === '!elementler') {
      const elementList = [
        '0   = Hepsi (filtre yok)',
        '99  = Şimşek (Şimşeklerin gücü)',
        '100 = Ateş (Ateşin gücü)',
        '101 = Buz (Buzun gücü)',
        '102 = Rüzgar (Rüzgarın gücü)',
        '103 = Toprak (Toprağın gücü)',
        '104 = Karanlık (Karanlığın gücü)',
      ].join('\n');

      await message.reply({
        content: '**Element Tipleri:**\n```\n' + elementList + '\n```'
      });
      return;
    }

    if (message.content.toLowerCase() === '!simyalar') {
      const simyaList = [
        '0 = Mat',
        '1 = Parlak',
        '2 = Tertemiz',
        '3 = Mükemmel',
        '4 = Kusursuz',
        '5 = Hepsi (filtre yok)',
        '',
        'Bonus Sayısı: 3, 4, 5 veya 6',
      ].join('\n');

      await message.reply({
        content: '**Simya Kaliteleri:**\n```\n' + simyaList + '\n```'
      });
      return;
    }

    if (message.content.toLowerCase() === '!kategoriler') {
      const kategoriList = [
        '**Petler:**',
        '0-1-1 = Petler',
        '0-1-2 = Seviye Atlayabilen Petler',
        '0-1-3 = Pet Yumurtalari',
        '',
        '**Silahlar:**',
        '0-2-0 = Savasci Tek Elli Silah',
        '0-2-3 = Savasci Cift Elli Silahlar',
        '1-2-1 = Ninja Hancerler',
        '1-2-2 = Ninja Yaylar',
        '2-2-0 = Sura Tek Elli Silah',
        '3-2-4 = Saman Canlar',
        '3-2-6 = Saman Yelpazeler',
        '4-2-5 = Lycan Pence',
        '',
        '**Zirhlar:**',
        '0-3-0 = Savasci Zirhlar',
        '1-3-0 = Ninja Zirhlar',
        '2-3-0 = Sura Zirhlar',
        '3-3-0 = Saman Zirhlar',
        '4-3-0 = Lycan Zirhlar',
        '',
        '**Migferler:**',
        '0-3-1 = Savasci Migferleri',
        '1-3-1 = Ninja Migferleri',
        '2-3-1 = Sura Migferleri',
        '3-3-1 = Saman Migferleri',
        '4-3-1 = Lycan Migferleri',
        '',
        '**Kalkanlar / Eldivenler:**',
        '0-3-2 = Kalkanlar',
        '0-3-3 = Eldiven',
        '',
        '**Aksesuarlar:**',
        '0-4-0 = Bilezikler',
        '0-4-1 = Ayakkabilar',
        '0-4-2 = Kolyeler',
        '0-4-3 = Kupeler',
        '0-4-4 = Kemerler',
        '0-4-5 = Tilsim',
        '',
        '**Malzemeler:**',
        '0-5-0 = Malzemeler',
        '0-5-1 = Zihin Taslari',
        '0-5-2 = Gelistirmeler Digerleri',
        '0-5-3 = Basari sansini yukselt',
        '',
        '**Balikcilik / Madenicilik:**',
        '0-7-0 = Oltalar',
        '0-7-1 = Kazmalar',
        '0-7-2 = Baliklar',
        '0-7-3 = Cevherler',
        '0-7-4 = Balikcilik Madenicilik Digerleri',
        '',
        '**Ejderha Tasi Simyasi:**',
        '0-8-0 = Elmas',
        '0-8-1 = Yakut',
        '0-8-2 = Yesim',
        '0-8-3 = Safir',
        '0-8-4 = Grena',
        '0-8-5 = Oniks',
        '0-8-6 = Ametist',
        '0-8-7 = Ejderha Tasi Simyasi Digerleri',
        '',
        '**Silah Gorunumleri:**',
        '0-9-0 = Savasci Silah Gorunumleri',
        '1-9-0 = Ninja Silah Gorunumleri',
        '3-9-0 = Saman Silah Gorunumleri',
        '4-9-0 = Lycan Silah Gorunumleri',
        '',
        '**Kostumler:**',
        '0-9-1 = Kostumler',
        '0-9-2 = Sac Modelleri',
        '0-9-3 = Omuz Kusaklari',
        '0-9-4 = Kostumler Digerleri',
        '0-9-5 = Aura Giysileri',
        '',
        '**Diger:**',
        '0-12-0 = Sandiklar / Kutular',
        '0-12-2 = Etkinlik Esyalari',
        '0-12-3 = Ruha Baglama',
        '0-12-4 = Savas Becerisi Kitaplari',
        '0-12-5 = Donusum Kureleri',
        '0-12-7 = Digerleri',
      ].join('\n');

      const buffer = Buffer.from(kategoriList, 'utf-8');
      await message.reply({
        content: '**Kategori Kodlari:**\nKategori butonunda bu kodlari kullanabilirsin.',
        files: [{
          attachment: buffer,
          name: 'kategoriler.txt'
        }]
      });
      return;
    }

    if (message.content.toLowerCase() === '!beceriler') {
      const beceriList = Object.entries(PET_SKILL_MAP)
        .map(([id, name]) => `${id.padStart(2)} = ${name}`)
        .join('\n');

      await message.reply({
        content: '**Pet Becerileri:**\nPet filtresinde bu IDleri virgülle ayırarak kullan.\nÖrnek: `6,13,20` (Berserker, Engel, Canavar avcısı)\n```\n' + beceriList + '\n```'
      });
      return;
    }

    if (message.content.toLowerCase() === '!export') {
      const profile = getSelectedProfile();
      if (!profile) {
        await message.reply('Once panelden bir profil sec!');
        return;
      }

      const exportData = {
        name: profile.name,
        serverId: profile.serverId,
        serverName: profile.serverName,
        itemNameFilter: profile.itemNameFilter,
        statFilters: profile.statFilters,
        minWon: profile.minWon,
        maxWon: profile.maxWon,
        minYang: profile.minYang,
        maxYang: profile.maxYang,
        minUpgrade: profile.minUpgrade,
        maxUpgrade: profile.maxUpgrade,
        minLevel: profile.minLevel,
        maxLevel: profile.maxLevel,
        elemType: profile.elemType,
        minElemTotal: profile.minElemTotal,
        minElemSingle: profile.minElemSingle,
        simyaQuality: profile.simyaQuality,
        minBonusCount: profile.minBonusCount,
        checkInterval: profile.checkInterval,
        minAbsorption: profile.minAbsorption,
        beltElemType: profile.beltElemType,
        beltWeaponFilter: profile.beltWeaponFilter,
        petType: profile.petType,
        minPetHP: profile.minPetHP,
        minPetSP: profile.minPetSP,
        minPetDefans: profile.minPetDefans,
        minPetDays: profile.minPetDays,
        minRemainingDays: profile.minRemainingDays,
        maxRemainingDays: profile.maxRemainingDays,
        categoryFilter: profile.categoryFilter,
      };

      const json = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(json, 'utf-8');

      await message.reply({
        content: `**${profile.name}** profili export edildi:`,
        files: [{
          attachment: buffer,
          name: `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
        }]
      });
      return;
    }

    if (message.content.toLowerCase().startsWith('!import ')) {
      const jsonStr = message.content.slice(8).trim();

      let importData;
      try {
        importData = JSON.parse(jsonStr);
      } catch (e) {
        await message.reply('Gecersiz JSON formati! Ornek: `!import {"name":"Profil",...}`');
        return;
      }

      if (!importData.name) {
        await message.reply('Gecersiz profil! "name" alani gerekli.');
        return;
      }

      const newProfile = createDefaultProfile(importData.name);

      if (importData.serverName && SERVERS[importData.serverName]) {
        newProfile.serverName = importData.serverName;
        newProfile.serverId = SERVERS[importData.serverName];
      } else if (importData.serverId) {
        newProfile.serverId = importData.serverId;
        const serverEntry = Object.entries(SERVERS).find(([_, id]) => id === importData.serverId);
        if (serverEntry) newProfile.serverName = serverEntry[0];
      }

      if (typeof importData.itemNameFilter === 'string') newProfile.itemNameFilter = importData.itemNameFilter;
      if (Array.isArray(importData.statFilters)) newProfile.statFilters = importData.statFilters;
      if (typeof importData.minWon === 'number') newProfile.minWon = importData.minWon;
      if (typeof importData.maxWon === 'number') newProfile.maxWon = importData.maxWon;
      if (typeof importData.minYang === 'number') newProfile.minYang = importData.minYang;
      if (typeof importData.maxYang === 'number') newProfile.maxYang = importData.maxYang;
      if (typeof importData.minUpgrade === 'number') newProfile.minUpgrade = importData.minUpgrade;
      if (typeof importData.maxUpgrade === 'number') newProfile.maxUpgrade = importData.maxUpgrade;
      if (typeof importData.minLevel === 'number') newProfile.minLevel = importData.minLevel;
      if (typeof importData.maxLevel === 'number') newProfile.maxLevel = importData.maxLevel;
      if (typeof importData.elemType === 'number') newProfile.elemType = importData.elemType;
      if (typeof importData.minElemTotal === 'number') newProfile.minElemTotal = importData.minElemTotal;
      if (typeof importData.minElemSingle === 'number') newProfile.minElemSingle = importData.minElemSingle;
      if (typeof importData.simyaQuality === 'number') newProfile.simyaQuality = importData.simyaQuality;
      if (typeof importData.minBonusCount === 'number') newProfile.minBonusCount = importData.minBonusCount;
      if (typeof importData.checkInterval === 'number') newProfile.checkInterval = Math.max(5, importData.checkInterval);
      if (typeof importData.minAbsorption === 'number') newProfile.minAbsorption = importData.minAbsorption;
      if (typeof importData.beltElemType === 'number') newProfile.beltElemType = importData.beltElemType;
      if (typeof importData.beltWeaponFilter === 'string') newProfile.beltWeaponFilter = importData.beltWeaponFilter;
      if (typeof importData.petType === 'number') newProfile.petType = importData.petType;
      if (typeof importData.minPetHP === 'number') newProfile.minPetHP = importData.minPetHP;
      if (typeof importData.minPetSP === 'number') newProfile.minPetSP = importData.minPetSP;
      if (typeof importData.minPetDefans === 'number') newProfile.minPetDefans = importData.minPetDefans;
      if (typeof importData.minPetDays === 'number') newProfile.minPetDays = importData.minPetDays;
      if (typeof importData.minRemainingDays === 'number') newProfile.minRemainingDays = importData.minRemainingDays;
      if (typeof importData.maxRemainingDays === 'number') newProfile.maxRemainingDays = importData.maxRemainingDays;
      if (typeof importData.categoryFilter === 'string') newProfile.categoryFilter = importData.categoryFilter;

      PROFILES.set(newProfile.id, newProfile);
      selectedProfileId = newProfile.id;
      saveProfiles();

      await message.reply(`Profil import edildi: **${newProfile.name}**\nPaneli yenilemek icin \`!panel\` yaz.`);
      return;
    }
  } catch (err) {
    console.error('Mesaj hatasi:', err.message);
  }
});

// ========== BOT BASLATMA ==========

async function startBot() {
  try {
    // MongoDB'ye baglanmayi dene (opsiyonel)
    if (process.env.MONGODB_URI) {
      try {
        console.log('MongoDB\'ye baglaniliyor...');
        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000 // 5 saniye timeout
        });
        isMongoConnected = true;
        console.log('MongoDB baglantisi basarili!');
      } catch (mongoErr) {
        console.log('MongoDB baglantisi kurulamadi:', mongoErr.message);
        console.log('Lokal mod aktif - profiller profiles.json dosyasinda saklanacak.');
        isMongoConnected = false;
      }
    } else {
      console.log('MONGODB_URI bulunamadi - Lokal mod aktif.');
      console.log('Profiller profiles.json dosyasinda saklanacak.');
      isMongoConnected = false;
    }

    // Discord'a baglan
    client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('Baslangic hatasi:', err.message);
    process.exit(1);
  }
}

client.once(Events.ClientReady, async () => {
  console.log('══════════════════════════════════════════');
  console.log(`Bot baglandi: ${client.user.tag}`);
  await loadStatMap();
  await loadItemLevelMap();
  await loadProfiles();
  console.log('Coklu Profil Sistemi aktif');
  console.log('Discord kanalinda !panel yazarak kontrol panelini ac');
  console.log('══════════════════════════════════════════');
});

client.on(Events.Error, (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

// Bellek kullanimi loglama (debug)
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`Bellek: RSS=${Math.round(used.rss / 1024 / 1024)}MB, Heap=${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}, 60000);

startBot();
