import { InvalidPaymentError, UnsupportedPaymentMethodError } from '../errors';
import { PaymentMethod } from './payment-method';

/** Finds a payment method by the name stored on a `Payment`. Supporting a new method is one `register` call. */
export class PaymentMethodRegistry {
  private readonly methodsByName = new Map<string, PaymentMethod>();

  constructor(methods: readonly PaymentMethod[] = []) {
    methods.forEach((method) => this.register(method));
  }

  register(method: PaymentMethod): void {
    if (this.methodsByName.has(method.name)) {
      throw new InvalidPaymentError(`Payment method '${method.name}' is already registered`);
    }
    this.methodsByName.set(method.name, method);
  }

  get(name: string): PaymentMethod {
    const method = this.methodsByName.get(name);
    if (!method) {
      throw new UnsupportedPaymentMethodError(name);
    }
    return method;
  }
}
