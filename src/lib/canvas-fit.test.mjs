import test from 'node:test'
import assert from 'node:assert/strict'
import { familyMembers } from '../data/family.ts'
import { getFitZoom, getTreeContentBounds } from './canvas-fit.ts'
import { computeTreeLayout, getParentChildBranchJunction, getParentChildConnectorPaths, getSpouseConnector, MARRIAGE_ANCHOR_RADIUS } from './tree-layout.ts'

function getOrthogonalPathPoints(path) {
  const tokens = path.match(/[A-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  const points = []
  let cursor = 0
  let command = ''
  let x = 0
  let y = 0
  while (cursor < tokens.length) {
    if (/^[A-Z]$/.test(tokens[cursor])) command = tokens[cursor++]
    if (command === 'M' || command === 'L') {
      x = Number(tokens[cursor++])
      y = Number(tokens[cursor++])
    } else if (command === 'H') {
      x = Number(tokens[cursor++])
    } else if (command === 'V') {
      y = Number(tokens[cursor++])
    } else {
      throw new Error(`Unexpected SVG path command: ${command}`)
    }
    points.push({ x, y })
  }
  return points
}

test('fit bounds use visible node extents with room for relationship anchors', () => {
  const bounds = getTreeContentBounds({
    positions: new Map([
      ['first', { x: 70, y: 32, generation: 0 }],
      ['last', { x: 344, y: 238, generation: 1 }],
    ]),
    width: 940,
    height: 380,
    nodeWidth: 240,
    nodeHeight: 106,
  })
  assert.deepEqual(bounds, { left: 58, top: 20, width: 538, height: 336 })
})

test('fit zoom includes all content and comfortable viewport padding', () => {
  const zoom = getFitZoom({ left: 0, top: 0, width: 1000, height: 500 }, 900, 600)
  assert.equal(zoom, 0.812)
})

test('fit zoom respects configured lower and upper limits', () => {
  assert.equal(getFitZoom({ left: 0, top: 0, width: 5000, height: 3000 }, 600, 400), 0.25)
  assert.equal(getFitZoom({ left: 0, top: 0, width: 100, height: 80 }, 1200, 900), 1.4)
})

test('Midnight compact card fit uses the same dimensions as the rendered card', () => {
  const member = { id: 'person', name: 'Person', parentIds: [], spouseIds: [], siblingIds: [] }
  const standardLayout = computeTreeLayout([member], 'rectangle')
  const layout = computeTreeLayout([member], 'rectangle', { compactCards: true })
  assert.equal(standardLayout.nodeWidth, 240)
  assert.equal(standardLayout.nodeHeight, 106)
  assert.equal(layout.nodeWidth, 212)
  assert.equal(layout.nodeHeight, 98)
  assert.deepEqual(getTreeContentBounds(layout), { left: 58, top: 20, width: 236, height: 122 })
})

test('compact card sizing leaves Circle View dimensions unchanged', () => {
  const layout = computeTreeLayout([], 'circle', { compactCards: true })
  assert.equal(layout.nodeWidth, 160)
  assert.equal(layout.nodeHeight, 144)
})

test('fit bounds include every rendered family connector and relationship badge', () => {
  const layout = computeTreeLayout(familyMembers)
  const bounds = getTreeContentBounds(layout)
  const positions = layout.positions
  const parentsByFamily = new Map()

  for (const child of familyMembers) {
    const parentIds = child.parentIds.filter((id) => positions.has(id)).sort()
    if (!parentIds.length) continue
    const adopted = parentIds.every((id) => child.adoptedParentIds?.includes(id))
    const key = `${parentIds.join('|')}::${adopted}`
    const group = parentsByFamily.get(key) ?? { parentIds, children: [], adopted }
    group.children.push(child)
    parentsByFamily.set(key, group)
  }

  for (const { parentIds, children, adopted } of parentsByFamily.values()) {
    const parents = parentIds.map((id) => positions.get(id))
    const childPoints = children.map((child) => positions.get(child.id))
    for (const path of getParentChildConnectorPaths(parents, childPoints, layout.nodeWidth, layout.nodeHeight)) {
      for (const point of getOrthogonalPathPoints(path)) {
        assert.ok(point.x >= bounds.left && point.x <= bounds.left + bounds.width)
        assert.ok(point.y >= bounds.top && point.y <= bounds.top + bounds.height)
      }
    }
    if (adopted) {
      const junction = getParentChildBranchJunction(parents, childPoints, layout.nodeWidth, layout.nodeHeight)
      assert.ok(junction)
      assert.ok(junction.x - 10 >= bounds.left && junction.x + 10 <= bounds.left + bounds.width)
      assert.ok(junction.y - 10 >= bounds.top && junction.y + 10 <= bounds.top + bounds.height)
    }
  }

  const renderedPairs = new Set()
  for (const member of familyMembers) {
    for (const spouseId of [...member.spouseIds, ...(member.formerSpouseIds ?? [])]) {
      const key = [member.id, spouseId].sort().join('|')
      if (renderedPairs.has(key)) continue
      renderedPairs.add(key)
      const connector = getSpouseConnector(positions.get(member.id), positions.get(spouseId), layout.nodeWidth, layout.nodeHeight)
      if (!connector) continue
      for (const point of getOrthogonalPathPoints(connector.path)) {
        assert.ok(point.x >= bounds.left && point.x <= bounds.left + bounds.width)
        assert.ok(point.y >= bounds.top && point.y <= bounds.top + bounds.height)
      }
      assert.ok(connector.anchorX - MARRIAGE_ANCHOR_RADIUS >= bounds.left)
      assert.ok(connector.anchorX + MARRIAGE_ANCHOR_RADIUS <= bounds.left + bounds.width)
      assert.ok(connector.anchorY - MARRIAGE_ANCHOR_RADIUS >= bounds.top)
      assert.ok(connector.anchorY + MARRIAGE_ANCHOR_RADIUS <= bounds.top + bounds.height)
    }
  }
})
