/**
 * `ApiReport`(`ApiPort.reports()`/`report()` DTO) → 도메인 `Report`(F5c).
 *
 * `parseApiAlert.ts` 와 같은 자리 — `ApiPort` 는 DTO 만 알고, 도메인 객체로 바꾸는 일은
 * 그 DTO 를 쓰는 이 계층(application)이 한다.
 */
import { Report, ReportPhoto } from '../../domain/report/Report';
import { toSegmentId, toValleyId } from '../../domain/valley/ids';
import type { ApiReport, ApiReportPhoto } from '../ports/ApiPort';

function parseApiReportPhoto(raw: ApiReportPhoto): ReportPhoto {
  return new ReportPhoto({
    id: raw.id,
    url: raw.url,
    width: raw.width,
    height: raw.height,
    bytes: raw.bytes,
    order: raw.order,
  });
}

export function parseApiReport(raw: ApiReport): Report {
  return new Report({
    id: raw.id,
    valleyId: toValleyId(raw.valleyId),
    ...(raw.segmentId !== null ? { segmentId: toSegmentId(raw.segmentId) } : {}),
    type: raw.type,
    body: raw.body,
    nickname: raw.nickname,
    createdAt: raw.createdAt,
    photos: raw.photos.map(parseApiReportPhoto),
    // F5d — 둘 다 있을 때만(서버 DTO 도 둘 다 있거나 둘 다 생략하는 계약이다).
    ...(raw.lat !== undefined && raw.lng !== undefined ? { lat: raw.lat, lng: raw.lng } : {}),
  });
}

/** 최신순 페이지(응답 그대로) → 도메인 배열. */
export function parseApiReports(raws: readonly ApiReport[]): readonly Report[] {
  return raws.map(parseApiReport);
}
