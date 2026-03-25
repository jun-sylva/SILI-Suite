import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Récupérer le token depuis le header Authorization
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 })
    }

    // 2. Vérifier l'identité via le token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    // 3. Vérifier que c'est bien un Master
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // 4. Lire le body
    const { action, level, service, message, resourceType, resourceId, metadata, notification } = await req.json()

    if (!action || !level || !service || !message) {
      return NextResponse.json({ error: 'action, level, service et message sont requis' }, { status: 400 })
    }

    // 5. Écrire dans master_audit_logs
    const { error: auditError } = await supabaseAdmin.from('master_audit_logs').insert({
      actor_id: user.id,
      action,
      level,
      service,
      message,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      metadata: metadata ?? {},
      ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
    })

    if (auditError) {
      console.error('[audit-and-notify] master_audit_logs error:', auditError.message)
      return NextResponse.json({ error: auditError.message }, { status: 500 })
    }

    // 6. Notifier tous les Masters
    if (notification) {
      const { titre, message: notifMessage, type = 'info', data = {} } = notification

      const { data: masters, error: mastersError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_super_admin', true)

      if (mastersError) {
        console.error('[audit-and-notify] profiles error:', mastersError.message)
        return NextResponse.json({ error: mastersError.message }, { status: 500 })
      }

      if (masters && masters.length > 0) {
        const { error: notifError } = await supabaseAdmin.from('notifications').insert(
          masters.map((m: { id: string }) => ({
            user_id: m.id,
            tenant_id: null,
            type,
            titre,
            message: notifMessage,
            data,
            is_read: false,
          }))
        )
        if (notifError) {
          console.error('[audit-and-notify] notifications error:', notifError.message)
          return NextResponse.json({ error: notifError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[audit-and-notify] unexpected:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
