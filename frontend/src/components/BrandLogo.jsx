import React from 'react';

export function ServicePathMark({ size = 32, theme = 'light', className = '' }) {
  const isDark = theme === 'dark';
  const topRibbon = isDark ? '#74C68E' : '#5CA473';
  const bodyRibbon = isDark ? '#2B6E42' : '#1E5631';
  const foldShadow = '#143D22';
  const roadChannel = '#143D22';
  const roadDash = '#FCFBF8';
  const arrowFill = isDark ? '#74C68E' : '#5CA473';

  return (
    <svg
      className={`sp-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >

      <path
        d="M9 49.5 L19.5 57.2 C22.2 59.1 25.8 58.3 29 56.2 C39.5 49.8 46 43.2 45.4 36 C44.8 29.6 37.5 26.2 29.5 23.8 C23.2 21.8 20.2 19.6 20.8 16.5 L11.5 22.5 C10.4 27.2 13.2 31.4 21.2 34.8 C27.2 37.4 29.2 39.4 28.4 41.8 C27.4 44.5 20.2 47.6 9 49.5 Z"
        fill={bodyRibbon}
      />

      <path
        d="M11.5 22.5 L20.8 16.5 C20.2 19.6 23.2 21.8 29.5 23.8 L21.2 28.8 C14.8 26.6 11.4 24.8 11.5 22.5 Z"
        fill={foldShadow}
      />

      <path
        d="M11.5 22.5 C11 18.2 13.4 14.2 19 11 L28.8 5.8 C31.6 4.3 35 4.6 37.6 6.5 L42.5 10.4 C35.2 13.6 28.4 17.5 23.2 21 C19.2 23.8 14.2 24.2 11.5 22.5 Z"
        fill={topRibbon}
      />

      <path
        d="M14.5 51.8 C29.2 47.2 38.6 42.6 38.6 37 C38.6 32.1 25 29.2 25 23.4 C25 18.9 32.5 15.8 42.8 14"
        stroke={roadChannel}
        strokeWidth="7"
        strokeLinecap="round"
      />

      <path
        d="M15 51.6 C29 47.2 38.4 42.6 38.4 37 C38.4 32.1 25 29.2 25 23.4 C25 18.9 32.2 15.9 42 14.1"
        stroke={roadDash}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="4.8 4.2"
      />

      <path
        d="M43.2 9.4 L56.4 7.6 C57.8 7.4 58.8 8.8 58 10.1 L51.8 21.4 C51.1 22.6 49.4 22.5 48.8 21.2 L47 17 L42.6 13.3 C41.5 12.3 41.9 9.6 43.2 9.4 Z"
        fill={arrowFill}
      />
    </svg>
  );
}

export function ServicePathLogo({
  theme = 'light',
  size = 'md',
  className = '',
}) {
  const markSize = size === 'sm' ? 28 : size === 'lg' ? 40 : 32;

  return (
    <span className={`sp-logo sp-logo-${theme} sp-logo-${size} ${className}`.trim()}>
      <ServicePathMark size={markSize} theme={theme} />
      <span className="sp-logo-divider" aria-hidden="true" />
      <span className="sp-logo-title">
        <span className="sp-logo-name">ServicePath</span>{' '}
        <span className="sp-logo-ai">AI</span>
      </span>
    </span>
  );
}
