import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubHeader } from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, OPERATOR_NAME } from '@/lib/contact';

// ※ 초안. 출시 전 법적 검토 필요.
type Doc = { title: string; intro: string; sections: [string, string][] };

const contact = CONTACT_EMAIL || '[문의 이메일]';

const PRIVACY: Doc = {
  title: '개인정보처리방침',
  intro: `${OPERATOR_NAME}(이하 '운영자')는 데일리 플래너(이하 '앱') 이용자의 개인정보를 소중히 다루며, 「개인정보 보호법」 등 관련 법령을 지킵니다. 앱의 학습 기록은 기본적으로 이용자의 기기에만 저장되며, 이용자가 구글 로그인을 해 클라우드 백업을 사용할 때에만 서버로 전송됩니다.`,
  sections: [
    [
      '1. 수집하는 개인정보',
      `· 구글 로그인 시: 이메일 주소, 이름·프로필 사진(구글 계정 기본 정보), 계정 식별자
· 클라우드 백업 사용 시: 앱에 입력한 학습 데이터(타임테이블 계획·집중 기록, 과목, 할 일, 일정, 메모, D-Day, 앱 설정)
· Pro 구독 시: 구독 상태 확인을 위한 익명 앱 사용자 ID와 구매 내역(상품, 구매·만료 일시). 카드번호 등 결제 정보는 앱 마켓(Google Play·App Store)이 처리하며 운영자는 받지 않습니다.
· 로그인하지 않으면 학습 데이터는 기기에만 저장되고 서버로 전송되지 않습니다.`,
    ],
    [
      '2. 이용 목적',
      `· 회원 식별 및 로그인 유지
· 학습 데이터의 클라우드 백업·복원(기기 변경, 앱 재설치 시)
· Pro 구독 이용 자격 확인 및 구매 복원
· 문의 응대`,
    ],
    [
      '3. 보유 및 이용 기간',
      `회원 탈퇴 시까지 보유하며, 탈퇴하면 계정 정보와 클라우드 백업을 지체 없이 삭제합니다. 다만 관계 법령에 따라 보존이 필요한 정보(예: 「전자상거래 등에서의 소비자보호에 관한 법률」에 따른 대금 결제 기록 5년)는 해당 기간 동안 보관하며, 이 기록은 앱 마켓이 보관합니다.`,
    ],
    ['4. 제3자 제공', '운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 근거가 있는 경우는 예외로 합니다.'],
    [
      '5. 처리 위탁 및 국외 이전',
      `앱 운영을 위해 아래 업체에 개인정보 처리를 맡기며, 일부는 국외 서버에 저장될 수 있습니다.
· Supabase Inc. — 계정 관리, 클라우드 백업 저장 (서버 위치: 대한민국 서울 — Northeast Asia (Seoul))
· Google LLC — 구글 계정 로그인
· RevenueCat Inc. — 구독 상태 관리 (미국)
· Google LLC / Apple Inc. — 앱 마켓 결제 처리
이전되는 항목은 1번의 항목이며, 이용 시점에 네트워크를 통해 전송되고 회원 탈퇴 또는 위탁 계약 종료 시까지 보관됩니다.`,
    ],
    [
      '6. 이용자의 권리',
      `이용자는 언제든지 자신의 개인정보를 열람·수정·삭제하거나 처리 정지를 요구할 수 있습니다.
· 클라우드 백업 확인: 설정 › 백업·동기화
· 기기 데이터 삭제: 설정 › 데이터 초기화
· 계정과 클라우드 데이터 삭제: 설정 › 계정 › 계정 탈퇴
· 그 밖의 요청: ${contact}`,
    ],
    [
      '7. 파기 절차 및 방법',
      '보유 기간이 끝나거나 처리 목적을 달성한 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로 삭제합니다.',
    ],
    [
      '8. 안전성 확보 조치',
      '전송 구간 암호화(HTTPS), 본인 데이터만 접근할 수 있는 접근 통제(행 단위 보안 정책) 등 안전 조치를 하고 있습니다. 구글 계정의 캘린더·메일 등 다른 데이터에는 접근하지 않습니다.',
    ],
    ['9. 광고 및 행태 정보', '앱에는 광고가 없으며, 광고 목적의 행태 정보를 수집하지 않습니다. 별도의 분석 도구도 사용하지 않습니다.'],
    [
      '10. 개인정보 보호책임자',
      `· 책임자: ${OPERATOR_NAME}
· 연락처: ${contact}
개인정보 침해에 대한 상담은 개인정보침해신고센터(국번 없이 118), 개인정보분쟁조정위원회(1833-6972) 등에 문의할 수 있습니다.`,
    ],
    ['11. 고지의 의무', `이 방침은 ${LEGAL_EFFECTIVE_DATE}부터 시행합니다. 내용이 바뀌면 앱 내 공지 또는 업데이트를 통해 알립니다.`],
  ],
};

