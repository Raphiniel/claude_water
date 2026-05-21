/** Operational modes stored in SystemSetting (backend api.models.SystemSetting). */

export const SYSTEM_MODES = {
  NORMAL: {
    key: 'NORMAL',
    label: 'Normal',
    hint: 'Standard fault intake, assignment, and SMS behaviour.',
    statusLabel: 'Operational',
    statusDetail: 'All systems running normally',
    dot: '#10b981',
    banner: null,
  },
  EMERGENCY: {
    key: 'EMERGENCY',
    label: 'Emergency',
    hint: 'High-visibility alert for staff — treat new faults as urgent.',
    statusLabel: 'Emergency',
    statusDetail: 'Urgent response mode — prioritize pending faults',
    dot: '#ef4444',
    banner: {
      tone: 'danger',
      title: 'Emergency operations',
      body: 'The portal is in emergency mode. Prioritize pending faults and field response.',
    },
  },
  MAINTENANCE: {
    key: 'MAINTENANCE',
    label: 'Maintenance',
    hint: 'Pauses auto-assign to nearest technician (manual assignment still works).',
    statusLabel: 'Maintenance',
    statusDetail: 'Auto-assign paused — assign technicians manually',
    dot: '#f59e0b',
    banner: {
      tone: 'warning',
      title: 'Maintenance window',
      body: 'Auto-assign is paused while maintenance mode is active.',
    },
  },
};

export function getModeMeta(mode) {
  return SYSTEM_MODES[mode] || SYSTEM_MODES.NORMAL;
}
