/**
 * The Randlord — UI Kit
 * Native implementation of The Neurodiverse Agency Design System v2.0 (NDA, --nda-*)
 *
 * Implements:
 * - Zero radius doctrine (--nda-radius-none: 0) on all spatial elements
 * - 3px solid #1A1A1A structural ink edges
 * - Hard offset shadows (4px / 6px / 8px)
 * - Private Tools 3-Fill Button Rule ("Colour Says Where the Press Goes")
 * - 24-unit bent-wire SVG icons (viewBox="0 0 24 24", stroke-width="3", stroke-linecap="square", stroke-linejoin="round", fill="none")
 */

import React, { CSSProperties, ReactNode } from 'react';

/* ─────────────────────────  Bent-Wire 24-Unit SVG Icons  ───────────────────────── */

export function BentWireIcon({
  name,
  size = 20,
  color = 'currentColor',
  style
}: {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: '3',
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0, ...style }
  };

  switch (name) {
    case 'save':
    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'ai':
    case 'spark':
    case 'send':
      return (
        <svg {...common}>
          <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" />
        </svg>
      );
    case 'plus':
    case 'add':
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'close':
    case 'cancel':
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case 'budget':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="9" y1="10" x2="9" y2="20" />
        </svg>
      );
    case 'ledger':
      return (
        <svg {...common}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      );
    case 'accounts':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="7" cy="15" r="1" fill={color} />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <polyline points="4 18 10 12 14 16 20 6" />
          <line x1="20" y1="6" x2="20" y2="11" />
        </svg>
      );
    case 'plan':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="4" y1="10" x2="20" y2="10" />
        </svg>
      );
    case 'advisors':
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'chevron-left':
    case 'left':
      return (
        <svg {...common}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case 'chevron-right':
    case 'right':
      return (
        <svg {...common}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          <polyline points="9 6 15 12 9 18" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'delete':
    case 'trash':
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export const Icon = {
  budget: (s = 18) => <BentWireIcon name="budget" size={s} />,
  ledger: (s = 18) => <BentWireIcon name="ledger" size={s} />,
  accounts: (s = 18) => <BentWireIcon name="accounts" size={s} />,
  reports: (s = 18) => <BentWireIcon name="reports" size={s} />,
  plan: (s = 18) => <BentWireIcon name="plan" size={s} />,
  advisors: (s = 18) => <BentWireIcon name="advisors" size={s} />,
  left: (s = 16) => <BentWireIcon name="left" size={s} />,
  right: (s = 16) => <BentWireIcon name="right" size={s} />,
  close: (s = 16) => <BentWireIcon name="close" size={s} />,
  plus: (s = 16) => <BentWireIcon name="plus" size={s} />,
  send: (s = 16) => <BentWireIcon name="send" size={s} />,
  check: (s = 16) => <BentWireIcon name="check" size={s} />,
  chevron: (s = 14) => <BentWireIcon name="chevron" size={s} />,
  search: (s = 16) => <BentWireIcon name="search" size={s} />
};

/* ─────────────────────────  Primitives  ───────────────────────── */

export function Dot({
  size = 8,
  color = 'var(--nda-identity-primary)',
  breathe = false,
  style
}: { size?: number; color?: string; breathe?: boolean; style?: CSSProperties }) {
  return (
    <span
      className={breathe ? 'rl-breathe' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 0,
        backgroundColor: color,
        border: '1.5px solid var(--nda-ink-primary)',
        display: 'inline-block',
        flexShrink: 0,
        ...style
      }}
    />
  );
}

export function StatLabel({
  children,
  size = 'sm',
  muted = false,
  style
}: { children: ReactNode; size?: 'xs' | 'sm' | 'md'; muted?: boolean; style?: CSSProperties }) {
  const fontSize = size === 'xs' ? 11 : size === 'sm' ? 12 : 14;
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: muted ? 'var(--nda-ink-secondary)' : 'var(--nda-ink-primary)',
        display: 'inline-block',
        ...style
      }}
    >
      {children}
    </span>
  );
}

export function Heading({
  children,
  level = 2,
  style
}: { children: ReactNode; level?: 1 | 2 | 3 | 4; style?: CSSProperties }) {
  const Tag = `h${level}` as const;
  const defaultSize = level === 1 ? 32 : level === 2 ? 24 : level === 3 ? 18 : 15;
  return (
    <Tag
      style={{
        fontFamily: 'var(--font-header)',
        fontSize: defaultSize,
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--nda-ink-primary)',
        lineHeight: 1.1,
        margin: 0,
        ...style
      }}
    >
      {children}
    </Tag>
  );
}

