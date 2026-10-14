import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LanguageContext, type Language } from './LanguageContext'

const arabic: Record<string, string> = {
  'Born': '\u0648\u0644\u062F', 'Died': '\u062A\u0648\u0641\u064A', 'Present': '\u062D\u062A\u0649 \u0627\u0644\u0622\u0646', 'More options': '\u062E\u064A\u0627\u0631\u0627\u062A \u0623\u062E\u0631\u0649',
  'Enter a year from 1000 onward.': 'أدخل سنة تبدأ من 1000 أو بعدها.',
  'Birth dates cannot be in the future.': 'لا يمكن أن يكون تاريخ الميلاد في المستقبل.',
  'Enter a month from 01 to 12.': 'أدخل شهرًا من 01 إلى 12.',
  'Enter a valid day for this month.': 'أدخل يومًا صالحًا لهذا الشهر.',
  'Enter a four-digit year or complete date.': 'أدخل سنة من أربعة أرقام أو تاريخًا كاملًا.',
  'Gender': 'الجنس', 'Male': 'ذكر', 'Female': 'أنثى', 'Father': 'الأب', 'Mother': 'الأم',
  'Select father': 'اختر الأب', 'Select mother': 'اختر الأم', 'Choose one existing father and one existing mother to place this person in the tree.': 'اختر أبًا وأمًا موجودين لإضافة هذا الفرد إلى الشجرة.',
  'Profile photo': 'الصورة الشخصية',
  'Edit': 'تعديل',
  'Choose preset avatar': 'اختر صورة رمزية',
  'Upload photo': 'رفع صورة',
  'Birth date optional': 'تاريخ الميلاد (اختياري)',
  'Male Avatars': 'صور للذكور',
  'Female Avatars': 'صور للإناث',
  'Edit profile photo': 'تعديل الصورة الشخصية',
  'Choose a preset avatar': 'اختر صورة رمزية',
  'Center tree': 'توسيط الشجرة',
  'Settings': 'الإعدادات',
  'Drag a person onto a relative to propose a relationship change. Confirm it before the tree updates.': 'اسحب فردًا إلى قريب لاقتراح تغيير العلاقة. أكّد التغيير قبل تحديث الشجرة.',
  'FAMILY WORKSPACE': 'مساحة العائلة', 'Morgan family tree': 'شجرة عائلة مورغان', 'Add person': 'إضافة فرد',
  'Family tree': 'شجرة العائلة', 'people': 'أفراد', 'generations': 'أجيال', 'Drag a person onto a relative to propose a relationship change.': 'اسحب فردًا إلى قريب لاقتراح تغيير في صلة القرابة.',
  'Search family members': 'البحث عن أفراد العائلة', 'Find a person (Ctrl+K)': 'ابحث عن فرد (Ctrl+K)', 'Clear search': 'مسح البحث', 'No family members found': 'لم يتم العثور على أفراد',
  'Zoom out': 'تصغير', 'Zoom in': 'تكبير', 'Fit tree to screen': 'ملاءمة الشجرة للشاشة', 'Rectangle cards': 'بطاقات مستطيلة', 'Circle portraits': 'صور دائرية',
  'Expand all branches': 'توسيع كل الفروع', 'Collapse all branches': 'طي كل الفروع', 'Focus selected family': 'التركيز على العائلة المحددة', 'Undo': 'تراجع', 'Redo': 'إعادة',
  'Export and backup': 'تصدير ونسخ احتياطي', 'Export full tree': 'تصدير الشجرة كاملة', 'Export selected branch': 'تصدير الفرع المحدد', 'Restore backup': 'استعادة نسخة احتياطية',
  'Switch to light theme': 'التبديل إلى المظهر الفاتح', 'Switch to dark theme': 'التبديل إلى المظهر الداكن', 'Language': 'اللغة', 'Theme': 'المظهر',
  'Charcoal': 'فحمي', 'Blue slate': 'أزرق أردوازي', 'Soft light': 'فاتح هادئ',
  'WORKSPACE': 'مساحة العمل', 'Family members': 'أفراد العائلة', 'Family navigation': 'التنقل العائلي', 'Quick stats': 'إحصاءات سريعة', 'Members': 'الأفراد', 'Generations': 'الأجيال', 'Branches': 'الفروع', 'Go to {name}': 'الانتقال إلى {name}', 'Add a family member to see branches here.': 'أضف فردًا من العائلة لعرض الفروع هنا.', 'Family tree preview': 'معاينة شجرة العائلة', 'PERSON DETAILS': 'تفاصيل الفرد', 'Close details': 'إغلاق التفاصيل',
  'Birth date unknown': 'تاريخ الميلاد غير معروف', 'Parents': 'الوالدان', 'No parents linked': 'لا توجد صلة بالوالدين', 'Partners': 'الشركاء', 'No partners linked': 'لا يوجد شركاء',
  'Siblings': 'الإخوة والأخوات', 'No siblings linked': 'لا توجد صلة بالإخوة', 'Children': 'الأبناء', 'No children linked': 'لا يوجد أبناء', 'Add relative': 'إضافة قريب', 'Parent': 'والد', 'Child': 'ابن', 'Partner': 'شريك', 'Sibling': 'أخ أو أخت', 'Delete family member': 'حذف فرد من العائلة',
  'YOUR PEOPLE': 'أفراد عائلتك', 'Close family members': 'إغلاق أفراد العائلة', 'Your family tree starts here': 'تبدأ شجرة عائلتك هنا', 'Add a family member to plant the first branch.': 'أضف فردًا لبدء أول فرع.', 'Add first member': 'إضافة أول فرد',
  'Propose a relationship change': 'اقتراح تغيير صلة قرابة', 'Dragging only proposes a change. Review it below and confirm before family connections update.': 'السحب يقترح تغييرًا فقط. راجع التفاصيل وأكد قبل تحديث صلات القرابة.', 'Relationship': 'صلة القرابة', 'Link them as partners': 'ربطهما كشريكين', 'Link them as siblings': 'ربطهما كأخوين', 'Cancel': 'إلغاء', 'Confirm change': 'تأكيد التغيير',
  'Add a family member': 'إضافة فرد من العائلة', 'Name': 'الاسم', 'Birth date': 'تاريخ الميلاد', 'optional': 'اختياري', 'Full name': 'الاسم الكامل', 'Relationship to': 'صلة القرابة بـ', 'Related family member': 'فرد العائلة المرتبط', 'This person will start your family tree.': 'سيبدأ هذا الفرد شجرة عائلتك.',
  'Possible match': 'تطابق محتمل', 'Possible matches': 'تطابقات محتملة', 'A person with this name and birth date is already in the tree. Select them or verify this is another person.': 'يوجد فرد بهذا الاسم وتاريخ الميلاد في الشجرة. اختره أو تحقق من أنه شخص آخر.', 'Someone has the same name. Compare details; people are never merged automatically.': 'يوجد شخص بالاسم نفسه. قارن التفاصيل؛ لا يتم دمج الأشخاص تلقائيًا.',
  'Relationship change': 'تغيير صلة القرابة', 'Confirm': 'تأكيد', 'Delete person': 'حذف الفرد', 'Restore this family tree?': 'استعادة شجرة العائلة؟',
  'This file is not a valid family tree backup.': 'هذا الملف ليس نسخة احتياطية صالحة لشجرة العائلة.', 'Could not restore this backup.': 'تعذرت استعادة هذه النسخة الاحتياطية.',
  'Expand sidebar': 'توسيع الشريط الجانبي', 'Collapse sidebar': 'طي الشريط الجانبي', 'Undo (Ctrl+Z)': 'تراجع (Ctrl+Z)', 'Redo (Ctrl+Shift+Z)': 'إعادة (Ctrl+Shift+Z)',
  'Tree display mode': 'طريقة عرض الشجرة', 'Root family branches': 'فروع العائلة الرئيسية', 'FAMILY TREE': 'شجرة العائلة',
  'Add a child of {name}': 'إضافة ابن لـ {name}', 'Add a relative to {name}': 'إضافة قريب لـ {name}', 'Add child': 'إضافة ابن', 'Add partner': 'إضافة شريك',
  'Family relationship updated.': 'تم تحديث صلة القرابة.', 'Family member added to the tree.': 'تمت إضافة فرد إلى الشجرة.', 'Family tree backup restored.': 'تمت استعادة نسخة شجرة العائلة.',
  'Selected branch exported.': 'تم تصدير الفرع المحدد.', 'Full tree backup exported.': 'تم تصدير نسخة الشجرة كاملة.',
  'A person cannot be related to themselves.': 'لا يمكن أن يكون الشخص قريبًا لنفسه.', 'One of those family members could not be found.': 'تعذر العثور على أحد أفراد العائلة.', 'These family members are already partners.': 'هذان الشخصان شريكان بالفعل.', 'Siblings cannot be linked as partners.': 'لا يمكن ربط الإخوة كشريكين.', 'A person cannot partner with their ancestor or descendant.': 'لا يمكن للشخص الارتباط بأحد أصوله أو ذريته.', 'These family members are already siblings.': 'هذان الشخصان شقيقان بالفعل.', 'An ancestor and descendant cannot be linked as siblings.': 'لا يمكن ربط الأصل والذرية كأشقاء.', 'That parent relationship already exists.': 'صلة الوالد هذه موجودة بالفعل.', 'That would create a family cycle. A descendant cannot become an ancestor.': 'سينشأ عن ذلك تسلسل دائري. لا يمكن للذرية أن تصبح أصلًا.',
  'Link them as partners.': 'ربطهما كشريكين.', 'Link them as siblings.': 'ربطهما كأخوين.', 'This removes this person and their relationship links from the tree. Other family members will stay in the tree.': 'سيؤدي ذلك إلى إزالة هذا الفرد وصلاته من الشجرة. سيبقى بقية أفراد العائلة.', 'Delete {name}?': 'حذف {name}؟', 'The selected backup contains {count} people and will replace the current tree. You can undo the restore afterward.': 'تحتوي النسخة المحددة على {count} أفراد وستستبدل الشجرة الحالية. يمكنك التراجع عن الاستعادة لاحقًا.',
  '{source} will become a parent of {target}.': 'سيصبح {source} والدًا لـ {target}.', '{source} will become a child of {target}.': 'سيصبح {source} ابنًا لـ {target}.', '{source} and {target} will be linked as partners.': 'سيتم ربط {source} و{target} كشريكين.', '{source} will be linked as a sibling of {target}.': 'سيتم ربط {source} و{target} كأخوين.', 'Make {source} a parent of {target}.': 'اجعل {source} والدًا لـ {target}.', 'Make {source} a child of {target}.': 'اجعل {source} ابنًا لـ {target}.',
  'Close dialog': 'إغلاق النافذة', 'Drag to propose a relationship change': 'اسحب لاقتراح تغيير صلة القرابة', 'Drag {name} to propose a relationship change': 'اسحب {name} لاقتراح تغيير صلة القرابة', 'Expand branch': 'توسيع الفرع', 'Collapse branch': 'طي الفرع', 'Expand branch for {name}': 'توسيع فرع {name}', 'Collapse branch for {name}': 'طي فرع {name}',
  '{name} was removed from the tree.': 'تمت إزالة {name} من الشجرة.', 'Relationships change only after you confirm.': 'لا تتغير صلات القرابة إلا بعد التأكيد.',
  'Switch language to Arabic': 'التبديل إلى العربية', 'Switch language to English': 'التبديل إلى الإنجليزية', 'Close actions menu': 'إغلاق قائمة الإجراءات',
  'Grandfather': 'الجد', 'Grandmother': 'الجدة', 'Son': 'الابن', 'Daughter': 'الابنة', 'Daughter-in-law': 'زوجة الابن', 'Family founder': 'مؤسس العائلة',
  'Mark partners as divorced': 'تسجيل الطلاق بين الشريكين', 'Make {source} adoptive parent of {target}.': 'اجعل {source} والدًا بالتبني لـ {target}.',
  '{source} and {target} will be marked as divorced.': 'سيتم تسجيل الطلاق بين {source} و{target}.', '{source} will be recorded as an adoptive parent of {target}.': 'سيتم تسجيل {source} كوالد بالتبني لـ {target}.',
  'Only current partners can be marked as divorced.': 'يمكن تسجيل الطلاق للشركاء الحاليين فقط.', 'That adoption relationship already exists.': 'علاقة التبني هذه موجودة بالفعل.',
}

function initialLanguage(): Language {
  try { return localStorage.getItem('family-tree-language') === 'ar' ? 'ar' : 'en' } catch { return 'en' }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    try { localStorage.setItem('family-tree-language', language) } catch { /* Preferences remain usable when storage is unavailable. */ }
  }, [language])
  const value = useMemo(() => ({ language, setLanguage, t: (message: string, values?: Record<string, string | number>) => {
    const translated = language === 'ar' ? arabic[message] ?? message : message
    return Object.entries(values ?? {}).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), translated)
  } }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
