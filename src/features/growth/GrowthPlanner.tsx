import { useGrowthPlanner } from './model/useGrowthPlanner'
import { GrowthPlannerPage } from './ui/GrowthPlannerPage'

export function GrowthPlanner() {
  const model = useGrowthPlanner()
  return <GrowthPlannerPage model={model} />
}
