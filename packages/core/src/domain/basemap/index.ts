export {
  type BaseMapHealth,
  type BaseMapHost,
  evaluate as evaluateBaseMapHealth,
  INITIAL_BASE_MAP_HEALTH,
  isBaseMapUrl,
  noteFailure as noteBaseMapFailure,
  noteSuccess as noteBaseMapSuccess,
  OUTAGE_SUSTAIN_MS,
  sourceUrlOf,
} from './BaseMapHealth';
export { BaseMapHealthMonitor, type BaseMapHealthMonitorOptions } from './BaseMapHealthMonitor';
