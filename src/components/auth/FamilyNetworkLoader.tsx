import { useEffect, useState } from 'react'

type Point = { x: number; y: number }
type Tone = 'warm' | 'cool'
type NodeSpec = { id: string; point: Point; radius: number; tone: Tone; delay: number }
type BranchSpec = { id: string; path: string; delay: number }

export const FAMILY_NETWORK_LOADER_CYCLE_MS = 6_000
const CYCLE_SECONDS = FAMILY_NETWORK_LOADER_CYCLE_MS / 1_000
const PHASE_TIMES = '0;0.166667;0.291667;0.416667;0.558333;0.691667;0.733333;0.833333;0.925;1'
const PHASE_SPLINES = Array.from({ length: 9 }, () => '0.45 0 0.55 1').join(';')
const BLOB_SHAPES = [
  'M0,-48 C28,-48 50,-24 48,2 C46,28 26,46 0,46 C-27,46 -50,26 -48,-2 C-46,-28 -27,-48 0,-48 Z',
  'M4,-44 C32,-46 52,-20 46,6 C40,32 22,50 -4,48 C-30,46 -48,22 -46,-4 C-44,-30 -24,-42 4,-44 Z',
  'M-2,-50 C24,-44 46,-28 50,0 C54,26 24,44 2,44 C-24,44 -52,30 -50,2 C-48,-26 -28,-56 -2,-50 Z',
]
const ELLIPSE_SHAPE = 'M0,-92 C12,-92 14,-50 14,0 C14,50 12,92 0,92 C-12,92 -14,50 -14,0 C-14,-50 -12,-92 0,-92 Z'
const LINE_SHAPE = 'M0,-130 C0.8,-130 1.2,-120 1.2,0 C1.2,120 0.8,130 0,130 C-0.8,130 -1.2,120 -1.2,0 C-1.2,-120 -0.8,-130 0,-130 Z'
const TRUNK_PATH = 'M0,-130 L0,-40'
const SPLIT_PATHS = [
  { id: 'left', straight: 'M0,-40 C0,-10 0,-20 0,20 C0,80 0,80 0,130', curved: 'M0,-40 C0,-10 -90,-20 -90,20 C-90,80 0,80 0,130' },
  { id: 'right', straight: 'M0,-40 C0,-10 0,-20 0,20 C0,80 0,80 0,130', curved: 'M0,-40 C0,-10 90,-20 90,20 C90,80 0,80 0,130' },
]
const OUTER_BRANCHES: BranchSpec[] = [
  { id: 'left', path: 'M-90,20 C-100,60 -150,64 -150,110', delay: 0 },
  { id: 'right', path: 'M90,20 C100,60 150,64 150,110', delay: 0.12 },
]
const CORE_NODES: NodeSpec[] = [
  { id: 'root', point: { x: 0, y: -130 }, radius: 9, tone: 'warm', delay: 0 },
  { id: 'left', point: { x: -90, y: 20 }, radius: 10, tone: 'cool', delay: 0.1 },
  { id: 'right', point: { x: 90, y: 20 }, radius: 10, tone: 'cool', delay: 0.1 },
  { id: 'youngest', point: { x: 0, y: 130 }, radius: 8.5, tone: 'cool', delay: 0.34 },
]
const PULSE_PATHS = [
  { id: 'left', path: 'M0,-130 L0,-40 C0,-10 -90,-20 -90,20 C-90,80 0,80 0,130', delay: 0 },
  { id: 'outer-left', path: 'M-90,20 C-100,60 -150,64 -150,110', delay: 0.18 },
  { id: 'right', path: 'M0,-130 L0,-40 C0,-10 90,-20 90,20 C90,80 0,80 0,130', delay: 0.36 },
  { id: 'outer-right', path: 'M90,20 C100,60 150,64 150,110', delay: 0.54 },
]
const REGION = { x: -260, y: -260, width: 520, height: 520 }

function PhaseAnimation({ attributeName, values, keyTimes = PHASE_TIMES, duration = CYCLE_SECONDS }: {
  attributeName: string
  values: string
  keyTimes?: string
  duration?: number
}) {
  const segmentCount = keyTimes.split(';').length - 1
  const splines = Array.from({ length: segmentCount }, () => '0.45 0 0.55 1').join(';')
  return <animate
    attributeName={attributeName}
    values={values}
    keyTimes={keyTimes}
    keySplines={splines}
    calcMode="spline"
    dur={`${duration}s`}
    repeatCount="indefinite"
  />
}