export type LifecycleTone = 'forest' | 'cyan' | 'ochre' | 'lavender' | 'slate' | 'error' | 'warning' | 'neutral' | 'success';

export function ViewHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', padding: '0 0 var(--nd-s1)' }}>
      <Heading level={2} style={{ fontSize: 20, margin: 0 }}>{title}</Heading>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'slate',
  style
}: {
  children: ReactNode;
  tone?: LifecycleTone | 'forest' | 'orange' | 'yellow' | 'slate' | 'red' | 'cyan' | 'ochre' | 'lavender' | string;
  style?: CSSProperties;
}) {
  let bg = 'var(--nda-canvas-container)';
  let fg = 'var(--nda-ink-primary)';
  if (tone === 'forest' || tone === 'FACT' || tone === 'success') {
    bg = 'var(--nda-identity-primary)';
    fg = '#FFFFFF';
  } else if (tone === 'orange' || tone === 'warning') {
    bg = 'var(--nda-action-primary)';
    fg = '#FFFFFF';
  } else if (tone === 'yellow' || tone === 'ochre' || tone === 'MISSING') {
    bg = 'var(--nda-identity-secondary)';
    fg = 'var(--nda-ink-primary)';
  } else if (tone === 'red' || tone === 'error') {
    bg = 'var(--nda-semantic-error)';
    fg = '#FFFFFF';
  } else if (tone === 'cyan' || tone === 'ESTIMATE') {
    bg = '#1C7A4E';
    fg = '#FFFFFF';
  } else if (tone === 'lavender' || tone === 'BUDGET SUGGESTION') {
    bg = 'var(--nda-canvas-secondary)';
    fg = '#FFFFFF';
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        border: '2px solid var(--nda-ink-primary)',
        backgroundColor: bg,
        color: fg,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: 0,
        ...style
      }}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────  Buttons (Private Tools 3-Fill Rule)  ───────────────────────── */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'action' | 'ai' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  // Infer icon name if not specified
  let defaultIcon = icon;
  if (!defaultIcon) {
    if (variant === 'action') defaultIcon = 'check';
    else if (variant === 'ai') defaultIcon = 'send';
    else if (variant === 'danger') defaultIcon = 'delete';
  }

  const height = size === 'sm' ? 34 : size === 'lg' ? 48 : 42;
  const padding = size === 'sm' ? '0 12px' : size === 'lg' ? '0 24px' : '0 16px';
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  let btnClass = 'nda-btn nda-btn-secondary';
  if (variant === 'action') btnClass = 'nda-btn nda-btn-action';
  else if (variant === 'ai') btnClass = 'nda-btn nda-btn-ai';
  else if (variant === 'danger') btnClass = 'nda-btn nda-btn-danger';
  else if (variant === 'ghost') btnClass = 'nda-btn nda-btn-ghost';

  return (
    <button
      className={`${btnClass} ${rest.className || ''}`}
      disabled={disabled}
      style={{
        height,
        padding,
        fontSize,
        ...style
      }}
      {...rest}
    >
      {defaultIcon && (
        <BentWireIcon
          name={defaultIcon}
          size={size === 'sm' ? 16 : 20}
          color="currentColor"
        />
      )}
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  label,
  style,
  ...rest
}: { children: ReactNode; label: string; style?: CSSProperties } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: 38,
        height: 38,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--nda-canvas-container)',
        border: '3px solid var(--nda-ink-primary)',
        boxShadow: 'var(--nda-shadow-sm)',
        color: 'var(--nda-ink-primary)',
        cursor: 'pointer',
        borderRadius: 0,
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────  Panels & Cards  ───────────────────────── */

