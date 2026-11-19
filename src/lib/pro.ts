// ---------- Pro 구독 (RevenueCat) ----------
// 상태는 모듈 스토어(pomodoro.ts와 같은 방식) + usePro 훅으로 읽는다.
// API 키가 없으면(아직 스토어 미등록) RevenueCat을 부르지 않고 무료로 동작한다.

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

// TODO(출시): RevenueCat 대시보드 > Project > API keys 의 공개 SDK 키를 .env에 넣는다.
//   EXPO_PUBLIC_RC_ANDROID_KEY=goog_xxx
//   EXPO_PUBLIC_RC_IOS_KEY=appl_xxx
const API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
});

// TODO(출시): RevenueCat에서 만든 entitlement 식별자. 상품(연간/월간)은 이 entitlement에 묶고,
//   current offering에 annual / monthly 패키지로 등록하면 아래 코드가 그대로 읽는다.
export const PRO_ENTITLEMENT = 'pro';

// TODO(출시): 실제 가격은 스토어 상품의 priceString을 쓴다. 상품을 못 불러왔을 때만 표시할 자리값.
export const PRICE_PLACEHOLDER = { annual: '—', monthly: '—' };

export type ProPlan = 'annual' | 'monthly';

export type ProState = {
  isPro: boolean;
  /** RevenueCat 설정 완료 여부 (키 없음/웹이면 false) */
  available: boolean;
  plan: ProPlan | null;
  /** 다음 결제(만료) 시각 ISO */
  renewsAt: string | null;
  packages: Partial<Record<ProPlan, PurchasesPackage>>;
  /** 구독 관리 URL (스토어) */
  manageUrl: string | null;
};

let state: ProState = {
  isPro: false,
  available: false,
  plan: null,
  renewsAt: null,
  packages: {},
  manageUrl: null,
};
/** 개발 빌드에서 잠금 화면 확인용 강제 Pro */
let devPro = false;

const listeners = new Set<() => void>();
function set(patch: Partial<ProState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function getProState(): ProState {
  return state;
}

/** Pro 상태 구독 훅 */
export function usePro(): ProState {
  return useSyncExternalStore(subscribe, getProState, getProState);
}

function applyCustomerInfo(info: CustomerInfo) {
  const ent = info.entitlements.active[PRO_ENTITLEMENT];
  const id = ent?.productIdentifier ?? '';
  set({
    isPro: devPro || !!ent,
    plan: ent ? (/month/i.test(id) ? 'monthly' : 'annual') : null,
    renewsAt: ent?.expirationDate ?? null,
    manageUrl: info.managementURL,
  });
}

let initialized = false;

/** 앱 시작 시 1회. 키가 없으면 조용히 무료로 둔다. */
export async function initPro(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!API_KEY || Platform.OS === 'web') return;
  try {
    Purchases.configure({ apiKey: API_KEY });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    set({ available: true });
    applyCustomerInfo(await Purchases.getCustomerInfo());
    const current = (await Purchases.getOfferings()).current;
    set({
      packages: {
        annual: current?.annual ?? undefined,
        monthly: current?.monthly ?? undefined,
      },
    });
  } catch {
    // 네트워크/설정 오류 — 무료로 동작하고 다음 실행에 다시 시도
  }
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

/** 진행 중인 결제 — 버튼 연타 등으로 겹쳐 들어온 호출은 무시해 중복 결제를 막는다 */
let purchasing = false;

export async function purchasePro(plan: ProPlan): Promise<PurchaseResult> {
  if (purchasing) return { ok: false, cancelled: true, message: '' };
  purchasing = true;
  try {
    return await purchaseOnce(plan);
  } finally {
    purchasing = false;
  }
}

async function purchaseOnce(plan: ProPlan): Promise<PurchaseResult> {
  const pkg = state.packages[plan];
  if (!state.available || !pkg)
    return { ok: false, cancelled: false, message: '아직 스토어 상품이 준비되지 않았어요.' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return state.isPro
      ? { ok: true }
      : { ok: false, cancelled: false, message: '결제는 됐지만 Pro 확인이 늦어지고 있어요.' };
  } catch (e) {
    const err = e as { userCancelled?: boolean | null; message?: string };
    return { ok: false, cancelled: !!err.userCancelled, message: err.message ?? String(e) };
  }
}

/** 구매 복원. Pro가 확인되면 true */
export async function restorePro(): Promise<boolean> {
  if (!state.available) return false;
  try {
    applyCustomerInfo(await Purchases.restorePurchases());
  } catch {
    return false;
  }
  return state.isPro;
}

/** 개발 빌드 전용: 결제 없이 Pro 켜고 끄기 */
export function setDevPro(on: boolean): void {
  if (!__DEV__) return;
  devPro = on;
  set({ isPro: on || (state.plan != null && state.available) });
}

/** 화면 표시용 가격 */
export function priceOf(plan: ProPlan): string {
  return state.packages[plan]?.product.priceString ?? PRICE_PLACEHOLDER[plan];
}