function SvgDefinitions() {
  return <defs>
    <linearGradient id="rootly-branch" gradientUnits="userSpaceOnUse" x1="0" y1="-150" x2="0" y2="150">
      <stop offset="0" stopColor="#F6E2B8" />
      <stop offset="0.38" stopColor="#C8F5DF" />
      <stop offset="0.7" stopColor="#5EE0B0" />
      <stop offset="1" stopColor="#1FB89A" />
    </linearGradient>
    <radialGradient id="rootly-seed-highlight" cx="0.38" cy="0.3" r="0.7">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
      <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="rootly-aura">
      <stop offset="0" stopColor="#5EE0B0" stopOpacity="0.32" />
      <stop offset="1" stopColor="#5EE0B0" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="rootly-node-cool" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#FFFFFF" />
      <stop offset="0.35" stopColor="#CFF7E6" />
      <stop offset="0.75" stopColor="#4FD8A6" />
      <stop offset="1" stopColor="#17977F" />
    </radialGradient>
    <radialGradient id="rootly-node-warm" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#FFFFFF" />
      <stop offset="0.35" stopColor="#FBEACB" />
      <stop offset="0.75" stopColor="#E9B676" />
      <stop offset="1" stopColor="#B9773A" />
    </radialGradient>
    <radialGradient id="rootly-halo-cool">
      <stop offset="0" stopColor="#5EE0B0" stopOpacity="0.55" />
      <stop offset="1" stopColor="#5EE0B0" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="rootly-halo-warm">
      <stop offset="0" stopColor="#F2C27E" stopOpacity="0.55" />
      <stop offset="1" stopColor="#F2C27E" stopOpacity="0" />
    </radialGradient>
    <filter id="rootly-blur" filterUnits="userSpaceOnUse" {...REGION}><feGaussianBlur stdDeviation="4" /></filter>
    <filter id="rootly-blur-lg" filterUnits="userSpaceOnUse" {...REGION}><feGaussianBlur stdDeviation="16" /></filter>
    <filter id="rootly-shadow" filterUnits="userSpaceOnUse" {...REGION}><feGaussianBlur stdDeviation="3" /></filter>
  </defs>
}

function GuideRings({ reduced }: { reduced: boolean }) {
  return <g>
    <circle r="196" fill="none" stroke="#CFEFE2" strokeOpacity="0.08" strokeWidth="0.6" pathLength="1" strokeDasharray="1" strokeDashoffset={reduced ? 0 : 1}>
      {!reduced && <PhaseAnimation attributeName="stroke-dashoffset" values="1;1;0.76;0.28;0;0;0;0;1;1" />}
    </circle>
    <g>
      <circle r="228" fill="none" stroke="#CFEFE2" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="0.5 7" strokeLinecap="round" />
      {[0, 90, 180, 270].map((degree) => <line key={degree} x1="0" y1="-232" x2="0" y2="-222" stroke="#CFEFE2" strokeOpacity="0.22" strokeWidth="0.8" transform={`rotate(${degree})`} />)}
      {!reduced && <animateTransform attributeName="transform" type="rotate" values="0;360" dur="140s" repeatCount="indefinite" />}
    </g>
  </g>
}

function BranchStroke({ d, shapeValues, drawValues }: { d: string; shapeValues?: string; drawValues?: string }) {
  const children = <>
    {shapeValues && <PhaseAnimation attributeName="d" values={shapeValues} />}
    {drawValues && <PhaseAnimation attributeName="stroke-dashoffset" values={drawValues} />}
  </>
  const pathProps = drawValues ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 } : {}
  return <g>
    <g opacity="0.5" filter="url(#rootly-blur)">
      <path {...pathProps} d={d} fill="none" stroke="url(#rootly-branch)" strokeWidth="6.4" strokeLinecap="round">{children}</path>
    </g>
    <path {...pathProps} d={d} fill="none" stroke="url(#rootly-branch)" strokeWidth="2" strokeLinecap="round">{children}</path>
  </g>
}

