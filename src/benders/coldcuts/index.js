import config from '../../config';
import logger from '../../lib/logger';
import _ from 'lodash';

export default class emile {
    constructor(browserInstance, {retailerId, variants, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        try {
            const {variants, bro} = this;
            this.page = await bro.newPage();
            await this.page.setRequestInterceptionEnabled(true);
            this.page.on('request', request => {
                const intercepted = ['image', 'font'];

                if (intercepted.includes(request.resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            logger.nfo('Begin coldcuts bender', this.variants);

            for (const [value, index] of variants.entries()) {
                await this.page.goto(index.shopId);
                await this.page.waitFor(1500);
                logger.nfo('coldcuts done goto');
                const itemIsAvailable = await this.page.evaluate(() => {
                    return document.querySelectorAll('#add-to-cart').length !== 0;
                });
                logger.nfo('coldcuts item available');
                this.variants[value].available = itemIsAvailable;

                if (itemIsAvailable) {
                    await this.page.evaluate(() => {
                        document.querySelector(`#add-to-cart`).click();
                    });
                    logger.nfo('coldcuts item added to cart');
                    await this.page.waitFor(1000);
                } else {
                    const allUnavailable = _.filter(variants, 'available').length === 0;
                    const endOfArray = value + 1 === variants.length;

                    if (endOfArray && allUnavailable) {
                        return {type: 'all-unavailable', retailerId: this.retailerId, variants}
                    }
                }
            }
            await this.page.goto(`https://www.coldcutshotwax.uk/checkout`);
            logger.nfo('coldcuts gotocheckout');
            await this.fillShippingInfos();
            logger.nfo('coldcuts done filling');
            await this.page.click(`form > div.step__footer > button`);
            logger.nfo('coldcuts done clicking next');
            await this.page.waitForSelector(`label > span.radio__label__accessory > span`);
            logger.nfo('coldcuts done wait selector');
            const shippingPriceRaw = await this.page.evaluate(() => {
                return document.querySelectorAll('label > span.radio__label__accessory > span')[1].textContent;
            });
            logger.nfo('coldcuts done shipping price');
            const shippingPrice = shippingPriceRaw.replace(/\s/g, '').replace(`£`, ``);

            logger.nfo('End coldcuts bender', this.variants);

            if (checkout) {

            } else {
                return {
                    type: 'shipping',
                    retailerId: this.retailerId,
                    shipping: {price: parseFloat(shippingPrice), currency: 'gbp'},
                    variants
                };
            }
        } catch (e) {
            logger.nfo(`Error in coldcuts`, {error: e, stack: e.stack})
        }
    }

    async fillShippingInfos() {
        await this.page.type(`#checkout_email`, config.gram.email);
        await this.page.evaluate((country) => {
            document.querySelector(`#checkout_shipping_address_country > option[data-code="${country.toUpperCase()}"]`).selected = true;
            document.querySelector('#checkout_shipping_address_country').dispatchEvent(new Event('change', {'bubbles': true}));
        }, this.destinationAddress.country);
        await this.page.type(`#checkout_shipping_address_first_name`, this.destinationAddress.first_name);
        await this.page.type(`#checkout_shipping_address_last_name`, this.destinationAddress.last_name);
        await this.page.type(`#checkout_shipping_address_address1`, this.destinationAddress.line1);
        await this.page.type(`#checkout_shipping_address_address2`, this.destinationAddress.line2);
        await this.page.type(`#checkout_shipping_address_city`, this.destinationAddress.city);
        await this.page.type(`#checkout_shipping_address_zip`, this.destinationAddress.zip);
        await this.page.type(`#checkout_shipping_address_phone`, config.gram.phone);
    }
}
