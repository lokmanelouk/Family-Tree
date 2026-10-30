import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Camera, Check, ChevronRight, ImagePlus, Upload } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { useLanguage } from '../../i18n/useLanguage'
import { isSupportedPhotoType } from '../../lib/photo-file'
import { AvatarIllustration } from './AvatarIllustration'

const avatarGroups = [
  { id: 'male', label: 'Male Avatars' },
  { id: 'female', label: 'Female Avatars' },
] as const

type ProfileAvatarPickerProps = {
  avatarId: string
  avatar: FamilyMember['avatar']
  photo: string
  error: string
  onChange: (avatarId: string, photo: string) => void
  onError: (message: string) => void
}

export function ProfileAvatarPicker({ avatarId, avatar, photo, error, onChange, onError }: ProfileAvatarPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const presetGridRef = useRef<HTMLDivElement>(null)
  const presetMenuItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setShowPresets(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (showPresets) {
        setShowPresets(false)
        requestAnimationFrame(() => presetMenuItemRef.current?.focus())
      } else {
        setOpen(false)
        avatarRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, showPresets])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isSupportedPhotoType(file.type)) {
      onError(t('Choose a PNG, JPG, or WebP image.'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      onError(t('Photo must be 2 MB or smaller.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(avatarId, reader.result)
        onError('')
        setOpen(false)
        setShowPresets(false)
        avatarRef.current?.focus()
      } else onError(t('Could not read this photo.'))
    }
    reader.onerror = () => onError(t('Could not read this photo.'))
    reader.readAsDataURL(file)
  }

  function choosePreset(presetId: string) {
    onChange(presetId, '')
    onError('')
    setOpen(false)
    setShowPresets(false)
    avatarRef.current?.focus()
  }

  function openPresets() {
    setShowPresets(true)
    requestAnimationFrame(() => presetGridRef.current?.querySelector<HTMLButtonElement>('button')?.focus())
  }

  return <div className="profile-avatar-picker" ref={rootRef}>
    <button ref={avatarRef} className="profile-avatar-trigger" type="button" aria-label={t('Edit profile photo')} aria-haspopup="dialog" aria-expanded={open} aria-controls={menuId} onClick={() => { setOpen((current) => !current); setShowPresets(false) }}>
      {photo ? <img className="profile-avatar-image" src={photo} alt="" /> : <AvatarIllustration avatar={avatar} name={t('Selected illustrated avatar')} compact />}
      <span className="profile-avatar-edit-overlay"><Camera size={18} aria-hidden="true" /><span>{t('Edit')}</span></span>
    </button>
    {open && <div className="profile-avatar-menu" id={menuId} role="dialog" aria-label={t('Edit profile photo')}>
      {showPresets ? <>
        <div className="profile-avatar-menu-heading"><button type="button" aria-label={t('Back')} onClick={() => { setShowPresets(false); requestAnimationFrame(() => presetMenuItemRef.current?.focus()) }}><ArrowLeft size={14} /></button><strong>{t('Choose preset avatar')}</strong></div>
        {avatarGroups.map(({ id: group, label }) => <section className="avatar-preset-group" key={group} aria-label={t(label)}>
          <h3>{t(label)}</h3>
          <div className="avatar-preset-grid" ref={presetGridRef}>
            {avatarPresets.filter((preset) => preset.group === group).map((preset) => <button key={preset.id} type="button" className="avatar-preset-option" aria-label={t(preset.label)} onClick={() => choosePreset(preset.id)}>
              <AvatarIllustration avatar={preset.avatar} name={t(preset.label)} compact />
              {preset.id === avatarId && !photo && <span className="avatar-preset-check"><Check size={11} aria-hidden="true" /></span>}
            </button>)}
          </div>
        </section>)}
      </> : <div className="profile-avatar-menu-actions">
        <button ref={presetMenuItemRef} type="button" onClick={openPresets}><ImagePlus size={15} aria-hidden="true" /><span>{t('Choose preset avatar')}</span><ChevronRight className="submenu-chevron" size={14} aria-hidden="true" /></button>
        <button type="button" onClick={() => fileInputRef.current?.click()}><Upload size={15} aria-hidden="true" /><span>{t('Upload photo')}</span></button>
        <input ref={fileInputRef} className="profile-avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('Upload photo')} onChange={handleFileChange} />
      </div>}
    </div>}
    {error && <p className="photo-upload-error" role="alert">{error}</p>}
  </div>
}
