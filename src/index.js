import { getOrCreateQueue, attachQueueProcessors } from './queue/utils'
import logger from './lib/logger'

// juno OK 100%
// rushhour OK 100%
// hardwax OK 100%
// coldcuts OK 100%
// sideone ?flow?
// emile OK 100%
// misbits OK 100%

(async () => {
    try {
        const queue = await getOrCreateQueue();
        queue && logger.log('Queue created');

        const queueWithProcessors = await attachQueueProcessors(queue);
        queueWithProcessors && logger.log('Processors attached. Ready!');
    } catch (e) {
        logger.err('error in bender main', e);
    }
})();
