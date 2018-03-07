import config from '../../config';
import _ from 'lodash';

export default class misbits {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
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

        for (const [value, index] of variants.entries()) {
            await this.page.goto(index.shopId);

            const itemIsAvailable = await this.page.evaluate(() => {
                return document.querySelectorAll(`p.stock.in-stock`).length > 0;
            });
            this.variants[value].available = itemIsAvailable;

            if (itemIsAvailable) {
                await this.page.click('button.single_add_to_cart_button');
                await this.page.waitForSelector(`#content > div.woo-wrapper > div > div > div.woocommerce-message`);
            } else {
                const allUnavailable = _.filter(variants, 'available').length === 0;
                const endOfArray = value + 1 === variants.length;

                if (endOfArray && allUnavailable) {
                    return {type: 'all-unavailable', retailerId: this.retailerId, variants};
                }
            }
        }

        await this.page.goto('https://www.misbits.ro/cart/');
        await this.page.waitForSelector(`a.shipping-calculator-button`);
        await this.page.click('a.shipping-calculator-button');
        await this.page.waitForSelector(`#calc_shipping_country`);
        await this.page.select(`#calc_shipping_country`, this.destinationAddress.country.toUpperCase());
        await this.page.type(`#calc_shipping_postcode`, this.destinationAddress.zip);
        await this.page.waitForSelector('tr.shipping > td > form > section > p:nth-child(5) > button');
        await this.page.click(`tr.shipping > td > form > section > p:nth-child(5) > button`);
        await this.page.waitForSelector(`tr.shipping > td > span.amount`);

        const shippingPrice = await this.page.evaluate(() => {
            return document.querySelector(`tr.shipping > td > span.amount`).textContent.replace('lei', '').replace(/\s/g, '');
        });

        if (checkout) {
            await this.page.goto(`https://www.misbits.ro/checkout/`);
            await this.login();
            await this.fillShippingAndBillingInfo();
            await this.page.evaluate(() => {
                document.querySelector(`#place_order`).click()
            });
            await this.page.waitForSelector(`a.txtCheckout`);
            await this.page.click(`a.txtCheckout`);
            await this.fillPaymentInfo();
            if (process.env.NODE_ENV === 'production') {
                await this.page.click(`#button_status`);
                await this.page.waitFor(8000);
            }
            return {type: 'checkout', value: 'success'}
        } else {
            return {
                type: 'shipping',
                retailerId: this.retailerId,
                shipping: {price: shippingPrice, currency: 'ron'},
                variants
            };
        }
    }

    async login() {
        await this.page.waitForSelector([
            '#billing_first_name',
            '#billing_last_name',
            '#billing_company',
            '#billing_address_1',
            '#billing_city',
            '#billing_phone',
            '#billing_email',
            '#account_password',
            '#shipping_first_name',
            '#shipping_last_name',
            '#shipping_address_1',
            '#shipping_address_2',
            '#shipping_city',
        ]);

        await this.page.click(`.showlogin`);
        await this.page.type(`#username`, config.accounts.misbits.login);
        await this.page.type(`#password`, config.accounts.misbits.password);
        await this.page.click(`#post-42 > div > form.woocommerce-form.woocommerce-form-login.login > p:nth-child(5) > button`);
        await this.page.waitFor(3000);
    }

    async fillShippingAndBillingInfo() {
        await this.fillField(`#billing_first_name`, config.gram.firstName);
        await this.fillField(`#billing_last_name`, config.gram.lastName);
        await this.fillField(`#billing_company`, config.gram.companyName);
        await this.fillField(`#billing_address_1`, config.gram.address);
        await this.fillField(`#billing_city`, config.gram.city);
        await this.fillField(`#billing_phone`, config.gram.phone);

        await this.fillField(`#shipping_first_name`, this.destinationAddress.first_name);
        await this.fillField(`#shipping_last_name`, this.destinationAddress.last_name);
        await this.fillField(`#shipping_address_1`, this.destinationAddress.line1);
        await this.fillField(`#shipping_address_2`, this.destinationAddress.line2);
        await this.fillField(`#shipping_city`, this.destinationAddress.city);
    }

    async fillPaymentInfo() {
        await this.page.waitForSelector([
            '#card',
            '#exp_month',
            '#exp_year',
            '#cvv2',
            '#name_on_card',
        ]);
        await this.fillField(`#card`, config.finance.ccNumber);
        await this.page.select(`#exp_month`, config.finance.expiryMonth);
        await this.page.select(`#exp_year`, config.finance.expiryYearShort);
        await this.fillField(`#cvv2`, config.finance.cvv);
        await this.fillField(`#name_on_card`, config.finance.ccFullName);
    }

    async fillField(selector, value) {
        await this.page.waitFor(selector);
        await this.page.$eval(selector, input => input.value = '');
        await this.page.type(selector, value);
    }
}
