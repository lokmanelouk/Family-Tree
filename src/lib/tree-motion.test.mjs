import assert from 'node:assert/strict'
import test from 'node:test'
import { createSvgPathInterpolator, getExitAnimationIds, getRemovedMemberIds, getStableConnectorSegments, interpolateSvgPath, removeMotionArtifactOnFinishOrCancel } from './tree-motion.ts'

test('SVG path interpolation preserves exact endpoints and moves connector coordinates', () => {
  const from = 'M 0 10 C 20 10 20 30 40 30'
  const to = 'M 10 20 C 30 20 30 40 50 40'
  const interpolate = createSvgPathInterpolator(from, to)

  assert.ok(interpolate)
  assert.equal(interpolate(0), from)
  assert.equal(interpolate(1), to)
  assert.equal(interpolate(0.5), 'M 5 15 C 25 15 25 35 45 35')
})

test('SVG path interpolation rejects paths with incompatible command structures', () => {
  assert.equal(createSvgPathInterpolator('M 0 0 L 10 10', 'M 0 0 C 5 5 10 10 15 15'), null)
  assert.equal(interpolateSvgPath('M 0 0 L 10 10', 'M 0 0 C 5 5 10 10 15 15', 0.5), null)
})

test('SVG path interpolation handles easing values beyond the animation bounds', () => {
  const interpolate = createSvgPathInterpolator('M 1 2 L 3 4', 'M 5 6 L 7 8')

  assert.ok(interpolate)
  assert.equal(interpolate(-0.2), 'M 1 2 L 3 4')
  assert.equal(interpolate(1.2), 'M 5 6 L 7 8')
})

test('removed member ids are detected across delete, undo, and redo snapshots', () => {
  assert.deepEqual(getRemovedMemberIds(['a', 'b'], ['a']), ['b'])
  assert.deepEqual(getRemovedMemberIds(['a'], ['a', 'b']), [])
  assert.deepEqual(getRemovedMemberIds(['a', 'b'], ['a', 'c']), ['b'])
})

test('exit animation candidates stay bounded for bulk removals', () => {
  assert.deepEqual(getExitAnimationIds(['b'], null), ['b'])
  assert.deepEqual(getExitAnimationIds(['a', 'b'], 'b'), ['b'])
  assert.deepEqual(getExitAnimationIds(['a', 'b'], null), [])
})

test('parent connector segments keep child identity when sibling ordering changes', () => {
  const first = getStableConnectorSegments(['stem', 'bus', 'child-a-old', 'child-b-old'], ['a', 'b'])
  const reordered = getStableConnectorSegments(['stem', 'bus', 'child-b-new', 'child-a-new'], ['b', 'a'])

  assert.deepEqual(first.map(({ key }) => key), ['parent-stem', 'child-bus', 'child-a', 'child-b'])
  assert.deepEqual(reordered.map(({ key }) => key), ['parent-stem', 'child-bus', 'child-b', 'child-a'])
  assert.equal(first.find(({ childId }) => childId === 'a')?.path, 'child-a-old')
  assert.equal(reordered.find(({ childId }) => childId === 'a')?.path, 'child-a-new')
})

test('temporary animation artifacts are removed on both finish and cancellation', () => {
  for (const event of ['onfinish', 'oncancel']) {
    let removed = 0
    const animation = {}
    removeMotionArtifactOnFinishOrCancel(animation, { remove: () => { removed += 1 } })
    animation[event]()
    assert.equal(removed, 1)
  }
})
