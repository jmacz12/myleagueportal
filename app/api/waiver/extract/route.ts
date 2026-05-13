import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { isBasic } from '@/lib/org-plan-tier'
import * as pdfParseModule from 'pdf-parse'

type PdfParseFn = (data: Buffer) => Promise<{ text: string }>
const pdfParse: PdfParseFn =
  'default' in pdfParseModule && typeof pdfParseModule.default === 'function'
    ? (pdfParseModule.default as PdfParseFn)
    : (pdfParseModule as unknown as PdfParseFn)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  if (isBasic(org.plan)) {
    return NextResponse.json({ error: 'PDF extraction is a Pro/Enterprise feature' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const parsed = await pdfParse(buffer)
  const text = parsed.text?.trim()

  if (!text) return NextResponse.json({ error: 'Could not extract text. Make sure it is not a scanned image.' }, { status: 500 })

  return NextResponse.json({ text })
}