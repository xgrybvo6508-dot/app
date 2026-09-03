// Единая система дизайна приложения — источник истины для цвета, отступов,
// радиусов и типографики. Никакие цвета/размеры не должны быть литералами
// прямо в экранах/компонентах — только через эти токены, иначе приложение
// снова расползётся на несогласованные оттенки.
//
// Стиль: минимализм, светлый фон, приглушённый зелёный — единственный акцент,
// всё остальное — спокойные серые и белый, без ярких/контрастных цветов.
// Файл не зависит от React Native, поэтому его можно использовать и в
// обычных RN-экранах (через StyleSheet), и в чистых модулях, которые строят
// HTML/CSS для WebView-канваса графа (components/GraphCanvas.tsx,
// lib/graph/cytoscapeElements.ts).

export const colors = {
  background: '#FFFFFF',
  backgroundMuted: '#F7F7F5',

  surface: '#F2F2EF',
  surfaceAlt: '#E9E9E4',

  border: '#E2E2DD',
  borderStrong: '#CACAC3',

  textPrimary: '#232420',
  textSecondary: '#6D6F68',
  textMuted: '#9A9B93',
  textInverse: '#FFFFFF',

  // Нейтральная плотная поверхность для элементов, которым не нужен акцент
  // (например, реплика собеседника в чате) — сознательно не чистый чёрный.
  neutralSolid: '#2C2D28',

  // Единственный цветовой акцент приложения — приглушённый зелёный.
  accent: '#5F8768',
  accentPressed: '#4C6F56',
  accentSoft: '#E7EEE8',
  accentSoftText: '#3F5F49',

  // Единственное сознательное исключение из «только акцент+серый» — текст
  // ошибок должен отличаться от обычного текста, иначе его не видно.
  // Оттенок максимально приглушён, чтобы не спорить с зелёным акцентом.
  danger: '#95564F',

  // Шкала для типов узлов графа: спокойная серая градация + один акцентный
  // цвет для типа "task" (это то, что требует действия — единственный тип,
  // которому уместно выделиться цветом).
  graphTypeScale: {
    task: '#5F8768',
    plan_item: '#33342E',
    idea: '#585952',
    knowledge_item: '#797A71',
    research_finding: '#9C9D92',
    note: '#B8B9AD',
    life_domain: '#D3D4C7',
  } as Record<string, string>,
  graphTypeDefault: '#9A9B93',
  graphBackground: '#FAFAF8',
  graphEdge: '#D6D6CF',
  graphEdgeLabel: '#A6A79E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  round: 22,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '600' as const },
  subtitle: { fontSize: 17, fontWeight: '600' as const },
  sectionTitle: { fontSize: 14, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
};
