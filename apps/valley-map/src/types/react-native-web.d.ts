/**
 * react-native-web 전용 prop 선언.
 *
 * RNW 는 `dataSet` 을 `data-*` 속성으로, `href`/`hrefAttrs` 를 `<a>` 로
 * 내려보낸다. react-native 의 타입에는 없는 prop 이라 여기서 보강한다.
 *
 * `dataSet` 이 필요한 이유: 이 프로젝트는 RN 이 표현할 수 있는 것(레이아웃,
 * 색, 타이포, 반경)은 StyleSheet 로 두고, RN 이 표현할 수 없는 것만
 * (backdrop-filter, position:sticky, @keyframes, ::-webkit-scrollbar,
 * perspective/preserve-3d, :hover, ::placeholder, transition)
 * `app/+html.tsx` 의 전역 스타일시트에서 `[data-mv="..."]` 로 얹는다.
 * 그 슬롯 이름을 붙이는 통로가 `dataSet` 이다.
 */
import 'react-native';

type WebDataSet = Record<string, string | number | boolean | undefined>;

type WebLinkAttributes = {
  rel?: string;
  target?: string;
  download?: boolean | string;
};

declare module 'react-native' {
  interface ViewProps {
    dataSet?: WebDataSet;
    href?: string;
    hrefAttrs?: WebLinkAttributes;
  }
  interface TextProps {
    dataSet?: WebDataSet;
    href?: string;
    hrefAttrs?: WebLinkAttributes;
  }
  interface TextInputProps {
    dataSet?: WebDataSet;
  }
  interface ScrollViewProps {
    dataSet?: WebDataSet;
  }
  interface PressableProps {
    dataSet?: WebDataSet;
  }
  interface ImageProps {
    dataSet?: WebDataSet;
  }
}
