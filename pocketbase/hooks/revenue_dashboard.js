/// <reference path="../pb_data/types.d.ts" />
// Revenue Dashboard metrics endpoint:
// GET /backend/v1/dashboard/revenue
//
// Calculates:
// - mrr: sum of monthly equivalent value of active patients.
//   "weekly" = 29.90 * 4.33, "monthly" = 79.90, "quarterly" = 199.90 / 3
// - total_revenue: active patients * plan price (or accumulated plan values)
// - expiring_soon: array of patients whose subscription_end is in <= 3 days (and >= now - 1 day)
// - plan_distribution: object { free: N, weekly: N, monthly: N, quarterly: N }
// - overdue: array of patients with subscription_end < now and status != 'cancelled' (or status in ('expired', 'inactive') with past end)

routerAdd(
  'GET',
  '/backend/v1/dashboard/revenue',
  (e) => {
    let ownerId = ''
    const authRecord = e.auth
    if (authRecord && authRecord.id) {
      ownerId = authRecord.id
    }

    // Fallback: resolve admin/default owner if unauthenticated or single-tenant
    if (!ownerId) {
      try {
        const integ = $app.findFirstRecordByFilter(
          'integrations',
          "status = 'CONNECTED'",
          '-created',
          1,
          0,
        )
        if (integ) ownerId = integ.getString('owner')
      } catch (_) {}
    }

    if (!ownerId) {
      try {
        const adminEmail =
          $os.getenv('NUTRI_OWNER_EMAIL') ||
          $secrets.get('NUTRI_OWNER_EMAIL') ||
          'caiocandidonutri@hotmail.com'
        const admin = $app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
        if (admin) ownerId = admin.id
      } catch (_) {}
    }

    let filter = ''
    if (ownerId) {
      filter = "owner = '" + ownerId + "'"
    }

    let patients = []
    try {
      patients = $app.findRecordsByFilter('patients', filter, '-created', 1000, 0) || []
    } catch (err) {
      console.log(
        '[revenue_dashboard] error fetching patients: ' +
          (err && err.message ? err.message : String(err)),
      )
      return e.json(500, {
        error: 'Erro ao buscar dados dos pacientes',
      })
    }

    const now = new Date()
    const nowMs = now.getTime()
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000

    let mrr = 0
    let totalRevenue = 0
    let activePlansCount = 0

    const planDistribution = {
      free: 0,
      weekly: 0,
      monthly: 0,
      quarterly: 0,
    }

    const expiringSoon = []
    const overdue = []

    for (let i = 0; i < patients.length; i++) {
      const p = patients[i]
      const status = p.getString('status') || 'trial'
      const plan = (p.getString('subscription_plan') || 'free_trial').toLowerCase()
      const endStr = p.getString('subscription_end')
      const name = p.getString('name') || 'Sem Nome'
      const phone = p.getString('phone') || ''
      const email = p.getString('email') || ''
      const id = p.id

      // Plan distribution (all patients or active/trial)
      if (plan === 'weekly') {
        planDistribution.weekly++
      } else if (plan === 'monthly') {
        planDistribution.monthly++
      } else if (plan === 'quarterly') {
        planDistribution.quarterly++
      } else {
        planDistribution.free++
      }

      // Calculations for active patients
      const isActive = status === 'active'
      if (isActive) {
        activePlansCount++
        if (plan === 'weekly') {
          mrr += 29.9 * 4.33
          totalRevenue += 29.9
        } else if (plan === 'monthly') {
          mrr += 79.9
          totalRevenue += 79.9
        } else if (plan === 'quarterly') {
          mrr += 199.9 / 3
          totalRevenue += 199.9
        }
      }

      // Check subscription end date
      if (endStr) {
        const endDate = new Date(endStr)
        const diffMs = endDate.getTime() - nowMs
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

        // Expiring soon: within 3 days (0 to 3 days from now, or <= 3 days if still active/trial)
        if (
          diffMs > 0 &&
          diffMs <= threeDaysMs &&
          status !== 'cancelled' &&
          status !== 'inactive'
        ) {
          expiringSoon.push({
            id: id,
            name: name,
            phone: phone,
            email: email,
            plan: plan,
            subscription_end: endStr,
            days_left: Math.max(0, diffDays),
            status: status,
          })
        }

        // Overdue: end date passed and not cancelled
        if (endDate.getTime() < nowMs && status !== 'cancelled') {
          overdue.push({
            id: id,
            name: name,
            phone: phone,
            email: email,
            plan: plan,
            subscription_end: endStr,
            days_overdue: Math.abs(diffDays),
            status: status,
          })
        }
      }
    }

    // Round MRR and totalRevenue to 2 decimal places
    mrr = Math.round(mrr * 100) / 100
    totalRevenue = Math.round(totalRevenue * 100) / 100

    return e.json(200, {
      mrr: mrr,
      total_revenue: totalRevenue,
      active_plans: activePlansCount,
      expiring_soon: expiringSoon,
      plan_distribution: planDistribution,
      overdue: overdue,
    })
  },
  $apis.request(),
)
