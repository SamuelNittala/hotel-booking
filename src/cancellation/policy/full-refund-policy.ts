import { CancellationContext, RefundPolicy } from '../refund-policy';

export class FullRefundPolicy implements RefundPolicy {
  refundFor({ paidAmount }: CancellationContext): number {
    return paidAmount;
  }
}
