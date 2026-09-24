import { usePortfolioPlanner } from './model/usePortfolioPlanner'
import { PortfolioPlannerPage } from './ui/PortfolioPlannerPage'

export function PortfolioPlanner() {
  return <PortfolioPlannerPage model={usePortfolioPlanner()} />
}
