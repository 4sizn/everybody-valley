import { type LandParcel, parseLandParcels } from '@modu-valley/core';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { resolveApiBase } from '@/api/createApiClient';
import { useSession } from '@/session';

export function LandOwnershipPanel({ valleyId }: { readonly valleyId: string }) {
  const session = useSession();
  const [visible, setVisible] = useState(true);
  const [status, setStatus] = useState('토지소유 정보 불러오는 중…');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void retry;
    session.setLandParcels([]);
    if (!visible) return () => controller.abort();
    setStatus('토지소유 정보 불러오는 중…');
    void (async () => {
      try {
        const response = await fetch(
          `${resolveApiBase()}/api/land/${encodeURIComponent(valleyId)}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (!response.ok) throw new Error('unavailable');
        const data = (await response.json()) as { parcels: LandParcel[]; partial: boolean };
        // API 경계에서 좌표를 다시 검증한다. 서버가 이미 구분한 값을 코드로 왕복한다.
        const codes = { individual: '01', organization: '06', public: '02', unknown: 'ZZ' };
        const parcels = parseLandParcels({
          features: data.parcels.map((p) => ({
            geometry: { type: 'Polygon', coordinates: p.coordinates },
            properties: { posesn_se_code: codes[p.ownership] },
          })),
        });
        if (controller.signal.aborted) return;
        session.setLandParcels(parcels);
        setStatus(ownershipStatus(parcels.length, data.partial));
      } catch {
        if (!controller.signal.aborted) setStatus('토지소유 정보를 불러오지 못했습니다. 다시 시도');
      }
    })();
    return () => {
      controller.abort();
      session.setLandParcels([]);
    };
  }, [session, valleyId, visible, retry]);
  return (
    <View style={{ paddingVertical: 12, gap: 8 }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="사유지·토지소유 경계"
        accessibilityState={{ checked: visible }}
        onPress={() => setVisible(!visible)}
      >
        <Text style={{ color: '#26332b', fontWeight: '600' }}>
          사유지·토지소유 경계 {visible ? '켜짐' : '꺼짐'}
        </Text>
      </Pressable>
      {visible && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="토지소유 정보 새로고침"
            onPress={() => setRetry(retry + 1)}
          >
            <Text style={{ color: '#465348' }}>{status}</Text>
          </Pressable>
          <Text style={{ color: '#984517' }}>주황: 개인 사유지 · 황토: 법인·단체</Text>
          <Text style={{ color: '#47739b' }}>파랑: 국공유지 · 회색: 소유구분 미확인</Text>
          <Text style={{ color: '#465348', fontSize: 12 }}>
            국토교통부·브이월드 실시간 조회. 소유구분은 출입 허가·금지를 뜻하지 않으며 최신 장부와
            다를 수 있습니다.
          </Text>
        </>
      )}
    </View>
  );
}

function ownershipStatus(count: number, partial: boolean): string {
  if (!count) return '조회된 경계 없음 · 사유지가 없다는 의미는 아닙니다.';
  return `토지 경계 ${count}개${partial ? ' · 일부만 조회됨' : ''}`;
}
