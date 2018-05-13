import puppeteer from 'puppeteer';
import shortUid from 'short-uid';
import _ from 'lodash';
import rimraf from 'rimraf';

import * as AvCheckers from '../../availability-checker'
import logger from '../../lib/logger'
import * as Benders from "../../benders";

export default (job, ctx, done) => ({
    jobName: 'get-availability',
    concurrency: 1,
    processor: async (job, ctx, done) => {


        let result;
        try {
            const {retailers, cart} = job.data;
            const orderRaw = cart.content.vinyls;

            const order = _.map(orderRaw, (elem, key) => {
                const retailerForVariant = _.find(retailers, retailer => retailer.id === elem.retailerId).name;

                if (!retailerForVariant) {
                    throw new Error('UNSUPPORTED_RETAILER');
                }

                elem.variantId = key;
                elem.retailer = retailerForVariant;

                return elem;
            });

            const variants = _.reduce(order, (acc, elem) => {
                const {variantId, shopId} = elem;

                if (!acc[elem.retailer]) {
                    acc[elem.retailer] = {arr: [], retailerId: elem.retailerId};
                }

                for (let quantity of _.range(elem.quantity)) {
                    acc[elem.retailer].arr.push({variantId, shopId});
                }

                return acc;
            }, {});
            result = await Promise.all(
                _.map(variants, async (elem, key) => {
                    return (await AvCheckers[key]({
                        variants: elem.arr,
                        retailerId: parseInt(elem.retailerId),
                    }));
                })
            );
        } catch (e) {
            logger.err(`4 - Error in get-availability`, {...e, stack: e.stack});

            return done(e);
        }

        return done(null, JSON.stringify(result));
    },
});
