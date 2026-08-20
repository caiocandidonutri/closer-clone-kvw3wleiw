import { useEffect, useState, useCallback } from 'react'
import type { Patient, SubscriptionPlan, SubscriptionPlanSlug } from '@/lib/types'
import {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  renewPatient,
  releasePatientMessages,
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

  const releaseMessages = async (id: string, bonusAmount = 5) => {
    try {
      const p = await releasePatientMessages(id, bonusAmount)
      setPatients((prev) => prev.map((x) => (x.id === id ? p : x)))
      toast.success(`+${bonusAmount} mensagens liberadas para o paciente!`)
      return p
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao liberar mensagens')
      throw err
    }
  }

  const getById = async (id: string) => {
    const cached = patients.find((p) => p.id === id)
    if (cached) return cached
    return await getPatient(id)
  }

  return {
    patients,
    loading,
    create,
    update,
    remove,
    renew,
    releaseMessages,
    getById,
    refetch: fetchPatients,
  }
}

export const usePlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPlans = useCallback(async () => {
    try {
      const data = await listPlans()
      setPlans(data)
      return data
    } catch (err) {
      console.error('[usePlans] fetch error:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  return { plans, loading, refetch: fetchPlans }
}
