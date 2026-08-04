"use client"

import ComingSoon from "@/components/ComingSoon"
import { useLocale } from "@/lib/i18n/translate"

export default function LivestreamsPage() {
  const { t: tr } = useLocale()
  return <ComingSoon title={tr.livestreamsPage.title} description={tr.livestreamsPage.description} />
}
