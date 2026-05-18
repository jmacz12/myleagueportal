'use client'

import { useState } from 'react'
import { DashboardHelpDialog } from '@/components/dashboard/DashboardHelpDialog'
import { DashboardHowItWorksButton } from '@/components/dashboard/DashboardHowItWorksButton'
import {
  getDashboardHelpTopic,
  type DashboardHelpTopic,
} from '@/components/dashboard/dashboard-help-topics'

type DashboardHelpLauncherProps = {
  topic: DashboardHelpTopic
}

export function DashboardHelpLauncher({ topic }: DashboardHelpLauncherProps) {
  const [open, setOpen] = useState(false)
  const meta = getDashboardHelpTopic(topic)

  return (
    <>
      <DashboardHowItWorksButton onClick={() => setOpen(true)} />
      <DashboardHelpDialog
        open={open}
        onClose={() => setOpen(false)}
        title={meta.title}
        subtitle={meta.subtitle}
        titleId={meta.titleId}
      >
        {meta.body}
      </DashboardHelpDialog>
    </>
  )
}
