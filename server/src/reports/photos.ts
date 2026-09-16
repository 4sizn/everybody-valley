/**
 * 제보 사진 처리(F5a 결정 (c)) — `rotate()` 로 EXIF `Orientation` 만 픽셀에 반영해 회전하고, 장변을
 * `REPORT_PHOTO_MAX_DIMENSION`(1600)으로 줄이고, JPEG 로 다시 인코딩한다. `keepExif()`·
 * `withMetadata()` 를 부르지 않으므로 위치·시각을 포함한 EXIF·ICC·XMP 는 출력에 전혀 남지 않는다
 * (sharp 기본값 — 메타데이터를 요청하지 않으면 전부 버린다). 원본 바이트는 호출자가 버린다 —
 * 이 함수는 리사이즈된 버퍼만 돌려주고 디스크에 쓰지 않는다.
 */

import { REPORT_PHOTO_MAX_DIMENSION } from '@modu-valley/core';
import sharp from 'sharp';

export interface ProcessedPhoto {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export async function processReportPhoto(input: Buffer | Uint8Array): Promise<ProcessedPhoto> {
  const image = sharp(input).rotate().resize({
    width: REPORT_PHOTO_MAX_DIMENSION,
    height: REPORT_PHOTO_MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const { data, info } = await image.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: data.byteLength };
}
