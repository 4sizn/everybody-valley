/**
 * 제보 사진 선택 — web. 표준 `<input type="file">` 를 코드로 만들어 트리거한다(RNW 는 파일
 * 선택 UI 를 제공하지 않는다). `capture`/카메라 접근 없이 사진 앱(갤러리) 선택만 — spotts.kr
 * 참고 목업도 갤러리 선택 UI 였다.
 *
 * 취소 판정 — `cancel` 이벤트(최신 Chrome 계열만)가 오면 즉시 끝낸다. 그렇지 않은 브라우저를
 * 위해 `window` 가 포커스를 되찾은 뒤에도(파일 다이얼로그가 닫히면 늘 일어난다) `change` 가
 * 시작되지 않았으면 취소로 본다 — `change` 가 **동기적으로** 시작 플래그를 세우므로, 큰 사진을
 * 읽는 동안(수백 ms) 이 뒤늦은 판정이 정상 선택을 취소로 잘못 보는 경합은 없다.
 */

function createPhotoId(): string {
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function readFile(file: File): Promise<import('./reportPhotoPicker').PickedReportPhoto> {
  const buffer = await file.arrayBuffer();
  return {
    id: createPhotoId(),
    filename: file.name || 'photo.jpg',
    contentType: file.type || 'image/jpeg',
    bytes: buffer.byteLength,
    data: new Uint8Array(buffer),
    previewUri: URL.createObjectURL(file),
  };
}

export const REPORT_PHOTO_PICKER_SUPPORTED = true;

export function pickReportPhotos(options: {
  readonly maxCount: number;
}): Promise<readonly import('./reportPhotoPicker').PickedReportPhoto[]> {
  const { maxCount } = options;
  if (typeof document === 'undefined' || maxCount <= 0) return Promise.resolve([]);

  return new Promise((resolve) => {
    let settled = false;
    let selectionStarted = false;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = maxCount > 1;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    const finish = (photos: readonly import('./reportPhotoPicker').PickedReportPhoto[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(photos);
    };

    input.addEventListener('change', () => {
      selectionStarted = true;
      const files = Array.from(input.files ?? []).slice(0, maxCount);
      void Promise.all(files.map((file) => readFile(file))).then(finish);
    });
    input.addEventListener('cancel', () => finish([]));
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!selectionStarted) finish([]);
        }, 300);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}