function TreeNode({ spec, reduced, initialOpacity = 0 }: { spec: NodeSpec; reduced: boolean; initialOpacity?: number }) {
  const { x, y } = spec.point
  const ringColor = spec.tone === 'warm' ? '#F4D29E' : '#A7F0D2'
  const appearValues = spec.id === 'root'
    ? '0;0;1;1;1;1;1;1;0;0'
    : spec.id === 'youngest'
      ? '0;0;0;0;1;1;1;0;0;0'
      : '0;0;0;1;1;1;1;0;0;0'
  const initial = reduced ? 1 : initialOpacity
  return <g transform={`translate(${x} ${y})`} opacity={initial}>
    {!reduced && <PhaseAnimation attributeName="opacity" values={appearValues} />}
    <circle r={spec.radius * 3.2} fill={`url(#rootly-halo-${spec.tone})`} opacity={reduced ? 0.35 : 0.45}>
      {!reduced && <PhaseAnimation attributeName="opacity" values="0;0;0.35;0.62;0.44;0.65;0.35;0;0;0" />}
    </circle>
    <circle fill="none" stroke={ringColor} strokeWidth="0.75" r={spec.radius} opacity="0">
      {!reduced && <>
        <PhaseAnimation attributeName="r" values={`${spec.radius};${spec.radius};${spec.radius * 4.4};${spec.radius * 4.4};${spec.radius * 4.4};${spec.radius * 4.4};${spec.radius * 4.4};${spec.radius};${spec.radius};${spec.radius}`} />
        <PhaseAnimation attributeName="opacity" values="0;0;0.65;0;0;0;0;0;0;0" />
      </>}
    </circle>
    <circle r={spec.radius + 4.5} fill="none" stroke={ringColor} strokeWidth="0.8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={reduced ? 0 : 1} transform="rotate(-90)">
      {!reduced && <PhaseAnimation attributeName="stroke-dashoffset" values="1;1;0;0;0;0;0;1;1;1" />}
    </circle>
    <circle cy={spec.radius * 0.55} r={spec.radius} fill="#000" opacity="0.45" filter="url(#rootly-shadow)" />
    <circle r={spec.radius} fill={`url(#rootly-node-${spec.tone})`} />
    <circle cx={-spec.radius * 0.34} cy={-spec.radius * 0.38} r={spec.radius * 0.3} fill="#FFFFFF" opacity="0.75" />
  </g>
}

function AnimatedNode({ spec, initialOpacity = 0, travel }: { spec: NodeSpec; initialOpacity?: number; travel?: 'left' | 'right' }) {
  const toX = spec.point.x
  const appearValues = spec.id === 'root'
    ? '0;0;1;1;1;1;1;1;0;0'
    : spec.id === 'youngest'
      ? '0;0;0;0;1;1;1;0;0;0'
      : '0;0;0;1;1;1;1;0;0;0'
  const ringColor = spec.tone === 'warm' ? '#F4D29E' : '#A7F0D2'
  const radius = spec.radius
  const targetTransform = `translate(${toX} ${spec.point.y})`
  const travelValues = travel === 'left'
    ? `0 20;0 20;0 20;-90 20;-90 20;-90 20;-90 20;-90 20;0 20;0 20`
    : `0 20;0 20;0 20;90 20;90 20;90 20;90 20;90 20;0 20;0 20`
  return <g transform={travel ? 'translate(0 20)' : targetTransform} opacity={initialOpacity}>
    <PhaseAnimation attributeName="opacity" values={appearValues} />
    {travel && <animateTransform attributeName="transform" type="translate" values={travelValues} keyTimes={PHASE_TIMES} keySplines={PHASE_SPLINES} calcMode="spline" dur={`${CYCLE_SECONDS}s`} repeatCount="indefinite" />}
    <circle r={radius * 3.2} fill={`url(#rootly-halo-${spec.tone})`} opacity="0.45">
      <PhaseAnimation attributeName="opacity" values="0;0;0.35;0.62;0.44;0.65;0.35;0;0;0" />
    </circle>
    <circle fill="none" stroke={ringColor} strokeWidth="0.75" r={radius} opacity="0">
      <PhaseAnimation attributeName="r" values={`${radius};${radius};${radius * 4.4};${radius * 4.4};${radius * 4.4};${radius * 4.4};${radius * 4.4};${radius};${radius};${radius}`} />
      <PhaseAnimation attributeName="opacity" values="0;0;0.65;0;0;0;0;0;0;0" />
    </circle>
    <circle r={radius + 4.5} fill="none" stroke={ringColor} strokeWidth="0.8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1" transform="rotate(-90)">
      <PhaseAnimation attributeName="stroke-dashoffset" values="1;1;0;0;0;0;0;1;1;1" />
    </circle>
    <circle cy={radius * 0.55} r={radius} fill="#000" opacity="0.45" filter="url(#rootly-shadow)" />
    <circle r={radius} fill={`url(#rootly-node-${spec.tone})`} />
    <circle cx={-radius * 0.34} cy={-radius * 0.38} r={radius * 0.3} fill="#FFFFFF" opacity="0.75" />
  </g>
}

