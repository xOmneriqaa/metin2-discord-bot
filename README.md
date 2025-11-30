# Metin2 Pazar Botu

Discord üzerinden metin2alerts.com pazarını takip eden bot.

## Kurulum Seçenekleri

| Mod | Açıklama | Ne Zaman Kullan? |
|-----|----------|------------------|
| **Lokal** | Bilgisayarında çalışır, profiller `profiles.json`'a kaydedilir | Bilgisayarın açıkken çalışsın yeterli |
| **Cloud (Railway)** | 7/24 çalışır, profiller MongoDB'de saklanır | Sürekli açık kalsın istiyorsan |

---

## 1. Discord Bot Oluşturma (Her İki Mod İçin Gerekli)

1. [Discord Developer Portal](https://discord.com/developers/applications) adresine git
2. **New Application** → İsim ver → **Create**
3. Sol menüden **Bot** → **Reset Token** → Token'ı kopyala
4. **MESSAGE CONTENT INTENT** aktif et
5. Sol menüden **OAuth2 → URL Generator**
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Attach Files`
6. Oluşan URL ile botu sunucuna ekle
7. **Kanal ID'si almak için:** Discord ayarları → Geliştirici Modu aç → Kanala sağ tık → ID Kopyala

---

## 2A. Lokal Kurulum (Bilgisayarında Çalıştır)

> Bilgisayarın açık olduğu sürece bot çalışır. Kapattığında durur.

### Gereksinimler
- [Node.js](https://nodejs.org/) (v18+)

### Kurulum

```bash
# Klasöre gir
cd metin2-discord-bot

# Paketleri yükle
npm install
```

### .env Dosyası Oluştur

```env
DISCORD_TOKEN=discord_bot_tokenin
CHANNEL_ID=alert_gonderilecek_kanal_id
```

> **Not:** `MONGODB_URI` eklemene gerek yok profiller lokalde oluşacak.

### Çalıştır

```bash
node index.js
```

Konsolda şunu görmelisin:
```
MONGODB_URI bulunamadi - Lokal mod aktif.
Profiller profiles.json dosyasinda saklanacak.
Bot baglandi: BotAdi#1234
```

---

## 2B. Cloud Kurulum (Railway ile 7/24 Çalıştır)

> Bot sürekli açık kalır. Bilgisayarını kapatsan da çalışmaya devam eder.

### Adım 1: MongoDB Atlas Kurulumu

1. [MongoDB Atlas](https://www.mongodb.com/atlas) hesabı oluştur
2. **Create Cluster** (Free tier yeterli)
3. **Database Access** → Kullanıcı oluştur (şifreyi kaydet)
4. **Network Access** → **Add IP Address** → `0.0.0.0/0` ekle (her yerden erişim)
5. **Connect** → **Connect your application** → Connection string'i kopyala
   ```
   mongodb+srv://KULLANICI:SIFRE@cluster.xxxxx.mongodb.net/metin2bot
   ```

### Adım 2: GitHub'a Yükle

1. [GitHub](https://github.com) hesabı oluştur (yoksa)
2. Yeni repository oluştur (Private önerilir)
3. Projeyi yükle:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/metin2-discord-bot.git
   git push -u origin main
   ```

### Adım 3: Railway Kurulumu

1. [Railway](https://railway.app/) hesabı oluştur (GitHub ile giriş yap)
2. **New Project** → **Deploy from GitHub repo**
3. Repository'ni seç → **Deploy Now**
4. Sol menüden projeye tıkla → **Variables** sekmesi
5. Şu değişkenleri ekle:

   | Variable | Value |
   |----------|-------|
   | `DISCORD_TOKEN` | Discord bot tokenin |
   | `CHANNEL_ID` | Alert kanalının ID'si |
   | `MONGODB_URI` | MongoDB connection string |

6. **Deploy** → Otomatik başlar

### Railway Kontrol

- **Logs** sekmesinden bot durumunu görebilirsin
- Kod güncellediğinde GitHub'a push et → Railway otomatik yeniden deploy eder

---

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `!panel` | Kontrol paneli |
| `!help` | Yardım |
| `!statlar` | Efsun listesi *(isim kopyala)* |
| `!elementler` | Element kodları *(ID kopyala)* |
| `!kategoriler` | Kategori kodları *(ID kopyala)* |
| `!simyalar` | Simya kaliteleri *(ID kopyala)* |
| `!beceriler` | Pet becerileri *(ID kopyala)* |
| `!export` | Profili dışa aktar |
| `!import {JSON}` | Profil içe aktar |

---

## Profil Depolama

| Mod | Depolama Yeri | Açıklama |
|-----|---------------|----------|
| Lokal | `profiles.json` | Proje klasöründe dosya olarak saklanır |
| Cloud | MongoDB + `profiles.json` | Her ikisine de kaydedilir (yedekleme) |

> **Önemli:** Lokal modda oluşturduğun profiller, Railway'e geçtiğinde MongoDB'ye aktarılmaz. `!export` ve `!import` ile profilleri taşıyabilirsin.

---

## Sorun Giderme

### Bot başlamıyor
- Token doğru mu kontrol et
- `MESSAGE CONTENT INTENT` aktif mi?

### MongoDB bağlanmıyor
- IP whitelist'e `0.0.0.0/0` ekledin mi?
- Kullanıcı adı/şifre doğru mu?
- Connection string'de `metin2bot` database adı var mı?

### Railway'de çalışmıyor
- Variables doğru girildi mi?
- Logs sekmesinden hata mesajını kontrol et
