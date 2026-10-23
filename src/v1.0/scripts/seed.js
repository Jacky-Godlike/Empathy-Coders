/**
 * Ensure the runtime data exists and the demo orders are seeded.
 * Safe to run repeatedly: it only seeds when the runtime has no orders.
 */
import { createApplication } from '../server/bootstrap.js';

const { services } = await createApplication();
const stats = await services.orderService.stats();
console.log('OrderPilot seed ready');
console.log(JSON.stringify(stats, null, 2));
