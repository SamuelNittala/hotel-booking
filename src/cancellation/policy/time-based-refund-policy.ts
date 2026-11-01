import { daysBetween } from "../../shared/date-utils";
import { InvalidRefundPolicyError } from "../errors";
import { CancellationContext, RefundPolicy } from "../refund-policy";

export type RefundTier = {
  minDaysBeforeCheckIn: number;
  refundPercent: number;
};

export class TimeBasedRefundPolicy implements RefundPolicy {
  private readonly tiers: readonly RefundTier[];

  constructor(tiers: readonly RefundTier[]) {
    const seen = new Set<number>();
    for (const tier of tiers) {
      if (
        !Number.isFinite(tier.minDaysBeforeCheckIn) ||
        tier.minDaysBeforeCheckIn < 0
      ) {
        throw new InvalidRefundPolicyError(
          `minDaysBeforeCheckIn must be zero or more (got ${tier.minDaysBeforeCheckIn})`,
        );
      }
      if (
        !Number.isFinite(tier.refundPercent) ||
        tier.refundPercent < 0 ||
        tier.refundPercent > 100
      ) {
        throw new InvalidRefundPolicyError(
          `refundPercent must be from 0 to 100 (got ${tier.refundPercent})`,
        );
      }
      if (seen.has(tier.minDaysBeforeCheckIn)) {
        throw new InvalidRefundPolicyError(
          `two tiers start at ${tier.minDaysBeforeCheckIn} days`,
        );
      }
      seen.add(tier.minDaysBeforeCheckIn);
    }
    this.tiers = [...tiers].sort(
      (a, b) => b.minDaysBeforeCheckIn - a.minDaysBeforeCheckIn,
    );
  }

  static standard(): TimeBasedRefundPolicy {
    return new TimeBasedRefundPolicy([
      { minDaysBeforeCheckIn: 7, refundPercent: 100 },
      { minDaysBeforeCheckIn: 2, refundPercent: 50 },
    ]);
  }

  refundFor({ booking, paidAmount, cancelledAt }: CancellationContext): number {
    const cancelledOn = cancelledAt.toISOString().slice(0, 10);
    const daysBefore = daysBetween(cancelledOn, booking.dateRange.fromDate);
    const tier = this.tiers.find(
      (candidate) => daysBefore >= candidate.minDaysBeforeCheckIn,
    );
    if (!tier) {
      return 0;
    }
    return Math.round(paidAmount * tier.refundPercent) / 100; // to the nearest 0.01
  }
}
