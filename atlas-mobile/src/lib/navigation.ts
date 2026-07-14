import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * `router.back()`'in güvenli sürümü. Geçmişte gidilecek bir ekran yoksa
 * (ör. sayfaya doğrudan URL/derin link ile girildiyse — web'de test
 * ederken sık görülür) `router.back()` sessizce başarısız olur ve konsola
 * "GO_BACK ... was not handled by any navigator" uyarısı basar, kullanıcı
 * için buton işlevsiz kalır. Bu yardımcı önce `canGoBack()` ile kontrol
 * eder, geçmiş yoksa `fallback` rotasına gider.
 */
export function safeGoBack(router: Router, fallback: Parameters<Router['replace']>[0] = '/(tabs)'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
