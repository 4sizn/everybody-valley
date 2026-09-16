/**
 * 데이터 파일 머리말 파서 — 스키마 `$defs.metadata`.
 *
 * 좌표는 데이터 파일이 소유하므로, 파일이 어떤 좌표계·순서로 쓰였는지를
 * 파일 스스로 선언한다. 로더는 그 선언이 규약과 같은지만 본다.
 * 값의 모양(`DatasetMetadata`)과 규약 상수는 `domain/valley/ValleyDataset` 에 있다 —
 * 저장소 포트와 상태가 같은 타입을 보기 위해서다.
 */
import {
  COORDINATE_ORDER,
  DATASET_CRS,
  type DatasetMetadata,
  VERIFICATION_LEVELS,
} from '../../domain/valley/ValleyDataset';
import { ValleyDataError } from '../../shared/errors';
import { err, type Result } from '../../shared/result';
import { isJsonRecord, PropsReader } from './PropsReader';

/** `YYYY-MM-DD.N` — 수집일 + 그날의 리비전. */
const DATASET_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}\.\d+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDatasetMetadata(
  raw: unknown,
  path: string,
): Result<DatasetMetadata, ValleyDataError> {
  if (!isJsonRecord(raw)) {
    return err(
      new ValleyDataError('valley-data/invalid-collection', `${path} 는 객체여야 합니다.`, {
        context: { path },
      }),
    );
  }
  const reader = new PropsReader(raw, path);
  const description = reader.string('description');
  const source = reader.string('source');
  const sourceFile = reader.optionalString('sourceFile');
  const datasetVersion = reader.pattern('datasetVersion', DATASET_VERSION_PATTERN, 'YYYY-MM-DD.N');
  const collectedAt = reader.pattern('collectedAt', DATE_PATTERN, 'YYYY-MM-DD');
  const coordinateOrder = reader.const('coordinateOrder', COORDINATE_ORDER);
  const crs = reader.const('crs', DATASET_CRS, 'valley-data/unsupported-crs');
  const filter = reader.optionalString('filter');
  const verified = reader.optionalEnum('verified', VERIFICATION_LEVELS);
  const sources = reader.optionalStringArray('sources');
  return reader.finish(() => ({
    description,
    source,
    sourceFile,
    datasetVersion,
    collectedAt,
    coordinateOrder,
    crs,
    filter,
    verified,
    sources,
  }));
}
