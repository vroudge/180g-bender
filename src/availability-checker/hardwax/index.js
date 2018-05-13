import _ from 'lodash';
import scrapeIt from 'scrape-it';

export default async ({variants, retailerId}) => {
    const checkAvailability = await Promise.all(
        _.map(variants, async (variant, variantId) => {
            const {data} = await scrapeIt(variant.shopId, {
                available: {
                    selector: `.add_order.fright`,
                    convert: x => x && !x.includes('out of stock')
                }
            });

            return {...variant, available: data.available};
        })
    );

    if (_.filter(checkAvailability, 'available').length === 0) {
        return {type: 'all-unavailable', retailerId, variants};
    }

    return {
        type: 'get-availability',
        retailerId,
        variants: checkAvailability
    };
}
