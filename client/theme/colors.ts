// SAM Theme Tokens — light & dark variants
// All hardcoded colors from screens should map to these tokens

const alpha = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export interface ColorTokens {
  // Surfaces
  bg: string;               // app background
  bgSecondary: string;      // input/secondary surface
  bgInput: string;          // input field background
  bgInputAlt: string;       // alternate input (e.g. white card on chat bubble)
  surface: string;          // card surface
  surfaceAlt: string;       // alternate card surface (e.g. AI chat bubble)

  // Text
  text: string;             // primary text — slate-800
  textSecondary: string;    // secondary text — slate-500
  textTertiary: string;     // tertiary text — slate-400
  textOnPrimary: string;    // text on primary buttons (white)

  // Borders / Lines
  border: string;           // general border
  borderLight: string;      // hairline border
  divider: string;          // separator

  // Shadow (used for neomorphic shadows)
  shadow: string;

  // Tab bar
  tabBarBg: string;
  tabBarInactive: string;
  tabActiveBg: string;      // active chat icon background

  // Accents (kept consistent across themes)
  primary: string;          // emerald #059669
  primary04: string;
  primary06: string;
  primary08: string;
  primary10: string;
  primary12: string;
  primary30: string;

  accent: string;           // amber/orange #F97316
  accent10: string;
  accent08: string;
  accent15: string;

  info: string;             // indigo #6366F1
  info08: string;
  info10: string;

  sky: string;              // sky blue #0EA5E9
  sky08: string;
  sky10: string;

  purple: string;           // #6366F1 alias
  purple10: string;

  gold: string;             // #F59E0B
  surfaceHover: string;
  textInverse: string;
  danger: string;           // red #EF4444
  danger08: string;

  // White/black
  white: string;
  black: string;
}

export const lightColors: ColorTokens = {
  bg: '#F0F2F5',
  bgSecondary: '#E8E8EB',
  bgInput: '#E8E8EB',
  bgInputAlt: '#FFFFFF',
  surface: '#F0F2F5',
  surfaceAlt: '#FFFFFF',

  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  divider: '#E2E8F0',

  shadow: '#D1D9E6',

  tabBarBg: '#F0F2F5',
  tabBarInactive: '#B2BEC3',
  tabActiveBg: 'rgba(5,150,105,0.12)',

  primary: '#059669',
  primary04: alpha('#059669', 0.04),
  primary06: alpha('#059669', 0.06),
  primary08: alpha('#059669', 0.08),
  primary10: alpha('#059669', 0.10),
  primary12: alpha('#059669', 0.12),
  primary30: alpha('#059669', 0.30),

  accent: '#F97316',
  accent10: alpha('#F97316', 0.10),
  accent08: alpha('#F97316', 0.08),
  accent15: alpha('#F97316', 0.15),

  info: '#6366F1',
  info08: alpha('#6366F1', 0.08),
  info10: alpha('#6366F1', 0.10),

  sky: '#0EA5E9',
  sky08: alpha('#0EA5E9', 0.08),
  sky10: alpha('#0EA5E9', 0.10),

  purple: '#6366F1',
  purple10: alpha('#6366F1', 0.10),

  gold: '#F59E0B',
  surfaceHover: alpha('#000000', 0.04),
  textInverse: '#1E293B',
  danger: '#EF4444',
  danger08: alpha('#EF4444', 0.08),

  white: '#FFFFFF',
  black: '#000000',
};

export const darkColors: ColorTokens = {
  bg: '#0F172A',
  bgSecondary: '#1E293B',
  bgInput: '#334155',
  bgInputAlt: '#1E293B',
  surface: '#1E293B',
  surfaceAlt: '#334155',

  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#64748B',
  textOnPrimary: '#FFFFFF',

  border: '#334155',
  borderLight: '#1E293B',
  divider: '#1E293B',

  shadow: '#000000',

  tabBarBg: '#1E293B',
  tabBarInactive: '#64748B',
  tabActiveBg: alpha('#10B981', 0.22),

  primary: '#10B981',
  primary04: alpha('#10B981', 0.04),
  primary06: alpha('#10B981', 0.06),
  primary08: alpha('#10B981', 0.08),
  primary10: alpha('#10B981', 0.10),
  primary12: alpha('#10B981', 0.12),
  primary30: alpha('#10B981', 0.30),

  accent: '#FB923C',
  accent10: alpha('#FB923C', 0.10),
  accent08: alpha('#FB923C', 0.08),
  accent15: alpha('#FB923C', 0.15),

  info: '#818CF8',
  info08: alpha('#818CF8', 0.08),
  info10: alpha('#818CF8', 0.10),

  sky: '#38BDF8',
  sky08: alpha('#38BDF8', 0.08),
  sky10: alpha('#38BDF8', 0.10),

  purple: '#818CF8',
  purple10: alpha('#818CF8', 0.10),

  gold: '#FBBF24',
  surfaceHover: alpha('#FFFFFF', 0.06),
  textInverse: '#F1F5F9',
  danger: '#F87171',
  danger08: alpha('#F87171', 0.08),

  white: '#FFFFFF',
  black: '#000000',
};
