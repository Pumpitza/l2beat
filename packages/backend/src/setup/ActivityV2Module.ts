import { HttpClient, Logger } from '@l2beat/common'
import { ProjectId } from '@l2beat/types'

import { ActivityV2Controller } from '../api/controllers/ActivityV2Controller'
import { createActivityV2Router } from '../api/routers/ActivityV2Router'
import { Config } from '../config'
import { DailyTransactionCountService } from '../core/activity/DailyTransactionCountService'
import { Clock } from '../core/Clock'
import { SequenceProcessor } from '../core/SequenceProcessor'
import { DailyTransactionCountViewRepository } from '../peripherals/database/activity-v2/DailyTransactionCountRepository'
import { Database } from '../peripherals/database/shared/Database'
import { createSequenceProcessors } from './createSequenceProcessors'

export function getActivityV2Module(
  config: Config,
  logger: Logger,
  http: HttpClient,
  database: Database,
  clock: Clock,
) {
  if (!config.activityV2) {
    return undefined
  }

  const processors: SequenceProcessor[] = createSequenceProcessors(
    config,
    logger,
    http,
    database,
    clock,
  )
  const dailyCountViewRepository = new DailyTransactionCountViewRepository(
    database,
    logger,
  )
  const dailyCountService = new DailyTransactionCountService(
    processors,
    dailyCountViewRepository,
    clock,
    logger,
  )
  const activityController = new ActivityV2Controller(
    processors
      .filter((processor) =>
        config.projects.some(
          (p) =>
            p.projectId.toString() === processor.id &&
            !p.transactionApi?.excludeFromActivityApi,
        ),
      )
      .map((p) => ProjectId(p.id)),
    dailyCountService,
  )
  const router = createActivityV2Router(activityController)

  const start = () => {
    logger.info('Starting Activity V2 Module')
    processors.forEach((p) => p.start())
    dailyCountService.start()
    logger.info('Started Activity V2 Module')
  }

  return {
    router,
    start,
  }
}
