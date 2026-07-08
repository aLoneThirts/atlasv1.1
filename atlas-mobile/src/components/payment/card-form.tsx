import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Btn3D } from '@/components/ui/btn-3d';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import type { CardInput } from '@/lib/purchases';

function formatCardNumber(digits: string) {
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Kart giriş formu — iyzico-pay Edge Function'ın beklediği alanları toplar.
 * Gerçek doğrulama sunucuda/iyzico'da; burası yalnız temel format kontrolü yapar.
 */
export function CardForm({
  productLabel,
  priceLabel,
  busy,
  error,
  onSubmit,
}: {
  productLabel: string;
  priceLabel: string;
  busy: boolean;
  error?: string | null;
  onSubmit: (card: CardInput) => void;
}) {
  const [holderName, setHolderName] = useState('');
  const [numberDigits, setNumberDigits] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const [mm, yy] = expiry.split('/');
  const validName = holderName.trim().length > 1;
  const validNumber = numberDigits.length >= 12 && numberDigits.length <= 19;
  const validExpiry = /^\d{2}$/.test(mm ?? '') && /^\d{2}$/.test(yy ?? '') && Number(mm) >= 1 && Number(mm) <= 12;
  const validCvc = /^\d{3,4}$/.test(cvc);
  const canSubmit = validName && validNumber && validExpiry && validCvc && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ holderName: holderName.trim(), number: numberDigits, expireMonth: mm!, expireYear: yy!, cvc });
  };

  return (
    <View style={styles.card}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{productLabel}</Text>
        <Text style={styles.summaryPrice}>{priceLabel}</Text>
      </View>

      <Text style={styles.fieldLabel}>Kart Üzerindeki İsim</Text>
      <TextInput
        value={holderName}
        onChangeText={setHolderName}
        placeholder="AD SOYAD"
        autoCapitalize="characters"
        style={styles.input}
        placeholderTextColor={AtlasColors.gray}
        editable={!busy}
      />

      <Text style={styles.fieldLabel}>Kart Numarası</Text>
      <TextInput
        value={formatCardNumber(numberDigits)}
        onChangeText={(v) => setNumberDigits(v.replace(/\D/g, '').slice(0, 19))}
        placeholder="0000 0000 0000 0000"
        keyboardType="number-pad"
        maxLength={23}
        style={styles.input}
        placeholderTextColor={AtlasColors.gray}
        editable={!busy}
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.fieldLabel}>SKT (AA/YY)</Text>
          <TextInput
            value={expiry}
            onChangeText={(v) => {
              const d = v.replace(/\D/g, '').slice(0, 4);
              setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            placeholder="AA/YY"
            keyboardType="number-pad"
            maxLength={5}
            style={styles.input}
            placeholderTextColor={AtlasColors.gray}
            editable={!busy}
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.fieldLabel}>CVC</Text>
          <TextInput
            value={cvc}
            onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            style={styles.input}
            placeholderTextColor={AtlasColors.gray}
            editable={!busy}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Btn3D variant={canSubmit ? 'green' : 'disabled'} onPress={submit} disabled={!canSubmit} style={styles.submit}>
        {busy ? 'İşleniyor…' : `${priceLabel} Öde`}
      </Btn3D>

      <Text style={styles.trust}>🔒 Ödemeler iyzico güvencesiyle işlenir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AtlasColors.white,
    borderRadius: AtlasRadius.card,
    padding: 18,
    gap: 4,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: AtlasColors.line,
  },
  summaryLabel: { fontFamily: AtlasFonts.bodySemi, fontSize: 14, color: AtlasColors.ink, flex: 1 },
  summaryPrice: { fontFamily: AtlasFonts.heading, fontSize: 18, color: AtlasColors.inkStrong },
  fieldLabel: { fontFamily: AtlasFonts.bodyBold, fontSize: 12, color: AtlasColors.gray, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: AtlasColors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: AtlasFonts.bodySemi,
    color: AtlasColors.inkStrong,
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  error: {
    color: AtlasColors.red,
    fontFamily: AtlasFonts.bodySemi,
    fontSize: 13,
    marginTop: 12,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 10,
    padding: 10,
  },
  submit: { marginTop: 16 },
  trust: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 11.5,
    fontFamily: AtlasFonts.bodySemi,
    color: AtlasColors.gray,
  },
});
