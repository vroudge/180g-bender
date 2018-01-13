import kue from 'kue';
import _ from 'lodash';

import config from '../../config';
import processors from '../processors';

let queueHolder;

export const getOrCreateQueue = () => {
    try {
        if (queueHolder) {
            return queueHolder;
        }
        queueHolder = kue.createQueue({
            redis: config.api.queue.dsn,
        });

        if (process.env.NODE_ENV !== 'production') {
            kue.app.listen(3003);
        }

        return queueHolder;
    } catch (e) {
        return Promise.reject('QUEUE_NOT_CREATED')
    }
};

export const attachQueueProcessors = async (queue) => {
    try {
        _.map(processors, (elem) => {
            const { jobName, processor, concurrency } = elem();
            queue.process(jobName, concurrency, processor);
        });

        return Promise.resolve(queue);
    } catch (e) {
        return Promise.reject(new Error('PROCESS_NOT_ATTACHED'));
    }
};

export const insertJobInQueue = async (queue, data, options) => {
    if (!data.type) {
        return Promise.reject(new Error('Error: Trying to insert a job without jobtype'));
    }

    return new Promise(function (resolve, reject) {
        const { type } = data;
        const attempts = options.attempts || 2;
        const priority = options.priority || -10;
        const removeOnComplete = options.removeOnComplete;
        const job = queue.create(type, data)
            .priority(priority)
            .attempts(attempts)
            .removeOnComplete(removeOnComplete);

        if (options.waitForCompletion) {
            job.save()
                .on('complete', () => {
                    return resolve();
                })
                .on('failed', function (errorMessage) {
                    return reject(errorMessage);
                })
        } else {
            job.save((err) => {
                if (err) {
                    return reject(err)
                }
                return resolve(job);
            });
        }
    });
};

export const getAllJobs = async (queue) => {
    return new Promise(function (resolve, reject) {
        queue.inactive(async (err, ids) => {
            if (err) return reject(err);
            return resolve(ids);
        });
    })
        .then((inactiveIds) => {
            return new Promise(function (resolve, reject) {
                queue.active(async (err, ids) => {
                    if (err) return reject(err);
                    return resolve(_.union(ids, inactiveIds));
                });
            });

        })
};

export const getOneJobById = async (queue, jobId) => {
    return new Promise((resolve, reject) => {
        kue.Job.get(jobId, (err, job) => {
            if (err) return reject(err);
            return resolve(job);
        });
    });
};

