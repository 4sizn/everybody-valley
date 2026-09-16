import { CancellationTokenSource, STORAGE_KEYS, type ThemeMode } from '@modu-valley/core';
import { Alert, Button, Dialog, Segmented } from '@moduvalley/ui';
import { useState } from 'react';
import { createStorage } from '@/platform/mapPlatform';
import { useThemePreference } from '@/theme/ThemeProvider';
import { AdminDialog } from './AdminDialog.web';

export function SettingsDialog({
  kind,
  onClose,
}: {
  kind: 'settings' | 'safety' | null;
  onClose: () => void;
}) {
  const { preference, setPreference } = useThemePreference();
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const changeTheme = async (value: ThemeMode) => {
    const lifetime = new CancellationTokenSource();
    const result = await createStorage().write(STORAGE_KEYS.themeMode, value, lifetime.token);
    lifetime.dispose();
    if (result.ok) {
      setPreference(value);
      setError('');
    } else setError('설정을 저장하지 못했습니다. 다시 시도해주세요.');
  };
  return (
    <>
      <Dialog
        open={kind !== null}
        onClose={onClose}
        title={kind === 'settings' ? '표시 설정' : '계곡 이용 안전 안내'}
        footer={<Button onClick={onClose}>돌아가기</Button>}
      >
        {kind === 'settings' ? (
          <div className="ev-form">
            <Segmented
              label="화면 테마"
              value={preference}
              onChange={(value) => void changeTheme(value)}
              options={[
                { value: 'light', label: '라이트' },
                { value: 'dark', label: '다크' },
                { value: 'system', label: '시스템' },
              ]}
            />
            {error && <Alert status="error">{error}</Alert>}
            <p>
              기기의 GPS 위치를 수집하지 않습니다. 제보의 공개 위치는 작성자가 지도에서 별도로
              지정합니다.
            </p>
            <p>사진은 서버에서 재인코딩하여 위치 메타데이터를 제거합니다.</p>
            <p className="ev-muted">
              제보의 닉네임·본문·사진·선택한 위치는 공개됩니다. 서버는 수정·삭제 인증을 위한
              비밀번호 해시와 요청 제한·운영을 위한 IP 정보를 저장합니다. 개인정보는 제보에 적지
              마세요.
            </p>
            <Button variant="secondary" onClick={() => setAdminOpen(true)}>
              제보 운영자 관리
            </Button>
          </div>
        ) : (
          <div className="ev-form">
            <Alert status="unknown" title="자료 없음은 안전을 뜻하지 않습니다">
              현장 통제와 공식 안내를 우선하세요.
            </Alert>
            <p>
              방문 전 기상과 출입 통제를 확인하세요. 구명조끼를 착용하고 어린이는 보호자와
              함께하세요.
            </p>
            <p>
              갑작스러운 수위 변화나 대피 안내가 있으면 물에서 벗어나 현장 안내를 따르세요. 이 앱의
              제보 등록은 긴급 구조 요청을 대신하지 않습니다.
            </p>
            <a
              className="ev-link"
              href="https://www.safekorea.go.kr/safekorea-kor/acts/nacts/action-guide.do?category=summerWaterPlay&menuSn=4"
              target="_blank"
              rel="noreferrer"
            >
              국민안전24 물놀이 행동요령
            </a>
            <a className="ev-link" href="tel:119">
              긴급 구조 119 전화
            </a>
          </div>
        )}
      </Dialog>
      <AdminDialog open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}
