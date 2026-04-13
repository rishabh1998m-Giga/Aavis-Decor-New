import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: import.meta.env.VITE_RAZORPAY_KEY_ID!,
  key_secret: import.meta.env.VITE_RAZORPAY_KEY_SECRET!,
});

export async function createRazorpayOrder(amount: number, currency: string = 'INR') {
  const options = {
    amount: amount * 100, // Razorpay expects paise
    currency,
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw new Error('Payment gateway error');
  }
}