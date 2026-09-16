/**
 * VAO + 정점 버퍼 링.
 *
 * 데모 주석이 남긴 두 함정을 그대로 회피한다.
 *
 * 1) VAO 없이 `enableVertexAttribArray` 를 부르면 그 상태가 전역에 남아
 *    MapLibre 의 GL 상태 캐시(`context.currentNumAttributes`)와 어긋나고,
 *    이후 MapLibre 자체 드로우콜이 INVALID_OPERATION 을 뱉는다.
 *    → 속성 설정을 VAO 안에 갇혀 두고, 그릴 때만 바인딩한다.
 *
 * 2) 같은 버퍼를 매 프레임 덮어쓰면 아직 GPU 가 읽는 중인 버퍼를 건드려
 *    드라이버가 셰도우 카피를 버린다("READ-usage buffer was written, then
 *    fenced"). → 프레임마다 다른 슬롯을 돌려 쓴다.
 *
 * 또한 버퍼는 최대 크기로 한 번만 `bufferData` 하고 매 프레임
 * `bufferSubData` 로 덮는다. 매번 `bufferData` 를 부르면 드라이버가 버퍼를
 * 재할당한다.
 */
import { type Disposable, err, GlError, ok, type Result } from '@modu-valley/core';

/** GPU 인플라이트 프레임 수. 데모의 `RING = 3`. */
export const VERTEX_RING_DEPTH = 3;

type RingSlot = {
  readonly positions: WebGLBuffer;
  readonly colors: WebGLBuffer;
  readonly vao: WebGLVertexArrayObject;
};

export type VertexRingOptions = {
  readonly gl: WebGL2RenderingContext;
  readonly positionBytes: number;
  readonly colorBytes: number;
  readonly positionAttribute: number;
  readonly colorAttribute: number;
  readonly depth?: number;
};

export class VertexRing implements Disposable {
  readonly #gl: WebGL2RenderingContext;
  readonly #slots: readonly RingSlot[];

  #cursor = 0;
  #disposed = false;

  private constructor(gl: WebGL2RenderingContext, slots: readonly RingSlot[]) {
    this.#gl = gl;
    this.#slots = slots;
  }

  static create(options: VertexRingOptions): Result<VertexRing, GlError> {
    const { gl } = options;
    const depth = options.depth ?? VERTEX_RING_DEPTH;
    const slots: RingSlot[] = [];

    for (let index = 0; index < depth; index += 1) {
      const positions = gl.createBuffer();
      const colors = gl.createBuffer();
      const vao = gl.createVertexArray();
      if (vao === null) {
        for (const slot of slots) destroySlot(gl, slot);
        gl.deleteBuffer(positions);
        gl.deleteBuffer(colors);
        return err(
          new GlError('gl/context-unavailable', 'VAO 를 만들 수 없습니다.', {
            context: { index },
          }),
        );
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.bufferData(gl.ARRAY_BUFFER, options.positionBytes, gl.STREAM_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, colors);
      gl.bufferData(gl.ARRAY_BUFFER, options.colorBytes, gl.STREAM_DRAW);

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.enableVertexAttribArray(options.positionAttribute);
      gl.vertexAttribPointer(options.positionAttribute, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colors);
      gl.enableVertexAttribArray(options.colorAttribute);
      gl.vertexAttribPointer(options.colorAttribute, 4, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      slots.push({ positions, colors, vao });
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return ok(new VertexRing(gl, slots));
  }

  /**
   * 다음 슬롯에 데이터를 올리고 VAO 를 바인딩한다. 호출 뒤 바로 `drawArrays`
   * 할 수 있고, 끝나면 `release()` 로 되돌린다.
   */
  upload(
    positions: Float32Array,
    positionCount: number,
    colors: Float32Array,
    colorCount: number,
  ): void {
    if (this.#disposed) return;
    const gl = this.#gl;
    const slot = this.#slots[this.#cursor];
    if (slot === undefined) return;
    this.#cursor = (this.#cursor + 1) % this.#slots.length;

    gl.bindBuffer(gl.ARRAY_BUFFER, slot.positions);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions, 0, positionCount);
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.colors);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors, 0, colorCount);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindVertexArray(slot.vao);
  }

  release(): void {
    if (this.#disposed) return;
    this.#gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const slot of this.#slots) destroySlot(this.#gl, slot);
  }
}

function destroySlot(gl: WebGL2RenderingContext, slot: RingSlot): void {
  gl.deleteVertexArray(slot.vao);
  gl.deleteBuffer(slot.positions);
  gl.deleteBuffer(slot.colors);
}