export function NDRoot({
  as: Component = 'div',
  children,
  style,
  accent,
  ...rest
}: { as?: any; children: ReactNode; style?: CSSProperties; accent?: string; [k: string]: any }) {
  return (
    <Component
      style={{
        backgroundColor: 'var(--nda-canvas-primary)',
        color: 'var(--nda-ink-primary)',
        minHeight: '100vh',
        ...style
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function Panel({
  children,
  title,
  action,
  raised,
  style
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  raised?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--nda-canvas-container)',
        border: '3px solid var(--nda-ink-primary)',
        boxShadow: raised ? 'var(--nda-shadow-lg)' : 'var(--nda-shadow-md)',
        padding: '24px',
        borderRadius: 0,
        boxSizing: 'border-box',
        ...style
      }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--nda-ink-primary)' }}>
          {title ? <StatLabel size="sm">{title}</StatLabel> : <div />}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function TableCard({
  children,
  style
}: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--nda-canvas-container)',
        border: '3px solid var(--nda-ink-primary)',
        boxShadow: 'var(--nda-shadow-md)',
        borderRadius: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  );
}

export function Row({
  cols,
  children,
  dense = true,
  header = false,
  onClick,
  style
}: {
  cols: string;
  children: ReactNode;
  dense?: boolean;
  header?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const pad = header ? '10px 16px' : dense ? '10px 16px' : '14px 16px';
  return (
    <div
      className={onClick ? 'rl-row' : undefined}
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        alignItems: 'center',
        gap: '12px',
        padding: pad,
        borderBottom: header ? '3px solid var(--nda-ink-primary)' : '1px solid var(--nda-ui-lines)',
        backgroundColor: header ? 'var(--nda-canvas-secondary)' : undefined,
        color: header ? '#FFFFFF' : 'var(--nda-ink-primary)',
        cursor: onClick ? 'pointer' : undefined,
        ...style
      }}
    >
      {children}
    </div>
  );
}

export function Th({
  children,
  align = 'left'
}: { children?: ReactNode; align?: 'left' | 'right' }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-header)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textAlign: align
      }}
    >
      {children}
    </span>
  );
}

export function Money({
  children,
  size = 14,
  tone = 'var(--nda-ink-primary)',
  align = 'right',
  style
}: { children: ReactNode; size?: number; tone?: string; align?: 'left' | 'right'; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: size,
        color: tone,
        textAlign: align,
        fontVariantNumeric: 'tabular-nums',
        ...style
      }}
    >
      {children}
    </span>
  );
}

export function StatTileRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginTop: '12px'
      }}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  headline = false,
  style
}: { label: string; value: string; headline?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: headline ? 'var(--nda-identity-secondary)' : 'var(--nda-canvas-container)',
        border: '3px solid var(--nda-ink-primary)',
        boxShadow: 'var(--nda-shadow-sm)',
        padding: '16px 20px',
        borderRadius: 0,
        boxSizing: 'border-box',
        ...style
      }}
    >
      <StatLabel size="xs" muted={!headline}>
        {label}
      </StatLabel>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: headline ? 26 : 20,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--nda-ink-primary)',
          marginTop: 6
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function EmptyState({
  message,
  action
}: { message: string; action?: ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--nda-canvas-container)',
        border: '3px solid var(--nda-ink-primary)',
        boxShadow: 'var(--nda-shadow-sm)',
        padding: '32px 24px',
        textAlign: 'center',
        borderRadius: 0
      }}
    >
      <p style={{ fontSize: 15, color: 'var(--nda-ink-secondary)', margin: 0, maxWidth: '60ch', marginInline: 'auto' }}>
        {message}
      </p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

export function ErrorNote({
  title,
  body,
  detail,
  action
}: { title: string; body: string; detail?: string; action?: ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--nda-canvas-container)',
        border: '3px solid var(--nda-semantic-error)',
        boxShadow: '4px 4px 0 var(--nda-semantic-error)',
        padding: '16px 20px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        borderRadius: 0
      }}
    >
      <Dot color="var(--nda-semantic-error)" style={{ marginTop: 6 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-header)',
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--nda-semantic-error)',
            margin: 0
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nda-ink-primary)', margin: '4px 0 0' }}>
          {body}
        </p>
        {detail && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--nda-ink-secondary)', margin: '6px 0 0' }}>
            {detail}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth = 540
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number | string;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(26, 26, 26, 0.7)' }}
      />
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--nda-canvas-container)',
          border: '3px solid var(--nda-ink-primary)',
          boxShadow: 'var(--nda-shadow-lg)',
          width: '100%',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          padding: '24px',
          boxSizing: 'border-box',
          borderRadius: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Heading level={3}>{title}</Heading>
          <IconBtn label="Close" onClick={onClose}>
            {Icon.close(16)}
          </IconBtn>
        </div>
        <div style={{ margin: '16px 0' }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Loading({ text = 'Reading your ledger' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px' }}>
      <Dot breathe color="var(--nda-action-primary)" size={10} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textTransform: 'uppercase', color: 'var(--nda-ink-secondary)' }}>
        {text}
      </span>
    </div>
  );
}

/* ─────────────────────────  Form Input Styles  ───────────────────────── */

