# CyberSec Pro – Tam İyileştirme ve Gereksinimler Prompt’u

Aşağıdaki metni proje yöneticisi, geliştirici veya yapay zeka asistanına vererek tüm iyileştirmelerin uygulanmasını talep edebilirsiniz. İsterseniz bölüm bölüm kopyalayıp kullanabilirsiniz.

---

## KULLANIM

Bu dosyayı **prompt** olarak kullanın:
- Cursor/IDE’de yeni bir sohbet açıp tüm metni yapıştırın, veya
- “Aşağıdaki prompt’a göre CyberSec Pro projesinde değişiklik yap” gibi bir talimatla birlikte bu dosyayı referans gösterin.

---

# PROMPT METNİ (Kopyala-Yapıştır)

---

Sen, CyberSec Pro güvenlik platformu (semihkilic.com) için A’dan Z’ye eksiksiz, devrim niteliğinde ve kusursuz bir Kali-Linux web uygulaması çözümü üretmekle görevlisin. Aşağıdaki tüm maddeleri eksiksiz uygula.

---

## 1. GENEL VİZYON

- Uygulama, dünyanın en iyi kullanıcı dostu güvenlik taraması, raporlama ve monitoring platformu olmalıdır.
- Kullanıcı **hiçbir kod yazmadan**, sadece seçim yaparak (hedef, agent, araç, profil/parametreler) tarama başlatabilmeli ve sonuçları görebilmelidir.
- Tüm vaatler semihkilic.com satış sayfası ve dokümanlarıyla uyumlu olmalıdır.

---

## 2. ARAÇLAR (682+ TOOL)

### 2.1 Kurulum ve stabilite
- Sistemde **682 (veya mümkün olan en fazla) Kali/security aracı** kurulu, test edilmiş ve stabil çalışır durumda olmalıdır.
- Araç listesi veritabanında tek kaynak olarak tutulmalı; kategoriler, açıklamalar, varsayılan komutlar ve kurulum bilgileri buradan gelmeli.
- Backend veya agent makineleri **Kali tabanlı** imajlarda çalışmalı; araçlar `apt`, `pip`, `go install`, `git clone` vb. ile kurulabilir ve tespit edilebilir olmalı.

### 2.2 Her aracın kendine özgü arayüzü
- **Her araç**, kendi parametreleri için özel bir form arayüzüne sahip olmalıdır (Nmap örneğinde olduğu gibi: Scan Type, Port Options, Detection toggles vb.).
- Kullanıcı komut satırı görmemeli; tüm seçenekler **dropdown, toggle, input, slider** gibi UI bileşenleriyle sunulmalı.
- **Generated Command** alanı, kullanıcının yaptığı seçimlere göre anlık güncellenmeli; “Run Scan” ile bu komut seçilen agent üzerinde çalıştırılmalı.
- Ölçeklenebilirlik için: araç arayüzleri **şema (schema) tabanlı** olmalı. Backend’de her araç için bir UI şeması (alan tipleri, etiketler, varsayılanlar, komuta yansıyan flag’ler) tanımlanmalı; frontend tek bir “ToolFormRenderer” veya benzeri bileşenle bu şemayı okuyup formu çizmelidir. Böylece 682 araç için tekrarlayan sayfa yazılmaz.

### 2.3 Günlük güncelleme
- **Günlük otomatik güncelleme** mekanizması olmalıdır: upstream’de (Kali repo, GitHub, vb.) bir araç güncellendiğinde, platformda da güncelleme yapılmalı veya kullanıcıya bildirilmelidir.
- Cron veya systemd timer ile:
  - `apt update` ve uygun araçlar için `apt upgrade` (veya raporlama),
  - Git tabanlı araçlar için `git pull` ve gerekirse yeniden kurulum,
  - Güncellenen araçların listesi ve versiyonları veritabanında veya “Updates” sayfasında gösterilmeli.

---

## 3. AGENT SİSTEMİ

- Agent sistemi **dünyanın en iyisi** olacak şekilde tasarlanmalıdır.
- **Araç seçildiğinde / çalıştırılmadan önce** kullanıcı mutlaka **Execution Node (Agent)** seçebilmelidir. Bu seçim, Tools sayfası ve her aracın “Run” ekranında görünür olmalı (sadece ayrı bir “Agents” menüsüne bırakılmamalı).
- Özellikler:
  - Agent listesi: isim, konum, **Online/Offline** durumu, yüklü araç sayısı, mevcut kapasite (eşzamanlı job).
  - “Auto – Best available” seçeneği: sistem latency ve kaynak durumuna göre en uygun agent’ı seçer.
  - Tarama, **seçilen agent üzerinde** çalışmalı; komut sunucuda değil, agent makinesinde execute edilmelidir.
