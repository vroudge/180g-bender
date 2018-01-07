import config from '../../config';

export default class Juno {
    constructor(browserInstance, {variants, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;

        this.page = await bro.newPage();

        try {
            for (const variant of variants) {
                console.log(`juno open ${variant}`);

                await this.page.goto(variant);
                await this.page.click('.btn.btn-cta.mb-2.ml-2');
            }

            await this.page.goto('https://www.juno.co.uk/cart/');
            await this.page.select('select.delivery_country', `75`);
            await this.page.click('#cart_table_container > form:nth-child(3) > div > div:nth-child(2) > div > input');
            await this.page.waitForSelector(`#shipping_val`);

            const shippingPriceRaw = await this.page.evaluate(() => {
                return document.querySelectorAll(`#shipping_val`)[0].textContent;
            });

            if (checkout) {
                await this.login();
                await this.fillShippingInfo();
            } else {
                return {type: 'shipping', value: shippingPriceRaw};
            }

        } catch (e) {
            return new Error(e);
        }
    }

    async login() {
        await this.page.goto('https://www.juno.co.uk/login/?redir=checkout');
        await this.page.waitForSelector(`#email`);
        await this.page.type(`#email`, config.accounts.juno.login);
        await this.page.type(`#password`, config.accounts.juno.password);
        await this.page.click('#login-form > tbody > tr:nth-child(4) > td.input > input');
        console.log('done login juno');
    }

    async fillShippingInfo() {
        await this.page.waitForSelector(`#first_name`);

        await this.fillField(`#first_name`, this.destinationAddress.first_name);
        await this.fillField(`#last_name`, this.destinationAddress.last_name);
        await this.fillField(`#address1`, this.destinationAddress.line1);
        await this.fillField(`#address2`, this.destinationAddress.line2);
        await this.fillField(`#town_city`, this.destinationAddress.city);
        await this.fillField(`#state_county`, this.destinationAddress.state);
        await this.fillField(`#postcode`, this.destinationAddress.zip);
        await this.fillField(`#cvv`, config.finance.cvv);
        console.log('done fill shipping juno');
    }

    async fillField(selector, value) {
        await this.page.$eval(selector, input => input.value = '');
        await this.page.type(selector, value);
    }
}
