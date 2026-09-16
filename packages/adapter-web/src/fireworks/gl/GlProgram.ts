/**
 * WebGL 프로그램 래퍼.
 *
 * 데모는 셰이더 컴파일 실패를 `console.error` 로만 남기고 그대로 진행한다.
 * 링크가 깨진 프로그램으로 `drawArrays` 를 부르면 그 뒤 MapLibre 자체
 * 드로우콜까지 함께 무너진다. 여기서는 컴파일·링크 실패를 `Result` 로
 * 올려, 호출부가 레이어 추가를 포기할 수 있게 한다.
 */
import { type Disposable, err, GlError, ok, type Result } from '@modu-valley/core';

export type UniformName = 'u_matrix' | 'u_size';
export type AttributeName = 'a_pos' | 'a_col';

export class GlProgram implements Disposable {
  readonly program: WebGLProgram;

  readonly #gl: WebGL2RenderingContext;
  readonly #uniforms: ReadonlyMap<UniformName, WebGLUniformLocation>;
  readonly #attributes: ReadonlyMap<AttributeName, number>;

  #disposed = false;

  private constructor(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: ReadonlyMap<UniformName, WebGLUniformLocation>,
    attributes: ReadonlyMap<AttributeName, number>,
  ) {
    this.#gl = gl;
    this.program = program;
    this.#uniforms = uniforms;
    this.#attributes = attributes;
  }

  static create(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    uniformNames: readonly UniformName[],
    attributeNames: readonly AttributeName[],
  ): Result<GlProgram, GlError> {
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    if (!vertex.ok) return vertex;
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragment.ok) {
      gl.deleteShader(vertex.value);
      return fragment;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertex.value);
    gl.attachShader(program, fragment.value);
    gl.linkProgram(program);

    // 링크가 끝나면 셰이더 객체는 프로그램이 참조를 갖는다 — 바로 놓아준다.
    gl.deleteShader(vertex.value);
    gl.deleteShader(fragment.value);

    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      const log = gl.getProgramInfoLog(program) ?? '(정보 없음)';
      gl.deleteProgram(program);
      return err(
        new GlError('gl/program-link-failed', '불꽃 셰이더 프로그램 링크에 실패했습니다.', {
          context: { log },
        }),
      );
    }

    const uniforms = new Map<UniformName, WebGLUniformLocation>();
    for (const name of uniformNames) {
      const location = gl.getUniformLocation(program, name);
      if (location !== null) uniforms.set(name, location);
    }
    const attributes = new Map<AttributeName, number>();
    for (const name of attributeNames) {
      attributes.set(name, gl.getAttribLocation(program, name));
    }

    return ok(new GlProgram(gl, program, uniforms, attributes));
  }

  uniform(name: UniformName): WebGLUniformLocation | null {
    return this.#uniforms.get(name) ?? null;
  }

  attribute(name: AttributeName): number {
    return this.#attributes.get(name) ?? -1;
  }

  use(): void {
    this.#gl.useProgram(this.program);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#gl.deleteProgram(this.program);
  }
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): Result<WebGLShader, GlError> {
  const shader = gl.createShader(type);
  if (shader === null) {
    return err(
      new GlError('gl/context-unavailable', 'WebGL 셰이더 객체를 만들 수 없습니다.', {
        context: { type },
      }),
    );
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    const log = gl.getShaderInfoLog(shader) ?? '(정보 없음)';
    gl.deleteShader(shader);
    return err(
      new GlError('gl/shader-compile-failed', '불꽃 셰이더 컴파일에 실패했습니다.', {
        context: { type, log },
      }),
    );
  }
  return ok(shader);
}