function OuterBranch({ spec, reduced }: { spec: BranchSpec; reduced: boolean }) {
  const offsetValues = reduced ? undefined : '1;1;1;1;0;0;0;1;1;1'
  const pathProps = reduced ? {} : { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 }
  const nodesVisible = reduced ? 1 : 0
  const nodeValues = '0;0;0;0;1;1;0;0;0;0'
  return <g>
    <g opacity="0.5" filter="url(#rootly-blur)">
      <path {...pathProps} d={spec.path} fill="none" stroke="url(#rootly-branch)" strokeWidth="6.4" strokeLinecap="round">
        {offsetValues && <PhaseAnimation attributeName="stroke-dashoffset" values={offsetValues} />}
      </path>
    </g>
    <path {...pathProps} d={spec.path} fill="none" stroke="url(#rootly-branch)" strokeWidth="2" strokeLinecap="round">
      {offsetValues && <PhaseAnimation attributeName="stroke-dashoffset" values={offsetValues} />}
    </path>
    <g transform={spec.id === 'left' ? 'translate(-150 110)' : 'translate(150 110)'} opacity={nodesVisible}>
      {!reduced && <PhaseAnimation attributeName="opacity" values={nodeValues} />}
      <TreeNode spec={{ id: spec.id, point: { x: 0, y: 0 }, radius: 7, tone: 'cool', delay: spec.delay }} reduced={reduced} initialOpacity={1} />
    </g>
  </g>
}

function EnergyPulses() {
  return <g opacity="0">
    <PhaseAnimation attributeName="opacity" values="0;0;0;0;0.72;0.72;0;0;0;0" />
    <g filter="url(#rootly-blur)">
      {PULSE_PATHS.map((pulse) => <path key={`glow-${pulse.id}`} d={pulse.path} pathLength="1" className="rootly-loader-pulse" style={{ animationDelay: `${pulse.delay}s` }} fill="none" stroke="#B9F5DC" strokeWidth="6" strokeLinecap="round" />)}
    </g>
    {PULSE_PATHS.map((pulse) => <path key={pulse.id} d={pulse.path} pathLength="1" className="rootly-loader-pulse" style={{ animationDelay: `${pulse.delay}s` }} fill="none" stroke="#F4FFF9" strokeWidth="1.6" strokeLinecap="round" />)}
  </g>
}

