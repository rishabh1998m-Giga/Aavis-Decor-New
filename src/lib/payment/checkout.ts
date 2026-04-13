import { createRazorpayOrder } from './razorpay';

interface PaymentData {
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
}

export async function initiatePayment(
  amount: number,
  orderId: string,
  customerName: string
): Promise<boolean> {
  try {
    // 1. Create Razorpay order
    const order = await createRazorpayOrder(amount);
    
    // 2. Load Razorpay Checkout
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);

    // 3. Configure payment options
    const options: PaymentData = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID!,
      amount: order.amount,
      currency: order.currency,
      name: 'Aavis Decor',
      description: `Order #${orderId}`,
      order_id: order.id,
      handler: async (response: any) => {
        // 4. Verify payment signature
        const verification = await verifyPaymentSignature(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature
        );
        
        if (verification.success) {
          // Notify backend to process order
          await fetch('/api/orders/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });
          return true;
        }
        return false;
      },
      prefill: {
        name: customerName,
        email: '', // Will be filled by user
        contact: '' // Will be filled by user
      },
      theme: {
        color: '#6366f1' // Indigo-500
      }
    };

    // @ts-ignore
    const rzp = new window.Razorpay(options);
    rzp.open();
    
    return true;
  } catch (error) {
    console.error('Payment initiation failed:', error);
    return false;
  }
}

async function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<{ success: boolean }> {
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, paymentId, signature })
  });
  
  return response.json();
}