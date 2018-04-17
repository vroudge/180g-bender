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
        let things = [];
        try {
            const {variants, bro} = this;
            logger.nfo('Begin coldcuts bender', this.variants);

            const queriedVariants = await Promise.all(
                _.map(this.variants, (variant, variantId) => this.createPageAndAddToCart(variantId, variant))
            );

            const allUnavailable = _.filter(this.variants, 'available').length === 0;

            if (allUnavailable) {
                return {type: 'all-unavailable', retailerId: this.retailerId, variants};
            }
            this.page = await this.bro.newPage();
            await this.page.waitFor(1000);
            things.push('Done availability');
            await this.page.goto(`https://www.coldcutshotwax.uk/checkout`);
            things.push('Done gotocheckout');
            await this.fillShippingInfos();
            things.push('Done filling shipping');
            await this.page.click(`form > div.step__footer > button`);
            things.push('Done clicking form step button');
            await this.page.waitForSelector(`label > span.radio__label__accessory > span`);
            things.push('Done before shipping price');
            const shippingPriceRaw = await this.page.evaluate(() => {
                return document.querySelectorAll('label > span.radio__label__accessory > span')[1].textContent;
            });
            things.push('Done getting shipping price');
            const shippingPrice = shippingPriceRaw.replace(/\s/g, '').replace(`£`, ``);

            logger.nfo('End coldcuts bender', this.variants);

            if (checkout) {
                await this.page.click(`div.section--shipping-method > div.section__content > fieldset > div:nth-child(3) > div.radio-wrapper > div.radio__input > input`);
                await this.page.click(`div.step__footer > button`);
                await this.page.waitForSelector(`iframe.card-fields-iframe`);
                await this.page.waitFor(10000);
                await this.getAllPaymentFields();
                await this.page.click(`#checkout_different_billing_address_true`);
                await this.fillBillingInfos();
                await this.page.click(`button.step__footer__continue-btn.btn`);

                if (process.env.NODE_ENV === 'production') {
                    await this.page.waitForSelector(`body > div.content > div > div.main > div.main__content > div > form > div > button`);
                    await this.page.waitFor(3000);
                    await this.page.click(`body > div.content > div > div.main > div.main__content > div > form > div > button`);
                }

                await this.page.waitFor(8000);
                await this.page.close();
                return {type: 'checkout', value: 'success'}
            } else {
                await this.page.close();
                return {
                    type: 'shipping',
                    retailerId: this.retailerId,
                    shipping: {price: parseFloat(shippingPrice), currency: 'gbp'},
                    variants
                };
            }
        } catch (e) {
            logger.err('Error in colducts bender', {things});
            throw e;
        }
    }

    async createPageAndAddToCart(variantIndex, variant) {
        const page = await this.bro.newPage();

        page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().includes('.png')
                || request.url().includes('.jpg')
                || request.url().includes('.gif')
                || request.url().includes('.woff')
                || request.url().includes('twitter')
                || request.url().includes('facebook')
                || request.url().includes('beeketing'))
                request.abort();
            else
                request.continue();
        });
        await page.goto(variant.shopId);

        await page.waitFor(1000);
        const itemIsAvailable = await page.evaluate(() => {
            return document.querySelectorAll('#add-to-cart').length !== 0;
        });

        this.variants[variantIndex].available = itemIsAvailable;

        if (itemIsAvailable) {
            await page.evaluate(() => {
                document.querySelector(`#add-to-cart`).click();
            });
            await page.waitFor(1000);
        }

        return itemIsAvailable;
    }

    async getAllPaymentFields() {
        //get multiple iframes, since every field is a different iframe, WTF..
        const rawIframeNames = await this.page.evaluate(() => {
            const frames = [];
            const iframes = document.querySelectorAll(`.card-fields-iframe`);
            for (let i = 0; i < iframes.length; i++) {
                if (iframes[i].name.includes('card-field')) {
                    frames.push(`${iframes[i].name}`)
                }
            }
            return frames;
        });

        const frameNames = {
            number: {label: '', value: config.finance.ccNumber},
            expiry: {label: '', value: `${config.finance.expiryMonth}${config.finance.expiryYearShort}`},
            name: {label: '', value: config.finance.ccFullName},
            verificationValue: {label: '', value: config.finance.cvv},
        };

        _.each(rawIframeNames, (frame) => {
            if (frame.includes('number')) {
                frameNames.number.label = frame;
            } else if (frame.includes('expiry')) {
                frameNames.expiry.label = frame;
            } else if (frame.includes('name')) {
                frameNames.name.label = frame;
            } else if (frame.includes('verification_value')) {
                frameNames.verificationValue.label = frame;
            }
        });

        const frameObjects = await _.reduce(frameNames, async (pAcc, elem, key) => {
            const acc = await pAcc;
            if (!acc[key]) {
                acc[key] = {...frameNames[key]};
                acc[key].ctx = await this.page.frames().find(f => f.name() === elem.label)
            }
            return acc;
        }, Promise.resolve({}));

        await this.fillPaymentInfo(frameObjects.number, `#number`);
        await this.fillPaymentInfo(frameObjects.name, `#name`);
        await this.fillPaymentInfo(frameObjects.expiry, `#expiry`);
        await this.fillPaymentInfo(frameObjects.verificationValue, `#verification_value`);
    }

    async fillPaymentInfo(frameObject, fieldId) {
        const element = await frameObject.ctx.$(fieldId);
        await element.type(frameObject.value);
    }

    async fillBillingInfos() {
        await this.page.type(`#checkout_billing_address_first_name`, config.gram.firstName);
        await this.page.type(`#checkout_billing_address_last_name`, config.gram.lastName);
        await this.page.type(`#checkout_billing_address_company`, config.gram.companyName);
        await this.page.type(`#checkout_billing_address_address1`, config.gram.address);
        await this.page.type(`#checkout_billing_address_city`, config.gram.city);
        await this.page.type(`#checkout_billing_address_zip`, config.gram.zip);
        await this.page.type(`#checkout_billing_address_phone`, config.gram.phone);

        /*        await this.page.evaluate((country) => {
                    document.querySelector(`#checkout_billing_address_country > option[data-code="${config.gram.countryCode.toUpperCase()}"]`).selected = true;
                    document.querySelector('#checkout_billing_address_country').dispatchEvent(new Event('change', {'bubbles': true}));
                }, this.destinationAddress.country);*/
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