function AnimatedTree() {
  const seedValues = `${BLOB_SHAPES[0]};${BLOB_SHAPES[1]};${BLOB_SHAPES[2]};${BLOB_SHAPES[0]};${ELLIPSE_SHAPE};${LINE_SHAPE};${LINE_SHAPE};${LINE_SHAPE};${LINE_SHAPE};${LINE_SHAPE};${LINE_SHAPE};${LINE_SHAPE};${BLOB_SHAPES[0]}`
  const seedOpacity = '1;1;0.4;0;0;0;0;0;0;1'
  const trunkDraw = '1;1;0;0;0;0;0;0;1;1'
  const branchDraw = '1;1;1;0;0;0;0;0;1;1'
  const splitShape = `${SPLIT_PATHS[0].straight};${SPLIT_PATHS[0].straight};${SPLIT_PATHS[0].straight};${SPLIT_PATHS[0].curved};${SPLIT_PATHS[0].curved};${SPLIT_PATHS[0].curved};${SPLIT_PATHS[0].curved};${SPLIT_PATHS[0].curved};${SPLIT_PATHS[0].straight};${SPLIT_PATHS[0].straight}`
  const reversedSplitShape = `${SPLIT_PATHS[1].straight};${SPLIT_PATHS[1].straight};${SPLIT_PATHS[1].straight};${SPLIT_PATHS[1].curved};${SPLIT_PATHS[1].curved};${SPLIT_PATHS[1].curved};${SPLIT_PATHS[1].curved};${SPLIT_PATHS[1].curved};${SPLIT_PATHS[1].straight};${SPLIT_PATHS[1].straight}`
  const seedTimes = '0;0.055556;0.111111;0.166667;0.229167;0.291667;0.416667;0.558333;0.691667;0.733333;0.833333;0.925;1'
  const seedSplines = Array.from({ length: 12 }, () => '0.45 0 0.55 1').join(';')
  return <g>
    <g>
      {[0, 0.04].map((delay) => <circle key={delay} r="170" fill="none" stroke="#9FEFD0" strokeWidth="0.75" opacity="0">
        <animate attributeName="r" values="170;50;170;170" keyTimes="0;0.12;0.2;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" calcMode="spline" dur={`${CYCLE_SECONDS}s`} begin={`${delay}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.55;0;0" keyTimes="0;0.12;0.2;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" calcMode="spline" dur={`${CYCLE_SECONDS}s`} begin={`${delay}s`} repeatCount="indefinite" />
      </circle>)}
    </g>
    <g>
      <circle r="130" fill="url(#rootly-aura)" opacity="0.35">
        <PhaseAnimation attributeName="opacity" values="0.35;0.65;0.35;0;0;0;0;0;0;0" />
      </circle>
      <g opacity="1">
        <PhaseAnimation attributeName="opacity" values={seedOpacity} />
        <g filter="url(#rootly-blur-lg)" opacity="0.85">
          <path d={BLOB_SHAPES[0]} fill="url(#rootly-branch)"><animate attributeName="d" values={seedValues} keyTimes={seedTimes} keySplines={seedSplines} calcMode="spline" dur={`${CYCLE_SECONDS}s`} repeatCount="indefinite" /></path>
        </g>
        <path d={BLOB_SHAPES[0]} fill="url(#rootly-branch)"><animate attributeName="d" values={seedValues} keyTimes={seedTimes} keySplines={seedSplines} calcMode="spline" dur={`${CYCLE_SECONDS}s`} repeatCount="indefinite" /></path>
        <path d={BLOB_SHAPES[0]} fill="url(#rootly-seed-highlight)"><animate attributeName="d" values={seedValues} keyTimes={seedTimes} keySplines={seedSplines} calcMode="spline" dur={`${CYCLE_SECONDS}s`} repeatCount="indefinite" /></path>
      </g>
    </g>
    <BranchStroke d={TRUNK_PATH} drawValues={trunkDraw} />
    {SPLIT_PATHS.map((path, index) => <BranchStroke key={path.id} d={path.straight} shapeValues={index === 0 ? splitShape : reversedSplitShape} drawValues={branchDraw} />)}
    {OUTER_BRANCHES.map((branch) => <OuterBranch key={branch.id} spec={branch} reduced={false} />)}
    <EnergyPulses />
    {CORE_NODES.map((node) => <AnimatedNode key={node.id} spec={node} initialOpacity={0} travel={node.id === 'left' || node.id === 'right' ? node.id : undefined} />)}
  </g>
}

function CompleteTree() {
  return <g>
    <BranchStroke d={TRUNK_PATH} />
    {SPLIT_PATHS.map((path) => <BranchStroke key={path.id} d={path.curved} />)}
    {OUTER_BRANCHES.map((branch) => <OuterBranch key={branch.id} spec={branch} reduced />)}
    {CORE_NODES.map((node) => <TreeNode key={node.id} spec={node} reduced initialOpacity={1} />)}
  </g>
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export function FamilyNetworkLoader({ label }: { label: string }) {
  const reduced = usePrefersReducedMotion()
  return <section className="rootly-loader" role="status" aria-label={label}>
    <svg className="rootly-loader-art" viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
      <SvgDefinitions />
      <GuideRings reduced={reduced} />
      {reduced ? <CompleteTree /> : <AnimatedTree />}
    </svg>
  </section>
}
