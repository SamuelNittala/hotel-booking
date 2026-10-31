import { IdGenerator } from './id-generator';

/** Counts up from 1. Ids are unique within one running process only. */
export class SequentialIdGenerator implements IdGenerator {
  private lastId = 0;

  next(): number {
    return ++this.lastId;
  }
}
