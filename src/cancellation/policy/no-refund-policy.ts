import { RefundPolicy } from '../refund-policy';

/** Never pays anything back. */
export class NoRefundPolicy implements RefundPolicy {
  refundFor(): number {
    return 0;
  }
}
