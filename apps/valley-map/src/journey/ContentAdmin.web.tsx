import type { DiscoveryStory } from '@modu-valley/core';
import { Alert, Button, Field } from '@moduvalley/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveApiBase } from '@/api/createApiClient';
import { PARSED } from '@/session/valleySource';

const valleys = PARSED.ok ? PARSED.value.valleys : [];
const emptyStory = (): DiscoveryStory => {
  const date = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  return {
    id: '',
    kind: 'blog',
    valleyId: valleys[0]?.id ?? '',
    title: '',
    description: '',
    imageUrl: '',
    imageCredit: '',
    url: '',
    author: '',
    publishedOn: date,
    startsOn: date,
    endsOn: new Date(Date.now() + 30 * 86400_000 + 9 * 3600_000).toISOString().slice(0, 10),
    sponsored: false,
    enabled: false,
  };
};
export function ContentAdmin({ token }: { token: string }) {
  const [stories, setStories] = useState<DiscoveryStory[]>([]);
  const [draft, setDraft] = useState<DiscoveryStory | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const lock = useRef(false);
  const request = useCallback(
    async (method: string, body?: DiscoveryStory, id = '') => {
      const r = await fetch(
        `${resolveApiBase()}/api/admin/discovery${id ? `/${encodeURIComponent(id)}` : ''}`,
        {
          method,
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      if (!r.ok)
        throw new Error(
          r.status === 400
            ? '필수 항목·HTTPS 주소·게시 기간을 확인해주세요.'
            : r.status === 409
              ? '최대 200개까지 보관할 수 있습니다. 지난 콘텐츠를 삭제해주세요.'
              : '저장소에 연결하지 못했습니다. 인증과 서버 상태를 확인해주세요.',
        );
      return r;
    },
    [token],
  );
  const reload = useCallback(async () => {
    const r = await request('GET');
    setStories(((await r.json()) as { stories: DiscoveryStory[] }).stories);
  }, [request]);
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
  }, [reload]);
  const mutate = async (method: string, body?: DiscoveryStory, id = '') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(method, body, id);
      setDraft(null);
      setDeleteId('');
      await reload();
      window.dispatchEvent(new Event('everybody-content-changed'));
      setNotice(
        method === 'DELETE'
          ? '콘텐츠를 삭제했습니다.'
          : '저장했습니다. 공개 여부와 게시 기간에 따라 화면에 반영됩니다.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="ev-form" aria-label="홈 콘텐츠 관리">
      <p className="ev-muted">
        큰 주간 배너와 계곡별 블로그를 등록합니다. 등록한 글은 홈·계곡 미리보기·방문 후기 탭에 함께
        표시됩니다.
      </p>
      {error && <Alert status="error">{error}</Alert>}
      {notice && <p role="status">{notice}</p>}
      {draft ? (
        <form
          className="ev-form"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate('POST', draft);
          }}
        >
          <fieldset className="ev-fieldset ev-form" disabled={busy}>
            <label className="ev-admin-select">
              콘텐츠 종류
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'blog' | 'banner' })}
              >
                <option value="banner">주간 안내·광고 배너</option>
                <option value="blog">블로그 방문 후기</option>
              </select>
            </label>
            <label className="ev-admin-select">
              연결 계곡
              <select
                value={draft.valleyId}
                onChange={(e) => setDraft({ ...draft, valleyId: e.target.value })}
              >
                {valleys.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="제목"
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Field
              label="소개"
              required
              maxLength={300}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <Field
              label="작성자·광고주"
              required
              maxLength={80}
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            />
            <Field
              label="원문·광고 링크"
              type="url"
              required={draft.kind === 'blog' || draft.sponsored}
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
            <p className="ev-muted">
              HTTPS 링크를 사용하세요. 일반 배너의 링크를 비우면 연결한 계곡의 미리보기가 열립니다.
            </p>
            <Field
              label="썸네일·배너 이미지 주소"
              type="url"
              required
              value={draft.imageUrl}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
            />
            <Field
              label="이미지 출처·권리자"
              required
              maxLength={160}
              value={draft.imageCredit}
              onChange={(e) => setDraft({ ...draft, imageCredit: e.target.value })}
            />
            <p className="ev-muted">
              게시 허락을 받은 이미지를 사용하세요. 사진이 잘 보이는 가로 이미지를 권장합니다.
            </p>
            <Field
              label="원문 작성일"
              type="date"
              required
              value={draft.publishedOn}
              onChange={(e) => setDraft({ ...draft, publishedOn: e.target.value })}
            />
            <Field
              label="노출 시작일"
              type="date"
              required
              value={draft.startsOn}
              onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })}
            />
            <Field
              label="노출 종료일"
              type="date"
              required
              min={draft.startsOn}
              value={draft.endsOn}
              onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })}
            />
            <label className="ev-admin-check">
              <input
                type="checkbox"
                checked={draft.sponsored}
                onChange={(e) => setDraft({ ...draft, sponsored: e.target.checked })}
              />
              광고·협찬 콘텐츠 (광고 표시)
            </label>
            <label className="ev-admin-check">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              게시 기간 동안 공개
            </label>
          </fieldset>
          <div className="ev-choice">
            <Button type="submit" loading={busy}>
              콘텐츠 저장
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
              편집 취소
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Button
            icon="plus"
            onClick={() => {
              setDraft(emptyStory());
              setNotice('');
            }}
          >
            배너·블로그 등록
          </Button>
          {!stories.length && (
            <p className="ev-muted">등록된 콘텐츠가 없습니다. 첫 배너와 블로그를 등록해주세요.</p>
          )}
          {stories.map((s) => (
            <article className="ev-admin-report" key={s.id}>
              <strong>{s.title}</strong>
              <p className="ev-muted">
                {s.kind === 'banner' ? '배너' : '블로그'} · {s.enabled ? '공개 설정' : '비공개'}
                {s.sponsored ? ' · 광고' : ''}
                <br />
                {s.startsOn} ~ {s.endsOn}
              </p>
              <div className="ev-choice">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setDraft(s);
                    setDeleteId('');
                    setNotice('');
                  }}
                >
                  수정
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setDeleteId(s.id)}>
                  삭제
                </Button>
              </div>
              {deleteId === s.id && (
                <Alert status="caution" title="이 콘텐츠를 삭제할까요?">
                  <div className="ev-choice">
                    <Button
                      variant="danger"
                      loading={busy}
                      onClick={() => void mutate('DELETE', undefined, s.id)}
                    >
                      삭제 확인
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setDeleteId('')}>
                      계속 보관
                    </Button>
                  </div>
                </Alert>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
