import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Service role key — côté serveur uniquement, jamais exposé au client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[create-user] SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d\'environnement')
    return NextResponse.json({ error: 'Configuration serveur incomplète (service role key manquante)' }, { status: 500 })
  }

  try {
    const { email, password, fullName, phone, role, tenantId, assignedSocieteIds } = await req.json()

    if (!email || !password || !fullName || !tenantId) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }
    if (!['tenant_admin', 'tenant_user'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    // 1. Créer le compte auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // pas d'email de confirmation requis
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Créer/compléter le profil
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      full_name: fullName,
      phone: phone || null,
      role,
      tenant_id: tenantId,
      is_active: true,
    })

    if (profileError) {
      // Rollback : supprimer l'utilisateur auth créé
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // 3. Assigner les sociétés pour tenant_user
    if (role === 'tenant_user' && Array.isArray(assignedSocieteIds) && assignedSocieteIds.length > 0) {
      const rows = assignedSocieteIds.map((societeId: string) => ({
        user_id: authData.user.id,
        societe_id: societeId,
        is_active: true,
      }))
      const { error: assignError } = await supabaseAdmin.from('user_societes').insert(rows)
      if (assignError) {
        // Rollback complet
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: assignError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (err) {
    console.error('[create-user] Erreur inattendue:', err)
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 })
  }
}
