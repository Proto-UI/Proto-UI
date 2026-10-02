import fs from 'node:fs';
import {
  MAX_PUBLISHED_REVIEW_PACKET_BYTES,
  validatePublishedReviewPacket,
} from './review-runtime.mjs';

// This reads bounded content only. Authority comes from the matching packet and
// evidence tokens in the same eligible live approval, not from this local file.
export function readPublishedReviewPacket(path, packet) {
  if (typeof path !== 'string' || !path)
    throw new Error('--published-review-packet is required for merge-pull-request');
  // POSIX FIFOs must not wait for a writer before the descriptor type check.
  // Node does not expose O_NONBLOCK on Windows; preserve its standard open
  // semantics there and always validate the actual opened descriptor.
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0);
  const descriptor = fs.openSync(path, flags);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error('published review packet must be a regular file');
    if (stat.size > MAX_PUBLISHED_REVIEW_PACKET_BYTES)
      throw new Error(
        `published review packet exceeds the ${MAX_PUBLISHED_REVIEW_PACKET_BYTES}-byte bound`
      );
    // Read at most the observed size plus one byte. A concurrent size change
    // fails closed without allocating or reading an unbounded growing file.
    const buffer = Buffer.allocUnsafe(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(descriptor, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length !== stat.size)
      throw new Error('published review packet changed size while it was read');
    let publishedPacket;
    try {
      publishedPacket = JSON.parse(buffer.subarray(0, length).toString('utf8'));
    } catch {
      throw new Error('published review packet must contain valid JSON');
    }
    return validatePublishedReviewPacket(packet, publishedPacket);
  } finally {
    fs.closeSync(descriptor);
  }
}
