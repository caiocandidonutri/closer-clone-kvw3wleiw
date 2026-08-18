import { useEffect, useState, useCallback } from 'react'
import type { Patient, SubscriptionPlan, SubscriptionPlanSlug } from '@/lib/types'
import {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
  renewPatient,
  listPlans,
  CreatePatientInput,
} from '@/services/patients'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const usePatients = () => {
  const { user } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPatients = useCallback(async () => {
    if (!user) {
      setPatients([])
      setLoading(false)
      return
    }
    try {
      const data = await listPatients()
      setPatients(data)
    } catch (err) {
      console.error('[usePatients] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  const create = async (input: CreatePatientInput) => {
    try {
      const p = await createPatient(input)
      setPatients((prev) => [p, ...prev])
      toast.success('Paciente cadastrado! Convite enviado pelo WhatsApp.')
      return p
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao cadastrar paciente')
      throw err
    }
  }

  const update = async (id: string, patch: Partial<Patient>) => {
    try {
      const p = await updatePatient(id, patch)
      setPatients((prev) => prev.map((x) => (x.id === id ? p : x)))
      toast.success('Paciente atualizado')
      return p
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao atualizar paciente')
      throw err
    }
  }

  const remove = async (id: string) => {
    try {
      await deletePatient(id)
      setPatients((prev) => prev.filter((x) => x.id !== id))
      toast.success('Paciente removido')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao remover paciente')
    }
  }

  const renew = async (id: string, plan: SubscriptionPlanSlug) => {
    try {
      const p = await renewPatient(id, plan)
      setPatients((prev) => prev.map((x) => (x.id === id ? p : x)))
      toast.success('Assinatura renovada!')
      return p
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao renovar assinatura')
      throw err
    }
  }

  return { patients, loading, create, update, remove, renew, refetch: fetchPatients }
}

export const usePlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await listPlans()
        if (!cancelled) setPlans(data)
      } catch (err) {
        console.error('[usePlans] fetch error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { plans, loading }
}
