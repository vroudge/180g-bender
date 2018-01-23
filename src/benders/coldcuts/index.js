import config from '../../config';
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
        const {variants, bro} = this;
        this.page = await bro.newPage();
        try {
            await this.page.setRequestInterception(true);
            this.page.on('request', request => {
                const intercepted = ['image', 'font'];

                if (intercepted.includes(request.resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            for (const [value, index] of variants.entries()) {
                await this.page.goto(index.shopId, {waitUntil: 'networkidle0'});

                const itemIsAvailable = await this.page.evaluate(() => {
                    return document.querySelectorAll('#add-to-cart').length !== 0;
                });
                this.variants[value].available = itemIsAvailable;

                if (itemIsAvailable) {
                    await this.page.evaluate(() => {
                        document.querySelector(`#add-to-cart`).click();
                    });
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
            await this.fillShippingInfos();
            await this.page.click(`form > div.step__footer > button`);
            await this.page.waitFor(2000);

            const shippingPrice = await this.page.evaluate(() => {
                const nodes = Array.prototype.slice.call(document.querySelectorAll('label > span.radio__label__accessory > span'));
                const rightPrice = nodes.map(elem => elem.textContent.replace(/\s/g, ''))[1];
                return rightPrice.replace('£', '');
            });

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
            console.log(e);

        }
    }

    async fillShippingInfos() {
        await this.page.type(`#checkout_email`, config.gram.email);
        await this.page.type(`#checkout_shipping_address_first_name`, this.destinationAddress.first_name);
        await this.page.type(`#checkout_shipping_address_last_name`, this.destinationAddress.last_name);
        await this.page.type(`#checkout_shipping_address_address1`, this.destinationAddress.line1);
        await this.page.type(`#checkout_shipping_address_address2`, this.destinationAddress.line2);
        await this.page.type(`#checkout_shipping_address_city`, this.destinationAddress.city);
        await this.page.type(`#checkout_shipping_address_zip`, this.destinationAddress.zip);
        await this.page.type(`#checkout_shipping_address_phone`, config.gram.phone);
    }
}
