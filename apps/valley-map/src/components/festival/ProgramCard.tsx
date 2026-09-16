/**
 * 행사 프로그램 카드. 데모의 `.card`.
 *
 * '캘린더 등록' 은 원본에서도 동작하지 않는 예시 버튼이다(클릭 시 안내 알림).
 * `e.stopPropagation()` 까지 원본과 같은 이유로 필요하다 — 카드 전체가
 * 눌리는 구조가 되면 두 동작이 겹친다.
 */
import type { Program } from '@modu-valley/core';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { CalendarIcon } from '@/icons';
import { showNotice } from '@/platform/notify';
import { FESTIVAL_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export type ProgramCardProps = {
  readonly program: Program;
  readonly staggerIndex: number;
  readonly generation: number;
};

export function ProgramCard({ program, staggerIndex, generation }: ProgramCardProps) {
  const entrance = useStaggerEntrance(staggerIndex, generation);
  const themed = useThemedStyles();

  return (
    <Animated.View style={[styles.card, themed.card, entrance]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, themed.title]}>{program.title}</Text>
        <Pressable
          style={[styles.calendar, themed.calendar]}
          dataSet={{ mv: 'cal' }}
          accessibilityLabel={FESTIVAL_COPY.calendarAction}
          onPress={() => showNotice(FESTIVAL_COPY.demoAlert)}
        >
          <CalendarIcon />
          <Text style={[styles.calendarLabel, themed.calendarLabel]}>
            {FESTIVAL_COPY.calendarAction}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.schedule, themed.schedule]}>{program.schedule}</Text>
      <Text style={[styles.summary, themed.summary]}>{program.summary}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    padding: 13,
    // 카드 사이 간격은 부모의 gap 이 준다. 데모의 `.card{margin-bottom:8px}`
    // 를 그대로 옮기면, CSS 의 마진 병합(8px 과 다음 섹션의 24px 이 24px 로
    // 합쳐진다)이 없는 flexbox 에서 8px 이 더 벌어진다.
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '600',
  },
  calendar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADII.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  calendarLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '500',
  },
  schedule: {
    marginTop: 8,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  summary: {
    marginTop: 6,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface },
  title: { color: theme.colors.fg },
  calendar: { borderColor: theme.colors.line2 },
  calendarLabel: { color: theme.colors.fg },
  schedule: { color: theme.colors.fg2 },
  summary: { color: theme.colors.fg2 },
}));
