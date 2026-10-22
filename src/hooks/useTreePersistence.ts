import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyMember } from '../types/family'
import { saveTreeChanges } from '../lib/storage/supabase-tree-storage'
import { getTreeSaveErrorKey } from '../lib/storage/save-errors'

export type SaveStatus = 'saved' | 'saving' | 'error'

export function useTreePersistence(treeId: string, members: FamilyMember[], enabled = true, onRollback?: (members: FamilyMember[]) => void) {
  const savedMembers = useRef(members)
  const onRollbackRef = useRef(onRollback)
  const firstRender = useRef(true)
  const requestRevision = useRef(0)
  const failed = useRef(false)
  const queue = useRef(Promise.resolve())
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState('')
  useEffect(() => { onRollbackRef.current = onRollback }, [onRollback])

  const enqueue = useCallback((snapshot: FamilyMember[]) => {
    if (snapshot === savedMembers.current) return
    if (failed.current) failed.current = false
    const revision = ++requestRevision.current
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (revision !== requestRevision.current || failed.current) return
      setStatus('saving')
      setError('')
      try {
        await saveTreeChanges(treeId, savedMembers.current, snapshot)
        savedMembers.current = snapshot
        setStatus('saved')
      } catch (cause) {
        failed.current = true
        requestRevision.current += 1
        setStatus('error')
        setError(getTreeSaveErrorKey(cause))
        onRollbackRef.current?.(savedMembers.current)
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

  const adoptSnapshot = useCallback((snapshot: FamilyMember[]) => {
    requestRevision.current += 1
    failed.current = false
    savedMembers.current = snapshot
    setError('')
    setStatus('saved')
  }, [])

  return { status, error, adoptSnapshot }
}
