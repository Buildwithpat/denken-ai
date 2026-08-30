import Razorpay from 'razorpay';
import type { Orders } from 'razorpay/dist/types/orders';
import { env } from '../config/env';

// Emit a startup diagnostic so Render logs immediately show credential state.
const _keyPresent    = Boolean(env.RAZORPAY_KEY_ID);
const _secretPresent = Boolean(env.RAZORPAY_KEY_SECRET);
const _keyPrefix     = env.RAZORPAY_KEY_ID ? env.RAZORPAY_KEY_ID.slice(0, 14) + '…' : '(not set)';
console.info(`[razorpay] key_id=${_keyPrefix}  key_present=${_keyPresent}  secret_present=${_secretPresent}`);

let _instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.');
  }
  if (!_instance) {
    _instance = new Razorpay({
      key_id:     env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return _instance;
}

export const razorpay = {
  orders: {
    create: (params: Orders.RazorpayOrderCreateRequestBody): Promise<Orders.RazorpayOrder> =>
      getRazorpay().orders.create(params),
    fetch: (orderId: string): Promise<Orders.RazorpayOrder> =>
      getRazorpay().orders.fetch(orderId),
  },
};