const TERMS: Doc = {
  title: '이용약관',
  intro: `이 약관은 ${OPERATOR_NAME}(이하 '운영자')가 제공하는 데일리 플래너(이하 '앱')의 이용 조건과 절차를 정합니다.`,
  sections: [
    [
      '제1조 (서비스 내용)',
      '앱은 하루를 10분 단위 격자로 계획·기록하는 타임테이블, 집중 타이머, 할 일·일정·메모·D-Day 관리, 통계 기능을 제공합니다. 기본 기능은 계정 없이 무료로 이용할 수 있습니다.',
    ],
    [
      '제2조 (계정)',
      '클라우드 백업을 쓰려면 구글 계정으로 로그인해야 합니다. 이용자는 자신의 계정을 직접 관리해야 하며, 언제든지 설정 › 계정 › 계정 탈퇴로 계정을 삭제할 수 있습니다.',
    ],
    [
      '제3조 (데이터 보관)',
      '학습 데이터는 기본적으로 이용자의 기기에 저장됩니다. 로그인하지 않았거나 백업하지 않은 상태에서 앱을 삭제하거나 기기를 잃어버리면 데이터를 되살릴 수 없습니다. 운영자는 클라우드 백업을 안정적으로 운영하려 노력하지만, 모든 데이터의 영구 보존을 보장하지는 않습니다.',
    ],
    [
      '제4조 (Pro 구독)',
      `· Pro는 고급 통계, 공유 카드 스타일, 추가 테마 등을 제공하는 유료 구독입니다(월간·연간).
· 결제는 앱 마켓(Google Play·App Store) 계정으로 이뤄지며, 해지하지 않으면 각 기간이 끝날 때 자동으로 갱신됩니다.
· 해지는 앱 마켓의 구독 관리에서 할 수 있고, 해지해도 이미 결제한 기간이 끝날 때까지 Pro를 이용할 수 있습니다.
· 계정을 탈퇴해도 구독은 자동으로 해지되지 않습니다.
· 환불은 각 앱 마켓의 환불 정책과 관련 법령을 따릅니다.`,
    ],
    [
      '제5조 (이용자의 의무)',
      '이용자는 앱을 역설계·변조하거나, 서버에 비정상적인 부하를 주거나, 다른 사람의 계정을 무단으로 사용해서는 안 됩니다.',
    ],
    [
      '제6조 (서비스 변경·중단)',
      '운영자는 기능을 개선하거나 바꿀 수 있으며, 서비스를 중단해야 할 경우 앱을 통해 미리 알립니다. 유료 구독 중인 기능이 중단되면 관련 법령과 앱 마켓 정책에 따라 처리합니다.',
    ],
    [
      '제7조 (책임의 제한)',
      '운영자는 천재지변, 이용자의 기기·네트워크 문제, 이용자의 과실로 생긴 손해에 대해서는 책임을 지지 않습니다. 다만 운영자의 고의 또는 중대한 과실로 생긴 손해는 예외로 합니다.',
    ],
    [
      '제8조 (약관 변경)',
      '약관을 바꿀 때는 시행일 7일 전(이용자에게 불리한 변경은 30일 전)부터 앱에 알립니다. 변경 후에도 앱을 계속 이용하면 바뀐 약관에 동의한 것으로 봅니다.',
    ],
    ['제9조 (문의 및 분쟁)', `문의는 ${contact} 로 받습니다. 분쟁은 대한민국 법을 따르며, 관할 법원은 민사소송법에 따릅니다.`],
    ['부칙', `이 약관은 ${LEGAL_EFFECTIVE_DATE}부터 시행합니다.`],
  ],
};

/** 설정 › 개인정보처리방침 / 이용약관 (doc=privacy | terms) */
export default function LegalScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const d = doc === 'terms' ? TERMS : PRIVACY;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title={d.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>{d.intro}</Text>
        {d.sections.map(([h, body]) => (
          <Text key={h} style={styles.body}>
            <Text style={styles.heading}>{h}</Text>
            {`\n${body}`}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    heading: { ...PlannerType.labelStrong, fontSize: 15, color: theme.ink },
    body: { ...PlannerType.body, fontSize: 14, lineHeight: 22, color: theme.textSecondary },
  });
