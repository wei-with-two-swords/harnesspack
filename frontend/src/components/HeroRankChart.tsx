export function HeroRankChart() {
  return (
    <svg
      className="hero-rank-chart"
      viewBox="0 0 680 260"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="hero-rank-chart-fade" cx="76%" cy="50%" r="52%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="45%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>
        <mask id="hero-rank-chart-mask">
          <rect width="680" height="260" fill="url(#hero-rank-chart-fade)" />
        </mask>
      </defs>

      <g mask="url(#hero-rank-chart-mask)">
        <g className="chart-grid">
          <path d="M28 68H664M28 116H664M28 164H664" />
          <path d="M152 20V224M276 20V224M400 20V224M524 20V224M648 20V224" />
        </g>
        <path className="chart-axis" d="M28 20V224H664" />

        <g className="chart-curves">
          <path
            className="chart-curve chart-curve-top1"
            pathLength="1"
            d="M85 178 C153 172 187 150 247 144 C302 138 327 133 374 136 C421 138 446 147 493 141 C548 132 570 104 612 84 C629 76 638 72 646 68"
          />
          <path
            className="chart-curve chart-curve-top23"
            pathLength="1"
            d="M85 187 C145 178 179 150 238 130 C293 113 323 110 374 119 C425 127 446 136 493 136 C544 136 570 126 612 118 C629 115 638 113 646 112"
          />
          <path
            className="chart-curve chart-curve-rookie"
            pathLength="1"
            d="M85 198 C149 192 183 175 238 164 C293 153 323 141 374 133 C425 124 451 138 493 141 C544 142 570 118 612 102 C629 98 638 96 646 94"
          />
        </g>
        <g className="chart-endpoint">
          <circle className="chart-endpoint-ring" cx="646" cy="68" r="2.5" />
          <circle className="chart-endpoint-core" cx="646" cy="68" r="2.5" />
        </g>
      </g>
    </svg>
  );
}