export const inputStyle: CSSProperties = {
  height: 44,
  padding: '0 12px',
  border: '3px solid var(--nda-ink-primary)',
  borderRadius: 0,
  backgroundColor: 'var(--nda-canvas-container)',
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--nda-ink-primary)',
  boxSizing: 'border-box',
  width: '100%'
};

export const inputStyleSm: CSSProperties = {
  ...inputStyle,
  height: 38,
  padding: '0 10px',
  fontSize: 13
};

export const moneyInputStyle: CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-mono)',
  textAlign: 'right'
};

// Backwards-compatible stubs for rarely-used component exports
export const SectionHead = ({ title }: { title: string }) => <Heading level={2} style={{ marginBottom: 12 }}>{title}</Heading>;
export const Legend = ({ items }: { items: any[] }) => null;

export function Callout({
  tone = 'info',
  title,
  children
}: {
  tone?: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const borderColor = tone === 'error' ? 'var(--nda-semantic-error)' : tone === 'warning' ? 'var(--nda-identity-secondary)' : 'var(--nda-ink-primary)';
  return (
    <div
      style={{
        backgroundColor: 'var(--nda-canvas-container)',
        border: `3px solid ${borderColor}`,
        boxShadow: `4px 4px 0 ${borderColor}`,
        padding: '16px 20px',
        borderRadius: 0,
        margin: '12px 0'
      }}
    >
      {title && (
        <p
          style={{
            fontFamily: 'var(--font-header)',
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: borderColor,
            margin: '0 0 6px 0'
          }}
        >
          {title}
        </p>
      )}
      <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--nda-ink-primary)' }}>{children}</div>
    </div>
  );
}

export function ProgressBar({
  value = 0,
  max = 100,
  progress,
  tone = 'progress'
}: {
  value?: number;
  max?: number;
  progress?: number;
  tone?: string;
}) {
  const actualValue = progress !== undefined ? progress : value;
  const pct = Math.min(100, Math.max(0, (actualValue / (max || 100)) * 100));
  const barColor = tone === 'done' ? 'var(--nda-identity-primary)' : 'var(--nda-action-primary)';
  return (
    <div
      style={{
        height: 8,
        backgroundColor: 'var(--nda-ui-lines)',
        border: '1px solid var(--nda-ink-primary)',
        borderRadius: 0,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: barColor,
          borderRadius: 0
        }}
      />
    </div>
  );
}

export function Pill({ value, text }: { value: number; text: string }) {
  return (
    <span
      style={{
        justifySelf: 'end',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 100,
        padding: '4px 10px',
        borderRadius: 0,
        border: '2px solid var(--nda-ink-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        backgroundColor:
          value < 0
            ? 'var(--app-error-tint)'
            : value > 0
            ? 'var(--app-success-tint)'
            : 'var(--app-surface-alt)',
        color: value < 0 ? 'var(--nda-semantic-error)' : 'var(--nda-ink-primary)'
      }}
    >
      {text}
    </span>
  );
}

export const Disclosure = ({ summary, children }: { summary: string; children: ReactNode }) => (
  <details style={{ padding: '8px 0' }}>
    <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-header)', fontWeight: 700 }}>{summary}</summary>
    <div style={{ marginTop: 8 }}>{children}</div>
  </details>
);
export const ActionCard = ({ title, children }: { title: string; children: ReactNode }) => <Panel title={title}>{children}</Panel>;
export const ActionCardRow = ({ children }: { children: ReactNode }) => <div>{children}</div>;
export function FilterChip({
  label,
  children,
  active,
  count,
  onClick
}: {
  label?: string;
  children?: ReactNode;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}) {
  const content = label || children;
  return (
    <Button
      variant={active ? 'action' : 'secondary'}
      size="sm"
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span>{content}</span>
      {count !== undefined && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '1px 5px',
            backgroundColor: active ? '#FFFFFF' : 'var(--nda-ui-lines)',
            color: 'var(--nda-ink-primary)',
            borderRadius: 0
          }}
        >
          {count}
        </span>
      )}
    </Button>
  );
}
export const FilterChipRow = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', gap: 8 }}>{children}</div>;
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ marginBottom: 12 }}>
    <StatLabel size="xs">{label}</StatLabel>
    <div style={{ marginTop: 4 }}>{children}</div>
  </div>
);
export const DataTable = ({ children }: { children: ReactNode }) => <TableCard>{children}</TableCard>;
export const TaskRow = () => null;
