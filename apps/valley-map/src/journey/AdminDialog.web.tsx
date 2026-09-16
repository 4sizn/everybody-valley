import { type ApiAdminFlagSummary, type ApiAdminReport, reportTypeLabel } from '@modu-valley/core';
import { Alert, Badge, Button, Dialog, EmptyState, Field, Tabs } from '@moduvalley/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createApiClient } from '@/api/createApiClient';
import { ContentAdmin } from './ContentAdmin.web';

const api = createApiClient();

/** Tokens stay in this page's memory and are authenticated by the API on every request. */
export function AdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [token, setToken] = useState('');
  const [input, setInput] = useState('');
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState<readonly ApiAdminReport[]>([]);
  const [flags, setFlags] = useState<readonly ApiAdminFlagSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const reload = useCallback(async (credential: string, nextCursor?: string) => {
    setError('');
    const [page, flagged] = await Promise.all([
      api.adminReports(credential, {
        includeHidden: true,
        limit: 50,
        ...(nextCursor ? { cursor: nextCursor } : {}),
      }),
      api.adminFlags(credential),
    ]);
    if (!page.ok || !flagged.ok) {
      setError('운영 정보를 불러오지 못했습니다. 인증 정보와 서버 연결을 확인하세요.');
      return false;
    }
    setReports((current) =>
      nextCursor
        ? [...new Map([...current, ...page.value.reports].map((r) => [r.id, r])).values()]
        : page.value.reports,
    );
    setCursor(page.value.nextCursor);
    setFlags(flagged.value);
    return true;
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open && token) void reload(token);
  }, [open, token, reload]);
  const authenticate = () =>
    run(async () => {
      const credential = input.trim();
      if (credential && (await reload(credential))) {
        setToken(credential);
        setInput('');
      }
    });
  const toggle = (id: string, hidden: boolean) =>
    run(async () => {
      const result = await api.setReportHidden(token, id, hidden);
      if (result.ok) {
        window.dispatchEvent(new Event('everybody-reports-changed'));
        await reload(token);
      } else setError('제보 상태를 바꾸지 못했습니다. 다시 시도하세요.');
    });
  const rows =
    tab === 'flags'
      ? flags.map((r) => ({
          id: r.reportId,
          body: r.body,
          nickname: r.nickname,
          type: r.type,
          hidden: r.hidden,
          count: r.count,
        }))
      : reports.filter((r) => tab !== 'hidden' || r.hidden).map((r) => ({ ...r, count: 0 }));
  return (
    <Dialog
      open={open}
      title={token ? '서비스 운영' : '운영자 인증'}
      onClose={() => {
        if (!busy) {
          setInput('');
          onClose();
        }
      }}
      footer={
        token ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setToken('');
              setReports([]);
              setFlags([]);
              setError('');
            }}
          >
            운영자 모드 해제
          </Button>
        ) : (
          <Button loading={busy} disabled={!input.trim()} onClick={() => void authenticate()}>
            인증
          </Button>
        )
      }
    >
      <div className="ev-form">
        {error && <Alert status="error">{error}</Alert>}
        {!token ? (
          <>
            <Field
              type="password"
              label="운영자 토큰"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <p className="ev-muted">
              인증한 운영자는 홈 콘텐츠를 등록하고 제보를 관리할 수 있습니다. 인증 정보는 이
              페이지를 닫으면 사라집니다.
            </p>
          </>
        ) : (
          <>
            <Badge status="caution">운영자 모드</Badge>
            <Tabs
              label="운영 목록"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'content', label: '홈 콘텐츠' },
                { value: 'reports', label: '전체 제보' },
                { value: 'hidden', label: '숨긴 제보' },
                { value: 'flags', label: '신고 목록' },
              ]}
            />
            {tab === 'content' ? (
              <ContentAdmin token={token} />
            ) : (
              <>
                <Button
                  variant="ghost"
                  loading={busy}
                  onClick={() =>
                    void run(async () => {
                      await reload(token);
                    })
                  }
                >
                  목록 새로고침
                </Button>
                {!rows.length && (
                  <EmptyState
                    title="표시할 제보가 없습니다"
                    description={
                      tab === 'hidden' && cursor
                        ? '다음 페이지에도 숨긴 제보가 있을 수 있습니다.'
                        : ''
                    }
                  />
                )}
                {rows.map((report) => (
                  <article key={report.id} className="ev-admin-report">
                    <div className="ev-report-meta">
                      <strong>{reportTypeLabel(report.type)}</strong>
                      <span>{report.count ? `신고 ${report.count}건` : report.nickname}</span>
                    </div>
                    <p>{report.body}</p>
                    <Button
                      variant={report.hidden ? 'secondary' : 'danger'}
                      disabled={busy}
                      onClick={() => void toggle(report.id, !report.hidden)}
                    >
                      {report.hidden ? '제보 복구' : '제보 숨기기'}
                    </Button>
                  </article>
                ))}
                {cursor && tab !== 'flags' && (
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() =>
                      void run(async () => {
                        await reload(token, cursor);
                      })
                    }
                  >
                    이전 제보 더 보기
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
