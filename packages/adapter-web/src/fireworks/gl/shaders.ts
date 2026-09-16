/**
 * 불꽃 파티클 셰이더 — 원본 데모의 GLSL 그대로.
 *
 * GLSL ES 1.00 문법(`attribute`/`varying`)을 유지한다. MapLibre 6 은 WebGL2
 * 컨텍스트를 주지만 WebGL2 는 `#version 300 es` 가 없는 소스를 GLSL ES 1.00
 * 으로 컴파일하므로 그대로 동작하고, 데모와 픽셀 단위로 같은 결과가 나온다.
 *
 * 프래그먼트의 발광 계산이 데모와 동일하다.
 *   glow = (1 − 2d)^1.8,  gl_FragColor = vec4(rgb, 1) · alpha · glow
 * 알파를 색에 곱해 내보내므로 가산 합성(SRC_ALPHA, ONE)과 맞물려 빛난다.
 */
export const FIREWORK_VERTEX_SHADER = `
    attribute vec3 a_pos; attribute vec4 a_col;
    uniform mat4 u_matrix; uniform float u_size;
    varying vec4 v_col;
    void main(){
      gl_Position = u_matrix * vec4(a_pos, 1.0);
      gl_PointSize = u_size * (0.35 + 0.65 * a_col.a);
      v_col = a_col;
    }`;

export const FIREWORK_FRAGMENT_SHADER = `
    precision mediump float; varying vec4 v_col;
    void main(){
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float glow = pow(1.0 - d*2.0, 1.8);
      gl_FragColor = vec4(v_col.rgb, 1.0) * v_col.a * glow;
    }`;

/** 데모의 `gl.uniform1f(uSize, 22.0 * devicePixelRatio)`. */
export const FIREWORK_POINT_SIZE = 22;