- Teknik:
  - Agent’lar merkeze (WebSocket, long-poll veya gRPC) bağlanıp job çekmeli; komutu kendi ortamında çalıştırıp çıktıyı geri göndermeli.
  - Concurrency limitleri, timeout, retry ve iptal (cancel) güvenli şekilde yönetilmeli; bir scan iptal edildiğinde sadece o işin process’i sonlanmalı, sunucu veya diğer işler etkilenmemeli.
  - Agent kayıtları sabit dosya yolu yerine ortam değişkeni veya veritabanı ile yönetilmeli (farklı deployment ortamlarında çalışabilmek için).

---

## 4. KULLANICI DENEYİMİ

- **Sıfır kod girişi**: Tüm aksiyonlar form alanları, dropdown’lar ve butonlarla yapılmalı.
- **Akış**: Hedef gir/seç → Agent seç → Araç ve profil/parametreleri seç → “Run Scan” → Sonuçlar Scans/Reports’ta.
- Quick Scan (Dashboard), Tools listesi, tek araç sayfası ve Scans sayfası bu akışla uyumlu olmalı; agent seçimi her yerde tutarlı şekilde sunulmalı.

---

## 5. TEMA VE ARAYÜZ

- **Dark tema** varsayılan ve birincil tema olmalı; kullanıcı daha önce “dark teması biraz daha iyi” demiştir.
- **Light tema** tamamen kullanılabilir olmalı: metin, border ve butonlar net görünmeli; “hiçbir şey belli olmuyor” sorunu giderilmeli. Bunun için:
  - Tailwind (veya kullanılan CSS framework) içinde hem dark hem light için tam renk paleti tanımlanmalı.
  - `darkMode: 'class'` ile `<html class="dark">` / `<html>` geçişi yapılmalı; tüm bileşenler her iki temada da yeterli kontrasta sahip olmalı.
- Dashboard, sidebar, kartlar, formlar ve “Generated Command” kutusu her iki temada da okunaklı ve profesyonel görünmeli.

---

## 6. BACKEND VE MİMARİ

- **Scan** ve **Job** kavramları net ayrılmalı: Scan kullanıcı tarafından başlatılan birim; Job ise belirli bir agent’ta çalışan tek bir çalıştırma. Concurrency sınırları, kuyruk ve timeout Job seviyesinde yönetilmeli.
- Araç çalıştırma:
  - Ya mevcut backend’den agent’a SSH/API ile komut gönderilmeli,
  - Ya da merkezi bir **Orchestrator** + **Agent daemon** mimarisi kurulmalı (tercihen kuyruk tabanlı: Redis/Postgres + worker).
- Çıktı yönetimi: Çok büyük çıktılar için truncation veya streaming; veritabanında aşırı büyük tek bloklar engellenmeli.
- Lisans ve plan (starter / professional / enterprise) tek bir katmanda yönetilmeli; hangi araç/preset’in hangi planda açık olduğu net olmalı ve API’de uygulanmalı.

---

## 7. RAPORLAMA VE MONİTORİNG

- Tarama sonuçları normalize edilip bulgu (finding) olarak saklanmalı; raporlar (PDF/HTML) proje ve hedef bazında üretilebilmeli.
- Platformun kendisinin sağlığı (agent durumu, job sayısı, hata oranları) izlenebilir olmalı; Monitoring/Analytics sayfaları bu verileri göstermeli.

---

## 8. OPSİYONEL / UZUN VADE

- **Rust** ile backend, orchestrator ve agent daemon yeniden yazılabilir; performans, güvenlik ve dağıtım için tercih edilebilir.
- 682 aracın tam kataloğu Kali ve ek kaynaklardan otomatik veya yarı otomatik üretilebilir; kurulum script’leri ve health-check ile agent’lardaki kurulum durumu sürekli raporlanabilir.

---

## 9. KABUL KRİTERLERİ (Özet)

- [ ] 682 (veya hedeflenen maksimum) araç katalogda ve mümkün olduğunca kurulu/stabil.
- [ ] Her araç için şema tabanlı, kendine özgü form arayüzü; komut yalnızca seçimlerden üretiliyor.
- [ ] Her tarama akışında (Tools, Quick Scan, vb.) Execution Node (Agent) seçimi görünür ve çalışıyor.
- [ ] Tarama seçilen agent üzerinde çalışıyor; merkez sadece orkestrasyon ve sonuç toplama yapıyor.
- [ ] Light ve dark tema tanımlı; light temada tüm metin ve kontroller net görünüyor.
- [ ] Günlük güncelleme mekanizması var; güncellenen araçlar raporlanıyor veya otomatik güncelleniyor.
- [ ] Semihkilic.com satış vaatleri (araç sayısı, tek tıkla tarama, agent, raporlama) ile uyumlu.

---

Bu prompt’u takip ederek projede gerekli tüm iyileştirmeleri uygula. Önce mevcut kodu incele, sonra adım adım (tema, agent entegrasyonu, şema tabanlı arayüz, günlük güncelleme vb.) planlayıp uygula.
