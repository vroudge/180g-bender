import config from '../../config';
import _ from 'lodash';

export default class emile {
    constructor(browserInstance, {variants, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {

    }
}
