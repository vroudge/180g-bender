import _ from 'lodash';
import scrapeIt from 'scrape-it';

export default async ({variants, retailerId}) => {
    const checkAvailability = await Promise.all(
        _.map(variants, async (variant, variantId) => {
            const {data} = await scrapeIt({
                url: variant.shopId,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36',
                },
            }, {
                available: {
                    selector: `.purchase input`,
                    attr: 'value',
                    convert: x => x && x === 'Add to Cart'
                },
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
