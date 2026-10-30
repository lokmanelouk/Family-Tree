import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyMember } from '../types/family'
import { getLocalStorageErrorKey, saveTreeChanges, subscribeToTreeRevisions } from '../lib/storage/local-tree-storage'

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict'

export function useTreePersistence(treeId: string, members: FamilyMember[], enabled = true, onRollback?: (members: FamilyMember[]) => void, initialRevision = 0) {
  const savedMembers = useRef(members)
  const savedRevision = useRef(initialRevision)
  const onRollbackRef = useRef(onRollback)
  const firstRender = useRef(true)
  const requestRevision = useRef(0)
  const failed = useRef(false)
  const conflicted = useRef(false)
  const failedChange = useRef<{ before: FamilyMember[]; after: FamilyMember[] } | null>(null)
  const queue = useRef(Promise.resolve())
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState('')
  useEffect(() => { onRollbackRef.current = onRollback }, [onRollback])
  useEffect(() => subscribeToTreeRevisions((changedTreeId, revision) => {
    if (changedTreeId !== treeId || revision <= savedRevision.current || conflicted.current) return
    conflicted.current = true
    failed.current = true
    requestRevision.current += 1
    failedChange.current = null
    setStatus('conflict')
    setError('This tree was updated in another tab. Reload the latest version before editing.')
  }), [treeId])

  const enqueue = useCallback((snapshot: FamilyMember[]) => {
    if (snapshot === savedMembers.current) return
    if (conflicted.current) return
    if (failed.current) failed.current = false
    const revision = ++requestRevision.current
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (revision !== requestRevision.current || failed.current) return
      setStatus('saving')
      setError('')
      try {
        savedRevision.current = await saveTreeChanges(treeId, savedMembers.current, snapshot, savedRevision.current)
        savedMembers.current = snapshot
        failedChange.current = null
        setStatus('saved')
      } catch (cause) {
        failed.current = true
        requestRevision.current += 1
        if (cause instanceof Error && cause.message === 'LOCAL_TREE_CONFLICT') {
          conflicted.current = true
          failedChange.current = null
          setStatus('conflict')
          setError(getLocalStorageErrorKey(cause))
        } else {
          failedChange.current = { before: savedMembers.current, after: snapshot }
          setStatus('error')
          setError(getLocalStorageErrorKey(cause))
          onRollbackRef.current?.(savedMembers.current)
        }
      }
    })
  }, [treeId])

  useEffect(() => {
    if (!enabled) return
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (members !== savedMembers.current) enqueue(members)
  }, [enabled, enqueue, members])

  const adoptSnapshot = useCallback((snapshot: FamilyMember[], revision = savedRevision.current) => {
    requestRevision.current += 1
    failed.current = false
    conflicted.current = false
    failedChange.current = null
    savedMembers.current = snapshot
    savedRevision.current = revision
    setError('')
    setStatus('saved')
  }, [])

  const retry = useCallback(() => {
    const change = failedChange.current
    if (!change) return
    failed.current = false
    failedChange.current = null
    setError('')
    setStatus('saving')
    onRollbackRef.current?.(change.after)
  }, [])

  return { status, error, adoptSnapshot, retry }
}
