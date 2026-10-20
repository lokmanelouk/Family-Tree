import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyMember } from '../types/family'
import { saveTreeChanges } from '../lib/storage/supabase-tree-storage'

export type SaveStatus = 'saved' | 'saving' | 'error'

export function useTreePersistence(treeId: string, members: FamilyMember[], enabled = true) {
  const savedMembers = useRef(members)
  const latestMembers = useRef(members)
  const firstRender = useRef(true)
  const queue = useRef(Promise.resolve())
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState('')
  useEffect(() => {
    latestMembers.current = members
  }, [members])

  const enqueue = useCallback((snapshot: FamilyMember[]) => {
    queue.current = queue.current.catch(() => undefined).then(async () => {
      setStatus('saving')
      setError('')
      try {
        await saveTreeChanges(treeId, savedMembers.current, snapshot)
        savedMembers.current = snapshot
        setStatus('saved')
      } catch (cause) {
        setStatus('error')
        setError(cause instanceof Error ? cause.message : 'Could not save changes.')
      }
    })
  }, [treeId])

  useEffect(() => {
    if (!enabled) return
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    enqueue(members)
  }, [enabled, enqueue, members])

  const retry = useCallback(() => enqueue(latestMembers.current), [enqueue])
  return { status, error, retry }
}
