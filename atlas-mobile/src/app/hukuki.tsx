import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Interactive } from '@/components/ui/interactive';
import { AtlasFonts, AtlasSurface } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { useThemeMode } from '@/lib/theme-context';

/**
 * EKRAN — Gizlilik Politikası + Kullanım Şartları.
 * Onboarding'deki zorunlu onay checkbox'ından ve Ayarlar'dan erişilir; oturum/
 * onboarding durumundan bağımsız açılabilmesi için root layout'ta guard'sız
 * bir Stack.Screen olarak tanımlı (bkz. _layout.tsx, auth-callback ile aynı desen).
 *
 * ⚠️ İÇ NOT (kullanıcıya gösterilmez) — bu metin hukuki incelemeden GEÇMEDİ.
 * Okul/dershane satışı öncesi (öğretmenler değerlendirme için bu ekranı da
 * açacak) bir avukata/KVKK danışmanına onaylatılması ŞART — özellikle 18 yaş
 * altı öğrenci verisi kurumsal bağlamda daha sıkı incelenir (BACKEND.md §9
 * madde 6, henüz kapanmadı). Bu not yalnız kod yorumu olarak kalmalı; ekranda
 * "taslak" ibaresi kullanıcıya güvensiz görünür, önceden yanlışlıkla oradaydı.
 */
export default function HukukiScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Interactive onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Interactive>
          <Text style={[styles.title, { color: surface.text }]}>Gizlilik ve Şartlar</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.card}>
            <Text style={[styles.h1, { color: surface.text }]}>Gizlilik Politikası</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              Atlas (“uygulama”), YKS’ye hazırlanan öğrencilere yönelik bir eğitim uygulamasıdır. Bu
              metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında hangi
              kişisel verilerin, hangi amaçla, ne kadar süreyle işlendiğini açıklamak için hazırlanmıştır.
            </Text>

            <Text style={[styles.h2, { color: surface.text }]}>Toplanan veriler</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              • Hesap bilgileri: e-posta, kullanıcı adı, ad/soyad{'\n'}
              • Kullanım verisi: quiz sonuçları, XP, seri, can durumu, hedef okul/bölüm{'\n'}
              • Ödeme kaydı: yalnızca işlem durumu ve tutar (kart bilgisi Atlas sunucularında
              tutulmaz, doğrudan iyzico’ya gider){'\n'}
              • Bildirim için cihaz push token’ı (Expo Push Notifications altyapısı üzerinden)
            </Text>

            <Text style={[styles.h2, { color: surface.text }]}>İşleme amaçları</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              Hesabını oluşturmak ve sürdürmek, ilerlemeni kaydetmek, premium/ödeme işlemlerini
              yürütmek, haftalık sınav gibi bildirimleri göndermek, AI koç özelliğini (DeepSeek
              API üzerinden) senin bağlamınla besleyebilmek için kullanılır. Verilerin hiçbiri
              reklam/pazarlama amacıyla üçüncü taraflarla paylaşılmaz.
            </Text>

            <Text style={[styles.h2, { color: surface.text }]}>Saklama süresi ve silme</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              Verilerin hesabın açık olduğu sürece saklanır. Ayarlar &gt; Hesabı Sil ile hesabını
              istediğin an kalıcı olarak silebilirsin — bu işlem geri alınamaz ve tüm ilerleme/
              ödeme kaydı/mesaj geçmişini kapsar.
            </Text>

            <Text style={[styles.h2, { color: surface.text }]}>KVKK kapsamındaki hakların</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              Verilerinin işlenip işlenmediğini öğrenme, düzeltilmesini/silinmesini isteme ve
              işlemeye itiraz etme hakkına sahipsin. Talepler için: [destek e-postası eklenecek].
            </Text>

            <Text style={[styles.h2, { color: surface.text }]}>18 yaş altı kullanıcılar</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              Atlas 16-19 yaş grubunu hedefler; bazı kullanıcılar reşit olmayabilir. 18 yaşından
              küçüksen bu uygulamayı yalnızca velinin/yasal temsilcinin bilgisi ve onayı
              dahilinde kullanmalısın.
            </Text>

            <Text style={[styles.h1, { color: surface.text, marginTop: 22 }]}>Kullanım Şartları</Text>
            <Text style={[styles.p, { color: surface.textSecondary }]}>
              Uygulamayı kullanarak burada açıklanan kurallara uymayı kabul edersin: hesabını
              başkasıyla paylaşmama, içerikleri izinsiz çoğaltıp dağıtmama, premium/can satın
              alımlarının dijital ürün olduğu (iade koşulları için ilgili mevzuat geçerlidir) ve
              içeriğin (soru/konu bankası) zaman içinde değişebileceği.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  backSpacer: { width: 40 },
  title: { fontSize: 17, fontFamily: AtlasFonts.heading },
  scroll: { paddingHorizontal: 18, paddingBottom: 30 },
  card: { gap: 2 },
  h1: { fontSize: 17, fontFamily: AtlasFonts.heading, marginBottom: 8 },
  h2: { fontSize: 14, fontFamily: AtlasFonts.heading, marginTop: 14, marginBottom: 4 },
  p: { fontSize: 13, fontFamily: AtlasFonts.bodySemi, lineHeight: 19 },
});
